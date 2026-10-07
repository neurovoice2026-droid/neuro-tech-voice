import 'server-only'
// Google Calendar operations used by in-call booking: the calendar list for
// the settings page, busy times, and the event behind each booking. Every
// event the agent creates carries private extended properties
// (ntv_booking_id, ntv_call_id) so it can be traced back to the booking and
// the call, and found again after a timed-out insert.
//
// Ported from commit e7c7974 (lib/google/calendar.ts), adapted to this
// branch: the connection is the org's `google_calendar` row in
// `integrations` (refresh token, read with the service role and an explicit
// org filter), the OAuth client comes from lib/google/client.ts, and errors
// are logged with the structured logger. Availability math lives in
// lib/scheduling/slots.ts (pure, tested).

import { calendar, type calendar_v3 } from 'googleapis/build/src/apis/calendar'
import { createAdminClient } from '@/lib/supabase/admin'
import { getGoogleClientWithToken } from '@/lib/google/client'
import { createLogger } from '@/lib/observability/logger'
import type { BusyInterval } from '@/lib/scheduling/slots'

const log = createLogger({ component: 'google_calendar' })

export type GoogleCalendarErrorCode = 'auth' | 'not_found' | 'rate_limited' | 'timeout' | 'failed'

export class GoogleCalendarError extends Error {
  readonly code: GoogleCalendarErrorCode

  constructor(code: GoogleCalendarErrorCode, message: string) {
    super(message)
    this.name = 'GoogleCalendarError'
    this.code = code
  }
}

export interface CalendarConnection {
  connected: boolean
  /** The row exists and is active but Google refused the token (needs reconnecting). */
  needsReconnect: boolean
}

/** Whether the org has an active Google Calendar connection with a refresh token (no Google call). */
export async function calendarConnection(orgId: string): Promise<CalendarConnection> {
  const { data, error } = await createAdminClient()
    .from('integrations')
    .select('is_active, google_refresh_token, config, connected_at')
    .eq('org_id', orgId)
    .eq('type', 'google_calendar')
    .maybeSingle()
  if (error) throw new Error(`integrations read failed: ${error.message}`)
  const connected = !!data?.is_active && typeof data.google_refresh_token === 'string' && data.google_refresh_token.length > 0
  const config = (data?.config ?? {}) as { auth_error_at?: unknown }
  // A reconnect (new consent) moves connected_at past the recorded refusal.
  const refusedAt = typeof config.auth_error_at === 'string' ? Date.parse(config.auth_error_at) : NaN
  const connectedAt = typeof data?.connected_at === 'string' ? Date.parse(data.connected_at) : NaN
  return { connected, needsReconnect: connected && Number.isFinite(refusedAt) && !(connectedAt > refusedAt) }
}

/** Calendar API client for the org's connected Google Calendar, or null when it isn't connected. */
export async function getCalendarClientForOrg(orgId: string): Promise<calendar_v3.Calendar | null> {
  const { data, error } = await createAdminClient()
    .from('integrations')
    .select('is_active, google_refresh_token')
    .eq('org_id', orgId)
    .eq('type', 'google_calendar')
    .maybeSingle()
  if (error) throw new Error(`integrations read failed: ${error.message}`)
  if (!data?.is_active || typeof data.google_refresh_token !== 'string' || !data.google_refresh_token) return null
  if (!process.env.GOOGLE_CLIENT_ID || !process.env.GOOGLE_CLIENT_SECRET) return null
  return calendar({ version: 'v3', auth: getGoogleClientWithToken(data.google_refresh_token) })
}

function isAbort(error: unknown): boolean {
  if (!error || typeof error !== 'object') return false
  const name = (error as { name?: unknown }).name
  const code = (error as { code?: unknown }).code
  return name === 'AbortError' || name === 'TimeoutError' || code === 'ABORT_ERR' || code === 'ETIMEDOUT'
}

