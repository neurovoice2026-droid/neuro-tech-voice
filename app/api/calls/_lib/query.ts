import '@/lib/zod-setup'
import { z } from 'zod'
import { CALL_OUTCOMES, type CallOutcome } from '@/types'

// Call history query building shared by GET /api/calls and the export. Pure:
// the routes turn the returned filter operations into PostgREST calls, and the
// tests cover escaping and time zone math without a database.

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export const MAX_SEARCH_CHARS = 200
export const MAX_TAG_CHARS = 64

/** Columns for list views: everything but the transcript and the analysis blob. */
export const CALL_LIST_COLUMNS = [
  'id', 'org_id', 'agent_id', 'phone_number_id', 'provider_call_id', 'voice_provider', 'pipeline_mode',
  'caller_number', 'from_number', 'to_number', 'direction', 'is_test', 'duration_seconds', 'status',
  'end_reason', 'fallback_used', 'fallback_reason', 'sentiment', 'summary', 'outcome', 'intent', 'tags',
  'recording_url', 'started_at', 'ended_at', 'created_at',
].join(', ')

/** Every Call column (never search_tsv). */
export const CALL_DETAIL_COLUMNS = [
  'id', 'org_id', 'agent_id', 'phone_number_id', 'twilio_call_sid', 'elevenlabs_conversation_id',
  'voice_provider', 'pipeline_mode', 'provider_call_id', 'caller_number', 'from_number', 'to_number',
  'direction', 'is_test', 'duration_seconds', 'status', 'end_reason', 'fallback_used', 'fallback_reason',
  'transcript', 'sentiment', 'summary', 'outcome', 'intent', 'tags', 'extracted', 'analysis',
  'knowledge_sources', 'recording_url', 'recording_sid', 'recording_duration_seconds', 'usage_recorded_at',
  'stt_model', 'agent_seconds', 'llm_cached_input_tokens', 'cartesia_credits', 'billable_seconds',
  'billed_minutes', 'tts_characters', 'stt_seconds', 'llm_input_tokens', 'llm_output_tokens',
  'started_at', 'ended_at', 'created_at', 'updated_at',
].join(', ')

const optionalDate = z
  .union([z.literal(''), z.string().regex(DATE_RE, 'Use the YYYY-MM-DD format')])
  .optional()
  .transform((v) => v || null)

const booleanFlag = z
  .enum(['1', '0', 'true', 'false', ''])
  .optional()
  .transform((v) => v === '1' || v === 'true')

export const CallFiltersSchema = z.object({
  search: z.string().max(MAX_SEARCH_CHARS).optional().default(''),
  status: z.enum(['all', 'completed', 'failed', 'busy', 'no-answer', 'in-progress']).optional().default('all'),
  direction: z.enum(['all', 'inbound', 'outbound']).optional().default('all'),
  sentiment: z.enum(['all', 'positive', 'neutral', 'negative']).optional().default('all'),
  outcome: z
    .enum(['all', ...CALL_OUTCOMES] as unknown as ['all', ...CallOutcome[]])
    .optional()
    .default('all'),
  tag: z.string().max(MAX_TAG_CHARS).optional().default(''),
  dateFrom: optionalDate,
  dateTo: optionalDate,
  minDuration: z.coerce.number().int().min(0).max(86_400).optional().default(0),
  sortBy: z.enum(['created_at', 'duration_seconds', 'caller_number']).optional().default('created_at'),
  sortOrder: z.enum(['asc', 'desc']).optional().default('desc'),
  include_test: booleanFlag,
})

export type CallListFilters = z.infer<typeof CallFiltersSchema>

export const CallListQuerySchema = CallFiltersSchema.extend({
  page: z.coerce.number().int().min(1).max(100_000).optional().default(1),
  limit: z.coerce.number().int().min(1).max(100).optional().default(25),
})

export const EXPORT_COLUMNS = [
  'caller_number', 'direction', 'duration_seconds', 'status', 'outcome', 'intent', 'sentiment',
  'tags', 'created_at', 'summary', 'extracted', 'transcript', 'agent_name',
] as const
export type ExportColumn = (typeof EXPORT_COLUMNS)[number]

