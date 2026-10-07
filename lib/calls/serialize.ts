import 'server-only'
// Call history read model. The `calls` table is the single source of truth for
// both providers (filled by webhooks/polling, see lib/voice-providers/
// call-store.ts); every calls/dashboard endpoint reads it through here:
//   • column lists + DB row → API `Call` serialization (never a provider URL),
//   • id validation and ownership-scoped lookup (calls.id or a provider id),
//   • zod-validated list/export query params and the PostgREST filters they
//     produce (no unvalidated input is ever interpolated into a filter string),
//   • org-timezone day/month boundaries,
//   • paged "facts" loading for metrics, and CSV cell escaping.

import type { SupabaseClient } from '@supabase/supabase-js'
import { z } from 'zod'
import { RequestError } from '@/lib/api/http'
import {
  AI_OUTCOME_VALUES,
  CALL_STATUS_VALUES,
  ROUTING_REASON_VALUES,
  VOICE_PROVIDER_VALUES,
  isLiveStatus,
  type CallListItem,
} from '@/lib/calls/labels'
import { readCallMetadata } from '@/lib/voice-providers/call-metadata'
import {
  CALL_OUTCOMES,
  type Call,
  type CallDetails,
  type CallDirection,
  type CallOutcome,
  type CallStatus,
  type RoutingReason,
  type Sentiment,
  type TranscriptEntry,
  type VoiceProviderId,
} from '@/types'

// ─── Ids ──────────────────────────────────────────────────────────────────────

export const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
export const PROVIDER_CALL_ID_RE = /^[A-Za-z0-9_-]{6,128}$/

export interface ParsedCallId {
  value: string
  isUuid: boolean
}

/** Validates a route `[id]`: a calls.id UUID or a provider call id. Throws 400. */
export function parseCallId(raw: string | undefined): ParsedCallId {
  const value = typeof raw === 'string' ? raw.trim() : ''
  if (UUID_RE.test(value)) return { value: value.toLowerCase(), isUuid: true }
  if (PROVIDER_CALL_ID_RE.test(value)) return { value, isUuid: false }
  throw new RequestError('invalid_request', 'Invalid call id.', 400)
}

const PROVIDER_ID_COLUMNS = ['provider_call_id', 'elevenlabs_conversation_id', 'cartesia_call_id'] as const

/**
 * Finds one call of `orgId` by calls.id or by a provider call id. Each lookup
 * is a plain `.eq` on one column, always scoped by org_id.
 */
export async function findOrgCall<T>(
  db: SupabaseClient,
  orgId: string,
  id: ParsedCallId,
  columns: string,
): Promise<T | null> {
  const lookups: string[] = id.isUuid ? ['id', ...PROVIDER_ID_COLUMNS] : [...PROVIDER_ID_COLUMNS]
  for (const column of lookups) {
    const { data, error } = await db
      .from('calls')
      .select(columns)
      .eq('org_id', orgId)
      .eq(column, id.value)
      .limit(1)
      .maybeSingle()
    if (error) throw dbError(`calls lookup by ${column}`, error)
    if (data) return data as T
  }
  return null
}

export function dbError(operation: string, error: { message: string; code?: string }): Error {
  const err = new Error(`${operation} failed: ${error.message}`)
  ;(err as Error & { code?: string }).code = error.code
  return err
}

// ─── Columns and rows ─────────────────────────────────────────────────────────

const BASE_COLUMNS = [
  'id', 'org_id', 'agent_id', 'phone_number_id', 'twilio_call_sid', 'elevenlabs_conversation_id',
  'caller_number', 'direction', 'duration_seconds', 'status', 'sentiment', 'summary',
  'started_at', 'ended_at', 'created_at', 'provider', 'primary_provider', 'routing_reason',
  'failover_reason', 'provider_call_id', 'cartesia_call_id', 'from_number', 'to_number', 'outcome',
  'call_successful', 'summary_title', 'termination_reason', 'has_recording', 'recording_status',
  // Migration 017.
  'channel', 'is_test', 'owner_feedback',
].join(', ')