/** HTTP status and Google reason of a googleapis (Gaxios) error, without its message or config. */
export function googleErrorInfo(error: unknown): { status: number | null; reason: string | null; grant: string | null } {
  if (!error || typeof error !== 'object') return { status: null, reason: null, grant: null }
  const e = error as { status?: unknown; code?: unknown; response?: { status?: unknown; data?: unknown } }
  const statusRaw = e.response?.status ?? e.status ?? (typeof e.code === 'number' ? e.code : null)
  const status = typeof statusRaw === 'number' ? statusRaw : null
  const data = (e.response?.data ?? null) as { error?: unknown } | null
  let reason: string | null = null
  let grant: string | null = null
  if (data && typeof data.error === 'string') grant = data.error // token endpoint: { error: 'invalid_grant' }
  else if (data && data.error && typeof data.error === 'object') {
    const errors = (data.error as { errors?: Array<{ reason?: unknown }> }).errors
    const first = errors?.[0]?.reason
    reason = typeof first === 'string' ? first : null
  }
  return { status, reason, grant }
}

/** Revoked or expired consent: the owner must reconnect. */
export function isGoogleAuthError(error: unknown): boolean {
  const info = googleErrorInfo(error)
  return info.grant === 'invalid_grant' || info.status === 401 || (info.status === 403 && (info.reason === 'insufficientPermissions' || info.reason === 'forbidden'))
}

/** Remembers that Google refused the token (shown in the settings as "reconnect"). Logged, never thrown. */
async function markNeedsReconnect(orgId: string): Promise<void> {
  const db = createAdminClient()
  const { data, error } = await db.from('integrations').select('config').eq('org_id', orgId).eq('type', 'google_calendar').maybeSingle()
  if (error || !data) {
    if (error) log.error('google_calendar.mark_reconnect_failed', error, { orgId })
    return
  }
  const config = { ...((data.config ?? {}) as Record<string, unknown>), auth_error_at: new Date().toISOString() }
  const { error: updErr } = await db.from('integrations').update({ config }).eq('org_id', orgId).eq('type', 'google_calendar')
  if (updErr) log.error('google_calendar.mark_reconnect_failed', updErr, { orgId })
}

async function toCalendarError(orgId: string, operation: string, error: unknown): Promise<GoogleCalendarError> {
  if (error instanceof GoogleCalendarError) return error
  if (isAbort(error)) return new GoogleCalendarError('timeout', `Google Calendar ${operation} timed out`)
  const info = googleErrorInfo(error)
  if (isGoogleAuthError(error)) {
    log.warn('google_calendar.auth_failed', { orgId, operation, status: info.status })
    await markNeedsReconnect(orgId)
    return new GoogleCalendarError('auth', 'Google Calendar access was revoked or expired')
  }
  if (info.status === 404 || info.status === 410 || info.reason === 'notFound') {
    return new GoogleCalendarError('not_found', `Google Calendar ${operation}: not found`)
  }
  if (info.status === 429 || info.reason === 'rateLimitExceeded' || info.reason === 'userRateLimitExceeded') {
    log.warn('google_calendar.rate_limited', { orgId, operation })
    return new GoogleCalendarError('rate_limited', 'Google Calendar is rate limiting requests')
  }
  log.error('google_calendar.request_failed', undefined, { orgId, operation, status: info.status, reason: info.reason })
  return new GoogleCalendarError('failed', `Google Calendar ${operation} failed`)
}

async function callCalendar<T>(orgId: string, operation: string, run: () => Promise<T>): Promise<T> {
  try {
    return await run()
  } catch (error) {
    throw await toCalendarError(orgId, operation, error)
  }
}

// ─── Calendars ──────────────────────────────────────────────────────────────

export interface CalendarSummary {
  id: string
  name: string
  primary: boolean
  timeZone: string | null
  /** Writer or owner access: events can be created in it. */
  canBook: boolean
}

/**
 * The connected account's calendars, primary first, or null when Google
 * Calendar isn't connected. Throws GoogleCalendarError when Google fails.
 */
export async function listCalendars(orgId: string, opts: { client?: calendar_v3.Calendar; signal?: AbortSignal } = {}): Promise<CalendarSummary[] | null> {
  const client = opts.client ?? (await getCalendarClientForOrg(orgId))
  if (!client) return null
  const response = await callCalendar(orgId, 'calendar list', () =>
    client.calendarList.list(
      {
        minAccessRole: 'reader',
        maxResults: 250,
        fields: 'items(id,summary,summaryOverride,primary,timeZone,accessRole)',
      },
      { signal: opts.signal },
    ),
  )
  const items = response.data.items ?? []
  return items
    .filter((item): item is calendar_v3.Schema$CalendarListEntry & { id: string } => typeof item.id === 'string')
    .map((item) => ({
      id: item.id,
      name: item.summaryOverride || item.summary || item.id,
      primary: item.primary === true,
      timeZone: item.timeZone ?? null,
      canBook: item.accessRole === 'owner' || item.accessRole === 'writer',
    }))
    .sort((a, b) => Number(b.primary) - Number(a.primary) || a.name.localeCompare(b.name))
}