export const EXPORT_ROW_LIMIT = 5_000
export const MAX_SELECTED_IDS = 500
/** Ids per `in` filter: 100 uuids keep the PostgREST URL around 4 KB. */
export const SELECTED_IDS_PER_QUERY = 100

const idList = z
  .string()
  .max(MAX_SELECTED_IDS * 37)
  .optional()
  .transform((v, ctx) => {
    const ids = Array.from(new Set((v ?? '').split(',').map((s) => s.trim()).filter(Boolean)))
    if (ids.length > MAX_SELECTED_IDS) {
      ctx.addIssue({ code: 'custom', message: `Select at most ${MAX_SELECTED_IDS} calls` })
      return z.NEVER
    }
    if (ids.some((id) => !UUID_RE.test(id))) {
      ctx.addIssue({ code: 'custom', message: 'Contains an invalid call id' })
      return z.NEVER
    }
    return ids
  })

export const ExportQuerySchema = CallFiltersSchema.extend({
  format: z.enum(['csv', 'json']).optional().default('csv'),
  scope: z.enum(['all', 'filtered', 'selected']).optional().default('filtered'),
  columns: z
    .string()
    .max(500)
    .optional()
    .transform((v, ctx) => {
      const requested = (v ?? '').split(',').map((s) => s.trim()).filter(Boolean)
      const unknown = requested.filter((c) => !(EXPORT_COLUMNS as readonly string[]).includes(c))
      if (unknown.length > 0) {
        ctx.addIssue({ code: 'custom', message: `Unknown columns: ${unknown.slice(0, 5).join(', ')}` })
        return z.NEVER
      }
      const unique = Array.from(new Set(requested)) as ExportColumn[]
      return unique.length > 0
        ? unique
        : (['caller_number', 'direction', 'duration_seconds', 'status', 'outcome', 'sentiment', 'created_at'] as ExportColumn[])
    }),
  selectedIds: idList,
})

/**
 * POST body of the export: the same parameters as the query string, with the
 * selected ids as an array. Hundreds of ids don't fit in a URL (Vercel caps
 * request URLs at 14 KB), so the dashboard always posts.
 */
export const ExportBodySchema = z
  .record(
    z.string().max(40),
    z.union([z.string().max(1_000), z.array(z.string().max(64)).max(MAX_SELECTED_IDS)])
  )
  .refine((body) => Object.keys(body).length <= 40, 'Too many export options')

export function exportBodyToSearchParams(body: z.infer<typeof ExportBodySchema>): URLSearchParams {
  const params = new URLSearchParams()
  for (const [key, value] of Object.entries(body)) {
    params.set(key, Array.isArray(value) ? value.join(',') : value)
  }
  return params
}

/** Splits ids into batches for `in` filters. */
export function chunk<T>(items: readonly T[], size: number): T[][] {
  const out: T[][] = []
  for (let i = 0; i < items.length; i += Math.max(1, size)) out.push(items.slice(i, i + Math.max(1, size)))
  return out
}

// ─── Escaping ─────────────────────────────────────────────────────────────────

/** LIKE/ILIKE: backslash-escape the wildcard characters (Postgres' default escape is `\`). */
export function escapeLikePattern(value: string): string {
  return value.replace(/[\\%_]/g, (c) => `\\${c}`)
}

/**
 * A value inside a PostgREST logic tree (`or=(…)`): double-quoted so commas,
 * dots, colons and parentheses stay literal; `"` and `\` backslash-escaped.
 */
export function quotePostgrestValue(value: string): string {
  return `"${value.replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"`
}

/** Postgres text[] literal for `cs` (contains) filters. */
export function pgTextArrayLiteral(values: string[]): string {
  return `{${values.map((v) => `"${v.replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"`).join(',')}}`
}

/** Collapses whitespace and control characters; '' when nothing searchable is left. */
export function normalizeSearchTerm(raw: string): string {
  return raw
    .replace(/[\u0000-\u001f\u007f]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, MAX_SEARCH_CHARS)
}

/**
 * Full-text search over caller number, summary and transcript (search_tsv,
 * websearch syntax, 'simple' config) OR a substring match on the caller
 * number. Phone-looking input matches on digits without leading zeros, so
 * "0722 123 456" finds "+40722123456".
 */
