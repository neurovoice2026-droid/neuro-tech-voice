import { NextResponse, type NextRequest } from 'next/server'
import { google } from 'googleapis'
import { z } from 'zod'
import { ApiError, handleRoute, noStore, parseJson, zUuid } from '@/lib/api/http'
import { requireOrgContext } from '@/lib/api/auth'
import { entitlementsFor, requiredPlanFor } from '@/lib/billing/entitlements'
import { isConfigured as isEmailConfigured, sendEmail } from '@/lib/email/client'
import { isSupabaseAdminConfigured } from '@/lib/env'
import {
  getAuthorizedClient,
  googleErrorInfo,
  isGoogleAuthError,
  markGoogleIntegrationBroken,
  type GoogleOAuthClient,
} from '@/lib/google/client'
import { enforceRateLimit, RATE_LIMITS } from '@/lib/security/rate-limit'
import { createAdminClient } from '@/lib/supabase/admin'
import { PLANS } from '@/types'
import { dbError } from '../../_lib/db'

// POST /api/calls/[id]/integrations { type } — sends one call somewhere:
//   email          summary to the account owner (Resend)
//   google_docs    a call report document
//   google_sheets  a row in the org's call-log spreadsheet (created on first use)
// Reads only the calls table and non-token integration columns; Google
// credentials come from lib/google/client.ts.

export const runtime = 'nodejs'
export const maxDuration = 60

/** Per Google request; the route makes at most three. */
const GOOGLE_TIMEOUT_MS = 15_000

type Params = { params: Promise<{ id: string }> }

const BodySchema = z.object({
  // 'gmail' is what older dashboards sent for the email summary.
  type: z.enum(['email', 'gmail', 'google_docs', 'google_sheets']),
})

interface CallRow {
  id: string
  caller_number: string | null
  direction: string
  duration_seconds: number | null
  status: string
  sentiment: string | null
  outcome: string | null
  intent: string | null
  summary: string | null
  extracted: Record<string, unknown> | null
  started_at: string | null
}

const OUTCOME_LABELS: Record<string, string> = {
  booked: 'Booked', rescheduled: 'Rescheduled', cancelled: 'Cancelled', answered: 'Answered',
  message_taken: 'Message taken', transferred: 'Transferred', flagged: 'Flagged', missed: 'Missed',
  spam: 'Spam', other: 'Other',
}

function formatWhen(iso: string | null, timeZone: string): string {
  if (!iso) return 'Unknown time'
  try {
    return new Intl.DateTimeFormat('en-GB', { dateStyle: 'medium', timeStyle: 'short', timeZone }).format(new Date(iso))
  } catch {
    return iso
  }
}

function leadLines(extracted: CallRow['extracted']): string[] {
  if (!extracted || typeof extracted !== 'object') return []
  return Object.entries(extracted)
    .filter(([, v]) => typeof v === 'string' && v.trim())
    .map(([k, v]) => `  ${k.replace(/_/g, ' ')}: ${v}`)
}

function report(call: CallRow, timeZone: string): string {
  const leads = leadLines(call.extracted)
  return [
    'Call report',
    '',
    `Caller: ${call.caller_number ?? 'Unknown'}`,
    `When: ${formatWhen(call.started_at, timeZone)}`,
    `Direction: ${call.direction === 'outbound' ? 'Outbound' : 'Inbound'}`,
    `Duration: ${Number(call.duration_seconds) || 0}s`,
    `Outcome: ${call.outcome ? OUTCOME_LABELS[call.outcome] ?? call.outcome : 'Not analysed yet'}`,
    ...(call.intent ? [`Reason for calling: ${call.intent.replace(/_/g, ' ')}`] : []),
    `Sentiment: ${call.sentiment ?? 'Not analysed yet'}`,
    ...(leads.length > 0 ? ['', 'Details collected:', ...leads] : []),
    '',
    'Summary:',
    call.summary ?? '(no summary yet)',
  ].join('\n')
}

function escapeHtml(text: string): string {
  return text.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c] as string)
}

async function authorizedGoogleClient(orgId: string, type: 'google_docs' | 'google_sheets'): Promise<GoogleOAuthClient> {
  const auth = await getAuthorizedClient(orgId, type)
  if (!auth) {
    throw new ApiError(400, 'integration_not_connected', 'Connect this Google integration first on the Integrations page.')
  }
  return auth
}

async function handleGoogleFailure(orgId: string, type: 'google_docs' | 'google_sheets', error: unknown): Promise<never> {
  const info = googleErrorInfo(error)
  console.error('[calls] Google action failed', type, info.status, info.reason)
  if (isGoogleAuthError(error)) {
    await markGoogleIntegrationBroken(orgId, type, info.reason ?? 'authorization_failed')
    throw new ApiError(400, 'integration_reconnect', 'Google access has expired. Please reconnect this integration on the Integrations page.')
  }
  throw new ApiError(502, 'integration_failed', 'Google didn’t accept the request. Please try again in a minute.')
}