// ─── Busy times ─────────────────────────────────────────────────────────────

/** Busy blocks of one calendar between two instants (epoch ms). */
export async function freeBusy(
  client: calendar_v3.Calendar,
  input: { orgId: string; calendarId: string; timeMin: number; timeMax: number; signal?: AbortSignal },
): Promise<BusyInterval[]> {
  const response = await callCalendar(input.orgId, 'free/busy', () =>
    client.freebusy.query(
      {
        requestBody: {
          timeMin: new Date(input.timeMin).toISOString(),
          timeMax: new Date(input.timeMax).toISOString(),
          items: [{ id: input.calendarId }],
        },
      },
      { signal: input.signal },
    ),
  )
  const calendars = response.data.calendars ?? {}
  const entry = calendars[input.calendarId] ?? Object.values(calendars)[0]
  if (!entry) throw new GoogleCalendarError('failed', 'Google Calendar returned no availability')
  if (entry.errors?.length) {
    const reason = entry.errors[0]?.reason ?? 'unknown'
    if (reason === 'notFound') throw new GoogleCalendarError('not_found', 'The booking calendar was not found')
    log.error('google_calendar.freebusy_calendar_error', undefined, { orgId: input.orgId, reason })
    throw new GoogleCalendarError('failed', 'Google Calendar could not read availability')
  }
  return (entry.busy ?? [])
    .map((block) => ({ start: Date.parse(block.start ?? ''), end: Date.parse(block.end ?? '') }))
    .filter((block) => Number.isFinite(block.start) && Number.isFinite(block.end) && block.end > block.start)
}

// ─── Events ─────────────────────────────────────────────────────────────────

export interface BookingEventProperties {
  ntv_booking_id: string
  ntv_call_id?: string | null
}

export interface CreateEventInput {
  orgId: string
  calendarId: string
  summary: string
  description: string
  startMs: number
  endMs: number
  timezone: string
  properties: BookingEventProperties
  signal?: AbortSignal
}

function privateProperties(props: BookingEventProperties): Record<string, string> {
  const out: Record<string, string> = { ntv_booking_id: props.ntv_booking_id }
  if (props.ntv_call_id) out.ntv_call_id = props.ntv_call_id
  return out
}

export async function createEvent(client: calendar_v3.Calendar, input: CreateEventInput): Promise<{ id: string }> {
  const response = await callCalendar(input.orgId, 'event insert', () =>
    client.events.insert(
      {
        calendarId: input.calendarId,
        // No attendees: Google never e-mails the caller from the business's account.
        sendUpdates: 'none',
        requestBody: {
          summary: input.summary.slice(0, 250),
          description: input.description.slice(0, 4000),
          start: { dateTime: new Date(input.startMs).toISOString(), timeZone: input.timezone },
          end: { dateTime: new Date(input.endMs).toISOString(), timeZone: input.timezone },
          extendedProperties: { private: privateProperties(input.properties) },
        },
      },
      // Creating is not idempotent: never let the HTTP layer retry it.
      { signal: input.signal, retry: false },
    ),
  )
  const id = response.data.id
  if (!id) throw new GoogleCalendarError('failed', 'Google Calendar did not return the new event')
  return { id }
}

/**
 * The live event created for a booking, found by its private ntv_booking_id.
 * Used after an insert that timed out or failed on Google's side: the event
 * may exist even though the response never arrived.
 */
export async function findBookingEvent(
  client: calendar_v3.Calendar,
  input: { orgId: string; calendarId: string; bookingId: string; signal?: AbortSignal },
): Promise<string | null> {
  const response = await callCalendar(input.orgId, 'event lookup', () =>
    client.events.list(
      {
        calendarId: input.calendarId,
        privateExtendedProperty: [`ntv_booking_id=${input.bookingId}`],
        showDeleted: false,
        maxResults: 5,
        fields: 'items(id,status)',
      },
      { signal: input.signal },
    ),
  )
  const live = (response.data.items ?? []).find((item) => typeof item.id === 'string' && item.status !== 'cancelled')
  return live?.id ?? null
}
