import { google } from 'googleapis'
import { createAdminClient } from '@/lib/supabase/admin'
import { getGoogleClientWithToken } from '@/lib/google/client'
import { escapeSlackText, renderTemplate, DEFAULT_SMS_MESSAGE } from './templates'
import { callTemplateVars } from './call-vars'
import { createLogger } from '@/lib/observability/logger'
import { callerMessageSms } from '@/lib/sms/templates'
import { sendTransactionalSms, type SmsFailure } from '@/lib/sms/sender'

// ─── Types ──────────────────────────────────────────────────────────────────

type TriggerType =
  | 'call_ended'
  | 'call_missed'
  | 'sentiment_negative'
  | 'keyword_detected'

type ActionType =
  | 'send_email'
  | 'add_to_sheet'
  | 'create_calendar_event'
  | 'send_webhook'
  | 'create_doc'
  | 'notify_slack'
  | 'add_tag'
  | 'wait'
  | 'send_sms'

interface WorkflowAction {
  id: string
  type: ActionType
  config: Record<string, string>
}

interface Workflow {
  id: string
  org_id: string
  trigger: TriggerType
  trigger_config: Record<string, string>
  actions: WorkflowAction[]
  enabled: boolean
}

export interface CallContext {
  call_id?: string
  org_id: string
  conversation_id: string
  caller_number: string | null
  direction: string
  duration_seconds: number
  status: string
  sentiment: string | null
  summary: string | null
  transcript: Array<{ role: string; message: string }>
  agent_name?: string
  started_at: string
  // Post-call analysis (lib/voice-providers/call-store.ts triggerWorkflowsOnce).
  ended_at?: string | null
  from_number?: string | null
  to_number?: string | null
  /** The AI's verdict on the call's goal: success | failure | unknown. */
  call_successful?: string | null
  outcome?: string | null
  summary_title?: string | null
  /** Data-collection values by field id (caller_name, callback_number, reason_for_call, custom fields). */
  collected?: Record<string, string>
  business_name?: string | null
  /** Organization time zone for {{date}} / {{time}}. */
  timezone?: string | null
}

interface ActionResult {
  action_id: string
  action_type: string
  success: boolean
  message: string
}

// ─── Template interpolation ─────────────────────────────────────────────────

/**
 * Every documented variable ({{caller_number}}, {{outcome}}, {{caller_name}},
 * {{intent}}, {{agent_name}}, {{business_name}}, {{call_id}}, …, old aliases
 * such as {{caller}}) plus each data-collection field by id. Unknown names
 * render as '' so no literal "{{…}}" ever reaches an email or a document.
 */
export function interpolate(template: string, ctx: CallContext, opts?: { escape?: (value: string) => string }): string {
  return renderTemplate(template, callTemplateVars(ctx), opts)
}

// ─── Action executors ───────────────────────────────────────────────────────

async function executeSendWebhook(
  config: Record<string, string>,
  ctx: CallContext
): Promise<ActionResult> {
  const url = interpolate(config.url ?? '', ctx)
  if (!url) return { action_id: '', action_type: 'send_webhook', success: false, message: 'No webhook URL configured' }

  try {
    const payload = {
      event: 'workflow_triggered',
      call: {
        id: ctx.call_id,
        conversation_id: ctx.conversation_id,
        caller_number: ctx.caller_number,
        direction: ctx.direction,
        duration_seconds: ctx.duration_seconds,
        status: ctx.status,
        sentiment: ctx.sentiment,
        summary: ctx.summary,
        started_at: ctx.started_at,
        // Post-call analysis (additive fields).
        ended_at: ctx.ended_at ?? null,
        outcome: ctx.outcome ?? null,
        ai_outcome: ctx.call_successful ?? null,
        summary_title: ctx.summary_title ?? null,
        collected: ctx.collected ?? {},
      },
      timestamp: new Date().toISOString(),
    }

    const method = (config.method ?? 'POST').toUpperCase()
    const res = await fetch(url, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })

    return {
      action_id: '',
      action_type: 'send_webhook',
      success: res.ok,
      message: res.ok ? `Webhook sent (${res.status})` : `Webhook failed (${res.status})`,
    }
  } catch (err) {
    return {
      action_id: '',
      action_type: 'send_webhook',
      success: false,
      message: `Webhook error: ${err instanceof Error ? err.message : 'unknown'}`,
    }
  }
}

