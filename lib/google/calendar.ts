import 'server-only'
import { calendar, type calendar_v3 } from 'googleapis/build/src/apis/calendar'
import { getAuthorizedClient, googleErrorInfo, isGoogleAuthError, markGoogleIntegrationBroken } from '@/lib/google/client'
import type { BusyInterval } from '@/lib/scheduling/slots'

// Google Calendar operations used by booking: calendar list for the settings
// page, busy times, and the events behind each booking. Every event the agent
// creates carries private extended properties (ntv_booking_id, ntv_call_id,
// ntv_caller_phone) so it can be traced back to the booking and the call.
// Availability math lives in lib/scheduling/slots.ts (pure, tested).

export {
  generateSlots,
  resolveService,
  spreadSlots,
  mergeBusy,
  subtractInterval,
  type AvailableSlot,
  type BusyInterval,
  type DateRange,
  type SlotRules,
  type TimeOfDay,
} from '@/lib/scheduling/slots'

export type GoogleCalendarErrorCode = 'auth' | 'not_found' | 'rate_limited' | 'timeout' | 'failed'

export class GoogleCalendarError extends Error {
  readonly code: GoogleCalendarErrorCode

  constructor(code: GoogleCalendarErrorCode, message: string) {
    super(message)
    this.name = 'GoogleCalendarError'
    this.code = code
  }
}

/** Calendar API client for the org's connected Google Calendar, or null when it isn't connected. */
export async function getCalendarClientForOrg(orgId: string): Promise<calendar_v3.Calendar | null> {
  const auth = await getAuthorizedClient(orgId, 'google_calendar')
  return auth ? calendar({ version: 'v3', auth }) : null
}

function isAbort(error: unknown): boolean {
  if (!error || typeof error !== 'object') return false
  const name = (error as { name?: unknown }).name
  const code = (error as { code?: unknown }).code
  return name === 'AbortError' || name === 'TimeoutError' || code === 'ABORT_ERR' || code === 'ETIMEDOUT'
}