/** List views: no transcript/analysis (they can be large). */
export const CALL_LIST_COLUMNS: string = `${BASE_COLUMNS}, agents(name)`
/** Detail view. */
export const CALL_DETAIL_COLUMNS: string = `${BASE_COLUMNS}, transcript, analysis, call_metadata, retention_applied_at, agents(name, voice_name)`

type AgentJoin = { name?: string | null; voice_name?: string | null }

export interface CallRow {
  id: string
  org_id: string
  agent_id: string | null
  phone_number_id: string | null
  twilio_call_sid: string | null
  elevenlabs_conversation_id: string | null
  caller_number: string | null
  direction: string | null
  duration_seconds: number | null
  status: string | null
  sentiment: string | null
  summary: string | null
  started_at: string | null
  ended_at: string | null
  created_at: string
  provider: string | null
  primary_provider: string | null
  routing_reason: string | null
  failover_reason: string | null
  provider_call_id: string | null
  cartesia_call_id: string | null
  from_number: string | null
  to_number: string | null
  outcome: string | null
  call_successful: string | null
  summary_title: string | null
  termination_reason: string | null
  has_recording: boolean | null
  recording_status: string | null
  channel?: string | null
  is_test?: boolean | null
  owner_feedback?: string | null
  transcript?: unknown
  analysis?: unknown
  call_metadata?: unknown
  retention_applied_at?: string | null
  agents?: AgentJoin | AgentJoin[] | null
}

function oneOf<T extends string>(values: readonly T[], value: unknown): T | null {
  return typeof value === 'string' && (values as readonly string[]).includes(value) ? (value as T) : null
}

const RECORDING_STATUSES = ['unknown', 'pending', 'available', 'unavailable', 'deleted'] as const
type RecordingStatus = (typeof RECORDING_STATUSES)[number]
const SENTIMENTS: readonly Sentiment[] = ['positive', 'neutral', 'negative']
const CALL_RESULTS = ['success', 'failure', 'unknown'] as const

/** Whether the DB says a recording exists that we may proxy. */
export function recordingAvailable(row: Pick<CallRow, 'has_recording' | 'recording_status'>): boolean {
  if (row.recording_status === 'deleted' || row.recording_status === 'unavailable') return false
  return row.recording_status === 'available' || row.has_recording === true
}

/** Provider + provider-side id that holds this call's audio/transcript. */
export function providerTargets(
  row: Pick<CallRow, 'provider' | 'provider_call_id' | 'elevenlabs_conversation_id' | 'cartesia_call_id'>,
): Array<{ provider: VoiceProviderId; externalId: string }> {
  const out: Array<{ provider: VoiceProviderId; externalId: string }> = []
  const el = row.elevenlabs_conversation_id ?? (row.provider === 'elevenlabs' ? row.provider_call_id : null)
  const ca = row.cartesia_call_id ?? (row.provider === 'cartesia' ? row.provider_call_id : null)
  if (el) out.push({ provider: 'elevenlabs', externalId: el })
  if (ca) out.push({ provider: 'cartesia', externalId: ca })
  return out
}

/** The provider that served the call (legacy rows: ElevenLabs when it has a conversation id). */
export function servingProvider(row: Pick<CallRow, 'provider' | 'elevenlabs_conversation_id'>): VoiceProviderId | null {
  return oneOf(VOICE_PROVIDER_VALUES, row.provider) ?? (row.elevenlabs_conversation_id ? 'elevenlabs' : null)
}

function agentOf(row: CallRow): AgentJoin | null {
  const a = row.agents
  if (!a) return null
  return Array.isArray(a) ? (a[0] ?? null) : a
}

function normalizeTranscript(raw: unknown): TranscriptEntry[] {
  if (!Array.isArray(raw)) return []
  const out: TranscriptEntry[] = []
  for (const item of raw) {
    if (!item || typeof item !== 'object') continue
    const t = item as { role?: unknown; message?: unknown; time_in_call_secs?: unknown }
    if (typeof t.message !== 'string' || !t.message.trim()) continue
    out.push({
      role: t.role === 'agent' ? 'agent' : 'user',
      message: t.message,
      time_in_call_secs: typeof t.time_in_call_secs === 'number' && Number.isFinite(t.time_in_call_secs) ? Math.max(0, Math.round(t.time_in_call_secs)) : 0,
    })
  }
  return out
}

