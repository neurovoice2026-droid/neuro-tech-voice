import 'server-only'
import { randomUUID } from 'node:crypto'
import type { SupabaseClient } from '@supabase/supabase-js'
import { kvIncr } from '@/lib/kv'
import { isE164 } from '@/lib/phone/e164'
import { createAdminClient } from '@/lib/supabase/admin'
import { sendSms } from '@/lib/twilio/sms'
import { findKeywordMatch, parseKeywords } from './keywords'
import { buildWebhookPayload, WEBHOOK_EVENT } from './payload'
import { parseStoredAction, type ActionConfig, type WorkflowAction } from './schemas'
import {
  DEFAULT_SLACK_MESSAGE,
  buildTemplateVars,
  escapeSlackText,
  renderTemplate,
} from './templates'
import { customerWebhookHeaders, deliverJson, describeDelivery } from './webhook'
import {
  appendSheetRow,
  createCallDoc,
  createFollowUpEvent,
  saveTranscriptToDrive,
  sendGmail,
  type StepOutcome,
} from './google'
import { isUuid, loadOrgData, resolveCallData } from './context'
import {
  TESTABLE_ACTION_TYPES,
  customerNumber,
  type ActionResult,
  type CallContext,
  type TriggerType,
  type WorkflowCallData,
  type WorkflowOrgData,
} from './types'

export type { CallContext, TriggerType } from './types'

// Runs the organisation's workflows for one call event. Called after a call
// (post-call finalisation, the ElevenLabs webhook, the Twilio status callback),
// normally inside after(), so nothing here may throw at the caller: every
// failure is logged and written to the run record instead.
//
// - Every matching workflow runs concurrently; the steps of one workflow run
//   in order and stop at the first failure (the rest are recorded as skipped).
// - A workflow runs at most once per call, even if the event is delivered twice.
// - Each run has a time budget so its record is always completed.

/** Per-workflow budget; keeps runs inside a 300 s function even with retries and waits. */
const RUN_BUDGET_MS = 240_000
/** Budget for "Send test" (webhook and Slack only), inside the test route's maxDuration. */
export const TEST_RUN_BUDGET_MS = 45_000
const ONCE_PER_CALL_TTL_SECONDS = 7 * 24 * 3600

export const WORKFLOW_RUN_COLUMNS = 'id, org_id, name, trigger, trigger_config, actions, enabled, signing_secret'

export interface WorkflowRunRecord {
  id: string
  org_id: string
  name: string
  trigger: TriggerType
  trigger_config: { keyword?: string } | null
  actions: unknown
  enabled: boolean
  signing_secret: string | null
}

interface StepEnv {
  admin: SupabaseClient | null
  org: WorkflowOrgData
  /** Mutable per run: a tag added by one step shows up in later steps' data. */
  call: WorkflowCallData
  workflow: WorkflowRunRecord
  trigger: TriggerType
  test: boolean
  deadline: number
}

// ─── Steps ────────────────────────────────────────────────────────────────────

async function runWebhook(config: ActionConfig<'send_webhook'>, env: StepEnv): Promise<StepOutcome> {
  const secret = env.workflow.signing_secret
  if (!secret) {
    console.error('[workflows] workflow has no signing secret', env.workflow.id)
    return { success: false, attempts: 0, message: 'This workflow has no signing secret yet. Open it and create a new secret, then try again.' }
  }
  const deliveryId = randomUUID()
  const body = JSON.stringify(
    buildWebhookPayload({
      call: env.call,
      trigger: env.trigger,
      workflow: { id: env.workflow.id, name: env.workflow.name },
      deliveryId,
      test: env.test,
    })
  )
  const result = await deliverJson({
    url: config.url,
    body,
    deadline: env.deadline,
    headers: (attempt) => customerWebhookHeaders({ body, secret, deliveryId, event: WEBHOOK_EVENT, attempt }),
  })
  return {
    success: result.ok,
    attempts: result.attempts,
    status_code: result.outcome.kind === 'response' ? result.outcome.status : null,
    message: describeDelivery(result, { label: 'Your endpoint', url: config.url }),
  }
}