export function buildSearchFilter(raw: string): string | null {
  const term = normalizeSearchTerm(raw)
  if (!term) return null

  const digits = term.replace(/\D/g, '')
  const phoneLike = /^[+\d\s().-]+$/.test(term) && digits.length >= 3
  // PostgREST also treats `*` as a LIKE wildcard, so it can't be matched literally.
  const needle = phoneLike ? digits.replace(/^0+/, '') || digits : term.replace(/\*/g, '')

  const parts = [`search_tsv.wfts(simple).${quotePostgrestValue(term)}`]
  if (needle) parts.push(`caller_number.ilike.${quotePostgrestValue(`%${escapeLikePattern(needle)}%`)}`)
  return parts.join(',')
}

// ─── Time zones ───────────────────────────────────────────────────────────────

function offsetMs(timestamp: number, timeZone: string): number {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone,
    hourCycle: 'h23',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  }).formatToParts(new Date(timestamp))
  const get = (type: string) => Number(parts.find((p) => p.type === type)?.value)
  const asUtc = Date.UTC(get('year'), get('month') - 1, get('day'), get('hour'), get('minute'), get('second'))
  return asUtc - Math.floor(timestamp / 1000) * 1000
}

export function safeTimeZone(timeZone: string | null | undefined): string {
  if (!timeZone) return 'UTC'
  try {
    new Intl.DateTimeFormat('en-US', { timeZone })
    return timeZone
  } catch {
    return 'UTC'
  }
}

/** UTC instant of local midnight on `date` (YYYY-MM-DD) in `timeZone`, DST-correct. */
export function zonedMidnightUtc(date: string, timeZone: string, addDays = 0): string | null {
  const match = DATE_RE.exec(date) ? date.split('-').map(Number) : null
  if (!match) return null
  const [y, m, d] = match
  const guess = Date.UTC(y, m - 1, d + addDays)
  if (!Number.isFinite(guess)) return null
  const zone = safeTimeZone(timeZone)
  const first = guess - offsetMs(guess, zone)
  const second = guess - offsetMs(first, zone)
  return new Date(second).toISOString()
}

// ─── Filter plan ──────────────────────────────────────────────────────────────

export type FilterOp =
  | { op: 'eq'; column: string; value: string | boolean }
  | { op: 'gte'; column: string; value: string | number }
  | { op: 'lt'; column: string; value: string }
  | { op: 'or'; value: string }
  | { op: 'contains'; column: string; value: string }
  | { op: 'in'; column: string; value: string[] }

export function buildCallFilterOps(filters: CallListFilters, timeZone: string): FilterOp[] {
  const ops: FilterOp[] = []
  if (!filters.include_test) ops.push({ op: 'eq', column: 'is_test', value: false })

  const search = buildSearchFilter(filters.search)
  if (search) ops.push({ op: 'or', value: search })

  if (filters.status !== 'all') ops.push({ op: 'eq', column: 'status', value: filters.status })
  if (filters.direction !== 'all') ops.push({ op: 'eq', column: 'direction', value: filters.direction })
  if (filters.sentiment !== 'all') ops.push({ op: 'eq', column: 'sentiment', value: filters.sentiment })
  if (filters.outcome !== 'all') ops.push({ op: 'eq', column: 'outcome', value: filters.outcome })

  const tag = filters.tag.trim()
  if (tag) ops.push({ op: 'contains', column: 'tags', value: pgTextArrayLiteral([tag]) })

  if (filters.dateFrom) {
    const from = zonedMidnightUtc(filters.dateFrom, timeZone)
    if (from) ops.push({ op: 'gte', column: 'started_at', value: from })
  }
  if (filters.dateTo) {
    // Inclusive of the whole "to" day in the organisation's time zone.
    const to = zonedMidnightUtc(filters.dateTo, timeZone, 1)
    if (to) ops.push({ op: 'lt', column: 'started_at', value: to })
  }
  if (filters.minDuration > 0) ops.push({ op: 'gte', column: 'duration_seconds', value: filters.minDuration })
  return ops
}

export function sortColumn(sortBy: CallListFilters['sortBy']): string {
  // The UI's "date" sort is the call start; started_at is the indexed column.
  return sortBy === 'created_at' ? 'started_at' : sortBy
}