async function toCalendarError(orgId: string, operation: string, error: unknown): Promise<GoogleCalendarError> {
  if (error instanceof GoogleCalendarError) return error
  if (isAbort(error)) return new GoogleCalendarError('timeout', `Google Calendar ${operation} timed out`)
  const info = googleErrorInfo(error)
  if (isGoogleAuthError(error)) {
    await markGoogleIntegrationBroken(orgId, 'google_calendar', 'Google Calendar access was revoked or expired. Please reconnect it.')
    return new GoogleCalendarError('auth', 'Google Calendar access was revoked or expired')
  }
  if (info.status === 404 || info.status === 410 || info.reason === 'notFound') {
    return new GoogleCalendarError('not_found', `Google Calendar ${operation}: not found`)
  }
  if (info.status === 429 || info.reason === 'rateLimitExceeded' || info.reason === 'userRateLimitExceeded') {
    console.warn('[google] calendar rate limited', { operation, orgId })
    return new GoogleCalendarError('rate_limited', 'Google Calendar is rate limiting requests')
  }
  console.error('[google] calendar request failed', { operation, orgId, status: info.status, reason: info.reason })
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
export async function listCalendars(
  orgId: string,
  opts: { client?: calendar_v3.Calendar; signal?: AbortSignal } = {}
): Promise<CalendarSummary[] | null> {
  const client = opts.client ?? (await getCalendarClientForOrg(orgId))
  if (!client) return null
  const response = await callCalendar(orgId, 'calendar list', () =>
    client.calendarList.list(
      {
        minAccessRole: 'reader',
        maxResults: 250,
        fields: 'items(id,summary,summaryOverride,primary,timeZone,accessRole)',
      },
      { signal: opts.signal }
    )
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
  input: { orgId: string; calendarId: string; timeMin: number; timeMax: number; signal?: AbortSignal }
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
      { signal: input.signal }
    )
  )
  const calendars = response.data.calendars ?? {}
  const entry = calendars[input.calendarId] ?? Object.values(calendars)[0]
  if (!entry) throw new GoogleCalendarError('failed', 'Google Calendar returned no availability')
  if (entry.errors?.length) {
    const reason = entry.errors[0]?.reason ?? 'unknown'
    if (reason === 'notFound') throw new GoogleCalendarError('not_found', 'The booking calendar was not found')
    console.error('[google] free/busy calendar error', { orgId: input.orgId, reason })
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
  ntv_caller_phone?: string | null
}

export interface CreateEventInput {
  orgId: string
  calendarId: string
  summary: string
  description: string
  startMs: number
  endMs: number
  timezone: string
  /** Invited by email (Google sends the invite) when the caller gave an address. */
  attendee?: { email: string; name?: string | null } | null
  properties: BookingEventProperties
  signal?: AbortSignal
}

function privateProperties(props: BookingEventProperties): Record<string, string> {
  const out: Record<string, string> = { ntv_booking_id: props.ntv_booking_id }
  if (props.ntv_call_id) out.ntv_call_id = props.ntv_call_id
  if (props.ntv_caller_phone) out.ntv_caller_phone = props.ntv_caller_phone
  return out
}

export async function createEvent(client: calendar_v3.Calendar, input: CreateEventInput): Promise<{ id: string; htmlLink: string | null }> {
  const attendee = input.attendee?.email ? input.attendee : null
  const response = await callCalendar(input.orgId, 'event insert', () =>
    client.events.insert(
      {
        calendarId: input.calendarId,
        sendUpdates: attendee ? 'all' : 'none',
        requestBody: {
          summary: input.summary.slice(0, 250),
          description: input.description.slice(0, 4000),
          start: { dateTime: new Date(input.startMs).toISOString(), timeZone: input.timezone },
          end: { dateTime: new Date(input.endMs).toISOString(), timeZone: input.timezone },
          ...(attendee ? { attendees: [{ email: attendee.email, displayName: attendee.name ?? undefined }] } : {}),
          extendedProperties: { private: privateProperties(input.properties) },
        },
      },
      // Creating is not idempotent: never let the HTTP layer retry it.
      { signal: input.signal, retry: false }
    )
  )
  const id = response.data.id
  if (!id) throw new GoogleCalendarError('failed', 'Google Calendar did not return the new event')
  return { id, htmlLink: response.data.htmlLink ?? null }
}

/**
 * The live event created for a booking, found by its private ntv_booking_id.
 * Used after an insert that timed out or failed on Google's side: the event
 * may exist even though the response never arrived.
 */
export async function findBookingEvent(
  client: calendar_v3.Calendar,
  input: { orgId: string; calendarId: string; bookingId: string; signal?: AbortSignal }
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
      { signal: input.signal }
    )
  )
  const live = (response.data.items ?? []).find((item) => typeof item.id === 'string' && item.status !== 'cancelled')
  return live?.id ?? null
}

export interface PatchEventInput {
  orgId: string
  calendarId: string
  eventId: string
  startMs?: number
  endMs?: number
  timezone?: string
  summary?: string
  description?: string
  sendUpdates?: boolean
  signal?: AbortSignal
}

export async function patchEvent(client: calendar_v3.Calendar, input: PatchEventInput): Promise<void> {
  const body: calendar_v3.Schema$Event = {}
  if (input.startMs !== undefined) body.start = { dateTime: new Date(input.startMs).toISOString(), timeZone: input.timezone }
  if (input.endMs !== undefined) body.end = { dateTime: new Date(input.endMs).toISOString(), timeZone: input.timezone }
  if (input.summary !== undefined) body.summary = input.summary.slice(0, 250)
  if (input.description !== undefined) body.description = input.description.slice(0, 4000)
  await callCalendar(input.orgId, 'event update', () =>
    client.events.patch(
      {
        calendarId: input.calendarId,
        eventId: input.eventId,
        sendUpdates: input.sendUpdates ? 'all' : 'none',
        requestBody: body,
      },
      { signal: input.signal }
    )
  )
}

/** Deletes an event; one that is already gone counts as deleted. */
export async function deleteEvent(
  client: calendar_v3.Calendar,
  input: { orgId: string; calendarId: string; eventId: string; sendUpdates?: boolean; signal?: AbortSignal }
): Promise<{ alreadyGone: boolean }> {
  try {
    await callCalendar(input.orgId, 'event delete', () =>
      client.events.delete(
        { calendarId: input.calendarId, eventId: input.eventId, sendUpdates: input.sendUpdates ? 'all' : 'none' },
        { signal: input.signal }
      )
    )
    return { alreadyGone: false }
  } catch (error) {
    if (error instanceof GoogleCalendarError && error.code === 'not_found') return { alreadyGone: true }
    throw error
  }
}