type CallAnalysis = NonNullable<Call['analysis']>

function normalizeAnalysis(raw: unknown): CallAnalysis | null {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null
  const src = raw as { evaluation?: unknown; data?: unknown }
  const evaluation: NonNullable<CallAnalysis['evaluation']> = {}
  if (src.evaluation && typeof src.evaluation === 'object' && !Array.isArray(src.evaluation)) {
    for (const [key, value] of Object.entries(src.evaluation as Record<string, unknown>)) {
      if (!value || typeof value !== 'object') continue
      const v = value as { result?: unknown; rationale?: unknown }
      evaluation[key] = {
        result: typeof v.result === 'string' ? v.result : 'unknown',
        rationale: typeof v.rationale === 'string' && v.rationale.trim() ? v.rationale : null,
      }
    }
  }
  const data: NonNullable<CallAnalysis['data']> = {}
  if (src.data && typeof src.data === 'object' && !Array.isArray(src.data)) {
    for (const [key, value] of Object.entries(src.data as Record<string, unknown>)) {
      if (value === null || typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
        data[key] = value
      }
    }
  }
  if (!Object.keys(evaluation).length && !Object.keys(data).length) return null
  return { evaluation, data }
}

/** DB row → list item (the API never exposes a provider URL or internal routing JSON). */
export function serializeListItem(row: CallRow): CallListItem {
  const direction: CallDirection = row.direction === 'outbound' ? 'outbound' : 'inbound'
  const recording = recordingAvailable(row)
  const provider = servingProvider(row)
  const providerCallId =
    (provider === 'cartesia' ? row.cartesia_call_id : provider === 'elevenlabs' ? row.elevenlabs_conversation_id : null) ??
    row.provider_call_id ??
    null
  return {
    id: row.id,
    org_id: row.org_id,
    agent_id: row.agent_id,
    agent_name: agentOf(row)?.name ?? null,
    phone_number_id: row.phone_number_id,
    twilio_call_sid: row.twilio_call_sid,
    elevenlabs_conversation_id: row.elevenlabs_conversation_id,
    caller_number: row.caller_number ?? (direction === 'outbound' ? row.to_number : row.from_number) ?? null,
    direction,
    duration_seconds: Math.max(0, Math.round(row.duration_seconds ?? 0)),
    status: oneOf(CALL_STATUS_VALUES, row.status) ?? 'completed',
    sentiment: oneOf(SENTIMENTS, row.sentiment),
    summary: row.summary,
    recording_url: recording ? `/api/calls/${row.id}/audio` : null,
    started_at: row.started_at ?? row.created_at ?? null,
    ended_at: row.ended_at,
    created_at: row.created_at,
    provider,
    primary_provider: oneOf(VOICE_PROVIDER_VALUES, row.primary_provider),
    routing_reason: oneOf<RoutingReason>(ROUTING_REASON_VALUES, row.routing_reason),
    failover_reason: row.failover_reason,
    provider_call_id: providerCallId,
    from_number: row.from_number,
    to_number: row.to_number,
    outcome: oneOf<CallOutcome>(CALL_OUTCOMES, row.outcome),
    call_successful: oneOf(CALL_RESULTS, row.call_successful),
    summary_title: row.summary_title,
    termination_reason: row.termination_reason,
    has_recording: recording,
    recording_status: oneOf<RecordingStatus>(RECORDING_STATUSES, row.recording_status) ?? 'unknown',
    channel: oneOf(CHANNELS, row.channel) ?? 'phone',
    is_test: row.is_test === true,
    owner_feedback: oneOf(FEEDBACK_VALUES, row.owner_feedback),
  }
}

const CHANNELS = ['phone', 'web', 'other'] as const
const FEEDBACK_VALUES = ['like', 'dislike'] as const

