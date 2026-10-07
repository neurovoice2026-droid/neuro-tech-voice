import { NextResponse } from 'next/server'
import { z } from 'zod'
import { google } from 'googleapis'
import { requireOrg } from '@/lib/api/auth'
import { legacySentimentFromVerdict } from '@/lib/calls/legacy-sentiment'
import {
  apiError,
  assertSameOrigin,
  errorResponse,
  parseJsonBody,
  RequestError,
  requestErrorResponse,
} from '@/lib/api/http'
import { createLogger, requestIdFrom } from '@/lib/observability/logger'
import { rateLimit, RATE_LIMITS } from '@/lib/security/rate-limit'
import { getGoogleClientWithToken } from '@/lib/google/client'
import { sendEmail, isConfigured as emailConfigured } from '@/lib/email/client'
import {
  asRoutingReason,
  dbError,
  findOrgCall,
  isCallStatus,
  parseCallId,
  servingProvider,
  type CallRow,
} from '@/lib/calls/serialize'
import { failoverReasonLabel, handledBy, isLiveStatus, outcomeLabel } from '@/lib/calls/labels'

const BodySchema = z.object({
  type: z.enum(['gmail', 'google_docs', 'google_sheets']),
})

const REPORT_COLUMNS: string =
  'id, caller_number, direction, duration_seconds, sentiment, call_successful, summary, summary_title, outcome, status, provider, primary_provider, routing_reason, failover_reason, elevenlabs_conversation_id, started_at, created_at'

type ReportRow = Pick<
  CallRow,
  | 'id' | 'caller_number' | 'direction' | 'duration_seconds' | 'sentiment' | 'call_successful' | 'summary' | 'summary_title' | 'outcome'
  | 'status' | 'provider' | 'primary_provider' | 'routing_reason' | 'failover_reason' | 'elevenlabs_conversation_id'
  | 'started_at' | 'created_at'
>

const INTEGRATION_LIMIT = RATE_LIMITS.callIntegration

function handledByText(call: ReportRow): string {
  return handledBy({
    status: isCallStatus(call.status) ? call.status : 'completed',
    provider: servingProvider(call),
    routing_reason: asRoutingReason(call.routing_reason),
    elevenlabs_conversation_id: call.elevenlabs_conversation_id,
  }).label
}

function report(call: ReportRow): string {
  const failover = failoverReasonLabel(
    call.failover_reason,
    call.primary_provider === 'cartesia' ? 'cartesia' : 'elevenlabs',
  )
  return [
    call.summary_title ? `Call report: ${call.summary_title}` : 'Call report',
    '',
    `Caller: ${call.caller_number ?? 'Unknown'}`,
    `Direction: ${call.direction ?? 'inbound'}`,
    `Duration: ${call.duration_seconds ?? 0}s`,
    `Handled by: ${handledByText(call)}`,
    ...(failover ? [`Failover: ${failover}`] : []),
    `Outcome: ${outcomeLabel(call.outcome) ?? '—'}`,
    `Sentiment: ${call.sentiment ?? legacySentimentFromVerdict(call.call_successful) ?? 'unknown'}`,
    `Date: ${call.started_at ?? call.created_at ?? ''}`,
    '',
    'Summary:',
    call.summary ?? '(no summary)',
  ].join('\n')
}

const escapeHtml = (s: string) =>
  s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c] as string)