async function executeAddTag(
  config: Record<string, string>,
  ctx: CallContext
): Promise<ActionResult> {
  const tag = interpolate(config.tag ?? '', ctx)
  if (!tag || !ctx.call_id) {
    return { action_id: '', action_type: 'add_tag', success: false, message: 'No tag or call_id' }
  }

  try {
    const supabase = createAdminClient()
    // Tags are stored in the call's metadata — we use summary field as a lightweight approach
    // In the future, a dedicated tags column or table could be used
    const { data: call } = await supabase
      .from('calls')
      .select('summary')
      .eq('id', ctx.call_id)
      .single()

    const existingSummary = call?.summary ?? ''
    const tagLine = `[tag:${tag}]`
    if (!existingSummary.includes(tagLine)) {
      await supabase
        .from('calls')
        .update({ summary: existingSummary ? `${existingSummary} ${tagLine}` : tagLine })
        .eq('id', ctx.call_id)
    }

    return { action_id: '', action_type: 'add_tag', success: true, message: `Tag "${tag}" added` }
  } catch {
    return { action_id: '', action_type: 'add_tag', success: false, message: 'Failed to add tag' }
  }
}

async function executeWait(config: Record<string, string>): Promise<ActionResult> {
  const seconds = Math.min(Number(config.seconds ?? config.duration ?? 5), 30)
  await new Promise((resolve) => setTimeout(resolve, seconds * 1000))
  return { action_id: '', action_type: 'wait', success: true, message: `Waited ${seconds}s` }
}

// ─── Google / Slack integration actions ───────────────────────────────────────

// Resolves an authenticated Google client for the org's connected integration,
// or null when that integration isn't connected. Uses the service-role client
// because workflows run in a webhook (no-user) context.
async function getGoogleAuth(orgId: string, type: string) {
  const supabase = createAdminClient()
  const { data } = await supabase
    .from('integrations')
    .select('google_refresh_token, is_active')
    .eq('org_id', orgId)
    .eq('type', type)
    .maybeSingle()

  if (!data || !data.is_active || !data.google_refresh_token) return null
  return getGoogleClientWithToken(data.google_refresh_token as string)
}

function defaultCallReport(ctx: CallContext): string {
  return [
    'Call report',
    '',
    `Caller: ${ctx.caller_number ?? 'Unknown'}`,
    `Direction: ${ctx.direction}`,
    `Duration: ${ctx.duration_seconds}s`,
    `Sentiment: ${ctx.sentiment ?? 'unknown'}`,
    '',
    'Summary:',
    ctx.summary ?? '(no summary)',
  ].join('\n')
}

async function executeSendEmail(config: Record<string, string>, ctx: CallContext): Promise<ActionResult> {
  const base = { action_id: '', action_type: 'send_email' }
  const auth = await getGoogleAuth(ctx.org_id, 'gmail')
  if (!auth) return { ...base, success: false, message: 'Gmail is not connected' }

  const to = interpolate(config.to ?? '', ctx)
  if (!to) return { ...base, success: false, message: 'No recipient configured' }
  const subject = interpolate(config.subject ?? 'Call follow-up', ctx)
  const body = interpolate(config.body ?? config.message ?? defaultCallReport(ctx), ctx)

  try {
    const gmail = google.gmail({ version: 'v1', auth })
    const raw = Buffer.from(
      `To: ${to}\r\nSubject: ${subject}\r\nContent-Type: text/plain; charset="UTF-8"\r\n\r\n${body}`
    ).toString('base64url')
    await gmail.users.messages.send({ userId: 'me', requestBody: { raw } })
    return { ...base, success: true, message: `Email sent to ${to}` }
  } catch (err) {
    return { ...base, success: false, message: `Gmail error: ${err instanceof Error ? err.message : 'unknown'}` }
  }
}

