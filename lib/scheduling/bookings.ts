import 'server-only'
import type { calendar_v3 } from 'googleapis/build/src/apis/calendar'
import { createAdminClient } from '@/lib/supabase/admin'
import { kvDel, kvIncr } from '@/lib/kv'
import { isE164 } from '@/lib/phone/e164'
import { sendSms } from '@/lib/twilio/sms'
import {
  createEvent,
  deleteEvent,
  findBookingEvent,
  freeBusy,
  getCalendarClientForOrg,
  GoogleCalendarError,
  patchEvent,
} from '@/lib/google/calendar'
import { loadSchedulingSettings } from '@/lib/scheduling/settings'
import {
  appointmentMinutes,
  clampRange,
  generateSlots,
  resolveService,
  subtractInterval,
  type AvailableSlot,
  type BusyInterval,
  type TimeOfDay,
} from '@/lib/scheduling/slots'
import {
  addDays,
  compareDates,
  formatIsoDate,
  localDateOf,
  parseDateTimeInZone,
  safeTimeZone,
  type CalendarDate,
} from '@/lib/scheduling/time'
import { offerFreedSlot } from '@/lib/scheduling/waitlist'
import { bookingCancelledSms, bookingConfirmationSms, bookingRescheduledSms } from '@/lib/sms/templates'
import type { Booking, SchedulingSettings, ServiceOffering, WorkingHours } from '@/types'

// Bookings: the local mirror of every appointment the agent (or the dashboard)
// makes in Google Calendar. Rules that keep it honest:
// - a time is only booked after a fresh busy check right before writing, under
//   a short per-organisation lock, so two callers can't take the same slot
// - retries of the same request (model or gateway) return the first booking:
//   idempotency key `<call_id>:<start in UTC>`
// - a booking row is never left behind without its calendar event
// - calendar writes run to their own deadline, not the caller's: once Google
//   has a change, the booking records it even if the tool already answered
// - callers can only see, move or cancel bookings made under their own number

export type Defer = (task: () => Promise<unknown>) => void

export const BOOKING_COLUMNS =
  'id, org_id, agent_id, call_id, calendar_id, google_event_id, caller_name, caller_phone, caller_email, service, starts_at, ends_at, timezone, status, notes, confirmation_sent_at, reminder_sent_at, created_at, updated_at'

const ACTIVE_STATUSES = ['booked', 'rescheduled'] as const
/** Extra days searched after an empty range, so one tool call can still offer something. */
const LOOKAHEAD_DAYS = 7
/** Covers a busy check, the insert, a slow calendar write and the event lookup after it. */
const LOCK_TTL_SECONDS = 30
const LOCK_ATTEMPTS = 8
const LOCK_WAIT_MS = 350
const HOUR_MS = 3_600_000
const CALENDAR_WRITE_TIMEOUT_MS = 10_000
const EVENT_LOOKUP_TIMEOUT_MS = 4_000

function isActiveStatus(status: unknown): boolean {
  return (ACTIVE_STATUSES as readonly unknown[]).includes(status)
}

/**
 * Deadline for one calendar write. The caller's signal decides whether a write
 * starts; once Google has the request it gets this deadline instead, so a
 * change Google applied is also recorded here. The voice tool has already told
 * the model to check with find_booking when it answered before this finished.
 */
function calendarWriteSignal(): AbortSignal {
  return AbortSignal.timeout(CALENDAR_WRITE_TIMEOUT_MS)
}

export type CalendarFailure = 'not_connected' | 'calendar_error' | 'calendar_auth' | 'calendar_not_found' | 'timeout'