// POST /api/calls/[id]/integrations { type } — sends one call to the owner's
// email, Google Docs or Google Sheets. The call is looked up by calls.id or a
// provider call id with `.eq` on one column, always scoped to the org.
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const requestId = requestIdFrom(request)
  let log = createLogger({ requestId, route: 'calls.integrations' })
  try {
    assertSameOrigin(request)
    const { supabase, user, org } = await requireOrg()
    log = log.child({ orgId: org.id })
    const id = parseCallId((await params).id)
    const { type } = await parseJsonBody(request, BodySchema, 1024)
    log = log.child({ integration: type })

    const call = await findOrgCall<ReportRow>(supabase, org.id, id, REPORT_COLUMNS)
    if (!call) return apiError('not_found', 'Call not found', 404, { requestId })
    if (isLiveStatus(call.status)) {
      return apiError('conflict', 'This call is still in progress. Try again once it has ended.', 409, { requestId })
    }

    const limit = await rateLimit(INTEGRATION_LIMIT, org.id)
    if (!limit.allowed) {
      return apiError('rate_limited', 'Too many requests in a short time. Please wait a moment.', 429, {
        requestId,
        headers: { 'Retry-After': String(Math.max(1, Math.ceil((limit.resetAt - Date.now()) / 1000))) },
      })
    }

    // ── Email summary (Resend, sent to the account owner) ───────────────────
    if (type === 'gmail') {
      if (!emailConfigured()) return apiError('not_configured', 'Email is not configured', 400, { requestId })
      if (!user.email) return apiError('invalid_request', 'No email on file', 400, { requestId })
      const ok = await sendEmail({
        to: user.email,
        subject: `Call summary — ${call.caller_number ?? 'Unknown'}`,
        html: `<pre style="font-family:inherit;white-space:pre-wrap">${escapeHtml(report(call))}</pre>`,
      })
      if (!ok) return apiError('provider_error', 'Failed to send email', 502, { requestId })
      return NextResponse.json({ success: true, message: `Summary emailed to ${user.email}` })
    }

    // ── Google actions need a connected integration with a refresh token ────
    const { data: integration, error: integrationError } = await supabase
      .from('integrations')
      .select('google_refresh_token, is_active, config')
      .eq('org_id', org.id)
      .eq('type', type)
      .maybeSingle()
    if (integrationError) throw dbError('integration lookup', integrationError)
    if (!integration?.is_active || !integration.google_refresh_token) {
      return apiError('precondition_failed', 'Integration not connected', 400, { requestId })
    }

    const auth = getGoogleClientWithToken(integration.google_refresh_token as string)
    const when = call.started_at ?? call.created_at ?? ''

    try {
      if (type === 'google_docs') {
        const docs = google.docs({ version: 'v1', auth })
        const created = await docs.documents.create({
          requestBody: { title: `Call report — ${call.caller_number ?? 'Unknown'} — ${when}` },
        })
        const documentId = created.data.documentId
        if (documentId) {
          await docs.documents.batchUpdate({
            documentId,
            requestBody: { requests: [{ insertText: { location: { index: 1 }, text: report(call) } }] },
          })
        }
        return NextResponse.json({ success: true, message: 'Call report created in Google Docs' })
      }

      // google_sheets
      const sheets = google.sheets({ version: 'v4', auth })
      const cfg = (integration.config ?? {}) as Record<string, unknown>
      let spreadsheetId = typeof cfg.call_log_spreadsheet_id === 'string' ? cfg.call_log_spreadsheet_id : undefined

      // Create a single per-org call-log spreadsheet on first use.
      if (!spreadsheetId) {
        const created = await sheets.spreadsheets.create({
          requestBody: { properties: { title: 'Neuro Tech Voice — Call Log' } },
        })
        spreadsheetId = created.data.spreadsheetId ?? undefined
        if (spreadsheetId) {
          await sheets.spreadsheets.values.append({
            spreadsheetId,
            range: 'A:Z',
            valueInputOption: 'RAW',
            requestBody: { values: [['Date', 'Caller', 'Direction', 'Duration (s)', 'Handled by', 'Sentiment', 'Summary']] },
          })
          const { error: cfgError } = await supabase
            .from('integrations')
            .update({ config: { ...cfg, call_log_spreadsheet_id: spreadsheetId } })
            .eq('org_id', org.id)
            .eq('type', 'google_sheets')
          if (cfgError) throw dbError('integration config update', cfgError)
        }
      }
      if (!spreadsheetId) return apiError('provider_error', 'Could not access spreadsheet', 502, { requestId })

      // RAW: values are stored as typed, so a summary starting with "=" is never a formula.
      await sheets.spreadsheets.values.append({
        spreadsheetId,
        range: 'A:Z',
        valueInputOption: 'RAW',
        requestBody: {
          values: [[
            when,
            call.caller_number ?? '',
            call.direction ?? 'inbound',
            String(call.duration_seconds ?? 0),
            handledByText(call),
            call.sentiment ?? legacySentimentFromVerdict(call.call_successful) ?? '',
            call.summary ?? '',
          ]],
        },
      })
      return NextResponse.json({ success: true, message: 'Call logged to Google Sheets' })
    } catch (err) {
      log.error('calls.integrations.google_failed', err)
      return apiError('provider_error', 'The Google integration did not accept the request. Please reconnect it and try again.', 502, { requestId })
    }
  } catch (err) {
    if (err instanceof RequestError) return requestErrorResponse(err, requestId)
    return errorResponse(err, log, 'calls.integrations.failed', requestId)
  }
}
