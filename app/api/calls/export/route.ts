import { z } from 'zod'
import { requireOrg } from '@/lib/api/auth'
import { apiError, errorResponse, RequestError, requestErrorResponse } from '@/lib/api/http'
import { createLogger, requestIdFrom } from '@/lib/observability/logger'
import { rateLimit, RATE_LIMITS } from '@/lib/security/rate-limit'
import {
  applyCallFilters,
  CALL_DETAIL_COLUMNS,
  CALL_LIST_COLUMNS,
  CallFilterSchema,
  csvCell,
  dbError,
  parseQuery,
  safeTimeZone,
  serializeCallDetail,
  UUID_RE,
  type CallDetail,
  type CallRow,
} from '@/lib/calls/serialize'
import { buildTsQuery, searchCallIds } from '@/lib/calls/search'
import {
  callResultLabel,
  failoverReasonLabel,
  outcomeLabel,
  providerLabel,
  routingReasonLabel,
} from '@/lib/calls/labels'

// GET /api/calls/export?format=csv|json&scope=filtered|all|selected&columns=a,b&selectedIds=...
// Exports the org's calls from the `calls` table. Columns are whitelisted; CSV
// cells are protected against spreadsheet formula injection.

type ExportColumn = {
  label: string
  /** CSV value (human labels for routing fields; never raw internal codes alone). */
  csv: (c: CallDetail) => unknown
  /** JSON value (raw, for developers). */
  json: (c: CallDetail) => unknown
}

const transcriptText = (c: CallDetail) =>
  c.transcript.map((t) => `${t.role === 'agent' ? 'Agent' : 'Caller'}: ${t.message}`).join('\n')

const EXPORT_COLUMNS = {
  caller_number: { label: 'Phone Number', csv: (c) => c.caller_number, json: (c) => c.caller_number },
  from_number: { label: 'From', csv: (c) => c.from_number, json: (c) => c.from_number },
  to_number: { label: 'To', csv: (c) => c.to_number, json: (c) => c.to_number },
  direction: { label: 'Direction', csv: (c) => c.direction, json: (c) => c.direction },
  duration_seconds: { label: 'Duration (s)', csv: (c) => c.duration_seconds, json: (c) => c.duration_seconds },
  status: { label: 'Status', csv: (c) => c.status, json: (c) => c.status },
  sentiment: { label: 'Sentiment', csv: (c) => c.sentiment, json: (c) => c.sentiment },
  created_at: { label: 'Date & Time', csv: (c) => c.started_at ?? c.created_at, json: (c) => c.started_at ?? c.created_at },
  ended_at: { label: 'Ended At', csv: (c) => c.ended_at, json: (c) => c.ended_at },
  provider: { label: 'Voice Provider', csv: (c) => providerLabel(c.provider), json: (c) => c.provider ?? null },
  routing_reason: { label: 'Routing', csv: (c) => routingReasonLabel(c.routing_reason), json: (c) => c.routing_reason ?? null },
  failover_reason: {
    label: 'Failover Reason',
    csv: (c) => failoverReasonLabel(c.failover_reason, c.primary_provider),
    json: (c) => c.failover_reason ?? null,
  },
  outcome: { label: 'Outcome', csv: (c) => outcomeLabel(c.outcome), json: (c) => c.outcome ?? null },
  call_successful: { label: 'AI Outcome', csv: (c) => callResultLabel(c.call_successful), json: (c) => c.call_successful ?? null },
  summary_title: { label: 'Summary Title', csv: (c) => c.summary_title, json: (c) => c.summary_title ?? null },
  summary: { label: 'AI Summary', csv: (c) => c.summary, json: (c) => c.summary },
  transcript: { label: 'Transcript', csv: transcriptText, json: (c) => c.transcript },
  agent_name: { label: 'Agent', csv: (c) => c.agent_name ?? '', json: (c) => c.agent_name ?? null },
} satisfies Record<string, ExportColumn>

type ExportColumnId = keyof typeof EXPORT_COLUMNS
const COLUMN_IDS = Object.keys(EXPORT_COLUMNS) as ExportColumnId[]
const DEFAULT_COLUMNS: ExportColumnId[] = ['caller_number', 'direction', 'duration_seconds', 'status', 'sentiment', 'created_at']