/** The provider conversation id of an ElevenLabs-served call (null otherwise). */
export function elevenLabsConversationId(row: Pick<CallRow, 'provider' | 'provider_call_id' | 'elevenlabs_conversation_id'>): string | null {
  if (servingProvider(row) !== 'elevenlabs') return null
  return row.elevenlabs_conversation_id ?? row.provider_call_id ?? null
}

/** The call view's provider extras (never cost, never internal routing JSON). */
export function serializeCallDetails(row: CallRow): CallDetails {
  const meta = readCallMetadata(row.call_metadata)
  return {
    main_language: meta.main_language ?? null,
    queue_wait_secs: meta.queue_wait_secs ?? null,
    tool_events: meta.tool_events ?? [],
    provider_error: meta.provider_error ?? null,
    warnings: meta.warnings ?? [],
    content_purged: !!row.retention_applied_at,
    can_reanalyze: !row.retention_applied_at && !!elevenLabsConversationId(row) && !isLiveStatus(row.status),
  }
}

export type CallDetail = Call & { agents: { name: string | null; voice_name: string | null } | null }

/** DB row (with transcript/analysis) → full Call, plus the legacy `agents` object. */
export function serializeCallDetail(row: CallRow): CallDetail {
  const agent = agentOf(row)
  return {
    ...serializeListItem(row),
    transcript: normalizeTranscript(row.transcript),
    analysis: normalizeAnalysis(row.analysis),
    details: serializeCallDetails(row),
    agents: agent ? { name: agent.name ?? null, voice_name: agent.voice_name ?? null } : null,
  }
}

// ─── Query params ─────────────────────────────────────────────────────────────

/** Browsers send `key=` for unset filters: treat empty strings as absent. */
const blankToUndefined = (v: unknown) => (v === '' || v === null ? undefined : v)

function optional<S extends z.ZodType>(schema: S) {
  return z.preprocess(blankToUndefined, schema.optional())
}

/** Like optional(), but absent/blank values become `fallback`. */
function withDefault<S extends z.ZodType>(schema: S, fallback: z.util.NoUndefined<z.core.output<S>>) {
  return z.preprocess(blankToUndefined, schema.default(fallback))
}

const dateParam = z.union([z.iso.date(), z.iso.datetime({ offset: true })])

const SORT_FIELDS = ['created_at', 'started_at', 'duration_seconds', 'caller_number'] as const

export const CallFilterSchema = z.object({
  search: optional(z.string().max(120)),
  status: withDefault(z.enum(['all', ...CALL_STATUS_VALUES]), 'all'),
  direction: withDefault(z.enum(['all', 'inbound', 'outbound']), 'all'),
  sentiment: withDefault(z.enum(['all', 'positive', 'neutral', 'negative']), 'all'),
  provider: withDefault(z.enum(['all', ...VOICE_PROVIDER_VALUES]), 'all'),
  routing: withDefault(z.enum(['all', ...ROUTING_REASON_VALUES]), 'all'),
  outcome: withDefault(z.enum(['all', ...CALL_OUTCOMES]), 'all'),
  /** call_successful ("AI outcome"). */
  aiOutcome: withDefault(z.enum(['all', ...AI_OUTCOME_VALUES]), 'all'),
  dateFrom: optional(dateParam),
  dateTo: optional(dateParam),
  minDuration: withDefault(z.coerce.number().int().min(0).max(86_400), 0),
  sortBy: withDefault(z.enum(SORT_FIELDS), 'created_at'),
  sortOrder: withDefault(z.enum(['asc', 'desc']), 'desc'),
})
export type CallFilterParams = z.infer<typeof CallFilterSchema>

export const CallListQuerySchema = CallFilterSchema.extend({
  page: withDefault(z.coerce.number().int().min(1).max(100_000), 1),
  limit: withDefault(z.coerce.number().int().min(1).max(100), 25),
})

/** `?limit=` for small "latest N" endpoints. */
export function limitQuerySchema(max: number, fallback: number) {
  return z.object({ limit: withDefault(z.coerce.number().int().min(1).max(max), fallback) })
}