export const POST = handleRoute(async (req: NextRequest, routeCtx: Params) => {
  const { id: rawId } = await routeCtx.params
  const idResult = zUuid.safeParse(rawId)
  if (!idResult.success) throw new ApiError(400, 'invalid_id', 'That call id is not valid.')
  const id = idResult.data

  const ctx = await requireOrgContext()
  await enforceRateLimit(RATE_LIMITS.apiWrite, ctx.user.id)
  const { type } = await parseJson(req, BodySchema, { maxBytes: 1024 })

  const { data, error } = await ctx.supabase
    .from('calls')
    .select('id, caller_number, direction, duration_seconds, status, sentiment, outcome, intent, summary, extracted, started_at')
    .eq('id', id)
    .eq('org_id', ctx.org.id)
    .maybeSingle()
  if (error) throw dbError(error, 'load call for integration')
  if (!data) throw new ApiError(404, 'call_not_found', 'We couldn’t find that call.')
  const call = data as CallRow
  const timeZone = ctx.org.timezone || 'UTC'
  const text = report(call, timeZone)

  if (type === 'email' || type === 'gmail') {
    if (!isEmailConfigured()) throw new ApiError(503, 'not_configured', 'Email sending is not set up yet.')
    if (!ctx.user.email) throw new ApiError(400, 'no_email', 'Your account has no email address.')
    const ok = await sendEmail({
      to: ctx.user.email,
      subject: `Call summary: ${call.caller_number ?? 'Unknown caller'}`,
      html: `<pre style="font-family:inherit;white-space:pre-wrap">${escapeHtml(text)}</pre>`,
    })
    if (!ok) throw new ApiError(502, 'email_failed', 'The email couldn’t be sent. Please try again in a minute.')
    return noStore(NextResponse.json({ success: true, message: `Summary emailed to ${ctx.user.email}` }))
  }

  if (!entitlementsFor(ctx.org.plan).googleIntegrations) {
    const plan = PLANS[requiredPlanFor('googleIntegrations')].name
    throw new ApiError(403, 'upgrade_required', `Google integrations are available on ${plan} and above.`)
  }

  const auth = await authorizedGoogleClient(ctx.org.id, type)
  const title = `Call report: ${call.caller_number ?? 'Unknown caller'}, ${formatWhen(call.started_at, timeZone)}`

  if (type === 'google_docs') {
    try {
      const docs = google.docs({ version: 'v1', auth })
      const created = await docs.documents.create({ requestBody: { title } }, { timeout: GOOGLE_TIMEOUT_MS })
      const documentId = created.data.documentId
      if (!documentId) throw new Error('Google Docs returned no document id')
      await docs.documents.batchUpdate(
        {
          documentId,
          requestBody: { requests: [{ insertText: { location: { index: 1 }, text } }] },
        },
        { timeout: GOOGLE_TIMEOUT_MS }
      )
    } catch (err) {
      if (err instanceof ApiError) throw err
      return handleGoogleFailure(ctx.org.id, type, err)
    }
    return noStore(NextResponse.json({ success: true, message: 'Call report created in Google Docs' }))
  }

  // google_sheets
  const { data: integration, error: integrationError } = await ctx.supabase
    .from('integrations')
    .select('config')
    .eq('org_id', ctx.org.id)
    .eq('type', 'google_sheets')
    .maybeSingle()
  if (integrationError) throw dbError(integrationError, 'load sheets integration')
  const config = (integration?.config && typeof integration.config === 'object' ? integration.config : {}) as Record<string, unknown>
  let spreadsheetId = typeof config.call_log_spreadsheet_id === 'string' ? config.call_log_spreadsheet_id : null

  try {
    const sheets = google.sheets({ version: 'v4', auth })
    if (!spreadsheetId) {
      const created = await sheets.spreadsheets.create(
        { requestBody: { properties: { title: 'Neuro Tech Voice: Call log' } } },
        { timeout: GOOGLE_TIMEOUT_MS }
      )
      spreadsheetId = created.data.spreadsheetId ?? null
      if (!spreadsheetId) throw new Error('Google Sheets returned no spreadsheet id')
      await sheets.spreadsheets.values.append(
        {
          spreadsheetId,
          range: 'A:Z',
          valueInputOption: 'RAW',
          requestBody: { values: [['Date', 'Caller', 'Direction', 'Duration (s)', 'Outcome', 'Sentiment', 'Summary']] },
        },
        { timeout: GOOGLE_TIMEOUT_MS }
      )
      if (isSupabaseAdminConfigured()) {
        const { error: saveError } = await createAdminClient()
          .from('integrations')
          .update({ config: { ...config, call_log_spreadsheet_id: spreadsheetId } })
          .eq('org_id', ctx.org.id)
          .eq('type', 'google_sheets')
        if (saveError) console.error('[calls] saving the call-log spreadsheet id failed', saveError.code, saveError.message)
      }
    }
    await sheets.spreadsheets.values.append({
      spreadsheetId,
      range: 'A:Z',
      // RAW: a caller-controlled summary must never be evaluated as a formula.
      valueInputOption: 'RAW',
      requestBody: {
        values: [[
          formatWhen(call.started_at, timeZone),
          call.caller_number ?? '',
          call.direction,
          Number(call.duration_seconds) || 0,
          call.outcome ? OUTCOME_LABELS[call.outcome] ?? call.outcome : '',
          call.sentiment ?? '',
          call.summary ?? '',
        ]],
      },
    }, { timeout: GOOGLE_TIMEOUT_MS })
  } catch (err) {
    if (err instanceof ApiError) throw err
    return handleGoogleFailure(ctx.org.id, type, err)
  }
  return noStore(NextResponse.json({ success: true, message: 'Call logged to Google Sheets' }))
})