function calendarFailure(error: unknown): CalendarFailure {
  if (error instanceof GoogleCalendarError) {
    if (error.code === 'auth') return 'calendar_auth'
    if (error.code === 'not_found') return 'calendar_not_found'
    if (error.code === 'timeout') return 'timeout'
  }
  if (error && typeof error === 'object' && ((error as { name?: string }).name === 'AbortError' || (error as { name?: string }).name === 'TimeoutError')) {
    return 'timeout'
  }
  return 'calendar_error'
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

async function withOrgLock<T>(orgId: string, signal: AbortSignal | undefined, run: () => Promise<T>): Promise<T | 'locked'> {
  const key = `lock:booking:${orgId}`
  for (let attempt = 0; attempt < LOCK_ATTEMPTS; attempt += 1) {
    if (signal?.aborted) return 'locked'
    const count = await kvIncr(key, LOCK_TTL_SECONDS)
    if (count === 1) {
      try {
        return await run()
      } finally {
        await kvDel(key)
      }
    }
    await sleep(LOCK_WAIT_MS)
  }
  return 'locked'
}

function toBooking(row: Record<string, unknown>): Booking {
  return row as unknown as Booking
}

/** Instants that safely cover whole local days in any zone (UTC−12 … UTC+14). */
function dayBounds(from: CalendarDate, to: CalendarDate): { timeMin: number; timeMax: number } {
  const next = addDays(to, 1)
  return {
    timeMin: Date.UTC(from.year, from.month - 1, from.day) - 14 * HOUR_MS,
    timeMax: Date.UTC(next.year, next.month - 1, next.day) + 14 * HOUR_MS,
  }
}

async function localBusy(orgId: string, timeMin: number, timeMax: number, excludeBookingId?: string): Promise<BusyInterval[]> {
  const { data, error } = await createAdminClient()
    .from('bookings')
    .select('id, starts_at, ends_at')
    .eq('org_id', orgId)
    .in('status', [...ACTIVE_STATUSES])
    .lt('starts_at', new Date(timeMax).toISOString())
    .gt('ends_at', new Date(timeMin).toISOString())
    .limit(500)
  if (error) {
    console.error('[scheduling] booking lookup failed', error.code, error.message)
    throw new Error('Booking lookup failed')
  }
  return (data ?? [])
    .filter((row) => row.id !== excludeBookingId)
    .map((row) => ({ start: Date.parse(row.starts_at as string), end: Date.parse(row.ends_at as string) }))
}

/** Google busy blocks plus our own active bookings (covers events Google hasn't shown yet). */
async function loadBusy(
  client: calendar_v3.Calendar,
  input: { orgId: string; calendarId: string; from: CalendarDate; to: CalendarDate; signal?: AbortSignal; excludeBookingId?: string }
): Promise<BusyInterval[]> {
  const { timeMin, timeMax } = dayBounds(input.from, input.to)
  const [google, local] = await Promise.all([
    freeBusy(client, { orgId: input.orgId, calendarId: input.calendarId, timeMin, timeMax, signal: input.signal }),
    localBusy(input.orgId, timeMin, timeMax, input.excludeBookingId),
  ])
  return [...google, ...local]
}

interface SchedulingContext {
  client: calendar_v3.Calendar
  settings: SchedulingSettings
}

async function schedulingContext(orgId: string, fallbackHours: WorkingHours | null | undefined, signal?: AbortSignal): Promise<SchedulingContext | null> {
  const [client, loaded] = await Promise.all([
    getCalendarClientForOrg(orgId),
    loadSchedulingSettings(orgId, { fallbackHours, signal }),
  ])
  return client ? { client, settings: loaded.settings } : null
}

// ─── Availability ───────────────────────────────────────────────────────────

export interface AvailabilityInput {
  orgId: string
  dateFrom: CalendarDate
  dateTo: CalendarDate | null
  service: string | null
  timeOfDay: TimeOfDay
  timezone: string
  now: Date
  fallbackHours?: WorkingHours | null
  signal?: AbortSignal
}

export type AvailabilityResult =
  | {
      ok: true
      timezone: string
      service: ServiceOffering | null
      services: ServiceOffering[]
      durationMinutes: number
      from: string
      to: string
      slots: AvailableSlot[]
      /** Filled only when `slots` is empty: the next free times after the range. */
      later: AvailableSlot[]
    }
  | { ok: false; reason: CalendarFailure | 'beyond_booking_window'; maxDaysAhead?: number }

export async function checkAvailability(input: AvailabilityInput): Promise<AvailabilityResult> {
  const tz = safeTimeZone(input.timezone)
  let context: SchedulingContext | null
  try {
    context = await schedulingContext(input.orgId, input.fallbackHours, input.signal)
  } catch (error) {
    return { ok: false, reason: calendarFailure(error) }
  }
  if (!context) return { ok: false, reason: 'not_connected' }
  const { client, settings } = context

  const requested = { from: formatIsoDate(input.dateFrom), to: formatIsoDate(input.dateTo ?? input.dateFrom) }
  const days = clampRange(requested, settings, input.now, tz)
  if (!days) return { ok: false, reason: 'beyond_booking_window', maxDaysAhead: settings.max_days_ahead }

  const service = resolveService(settings.services, input.service)
  const lastBookable = addDays(localDateOf(input.now.getTime(), tz), settings.max_days_ahead)
  let lookaheadTo = addDays(days.to, LOOKAHEAD_DAYS)
  if (compareDates(lookaheadTo, lastBookable) > 0) lookaheadTo = lastBookable

  try {
    const busy = await loadBusy(client, {
      orgId: input.orgId,
      calendarId: settings.calendar_id,
      from: days.from,
      to: compareDates(lookaheadTo, days.to) > 0 ? lookaheadTo : days.to,
      signal: input.signal,
    })
    const range = { from: formatIsoDate(days.from), to: formatIsoDate(days.to) }
    const slots = generateSlots(settings, busy, range, service, input.timeOfDay, input.now, tz)
    let later: AvailableSlot[] = []
    if (slots.length === 0 && compareDates(lookaheadTo, days.to) > 0) {
      const laterRange = { from: formatIsoDate(addDays(days.to, 1)), to: formatIsoDate(lookaheadTo) }
      later = generateSlots(settings, busy, laterRange, service, input.timeOfDay, input.now, tz)
      // A time-of-day preference that leaves nothing shouldn't hide every other option.
      if (later.length === 0 && input.timeOfDay !== 'any') {
        later = generateSlots(settings, busy, laterRange, service, 'any', input.now, tz)
      }
    }
    return {
      ok: true,
      timezone: tz,
      service,
      services: settings.services,
      durationMinutes: appointmentMinutes(settings, service),
      from: range.from,
      to: range.to,
      slots,
      later,
    }
  } catch (error) {
    return { ok: false, reason: calendarFailure(error) }
  }
}

// ─── Booking ────────────────────────────────────────────────────────────────

export type SlotRejection = 'invalid_start' | 'in_past' | 'too_soon' | 'beyond_booking_window' | 'outside_hours' | 'slot_taken'

/** Why a requested start isn't in the free list, plus up to three nearby free times. */
function explainRejectedStart(
  settings: SchedulingSettings,
  busy: BusyInterval[],
  startMs: number,
  service: ServiceOffering | null,
  now: Date,
  tz: string
): { reason: SlotRejection; alternatives: AvailableSlot[] } {
  const date = localDateOf(startMs, tz)
  const day = formatIsoDate(date)
  const range = { from: day, to: day }
  const free = generateSlots(settings, busy, range, service, 'any', now, tz)
  const nearest = [...free].sort((a, b) => Math.abs(a.startMs - startMs) - Math.abs(b.startMs - startMs)).slice(0, 3)
  const alternatives = nearest.sort((a, b) => a.startMs - b.startMs)

  if (startMs <= now.getTime()) return { reason: 'in_past', alternatives }
  if (startMs < now.getTime() + settings.min_notice_minutes * 60_000) return { reason: 'too_soon', alternatives }
  const lastBookable = addDays(localDateOf(now.getTime(), tz), settings.max_days_ahead)
  if (compareDates(date, lastBookable) > 0) return { reason: 'beyond_booking_window', alternatives }
  const withoutBusy = generateSlots(settings, [], range, service, 'any', now, tz)
  if (!withoutBusy.some((slot) => slot.startMs === startMs)) return { reason: 'outside_hours', alternatives }
  return { reason: 'slot_taken', alternatives }
}

export interface BookingActor {
  orgId: string
  agentId: string | null
  callId: string | null
  timezone: string
  /** Language of texts to the caller (the agent's language). */
  language: string
  businessName: string | null
  agentName?: string | null
  fallbackHours?: WorkingHours | null
}

export type SmsOutcome = 'sent' | 'failed' | 'not_requested' | 'disabled' | 'no_phone'

export interface BookAppointmentInput extends BookingActor {
  start: string
  callerName: string
  callerPhone: string | null
  callerEmail: string | null
  service: string | null
  notes: string | null
  sendSmsConfirmation: boolean
  /** Made during a test call: the calendar event says so, so the owner can tell it apart. */
  isTest?: boolean
  now: Date
  signal?: AbortSignal
}

export type BookAppointmentResult =
  | { ok: true; booking: Booking; duplicate: boolean; sms: SmsOutcome }
  | { ok: false; reason: SlotRejection | CalendarFailure | 'in_progress' | 'storage_error'; alternatives?: AvailableSlot[] }

function eventSummary(service: string | null, callerName: string, isTest = false): string {
  return `${isTest ? '[Test] ' : ''}${service || 'Appointment'}: ${callerName}`
}

function eventDescription(input: {
  callerName: string
  callerPhone: string | null
  callerEmail: string | null
  service: string | null
  notes: string | null
  agentName?: string | null
  verb: string
  isTest?: boolean
}): string {
  return [
    `Name: ${input.callerName}`,
    input.callerPhone ? `Phone: ${input.callerPhone}` : null,
    input.callerEmail ? `Email: ${input.callerEmail}` : null,
    input.service ? `Service: ${input.service}` : null,
    input.notes ? `Notes: ${input.notes}` : null,
    '',
    `${input.verb} by ${input.agentName ? `${input.agentName}, ` : ''}your AI phone assistant.`,
    input.isTest ? 'This booking was made during a test call. Delete it if you no longer need it.' : null,
  ]
    .filter((line): line is string => line !== null)
    .join('\n')
}

/**
 * After an insert that timed out or failed on Google's side, the event may
 * exist anyway: look for it before giving the time back. null = not found or
 * the lookup failed too.
 */
async function recoverCreatedEvent(client: calendar_v3.Calendar, orgId: string, calendarId: string, bookingId: string): Promise<string | null> {
  try {
    return await findBookingEvent(client, { orgId, calendarId, bookingId, signal: AbortSignal.timeout(EVENT_LOOKUP_TIMEOUT_MS) })
  } catch (error) {
    console.error('[scheduling] checking for a half-created calendar event failed', { orgId, reason: calendarFailure(error) })
    return null
  }
}

async function sendBookingSms(input: {
  orgId: string
  bookingId: string
  callId: string | null
  to: string | null
  body: string
  markConfirmation: boolean
}): Promise<'sent' | 'failed' | 'no_phone'> {
  if (!input.to || !isE164(input.to)) return 'no_phone'
  try {
    const result = await sendSms({ orgId: input.orgId, to: input.to, body: input.body, kind: 'confirmation', callId: input.callId, bookingId: input.bookingId })
    if (!result.ok) {
      console.warn('[scheduling] booking text not sent', { orgId: input.orgId, reason: result.reason })
      return 'failed'
    }
    if (input.markConfirmation) {
      const { error } = await createAdminClient()
        .from('bookings')
        .update({ confirmation_sent_at: new Date().toISOString() })
        .eq('id', input.bookingId)
        .eq('org_id', input.orgId)
      if (error) console.error('[scheduling] marking confirmation failed', error.code, error.message)
    }
    return 'sent'
  } catch (error) {
    console.error('[scheduling] booking text failed', error instanceof Error ? error.message : error)
    return 'failed'
  }
}

export interface IdempotencyRow {
  idempotency_key: string | null
  status: string
  starts_at: string
}

/**
 * Which key a booking of `startMs` in one call uses, given the bookings that
 * already carry keys starting with `base` (`<call_id>:<start UTC>`):
 * - one of them is still active at that time → it is a retry: return it
 * - none exist → `base`
 * - the time was booked earlier in the call and then cancelled or moved away
 *   → a numbered key (`base#2`, `base#3`…), so booking it again isn't mistaken
 *   for a retry of the old booking. Pure.
 */
export function resolveIdempotencyKey<T extends IdempotencyRow>(
  rows: readonly T[],
  base: string,
  startMs: number
): { key: string; duplicate: T | null } {
  const own = rows.filter((row) => row.idempotency_key === base || row.idempotency_key?.startsWith(`${base}#`))
  const live = own.find((row) => isActiveStatus(row.status) && Date.parse(row.starts_at) === startMs)
  if (live) return { key: live.idempotency_key ?? base, duplicate: live }
  const taken = new Set(own.map((row) => row.idempotency_key))
  if (!taken.has(base)) return { key: base, duplicate: null }
  let n = 2
  while (taken.has(`${base}#${n}`)) n += 1
  return { key: `${base}#${n}`, duplicate: null }
}

async function lookUpIdempotency(orgId: string, base: string, startMs: number): Promise<{ key: string; duplicate: Booking | null }> {
  const { data, error } = await createAdminClient()
    .from('bookings')
    .select(`${BOOKING_COLUMNS}, idempotency_key`)
    .eq('org_id', orgId)
    // Keys are `<uuid>:<ISO instant>[#n]`: no LIKE wildcards inside the prefix.
    .like('idempotency_key', `${base}%`)
    .limit(50)
  if (error) {
    console.error('[scheduling] booking lookup failed', error.code, error.message)
    throw new Error('Booking lookup failed')
  }
  const rows = (data ?? []) as unknown as (Record<string, unknown> & IdempotencyRow)[]
  const { key, duplicate } = resolveIdempotencyKey(rows, base, startMs)
  if (!duplicate) return { key, duplicate: null }
  const booking: Record<string, unknown> = { ...duplicate }
  delete booking.idempotency_key
  return { key, duplicate: toBooking(booking) }
}

export async function bookAppointment(input: BookAppointmentInput): Promise<BookAppointmentResult> {
  const tz = safeTimeZone(input.timezone)
  const startMs = parseDateTimeInZone(input.start, tz)
  if (startMs === null) return { ok: false, reason: 'invalid_start' }

  const baseKey = input.callId ? `${input.callId}:${new Date(startMs).toISOString()}` : null
  let idempotencyKey: string | null = baseKey
  if (baseKey) {
    try {
      const resolved = await lookUpIdempotency(input.orgId, baseKey, startMs)
      if (resolved.duplicate) return { ok: true, booking: resolved.duplicate, duplicate: true, sms: 'not_requested' }
      idempotencyKey = resolved.key
    } catch {
      return { ok: false, reason: 'storage_error' }
    }
  }

  let context: SchedulingContext | null
  try {
    context = await schedulingContext(input.orgId, input.fallbackHours, input.signal)
  } catch (error) {
    return { ok: false, reason: calendarFailure(error) }
  }
  if (!context) return { ok: false, reason: 'not_connected' }
  const { client, settings } = context
  const service = resolveService(settings.services, input.service)

  const outcome = await withOrgLock(input.orgId, input.signal, async (): Promise<BookAppointmentResult> => {
    if (baseKey) {
      // A retry that waited for this lock would otherwise find its own booking busy.
      try {
        const resolved = await lookUpIdempotency(input.orgId, baseKey, startMs)
        if (resolved.duplicate) return { ok: true, booking: resolved.duplicate, duplicate: true, sms: 'not_requested' }
        idempotencyKey = resolved.key
      } catch {
        return { ok: false, reason: 'storage_error' }
      }
    }
    const date = localDateOf(startMs, tz)
    let busy: BusyInterval[]
    try {
      busy = await loadBusy(client, { orgId: input.orgId, calendarId: settings.calendar_id, from: date, to: date, signal: input.signal })
    } catch (error) {
      return { ok: false, reason: calendarFailure(error) }
    }
    const day = formatIsoDate(date)
    const free = generateSlots(settings, busy, { from: day, to: day }, service, 'any', input.now, tz)
    const slot = free.find((candidate) => candidate.startMs === startMs)
    if (!slot) return { ok: false, ...explainRejectedStart(settings, busy, startMs, service, input.now, tz) }
    // The caller's deadline passed while checking: don't start writing now.
    if (input.signal?.aborted) return { ok: false, reason: 'timeout' }

    const admin = createAdminClient()
    const serviceName = service?.name ?? input.service
    const inserted = await admin
      .from('bookings')
      .insert({
        org_id: input.orgId,
        agent_id: input.agentId,
        call_id: input.callId,
        calendar_id: settings.calendar_id,
        caller_name: input.callerName,
        caller_phone: input.callerPhone,
        caller_email: input.callerEmail,
        service: serviceName,
        starts_at: new Date(slot.startMs).toISOString(),
        ends_at: new Date(slot.endMs).toISOString(),
        timezone: tz,
        status: 'booked',
        notes: input.notes,
        idempotency_key: idempotencyKey,
      })
      .select(BOOKING_COLUMNS)
      .single()
    if (inserted.error || !inserted.data) {
      if (inserted.error?.code === '23505' && baseKey) {
        // A parallel retry inserted the same key first.
        const again = await lookUpIdempotency(input.orgId, baseKey, startMs).catch(() => null)
        if (again?.duplicate) return { ok: true, booking: again.duplicate, duplicate: true, sms: 'not_requested' }
      }
      console.error('[scheduling] booking insert failed', inserted.error?.code, inserted.error?.message)
      return { ok: false, reason: 'storage_error' }
    }
    const booking = toBooking(inserted.data as Record<string, unknown>)

    let eventId: string
    try {
      const event = await createEvent(client, {
        orgId: input.orgId,
        calendarId: settings.calendar_id,
        summary: eventSummary(serviceName, input.callerName, input.isTest),
        description: eventDescription({ ...input, service: serviceName, verb: 'Booked' }),
        startMs: slot.startMs,
        endMs: slot.endMs,
        timezone: tz,
        attendee: input.callerEmail ? { email: input.callerEmail, name: input.callerName } : null,
        properties: { ntv_booking_id: booking.id, ntv_call_id: input.callId, ntv_caller_phone: input.callerPhone },
        signal: calendarWriteSignal(),
      })
      eventId = event.id
    } catch (error) {
      const reason = calendarFailure(error)
      const recovered =
        reason === 'timeout' || reason === 'calendar_error'
          ? await recoverCreatedEvent(client, input.orgId, settings.calendar_id, booking.id)
          : null
      if (!recovered) {
        // No calendar event means no booking: remove the row so the time stays free.
        const removal = await admin.from('bookings').delete().eq('id', booking.id).eq('org_id', input.orgId)
        if (removal.error) console.error('[scheduling] removing an unconfirmed booking failed', removal.error.code, removal.error.message)
        return { ok: false, reason }
      }
      console.warn('[scheduling] calendar insert reported a failure but the event exists; keeping the booking', { orgId: input.orgId })
      eventId = recovered
    }
    const { error } = await admin
      .from('bookings')
      .update({ google_event_id: eventId })
      .eq('id', booking.id)
      .eq('org_id', input.orgId)
    // The event still carries ntv_booking_id, so later changes can find it without the stored id.
    if (error) console.error('[scheduling] storing the event id failed', error.code, error.message)
    booking.google_event_id = eventId
    return { ok: true, booking, duplicate: false, sms: 'not_requested' }
  })

  if (outcome === 'locked') return { ok: false, reason: 'in_progress' }
  if (!outcome.ok || outcome.duplicate) return outcome

  let sms: SmsOutcome = 'not_requested'
  if (input.sendSmsConfirmation) {
    if (!settings.send_sms_confirmation) sms = 'disabled'
    else {
      sms = await sendBookingSms({
        orgId: input.orgId,
        bookingId: outcome.booking.id,
        callId: input.callId,
        to: input.callerPhone,
        body: bookingConfirmationSms({
          language: input.language,
          businessName: input.businessName,
          startsAt: outcome.booking.starts_at,
          timezone: tz,
          service: outcome.booking.service,
        }),
        markConfirmation: true,
      })
    }
  }
  return { ...outcome, sms }
}

// ─── Lookup ─────────────────────────────────────────────────────────────────

/** Upcoming active bookings under a phone number, soonest first. */
export async function findUpcomingBookings(orgId: string, callerPhone: string, now: Date, limit = 5): Promise<Booking[]> {
  const { data, error } = await createAdminClient()
    .from('bookings')
    .select(BOOKING_COLUMNS)
    .eq('org_id', orgId)
    .eq('caller_phone', callerPhone)
    .in('status', [...ACTIVE_STATUSES])
    .gte('ends_at', now.toISOString())
    .order('starts_at', { ascending: true })
    .limit(limit)
  if (error) {
    console.error('[scheduling] booking lookup failed', error.code, error.message)
    throw new Error('Booking lookup failed')
  }
  return (data ?? []).map((row) => toBooking(row as Record<string, unknown>))
}

async function loadBooking(orgId: string, bookingId: string): Promise<Booking | null> {
  const { data, error } = await createAdminClient()
    .from('bookings')
    .select(BOOKING_COLUMNS)
    .eq('org_id', orgId)
    .eq('id', bookingId)
    .maybeSingle()
  if (error) {
    console.error('[scheduling] booking lookup failed', error.code, error.message)
    throw new Error('Booking lookup failed')
  }
  return data ? toBooking(data as Record<string, unknown>) : null
}

/** Organisation name/zone and the agent's language, for texts sent outside a call. */
async function loadActorDefaults(orgId: string, agentId: string | null): Promise<{ timezone: string; language: string; businessName: string | null }> {
  const admin = createAdminClient()
  const [org, agent] = await Promise.all([
    admin.from('organizations').select('name, timezone').eq('id', orgId).maybeSingle(),
    agentId
      ? admin.from('agents').select('language').eq('org_id', orgId).eq('id', agentId).maybeSingle()
      : admin.from('agents').select('language').eq('org_id', orgId).order('created_at', { ascending: false }).limit(1).maybeSingle(),
  ])
  return {
    timezone: safeTimeZone((org.data?.timezone as string | undefined) ?? null),
    language: (agent.data?.language as string | undefined) ?? 'en',
    businessName: (org.data?.name as string | undefined) ?? null,
  }
}

// ─── Reschedule ─────────────────────────────────────────────────────────────

export interface RescheduleBookingInput extends BookingActor {
  bookingId: string
  newStart: string
  /** When set (voice calls), the booking must belong to this number. */
  callerPhone?: string | null
  notifyCaller: boolean
  now: Date
  signal?: AbortSignal
  defer?: Defer
}

export type RescheduleBookingResult =
  | { ok: true; booking: Booking; previousStartsAt: string; unchanged: boolean; sms: SmsOutcome }
  | { ok: false; reason: SlotRejection | CalendarFailure | 'not_found' | 'in_progress' | 'storage_error'; alternatives?: AvailableSlot[] }

export async function rescheduleBooking(input: RescheduleBookingInput): Promise<RescheduleBookingResult> {
  const tz = safeTimeZone(input.timezone)
  let booking: Booking | null
  try {
    booking = await loadBooking(input.orgId, input.bookingId)
  } catch {
    return { ok: false, reason: 'storage_error' }
  }
  if (!booking || !ACTIVE_STATUSES.includes(booking.status as (typeof ACTIVE_STATUSES)[number])) return { ok: false, reason: 'not_found' }
  if (input.callerPhone !== undefined && (!input.callerPhone || booking.caller_phone !== input.callerPhone)) {
    return { ok: false, reason: 'not_found' }
  }
  const current = booking
  const newStartMs = parseDateTimeInZone(input.newStart, tz)
  if (newStartMs === null) return { ok: false, reason: 'invalid_start' }
  if (Date.parse(current.starts_at) === newStartMs) {
    return { ok: true, booking: current, previousStartsAt: current.starts_at, unchanged: true, sms: 'not_requested' }
  }

  let context: SchedulingContext | null
  try {
    context = await schedulingContext(input.orgId, input.fallbackHours, input.signal)
  } catch (error) {
    return { ok: false, reason: calendarFailure(error) }
  }
  if (!context) return { ok: false, reason: 'not_connected' }
  const { client, settings } = context
  const service = resolveService(settings.services, current.service)
  const ownBlock = { start: Date.parse(current.starts_at), end: Date.parse(current.ends_at) }
  // Keep the booking's own length when its service is no longer listed.
  const durationMs = service ? appointmentMinutes(settings, service) * 60_000 : ownBlock.end - ownBlock.start
  const effectiveService: ServiceOffering | null = service ?? { name: current.service ?? '', duration_minutes: Math.round(durationMs / 60_000) }

  const outcome = await withOrgLock(input.orgId, input.signal, async (): Promise<RescheduleBookingResult> => {
    const date = localDateOf(newStartMs, tz)
    let busy: BusyInterval[]
    try {
      const all = await loadBusy(client, {
        orgId: input.orgId,
        calendarId: current.calendar_id,
        from: date,
        to: date,
        signal: input.signal,
        excludeBookingId: current.id,
      })
      // Google still shows the booking at its old time; that block is ours to move.
      busy = subtractInterval(all, ownBlock)
    } catch (error) {
      return { ok: false, reason: calendarFailure(error) }
    }
    const day = formatIsoDate(date)
    const free = generateSlots(settings, busy, { from: day, to: day }, effectiveService, 'any', input.now, tz)
    const slot = free.find((candidate) => candidate.startMs === newStartMs)
    if (!slot) return { ok: false, ...explainRejectedStart(settings, busy, newStartMs, effectiveService, input.now, tz) }
    if (input.signal?.aborted) return { ok: false, reason: 'timeout' }

    // The stored id can be missing when saving it failed after the insert; the
    // event still carries ntv_booking_id.
    let existingEventId = current.google_event_id
    if (!existingEventId) {
      existingEventId = await recoverCreatedEvent(client, input.orgId, current.calendar_id, current.id)
    }

    let movedEventId: string | null = null
    let createdEventId: string | null = null
    if (existingEventId) {
      try {
        await patchEvent(client, {
          orgId: input.orgId,
          calendarId: current.calendar_id,
          eventId: existingEventId,
          startMs: slot.startMs,
          endMs: slot.endMs,
          timezone: tz,
          sendUpdates: !!current.caller_email,
          signal: calendarWriteSignal(),
        })
        movedEventId = existingEventId
      } catch (error) {
        const failure = calendarFailure(error)
        if (failure !== 'calendar_not_found') return { ok: false, reason: failure }
      }
    }
    if (!movedEventId) {
      // The event was deleted in Google (or never found): recreate it at the new time.
      try {
        const event = await createEvent(client, {
          orgId: input.orgId,
          calendarId: current.calendar_id,
          summary: eventSummary(current.service, current.caller_name),
          description: eventDescription({
            callerName: current.caller_name,
            callerPhone: current.caller_phone,
            callerEmail: current.caller_email,
            service: current.service,
            notes: current.notes,
            agentName: input.agentName,
            verb: 'Rescheduled',
          }),
          startMs: slot.startMs,
          endMs: slot.endMs,
          timezone: tz,
          attendee: current.caller_email ? { email: current.caller_email, name: current.caller_name } : null,
          properties: { ntv_booking_id: current.id, ntv_call_id: current.call_id, ntv_caller_phone: current.caller_phone },
          signal: calendarWriteSignal(),
        })
        createdEventId = event.id
      } catch (createError) {
        return { ok: false, reason: calendarFailure(createError) }
      }
    }

    const { data, error } = await createAdminClient()
      .from('bookings')
      .update({
        starts_at: new Date(slot.startMs).toISOString(),
        ends_at: new Date(slot.endMs).toISOString(),
        status: 'rescheduled',
        google_event_id: movedEventId ?? createdEventId,
        reminder_sent_at: null,
      })
      .eq('id', current.id)
      .eq('org_id', input.orgId)
      .select(BOOKING_COLUMNS)
      .single()
    if (error || !data) {
      console.error('[scheduling] booking update after reschedule failed', error?.code, error?.message)
      // Put the calendar back so it matches the booking the caller still has.
      try {
        if (movedEventId) {
          await patchEvent(client, {
            orgId: input.orgId,
            calendarId: current.calendar_id,
            eventId: movedEventId,
            startMs: ownBlock.start,
            endMs: ownBlock.end,
            timezone: tz,
            sendUpdates: !!current.caller_email,
            signal: calendarWriteSignal(),
          })
        } else if (createdEventId) {
          await deleteEvent(client, { orgId: input.orgId, calendarId: current.calendar_id, eventId: createdEventId, signal: calendarWriteSignal() })
        }
      } catch (revertError) {
        console.error('[scheduling] restoring the calendar after a failed reschedule failed', { orgId: input.orgId, reason: calendarFailure(revertError) })
      }
      return { ok: false, reason: 'storage_error' }
    }
    return { ok: true, booking: toBooking(data as Record<string, unknown>), previousStartsAt: current.starts_at, unchanged: false, sms: 'not_requested' }
  })

  if (outcome === 'locked') return { ok: false, reason: 'in_progress' }
  if (!outcome.ok) return outcome

  let sms: SmsOutcome = 'not_requested'
  if (input.notifyCaller) {
    sms = !settings.send_sms_confirmation
      ? 'disabled'
      : await sendBookingSms({
          orgId: input.orgId,
          bookingId: outcome.booking.id,
          callId: input.callId,
          to: outcome.booking.caller_phone,
          body: bookingRescheduledSms({
            language: input.language,
            businessName: input.businessName,
            startsAt: outcome.booking.starts_at,
            timezone: tz,
            service: outcome.booking.service,
          }),
          markConfirmation: false,
        })
  }

  const offer = () =>
    offerFreedSlot({
      orgId: input.orgId,
      startsAt: outcome.previousStartsAt,
      service: outcome.booking.service,
      timezone: tz,
      language: input.language,
      businessName: input.businessName,
      excludePhone: outcome.booking.caller_phone,
      now: input.now,
    })
  if (input.defer) input.defer(offer)
  else await offer()

  return { ...outcome, sms }
}

// ─── Cancel ─────────────────────────────────────────────────────────────────

export interface CancelBookingOptions {
  /** When set (voice calls), the booking must belong to this number. */
  callerPhone?: string | null
  /** Text the caller a cancellation notice (dashboard cancellations). Default false. */
  notifyCaller?: boolean
  /** Offer the freed time to the waitlist. Default true. */
  offerToWaitlist?: boolean
  /** Refuse bookings that already ended (callers can't cancel past visits). Default false. */
  onlyUpcoming?: boolean
  /** Skip loading these from the database when the caller already has them. */
  actor?: Pick<BookingActor, 'timezone' | 'language' | 'businessName'>
  now?: Date
  /** Already aborted = don't start. A calendar delete that started runs to its own deadline. */
  signal?: AbortSignal
  /** Background work after the response (route handlers pass `after`). */
  defer?: Defer
}

export type CancelBookingResult =
  | {
      ok: true
      booking: Booking
      alreadyCancelled: boolean
      /** false when Google Calendar wasn't connected: only the local booking changed. */
      calendarSynced: boolean
      sms: SmsOutcome
    }
  | { ok: false; reason: 'not_found' | 'not_cancellable' | 'storage_error' | Exclude<CalendarFailure, 'not_connected'>; message: string }

const CANCEL_MESSAGES = {
  not_found: 'That booking could not be found.',
  not_cancellable: 'Only upcoming bookings can be cancelled.',
  storage_error: 'The booking could not be updated. Please try again.',
  calendar_error: 'Google Calendar did not respond. The booking was not cancelled; please try again.',
  calendar_auth: 'Google Calendar needs to be reconnected before this booking can be cancelled.',
  calendar_not_found: 'The booking calendar could not be found in Google Calendar.',
  timeout: 'Google Calendar took too long to respond. The booking was not cancelled; please try again.',
} as const

/**
 * Cancels a booking: deletes the Google event (guests are told when the
 * caller was invited), marks the booking cancelled, optionally texts the
 * caller, and offers the freed time to the waitlist.
 */
export async function cancelBooking(orgId: string, bookingId: string, opts: CancelBookingOptions = {}): Promise<CancelBookingResult> {
  const now = opts.now ?? new Date()
  let booking: Booking | null
  try {
    booking = await loadBooking(orgId, bookingId)
  } catch {
    return { ok: false, reason: 'storage_error', message: CANCEL_MESSAGES.storage_error }
  }
  if (!booking) return { ok: false, reason: 'not_found', message: CANCEL_MESSAGES.not_found }
  if (opts.callerPhone !== undefined && (!opts.callerPhone || booking.caller_phone !== opts.callerPhone)) {
    return { ok: false, reason: 'not_found', message: CANCEL_MESSAGES.not_found }
  }
  if (booking.status === 'cancelled') {
    return { ok: true, booking, alreadyCancelled: true, calendarSynced: true, sms: 'not_requested' }
  }
  if (booking.status === 'completed' || booking.status === 'no_show') {
    return { ok: false, reason: 'not_cancellable', message: CANCEL_MESSAGES.not_cancellable }
  }
  if (opts.onlyUpcoming && Date.parse(booking.ends_at) <= now.getTime()) {
    return { ok: false, reason: 'not_cancellable', message: CANCEL_MESSAGES.not_cancellable }
  }

  // The caller's deadline decides whether the change starts, not whether it finishes.
  if (opts.signal?.aborted) return { ok: false, reason: 'timeout', message: CANCEL_MESSAGES.timeout }

  let client: calendar_v3.Calendar | null = null
  try {
    client = await getCalendarClientForOrg(orgId)
  } catch (error) {
    console.error('[scheduling] loading the calendar connection failed', error instanceof Error ? error.message : error)
    if (booking.google_event_id) return { ok: false, reason: 'storage_error', message: CANCEL_MESSAGES.storage_error }
  }
  // The stored id can be missing when saving it failed after the insert; the event still carries ntv_booking_id.
  const eventId = booking.google_event_id ?? (client ? await recoverCreatedEvent(client, orgId, booking.calendar_id, booking.id) : null)

  let calendarSynced = true
  if (eventId) {
    if (!client) {
      calendarSynced = false
    } else {
      try {
        await deleteEvent(client, {
          orgId,
          calendarId: booking.calendar_id,
          eventId,
          sendUpdates: !!booking.caller_email,
          signal: calendarWriteSignal(),
        })
      } catch (error) {
        const reason = calendarFailure(error)
        if (reason === 'calendar_auth') {
          // Access is gone: the event can't be removed from here anymore.
          calendarSynced = false
        } else {
          const key = reason === 'not_connected' ? 'calendar_error' : reason
          return { ok: false, reason: key, message: CANCEL_MESSAGES[key] }
        }
      }
    }
  }

  const { data, error } = await createAdminClient()
    .from('bookings')
    .update({ status: 'cancelled' })
    .eq('id', booking.id)
    .eq('org_id', orgId)
    .select(BOOKING_COLUMNS)
    .single()
  if (error || !data) {
    console.error('[scheduling] cancelling a booking failed', error?.code, error?.message)
    return { ok: false, reason: 'storage_error', message: CANCEL_MESSAGES.storage_error }
  }
  const cancelled = toBooking(data as Record<string, unknown>)
  const upcoming = Date.parse(cancelled.starts_at) > now.getTime()

  const needsActor = (opts.notifyCaller && cancelled.caller_phone) || (opts.offerToWaitlist !== false && upcoming)
  const actor = needsActor ? opts.actor ?? (await loadActorDefaults(orgId, cancelled.agent_id).catch(() => null)) : null
  const timezone = safeTimeZone(actor?.timezone ?? cancelled.timezone)

  let sms: SmsOutcome = 'not_requested'
  if (opts.notifyCaller && upcoming) {
    const { settings } = await loadSchedulingSettings(orgId).catch(() => ({ settings: null }))
    if (settings && !settings.send_sms_confirmation) sms = 'disabled'
    else {
      sms = await sendBookingSms({
        orgId,
        bookingId: cancelled.id,
        callId: null,
        to: cancelled.caller_phone,
        body: bookingCancelledSms({
          language: actor?.language ?? 'en',
          businessName: actor?.businessName ?? null,
          startsAt: cancelled.starts_at,
          timezone,
        }),
        markConfirmation: false,
      })
    }
  }

  if (opts.offerToWaitlist !== false && upcoming) {
    const offer = () =>
      offerFreedSlot({
        orgId,
        startsAt: cancelled.starts_at,
        service: cancelled.service,
        timezone,
        language: actor?.language ?? 'en',
        businessName: actor?.businessName ?? null,
        excludePhone: cancelled.caller_phone,
        now,
      })
    if (opts.defer) opts.defer(offer)
    else await offer()
  }

  return { ok: true, booking: cancelled, alreadyCancelled: false, calendarSynced, sms }
}