/** Parses URL query params with `schema`; invalid values → 400 with field paths. */
export function parseQuery<S extends z.ZodType>(request: Request, schema: S): z.infer<S> {
  const params = Object.fromEntries(new URL(request.url).searchParams.entries())
  const parsed = schema.safeParse(params)
  if (!parsed.success) {
    throw new RequestError(
      'invalid_request',
      'Some query parameters are invalid.',
      400,
      parsed.error.issues.slice(0, 10).map((i) => ({ path: i.path.join('.'), message: i.message })),
    )
  }
  return parsed.data
}

// ─── Filters → PostgREST ──────────────────────────────────────────────────────

/** PostgREST quoted value. Callers only pass server-built or whitelisted text. */
function quoted(value: string): string {
  return `"${value.replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"`
}

/**
 * Search: phone-like input becomes digits only (number columns); anything else
 * keeps letters (incl. Romanian diacritics), digits, spaces, apostrophes and
 * hyphens for the title/summary columns. Everything else is dropped, so the
 * resulting filter string cannot change the query's structure.
 */
export function searchExpression(raw: string | undefined, fullTextIds?: string[] | null): string | null {
  const input = (raw ?? '').trim()
  if (!input) return null
  if (/^[+\d\s().-]+$/.test(input)) {
    const digits = input.replace(/\D/g, '').slice(0, 15)
    if (digits.length < 3) return null
    const v = quoted(`*${digits}*`)
    return ['caller_number', 'from_number', 'to_number'].map((c) => `${c}.ilike.${v}`).join(',')
  }
  const text = input
    .replace(/[^A-Za-z0-9À-ɏ' -]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 80)
  // Full-text matches over transcripts (lib/calls/search.ts): server-made UUIDs only.
  const ids = (fullTextIds ?? []).filter((id) => UUID_RE.test(id))
  const idGroup = ids.length ? `id.in.(${ids.join(',')})` : null
  if (text.length < 2) return idGroup
  const v = quoted(`*${text}*`)
  return [...['summary_title', 'summary'].map((c) => `${c}.ilike.${v}`), ...(idGroup ? [idGroup] : [])].join(',')
}

/** `started_at` in [from, to), falling back to created_at when started_at is null. */
export function timeRangeExpression(from: Date | null, to: Date | null): string | null {
  if (!from && !to) return null
  const bounds = (col: string) => [
    ...(from ? [`${col}.gte.${quoted(from.toISOString())}`] : []),
    ...(to ? [`${col}.lt.${quoted(to.toISOString())}`] : []),
  ]
  return `and(${bounds('started_at').join(',')}),and(started_at.is.null,${bounds('created_at').join(',')})`
}

/** Combines OR-groups so that all of them must match (one `or=` param). */
export function combineOrGroups(groups: Array<string | null>): string | null {
  const present = groups.filter((g): g is string => !!g)
  if (present.length === 0) return null
  if (present.length === 1) return present[0]
  return `and(${present.map((g) => `or(${g})`).join(',')})`
}

interface FilterBuilder<Self> {
  eq(column: string, value: string): Self
  gte(column: string, value: number): Self
  or(filters: string): Self
}

/**
 * The "Transferred" status filter. A human transfer keeps status
 * completed/in-progress and records outcome='transferred'; legacy rows may
 * carry status='transferred' instead.
 */
export const TRANSFERRED_EXPRESSION = 'outcome.eq.transferred,status.eq.transferred'

/**
 * Applies the validated list filters (status, direction, provider, outcome,
 * AI outcome, dates, search...). `fullTextIds`: transcript matches found by
 * lib/calls/search.ts for a text search (OR-ed with the summary match).
 */
export function applyCallFilters<Q extends FilterBuilder<Q>>(query: Q, f: CallFilterParams, timeZone: string, fullTextIds?: string[] | null): Q {
  let q = query
  if (f.status !== 'all' && f.status !== 'transferred') q = q.eq('status', f.status)
  if (f.direction !== 'all') q = q.eq('direction', f.direction)
  if (f.sentiment !== 'all') q = q.eq('sentiment', f.sentiment)
  if (f.provider !== 'all') q = q.eq('provider', f.provider)
  if (f.routing !== 'all') q = q.eq('routing_reason', f.routing)
  if (f.outcome !== 'all') q = q.eq('outcome', f.outcome)
  if (f.aiOutcome !== 'all') q = q.eq('call_successful', f.aiOutcome)
  if (f.minDuration > 0) q = q.gte('duration_seconds', f.minDuration)
  const from = f.dateFrom ? rangeStart(f.dateFrom, timeZone) : null
  const to = f.dateTo ? rangeEnd(f.dateTo, timeZone) : null
  const statusGroup = f.status === 'transferred' ? TRANSFERRED_EXPRESSION : null
  const or = combineOrGroups([statusGroup, searchExpression(f.search, fullTextIds), timeRangeExpression(from, to)])
  if (or) q = q.or(or)
  return q
}

// ─── Time zones ───────────────────────────────────────────────────────────────

export function safeTimeZone(tz: string | null | undefined): string {
  if (!tz) return 'UTC'
  try {
    new Intl.DateTimeFormat('en-US', { timeZone: tz })
    return tz
  } catch (err) {
    // An invalid IANA name throws RangeError: fall back to UTC (organizations
    // validate the zone on save; this guards rows written before that).
    if (err instanceof RangeError) return 'UTC'
    throw err
  }
}

export interface LocalDate {
  year: number
  month: number // 1-12
  day: number
}

const WEEKDAY_INDEX: Record<string, number> = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 }
const formatters = new Map<string, Intl.DateTimeFormat>()

function formatter(timeZone: string): Intl.DateTimeFormat {
  let f = formatters.get(timeZone)
  if (!f) {
    f = new Intl.DateTimeFormat('en-US', {
      timeZone,
      hourCycle: 'h23',
      year: 'numeric',
      month: 'numeric',
      day: 'numeric',
      hour: 'numeric',
      minute: 'numeric',
      second: 'numeric',
      weekday: 'short',
    })
    formatters.set(timeZone, f)
  }
  return f
}

export interface WallTime extends LocalDate {
  hour: number
  minute: number
  second: number
  weekday: number // 0 = Sunday
}

export function wallTime(date: Date, timeZone: string): WallTime {
  const parts = formatter(timeZone).formatToParts(date)
  const get = (type: Intl.DateTimeFormatPartTypes) => parts.find((p) => p.type === type)?.value ?? ''
  return {
    year: Number(get('year')),
    month: Number(get('month')),
    day: Number(get('day')),
    hour: Number(get('hour')) % 24,
    minute: Number(get('minute')),
    second: Number(get('second')),
    weekday: WEEKDAY_INDEX[get('weekday')] ?? 0,
  }
}

function offsetMs(utcMs: number, timeZone: string): number {
  const whole = Math.floor(utcMs / 1000) * 1000
  const w = wallTime(new Date(whole), timeZone)
  return Date.UTC(w.year, w.month - 1, w.day, w.hour, w.minute, w.second) - whole
}

/** UTC instant of local midnight starting `d` in `timeZone`. */
export function zonedDayStart(d: LocalDate, timeZone: string): Date {
  const guess = Date.UTC(d.year, d.month - 1, d.day)
  const first = offsetMs(guess, timeZone)
  let ts = guess - first
  const second = offsetMs(ts, timeZone)
  if (second !== first) ts = guess - second
  return new Date(ts)
}

export function localDateOf(date: Date, timeZone: string): LocalDate {
  const w = wallTime(date, timeZone)
  return { year: w.year, month: w.month, day: w.day }
}

export function shiftDays(d: LocalDate, days: number): LocalDate {
  const t = new Date(Date.UTC(d.year, d.month - 1, d.day + days))
  return { year: t.getUTCFullYear(), month: t.getUTCMonth() + 1, day: t.getUTCDate() }
}

export function shiftMonths(d: LocalDate, months: number): LocalDate {
  const t = new Date(Date.UTC(d.year, d.month - 1 + months, 1))
  return { year: t.getUTCFullYear(), month: t.getUTCMonth() + 1, day: 1 }
}

function parseLocalDate(value: string): LocalDate | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value)
  return m ? { year: Number(m[1]), month: Number(m[2]), day: Number(m[3]) } : null
}