async function runSlack(config: ActionConfig<'notify_slack'>, env: StepEnv): Promise<StepOutcome> {
  const vars = buildTemplateVars(env.call, env.org)
  const template = config.message?.trim() ? config.message : DEFAULT_SLACK_MESSAGE
  const text = renderTemplate(template, vars, { escape: escapeSlackText }).trim()
  const body = JSON.stringify({ text: env.test ? `[Test] ${text}` : text })
  const result = await deliverJson({
    url: config.webhook_url,
    body,
    deadline: env.deadline,
    headers: () => ({ 'Content-Type': 'application/json' }),
  })
  return {
    success: result.ok,
    attempts: result.attempts,
    status_code: result.outcome.kind === 'response' ? result.outcome.status : null,
    message: result.ok ? 'Message posted to Slack.' : describeDelivery(result, { label: 'Slack', url: config.webhook_url }),
  }
}

async function runSms(config: ActionConfig<'send_sms'>, env: StepEnv): Promise<StepOutcome> {
  const to = customerNumber(env.call)
  if (!to || !isE164(to)) {
    return { success: true, skipped: true, attempts: 0, message: 'No text sent: the caller’s number was hidden or isn’t a full international number.' }
  }
  const body = renderTemplate(config.message, buildTemplateVars(env.call, env.org)).trim()
  if (!body) return { success: false, attempts: 0, message: 'The text message came out empty. Check the message in this step.' }

  const result = await sendSms({ orgId: env.org.id, to, body, kind: 'custom', callId: env.call.call_id })
  if (result.ok) return { success: true, attempts: 1, message: 'Text message sent to the caller.' }
  switch (result.reason) {
    case 'opted_out':
      return { success: true, skipped: true, attempts: 0, message: 'No text sent: this caller asked not to receive texts.' }
    case 'invalid_number':
      return { success: true, skipped: true, attempts: 0, message: 'No text sent: the caller’s number can’t receive texts.' }
    case 'sms_disabled':
      return { success: false, attempts: 0, message: 'Texts are turned off for your account or not part of your plan. Check Settings and Billing.' }
    case 'no_sms_number':
      return { success: false, attempts: 0, message: 'None of your phone numbers can send texts. Add a text-capable number on the Phone page.' }
    case 'not_configured':
      return { success: false, attempts: 0, message: 'Texting is unavailable right now. Please contact support.' }
    case 'provider_error':
      return { success: false, attempts: 1, message: 'The text couldn’t be delivered by our SMS provider.' }
  }
}

async function runAddTag(config: ActionConfig<'add_tag'>, env: StepEnv): Promise<StepOutcome> {
  const tag = config.tag.trim()
  const callId = env.call.call_id
  if (!callId || !env.admin) {
    return { success: false, attempts: 0, message: 'There’s no saved call to tag for this event.' }
  }
  // Optimistic update on updated_at so concurrent workflows adding tags to the
  // same call never overwrite each other.
  for (let attempt = 1; attempt <= 4; attempt++) {
    const { data, error } = await env.admin
      .from('calls')
      .select('tags, updated_at')
      .eq('id', callId)
      .eq('org_id', env.org.id)
      .maybeSingle()
    if (error) {
      console.error('[workflows] tag read failed', error.code, error.message)
      return { success: false, attempts: attempt, message: 'The tag couldn’t be saved on the call.' }
    }
    if (!data) return { success: false, attempts: attempt, message: 'The call for this event no longer exists.' }

    const row = data as { tags: unknown; updated_at: string | null }
    const current = Array.isArray(row.tags) ? row.tags.filter((t): t is string => typeof t === 'string') : []
    if (current.some((existing) => existing.toLowerCase() === tag.toLowerCase())) {
      env.call = { ...env.call, tags: current }
      return { success: true, attempts: attempt, message: `The call already had the tag “${tag}”.` }
    }

    const next = [...current, tag]
    let update = env.admin.from('calls').update({ tags: next }).eq('id', callId).eq('org_id', env.org.id)
    update = row.updated_at ? update.eq('updated_at', row.updated_at) : update.is('updated_at', null)
    const { data: updated, error: updateError } = await update.select('id')
    if (updateError) {
      console.error('[workflows] tag write failed', updateError.code, updateError.message)
      return { success: false, attempts: attempt, message: 'The tag couldn’t be saved on the call.' }
    }
    if (updated && updated.length > 0) {
      env.call = { ...env.call, tags: next }
      return { success: true, attempts: attempt, message: `Tag “${tag}” added to the call.` }
    }
    // Someone else changed the call in between: read again.
  }
  return { success: false, attempts: 4, message: 'The call kept changing while we tried to tag it. The tag wasn’t added.' }
}