const ExportQuerySchema = CallFilterSchema.extend({
  format: z.enum(['csv', 'json']).default('csv'),
  scope: z.enum(['filtered', 'all', 'selected']).default('filtered'),
  columns: z
    .string()
    .max(1000)
    .optional()
    .transform((v) => {
      const picked = (v ?? '')
        .split(',')
        .map((s) => s.trim())
        .filter((s): s is ExportColumnId => (COLUMN_IDS as string[]).includes(s))
      const unique = Array.from(new Set(picked))
      return unique.length ? unique : DEFAULT_COLUMNS
    }),
  selectedIds: z
    .string()
    .max(500 * 37)
    .optional()
    .transform((v, ctx) => {
      const ids = (v ?? '').split(',').map((s) => s.trim()).filter(Boolean)
      if (ids.length > 500 || ids.some((id) => !UUID_RE.test(id))) {
        ctx.addIssue({ code: 'custom', message: 'selectedIds must be up to 500 call ids.' })
        return z.NEVER
      }
      return ids.map((id) => id.toLowerCase())
    }),
})

const EXPORT_LIMIT = RATE_LIMITS.callsExport
const PAGE = 1000
const MAX_ROWS = 10_000

export async function GET(request: Request) {
  const requestId = requestIdFrom(request)
  let log = createLogger({ requestId, route: 'calls.export' })
  try {
    const { supabase, org } = await requireOrg()
    log = log.child({ orgId: org.id })
    const q = parseQuery(request, ExportQuerySchema)
    if (q.scope === 'selected' && q.selectedIds.length === 0) {
      return apiError('invalid_request', 'Select at least one call to export.', 400, { requestId })
    }

    const limit = await rateLimit(EXPORT_LIMIT, org.id)
    if (!limit.allowed) {
      return apiError('rate_limited', 'Too many exports in a short time. Please wait a moment.', 429, {
        requestId,
        headers: { 'Retry-After': String(Math.max(1, Math.ceil((limit.resetAt - Date.now()) / 1000))) },
      })
    }

    const tz = safeTimeZone(org.timezone)
    // Text search also matches what was said (our own full-text index, org-scoped).
    const fullTextIds = q.scope === 'filtered' && buildTsQuery(q.search) ? await searchCallIds(org.id, q.search ?? '') : null
    const columns = q.columns
    // Transcripts are large: only read them when the export includes them.
    const select = columns.includes('transcript') ? CALL_DETAIL_COLUMNS : CALL_LIST_COLUMNS
    const rows: CallRow[] = []
    for (let offset = 0; offset < MAX_ROWS; ) {
      let query = supabase.from('calls').select(select).eq('org_id', org.id)
      if (q.scope === 'filtered') query = applyCallFilters(query, q, tz, fullTextIds)
      if (q.scope === 'selected') query = query.in('id', q.selectedIds)
      const { data, error } = await query
        .order('started_at', { ascending: false, nullsFirst: false })
        .order('created_at', { ascending: false })
        .order('id', { ascending: false })
        .range(offset, Math.min(offset + PAGE, MAX_ROWS) - 1)
      if (error) throw dbError('calls export', error)
      const page = (data ?? []) as unknown as CallRow[]
      rows.push(...page)
      offset += page.length
      if (page.length === 0) break
    }
    if (rows.length >= MAX_ROWS) log.warn('calls.export.truncated', { maxRows: MAX_ROWS })

    const calls = rows.map(serializeCallDetail)
    const date = new Date().toISOString().slice(0, 10)
    const baseHeaders = { 'Cache-Control': 'private, no-store', 'X-Content-Type-Options': 'nosniff' }

    if (q.format === 'json') {
      const body = calls.map((c) => {
        const out: Record<string, unknown> = { id: c.id }
        for (const col of columns) out[col] = EXPORT_COLUMNS[col].json(c)
        return out
      })
      return new Response(JSON.stringify(body, null, 2), {
        headers: {
          ...baseHeaders,
          'Content-Type': 'application/json; charset=utf-8',
          'Content-Disposition': `attachment; filename="calls-${date}.json"`,
        },
      })
    }

    const lines = [
      columns.map((col) => csvCell(EXPORT_COLUMNS[col].label)).join(','),
      ...calls.map((c) => columns.map((col) => csvCell(EXPORT_COLUMNS[col].csv(c))).join(',')),
    ]
    // BOM so spreadsheet apps read UTF-8 (Romanian diacritics in transcripts).
    return new Response(`﻿${lines.join('\r\n')}\r\n`, {
      headers: {
        ...baseHeaders,
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="calls-${date}.csv"`,
      },
    })
  } catch (err) {
    if (err instanceof RequestError) return requestErrorResponse(err, requestId)
    return errorResponse(err, log, 'calls.export.failed', requestId)
  }
}