/** A date filter's inclusive start: a calendar day starts at local midnight. */
export function rangeStart(value: string, timeZone: string): Date {
  const d = parseLocalDate(value)
  return d ? zonedDayStart(d, timeZone) : new Date(value)
}

/** A date filter's exclusive end: a calendar day includes the whole day. */
export function rangeEnd(value: string, timeZone: string): Date {
  const d = parseLocalDate(value)
  return d ? zonedDayStart(shiftDays(d, 1), timeZone) : new Date(new Date(value).getTime() + 1)
}

// ─── Facts for metrics ────────────────────────────────────────────────────────

export interface CallFact {
  status: string | null
  sentiment: string | null
  duration_seconds: number | null
  started_at: string | null
  created_at: string
  call_successful?: string | null
  outcome?: string | null
}

export const FACT_COLUMNS: string = 'status, sentiment, duration_seconds, started_at, created_at, call_successful, outcome'

export function factTime(f: Pick<CallFact, 'started_at' | 'created_at'>): number {
  return Date.parse(f.started_at ?? f.created_at)
}

const FACT_PAGE = 1000
/** Upper bound for in-memory aggregation; newest calls first, so recent windows stay exact. */
export const FACT_MAX_ROWS = 20_000

/**
 * Loads the small per-call facts needed for metrics, newest first, paging past
 * PostgREST's max-rows limit. `total` is the exact count of matching calls;
 * `truncated` is true when more than FACT_MAX_ROWS matched.
 */