async function runWait(config: ActionConfig<'wait'>, env: StepEnv): Promise<StepOutcome> {
  const ms = Math.max(0, Math.min(config.seconds * 1000, env.deadline - Date.now()))
  await new Promise((resolve) => setTimeout(resolve, ms))
  const waited = Math.round(ms / 1000)
  return { success: true, attempts: 1, message: `Waited ${waited} ${waited === 1 ? 'second' : 'seconds'}.` }
}

async function runStep(action: WorkflowAction, env: StepEnv): Promise<StepOutcome> {
  const google = { org: env.org, call: env.call }
  switch (action.type) {
    case 'send_webhook':
      return runWebhook(action.config, env)
    case 'notify_slack':
      return runSlack(action.config, env)
    case 'send_sms':
      return runSms(action.config, env)
    case 'add_tag':
      return runAddTag(action.config, env)
    case 'wait':
      return runWait(action.config, env)
    case 'send_email':
      return sendGmail(action.config, google)
    case 'add_to_sheet':
      return appendSheetRow(action.config, google)
    case 'create_calendar_event':
      return createFollowUpEvent(action.config, google)
    case 'create_doc':
      return createCallDoc(action.config, google)
    case 'save_to_drive':
      return saveTranscriptToDrive(action.config, google)
  }
}

// ─── Runs ─────────────────────────────────────────────────────────────────────

function skippedResult(id: string, type: string, message: string): ActionResult {
  return { action_id: id, action_type: type, success: false, skipped: true, message, attempts: 0, duration_ms: 0 }
}

/** Runs one workflow's steps in order. Never throws. */
export async function runWorkflowSteps(env: StepEnv): Promise<{ success: boolean; results: ActionResult[] }> {
  const rawActions = Array.isArray(env.workflow.actions) ? env.workflow.actions : []
  const results: ActionResult[] = []
  let failed = false

  if (rawActions.length === 0) {
    return { success: false, results: [skippedResult('none', 'none', 'This workflow has no steps. Open it and add one.')] }
  }

  for (let index = 0; index < rawActions.length; index++) {
    const parsed = parseStoredAction(rawActions[index], index)
    const id = parsed.ok ? parsed.action.id : parsed.id
    const type = parsed.ok ? parsed.action.type : parsed.type

    if (failed) {
      results.push(skippedResult(id, type, 'Didn’t run because an earlier step failed.'))
      continue
    }
    if (!parsed.ok) {
      results.push({ action_id: id, action_type: type, success: false, message: parsed.message, attempts: 0, duration_ms: 0 })
      failed = true
      continue
    }
    if (env.test && !(TESTABLE_ACTION_TYPES as readonly string[]).includes(type)) {
      results.push(skippedResult(id, type, 'Not run in a test. It runs for real calls.'))
      continue
    }
    if (Date.now() >= env.deadline) {
      results.push({ action_id: id, action_type: type, success: false, message: 'Stopped: the workflow ran out of time before this step.', attempts: 0, duration_ms: 0 })
      failed = true
      continue
    }

    const startedAt = Date.now()
    let outcome: StepOutcome
    try {
      outcome = await runStep(parsed.action, env)
    } catch (error) {
      console.error('[workflows] step crashed', type, error)
      outcome = { success: false, attempts: 1, message: 'Something went wrong while running this step.' }
    }
    results.push({
      action_id: id,
      action_type: type,
      success: outcome.success,
      ...(outcome.skipped ? { skipped: true } : {}),
      message: outcome.message,
      attempts: outcome.attempts,
      duration_ms: Date.now() - startedAt,
      ...(outcome.status_code !== undefined ? { status_code: outcome.status_code } : {}),
    })
    if (!outcome.success) failed = true
  }

  return { success: !failed, results }
}