async function executeAddToSheet(config: Record<string, string>, ctx: CallContext): Promise<ActionResult> {
  const base = { action_id: '', action_type: 'add_to_sheet' }
  const auth = await getGoogleAuth(ctx.org_id, 'google_sheets')
  if (!auth) return { ...base, success: false, message: 'Google Sheets is not connected' }

  const spreadsheetId = config.spreadsheet_id ?? config.sheet_id ?? ''
  if (!spreadsheetId) return { ...base, success: false, message: 'No spreadsheet configured' }

  try {
    const sheets = google.sheets({ version: 'v4', auth })
    await sheets.spreadsheets.values.append({
      spreadsheetId,
      range: config.range ?? 'A:Z',
      valueInputOption: 'USER_ENTERED',
      requestBody: {
        values: [[
          ctx.started_at,
          ctx.caller_number ?? '',
          ctx.direction,
          String(ctx.duration_seconds),
          ctx.sentiment ?? '',
          ctx.summary ?? '',
        ]],
      },
    })
    return { ...base, success: true, message: 'Row appended to sheet' }
  } catch (err) {
    return { ...base, success: false, message: `Sheets error: ${err instanceof Error ? err.message : 'unknown'}` }
  }
}

async function executeCreateCalendarEvent(config: Record<string, string>, ctx: CallContext): Promise<ActionResult> {
  const base = { action_id: '', action_type: 'create_calendar_event' }
  const auth = await getGoogleAuth(ctx.org_id, 'google_calendar')
  if (!auth) return { ...base, success: false, message: 'Google Calendar is not connected' }

  try {
    const calendar = google.calendar({ version: 'v3', auth })
    const start = new Date(Date.now() + 24 * 60 * 60 * 1000)
    const durationMin = Number(config.duration_minutes ?? 30)
    const end = new Date(start.getTime() + durationMin * 60 * 1000)
    await calendar.events.insert({
      calendarId: config.calendar_id ?? 'primary',
      requestBody: {
        summary: interpolate(config.title ?? config.summary ?? 'Follow-up call', ctx),
        description: interpolate(config.description ?? ctx.summary ?? '', ctx),
        start: { dateTime: start.toISOString() },
        end: { dateTime: end.toISOString() },
      },
    })
    return { ...base, success: true, message: 'Calendar event created' }
  } catch (err) {
    return { ...base, success: false, message: `Calendar error: ${err instanceof Error ? err.message : 'unknown'}` }
  }
}

async function executeCreateDoc(config: Record<string, string>, ctx: CallContext): Promise<ActionResult> {
  const base = { action_id: '', action_type: 'create_doc' }
  const auth = await getGoogleAuth(ctx.org_id, 'google_docs')
  if (!auth) return { ...base, success: false, message: 'Google Docs is not connected' }

  try {
    const docs = google.docs({ version: 'v1', auth })
    const title = interpolate(config.title ?? `Call report ${ctx.conversation_id}`, ctx)
    const content = interpolate(config.content ?? defaultCallReport(ctx), ctx)
    const created = await docs.documents.create({ requestBody: { title } })
    const documentId = created.data.documentId
    if (documentId && content) {
      await docs.documents.batchUpdate({
        documentId,
        requestBody: { requests: [{ insertText: { location: { index: 1 }, text: content } }] },
      })
    }
    return { ...base, success: true, message: 'Doc created' }
  } catch (err) {
    return { ...base, success: false, message: `Docs error: ${err instanceof Error ? err.message : 'unknown'}` }
  }
}