export async function loadCallFacts(
  db: SupabaseClient,
  orgId: string,
  opts: { since?: Date } = {},
): Promise<{ facts: CallFact[]; total: number; truncated: boolean }> {
  const facts: CallFact[] = []
  let total = 0
  const range = opts.since ? timeRangeExpression(opts.since, null) : null
  for (let offset = 0; offset < FACT_MAX_ROWS; ) {
    let q = db
      .from('calls')
      .select(FACT_COLUMNS, offset === 0 ? { count: 'exact' } : undefined)
      .eq('org_id', orgId)
      // Test sessions (web, SDK, dashboard previews) never count in metrics.
      .eq('is_test', false)
    if (range) q = q.or(range)
    const { data, error, count } = await q
      .order('created_at', { ascending: false })
      .order('id', { ascending: false })
      .range(offset, Math.min(offset + FACT_PAGE, FACT_MAX_ROWS) - 1)
    if (error) throw dbError('calls facts query', error)
    if (offset === 0) total = count ?? 0
    const rows = (data ?? []) as unknown as CallFact[]
    facts.push(...rows)
    offset += rows.length
    if (rows.length === 0 || facts.length >= total) break
  }
  return { facts, total: Math.max(total, facts.length), truncated: total > facts.length }
}

// ─── CSV ──────────────────────────────────────────────────────────────────────

const FORMULA_START = /^[=+\-@\t\r]/

/**
 * One CSV cell: neutralises spreadsheet formulas (a leading = + - @ tab or CR
 * gets a leading apostrophe) and quotes per RFC 4180.
 */
export function csvCell(value: unknown): string {
  let s = value === null || value === undefined ? '' : String(value)
  if (FORMULA_START.test(s)) s = `'${s}`
  if (/[",\r\n]/.test(s) || /^\s|\s$/.test(s)) s = `"${s.replace(/"/g, '""')}"`
  return s
}

export function isCallStatus(value: unknown): value is CallStatus {
  return oneOf(CALL_STATUS_VALUES, value) !== null
}

export function asRoutingReason(value: unknown): RoutingReason | null {
  return oneOf<RoutingReason>(ROUTING_REASON_VALUES, value)
}