/** Claims (workflow, call) so a duplicated event can't run the same workflow twice. */
async function claimOncePerCall(workflowId: string, callId: string | null): Promise<boolean> {
  if (!callId) return true
  try {
    return (await kvIncr(`wf:once:${workflowId}:${callId}`, ONCE_PER_CALL_TTL_SECONDS)) === 1
  } catch (error) {
    // Better a rare duplicate than a workflow that silently never runs.
    console.error('[workflows] run de-duplication unavailable', error instanceof Error ? error.message : error)
    return true
  }
}

async function runAndRecord(
  admin: SupabaseClient,
  workflow: WorkflowRunRecord,
  org: WorkflowOrgData,
  call: WorkflowCallData,
  trigger: TriggerType
): Promise<void> {
  if (!(await claimOncePerCall(workflow.id, call.call_id))) return

  const { data: run, error: insertError } = await admin
    .from('workflow_runs')
    .insert({ workflow_id: workflow.id, call_id: call.call_id, status: 'running' })
    .select('id')
    .single()
  if (insertError) console.error('[workflows] run record insert failed', workflow.id, insertError.code, insertError.message)

  const { success, results } = await runWorkflowSteps({
    admin,
    org,
    call: { ...call },
    workflow,
    trigger,
    test: false,
    deadline: Date.now() + RUN_BUDGET_MS,
  })

  const firstFailure = results.find((result) => !result.success && !result.skipped)
  if (run) {
    const { error } = await admin
      .from('workflow_runs')
      .update({
        status: success ? 'completed' : 'failed',
        results,
        error: success ? null : (firstFailure?.message ?? 'A step failed.'),
        completed_at: new Date().toISOString(),
      })
      .eq('id', (run as { id: string }).id)
      .eq('workflow_id', workflow.id)
    if (error) console.error('[workflows] run record update failed', workflow.id, error.code, error.message)
  }

  const { error: counterError } = await admin.rpc('increment_workflow_counters', {
    p_workflow_id: workflow.id,
    p_success: success,
  })
  if (counterError) console.error('[workflows] counter update failed', workflow.id, counterError.code, counterError.message)
}

export async function executeWorkflows(orgId: string, trigger: TriggerType, ctx: CallContext): Promise<void> {
  if (!isUuid(orgId)) {
    console.error('[workflows] executeWorkflows called without a valid organization id')
    return
  }
  if (ctx.org_id && ctx.org_id !== orgId) {
    console.error('[workflows] call context belongs to another organization; nothing was run')
    return
  }

  try {
    const admin = createAdminClient()
    const { data, error } = await admin
      .from('workflows')
      .select(WORKFLOW_RUN_COLUMNS)
      .eq('org_id', orgId)
      .eq('trigger', trigger)
      .eq('enabled', true)
    if (error) {
      console.error('[workflows] workflow lookup failed', error.code, error.message)
      return
    }
    const workflows = (data ?? []) as unknown as WorkflowRunRecord[]
    if (workflows.length === 0) return

    const [org, call] = await Promise.all([loadOrgData(admin, orgId), resolveCallData(admin, orgId, ctx)])
    if (!org) return
    // Dashboard test calls never reach customers' systems.
    if (call.is_test) return
    if (trigger === 'sentiment_negative' && call.sentiment !== 'negative') return

    const matching =
      trigger === 'keyword_detected'
        ? workflows.filter((wf) => findKeywordMatch(call.transcript, parseKeywords(wf.trigger_config?.keyword)) !== null)
        : workflows
    if (matching.length === 0) return

    const settled = await Promise.allSettled(matching.map((wf) => runAndRecord(admin, wf, org, call, trigger)))
    for (const outcome of settled) {
      if (outcome.status === 'rejected') console.error('[workflows] workflow run crashed', outcome.reason)
    }
  } catch (error) {
    console.error('[workflows] executeWorkflows failed', trigger, error)
  }
}

/** "Send test": runs webhook and Slack steps against real or sample call data; records nothing. */
export async function runWorkflowTest(input: {
  workflow: WorkflowRunRecord
  org: WorkflowOrgData
  call: WorkflowCallData
}): Promise<{ success: boolean; results: ActionResult[] }> {
  return runWorkflowSteps({
    admin: null,
    org: input.org,
    call: { ...input.call },
    workflow: input.workflow,
    trigger: input.workflow.trigger,
    test: true,
    deadline: Date.now() + TEST_RUN_BUDGET_MS,
  })
}