/**
 * Slack text when the action has no message: variables only (so call data is
 * escaped for Slack), with the AI outcome when the call has one
 * (calls.sentiment is only set on older rows).
 */
export function defaultSlackTemplate(ctx: Pick<CallContext, 'call_successful' | 'sentiment'>): string {
  const verdict = ctx.call_successful ? ' (AI outcome: {{ai_outcome}})' : ctx.sentiment ? ' ({{sentiment}})' : ''
  return `:telephone_receiver: {{direction}} call from {{caller_number}}${verdict}. {{summary}}`
}

async function executeNotifySlack(config: Record<string, string>, ctx: CallContext): Promise<ActionResult> {
  const base = { action_id: '', action_type: 'notify_slack' }
  const url = config.webhook_url ?? config.url ?? ''
  if (!url) return { ...base, success: false, message: 'No Slack webhook URL configured' }

  try {
    const text = interpolate(config.message ?? defaultSlackTemplate(ctx), ctx, { escape: escapeSlackText })
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text }),
    })
    return { ...base, success: res.ok, message: res.ok ? 'Slack notified' : `Slack failed (${res.status})` }
  } catch (err) {
    return { ...base, success: false, message: `Slack error: ${err instanceof Error ? err.message : 'unknown'}` }
  }
}

// ─── Text the caller (send_sms) ──────────────────────────────────────────────

/** Plain-language, final outcome of a text that was not sent (never retried automatically). */
const SMS_FAILURE_MESSAGES: Record<SmsFailure, string> = {
  not_configured: 'Not sent: text messages are not available on this platform.',
  no_sms_number: 'Not sent: your business number cannot send text messages.',
  opted_out: 'Not sent: the caller opted out of text messages.',
  invalid_number: "Not sent: the caller's number cannot receive text messages.",
  daily_cap: 'Not sent: the daily limit of text messages was reached.',
  recipient_cap: 'Not sent: this caller already received the maximum number of texts today.',
  empty: 'Not sent: the message is empty.',
  failed: 'Not sent: the text could not be delivered.',
}

/**
 * Texts the other party of the call (from the stored call row, never from
 * the workflow config) from the org's own SMS-capable number. Transactional
 * only: the owner's message, signed with the business name. Never for test
 * calls or calls marked as spam.
 */
async function executeSendSms(config: Record<string, string>, ctx: CallContext, idempotencyKey: string): Promise<ActionResult> {
  const base = { action_id: '', action_type: 'send_sms' }
  if (!ctx.call_id) return { ...base, success: false, message: 'Not sent: no call to reply to.' }
  const log = createLogger({ component: 'workflow_sms', orgId: ctx.org_id, callId: ctx.call_id })
  const db = createAdminClient()
  try {
    const { data: call, error } = await db
      .from('calls')
      .select('id, direction, from_number, to_number, caller_number, phone_number_id, outcome, is_test')
      .eq('id', ctx.call_id)
      .eq('org_id', ctx.org_id)
      .maybeSingle()
    if (error) throw new Error(`calls read failed: ${error.message}`)
    if (!call) return { ...base, success: false, message: 'Not sent: the call was not found.' }
    if (call.is_test) return { ...base, success: false, message: 'Not sent: test calls never text anyone.' }
    if (call.outcome === 'spam') return { ...base, success: false, message: 'Not sent: the call was marked as spam.' }
    const to = (call.direction === 'outbound' ? call.to_number : call.from_number ?? call.caller_number) as string | null
    if (!to) return { ...base, success: false, message: "Not sent: the caller's number is unknown." }
    const text = interpolate(config.message || DEFAULT_SMS_MESSAGE, ctx)
    const body = callerMessageSms({ businessName: ctx.business_name ?? null, message: text })
    const result = await sendTransactionalSms({
      db,
      log,
      orgId: ctx.org_id,
      callId: ctx.call_id,
      preferredNumberId: (call.phone_number_id as string | null) ?? null,
      to,
      body,
      idempotencyKey,
    })
    if (result.ok) return { ...base, success: true, message: result.duplicate ? 'Text already sent for this call' : 'Text sent to the caller' }
    return { ...base, success: false, message: SMS_FAILURE_MESSAGES[result.reason] }
  } catch (err) {
    log.error('workflow.sms_failed', err)
    return { ...base, success: false, message: SMS_FAILURE_MESSAGES.failed }
  }
}

async function executeAction(
  action: WorkflowAction,
  ctx: CallContext,
  workflowId?: string
): Promise<ActionResult> {
  let result: ActionResult

  switch (action.type) {
    case 'send_webhook':
      result = await executeSendWebhook(action.config, ctx)
      break
    case 'add_tag':
      result = await executeAddTag(action.config, ctx)
      break
    case 'wait':
      result = await executeWait(action.config)
      break
    case 'send_email':
      result = await executeSendEmail(action.config, ctx)
      break
    case 'add_to_sheet':
      result = await executeAddToSheet(action.config, ctx)
      break
    case 'create_calendar_event':
      result = await executeCreateCalendarEvent(action.config, ctx)
      break
    case 'create_doc':
      result = await executeCreateDoc(action.config, ctx)
      break
    case 'notify_slack':
      result = await executeNotifySlack(action.config, ctx)
      break
    case 'send_sms':
      // One text per workflow step and call, whatever retries happen.
      result = await executeSendSms(action.config, ctx, `wf:${workflowId ?? 'none'}:${action.id}:${ctx.call_id ?? 'none'}`)
      break
    default:
      result = {
        action_id: action.id,
        action_type: action.type,
        success: false,
        message: `Unknown action type: ${action.type}`,
      }
  }

  result.action_id = action.id
  return result
}

// ─── Main executor ──────────────────────────────────────────────────────────

export async function executeWorkflows(
  trigger: TriggerType,
  ctx: CallContext
) {
  const supabase = createAdminClient()

  // Find enabled workflows matching this trigger + org
  const { data: workflows } = await supabase
    .from('workflows')
    .select('*')
    .eq('org_id', ctx.org_id)
    .eq('trigger', trigger)
    .eq('enabled', true)

  if (!workflows || workflows.length === 0) return

  for (const wf of workflows as Workflow[]) {
    // Check trigger_config conditions
    if (trigger === 'keyword_detected' && wf.trigger_config.keyword) {
      const keyword = wf.trigger_config.keyword.toLowerCase()
      const fullTranscript = ctx.transcript.map((t) => t.message).join(' ').toLowerCase()
      if (!fullTranscript.includes(keyword)) continue
    }

    // Create a run record
    const { data: run } = await supabase
      .from('workflow_runs')
      .insert({
        workflow_id: wf.id,
        call_id: ctx.call_id ?? null,
        status: 'running',
      })
      .select('id')
      .single()

    const results: ActionResult[] = []
    let allSuccess = true

    for (const action of wf.actions) {
      const result = await executeAction(action, ctx, wf.id)
      results.push(result)

      if (!result.success) {
        allSuccess = false
        // Stop executing remaining actions on failure
        break
      }
    }

    const runStatus = allSuccess ? 'completed' : 'failed'

    // Update run record
    if (run) {
      await supabase
        .from('workflow_runs')
        .update({
          status: runStatus,
          results,
          completed_at: new Date().toISOString(),
          ...(allSuccess ? {} : { error: results.find((r) => !r.success)?.message }),
        })
        .eq('id', run.id)
    }

    // Increment workflow counters
    await supabase
      .from('workflows')
      .update({
        runs: (wf as unknown as { runs: number }).runs + 1,
        successful_runs: ((wf as unknown as { successful_runs: number }).successful_runs) + (allSuccess ? 1 : 0),
        last_run_at: new Date().toISOString(),
      })
      .eq('id', wf.id)
  }
}
