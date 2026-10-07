import 'server-only'
// Bookings: the local mirror of every appointment the agent makes in the
// business's Google Calendar. Rules that keep it honest:
// - a time is only booked after a fresh busy check right before writing,
//   under a short per-organisation lease (./lock.ts), so two callers can't
//   take the same slot (and a unique index refuses it anyway)
// - retries of the same request return the first booking: idempotency key
//   `<call_id>:<start in UTC>`
// - a booking is 'booked' (and confirmed to the caller) only once Google
//   returned the event; a failed write leaves no booking behind
// - calendar writes run to their own deadline, not the caller's: once Google
//   has the event, the booking records it even if the tool already answered
//
// Ported from commit e7c7974 (lib/scheduling/bookings.ts: checkAvailability,
// bookAppointment, resolveIdempotencyKey, explainRejectedStart). Adapted:
// rules come from the agent's booking settings, the lease is a Postgres row
// instead of a KV counter, a daily cap is enforced, the database client is
// passed in, and errors go to the structured logger. Rescheduling and
// cancelling by phone were not ported (see docs/elevenlabs/B2.md).

import type { calendar_v3 } from 'googleapis/build/src/apis/calendar'
import type { SupabaseClient } from '@supabase/supabase-js'
import type { Logger } from '@/lib/observability/logger'
import { createEvent, findBookingEvent, freeBusy, getCalendarClientForOrg, GoogleCalendarError } from '@/lib/google/calendar'
import { clampRange, generateSlots, type AvailableSlot, type BusyInterval, type SlotRules, type TimeOfDay } from '@/lib/scheduling/slots'
import { addDays, compareDates, formatIsoDate, localDateOf, safeTimeZone, type CalendarDate } from '@/lib/scheduling/time'
import { withOrgBookingLock } from '@/lib/scheduling/lock'

export const BOOKING_COLUMNS =
  'id, org_id, agent_id, call_id, calendar_id, google_event_id, caller_name, caller_phone, notes, starts_at, ends_at, timezone, status, created_at'

export interface Booking {
  id: string
  org_id: string
  agent_id: string | null
  call_id: string | null
  calendar_id: string
  google_event_id: string | null
  caller_name: string | null
  caller_phone: string | null
  notes: string | null
  starts_at: string
  ends_at: string
  timezone: string
  status: 'pending' | 'booked' | 'cancelled'
  created_at: string
}

/** Rows that hold their time: being written ('pending') or confirmed ('booked'). */
export const ACTIVE_STATUSES = ['pending', 'booked'] as const
/** Extra days searched after an empty range, so one tool call can still offer something. */
const LOOKAHEAD_DAYS = 7
const HOUR_MS = 3_600_000
const CALENDAR_WRITE_TIMEOUT_MS = 8_000
const FREEBUSY_TIMEOUT_MS = 5_000
const EVENT_LOOKUP_TIMEOUT_MS = 3_000

function isActiveStatus(status: unknown): boolean {
  return (ACTIVE_STATUSES as readonly unknown[]).includes(status)
}

export type CalendarFailure = 'not_connected' | 'calendar_error' | 'calendar_auth' | 'calendar_not_found' | 'timeout'

export function calendarFailure(error: unknown): CalendarFailure {
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

interface LocalBooking {
  start: number
  end: number
}

async function localBookings(db: SupabaseClient, orgId: string, timeMin: number, timeMax: number): Promise<LocalBooking[]> {
  const { data, error } = await db
    .from('bookings')
    .select('id, starts_at, ends_at')
    .eq('org_id', orgId)
    .in('status', [...ACTIVE_STATUSES])
    .lt('starts_at', new Date(timeMax).toISOString())
    .gt('ends_at', new Date(timeMin).toISOString())
    .limit(500)
  if (error) throw new Error(`bookings lookup failed: ${error.message}`)
  return (data ?? []).map((row) => ({ start: Date.parse(row.starts_at as string), end: Date.parse(row.ends_at as string) }))
}

/** Local days (YYYY-MM-DD in the zone) that already hold `cap` active bookings. */
export function fullDays(bookings: readonly LocalBooking[], cap: number | null, timezone: string): Set<string> {
  const out = new Set<string>()
  if (!cap) return out
  const counts = new Map<string, number>()
  for (const b of bookings) {
    const day = formatIsoDate(localDateOf(b.start, timezone))
    counts.set(day, (counts.get(day) ?? 0) + 1)
  }
  for (const [day, n] of counts) if (n >= cap) out.add(day)
  return out
}

interface BusyView {
  /** Google busy blocks plus our own active bookings (covers events Google hasn't shown yet). */
  busy: BusyInterval[]
  local: LocalBooking[]
}

async function loadBusy(
  db: SupabaseClient,
  client: calendar_v3.Calendar,
  input: { orgId: string; calendarId: string; from: CalendarDate; to: CalendarDate; signal?: AbortSignal },
): Promise<BusyView> {
  const { timeMin, timeMax } = dayBounds(input.from, input.to)
  const signal = input.signal ? AbortSignal.any([input.signal, AbortSignal.timeout(FREEBUSY_TIMEOUT_MS)]) : AbortSignal.timeout(FREEBUSY_TIMEOUT_MS)
  const [google, local] = await Promise.all([
    freeBusy(client, { orgId: input.orgId, calendarId: input.calendarId, timeMin, timeMax, signal }),
    localBookings(db, input.orgId, timeMin, timeMax),
  ])
  return { busy: [...google, ...local], local }
}

// ─── Availability ───────────────────────────────────────────────────────────

export interface AvailabilityInput {
  db: SupabaseClient
  orgId: string
  calendarId: string
  rules: SlotRules
  dailyCap: number | null
  dateFrom: CalendarDate
  dateTo: CalendarDate | null
  timeOfDay: TimeOfDay
  timezone: string
  now: Date
  signal?: AbortSignal
  /** Test seam: the org's calendar client. */
  client?: calendar_v3.Calendar | null
}

export type AvailabilityResult =
  | {
      ok: true
      timezone: string
      durationMinutes: number
      from: string
      to: string
      slots: AvailableSlot[]
      /** Filled only when `slots` is empty: the next free times after the range. */
      later: AvailableSlot[]
    }
  | { ok: false; reason: CalendarFailure | 'beyond_booking_window'; maxDaysAhead?: number }

async function calendarClient(orgId: string, injected: calendar_v3.Calendar | null | undefined): Promise<calendar_v3.Calendar | null> {
  return injected !== undefined ? injected : getCalendarClientForOrg(orgId)
}

export async function checkAvailability(input: AvailabilityInput): Promise<AvailabilityResult> {
  const tz = safeTimeZone(input.timezone)
  let client: calendar_v3.Calendar | null
  try {
    client = await calendarClient(input.orgId, input.client)
  } catch (error) {
    return { ok: false, reason: calendarFailure(error) }
  }
  if (!client) return { ok: false, reason: 'not_connected' }

  const requested = { from: formatIsoDate(input.dateFrom), to: formatIsoDate(input.dateTo ?? input.dateFrom) }
  const days = clampRange(requested, input.rules, input.now, tz)
  if (!days) return { ok: false, reason: 'beyond_booking_window', maxDaysAhead: input.rules.max_days_ahead }

  const lastBookable = addDays(localDateOf(input.now.getTime(), tz), input.rules.max_days_ahead)
  let lookaheadTo = addDays(days.to, LOOKAHEAD_DAYS)
  if (compareDates(lookaheadTo, lastBookable) > 0) lookaheadTo = lastBookable

  try {
    const view = await loadBusy(input.db, client, {
      orgId: input.orgId,
      calendarId: input.calendarId,
      from: days.from,
      to: compareDates(lookaheadTo, days.to) > 0 ? lookaheadTo : days.to,
      signal: input.signal,
    })
    const full = fullDays(view.local, input.dailyCap, tz)
    const open = (slots: AvailableSlot[]) => slots.filter((s) => !full.has(s.date))
    const range = { from: formatIsoDate(days.from), to: formatIsoDate(days.to) }
    const slots = open(generateSlots(input.rules, view.busy, range, null, input.timeOfDay, input.now, tz))
    let later: AvailableSlot[] = []
    if (slots.length === 0 && compareDates(lookaheadTo, days.to) > 0) {
      const laterRange = { from: formatIsoDate(addDays(days.to, 1)), to: formatIsoDate(lookaheadTo) }
      later = open(generateSlots(input.rules, view.busy, laterRange, null, input.timeOfDay, input.now, tz))
      // A time-of-day preference that leaves nothing shouldn't hide every other option.
      if (later.length === 0 && input.timeOfDay !== 'any') {
        later = open(generateSlots(input.rules, view.busy, laterRange, null, 'any', input.now, tz))
      }
    }
    return { ok: true, timezone: tz, durationMinutes: input.rules.slot_minutes, from: range.from, to: range.to, slots, later }
  } catch (error) {
    return { ok: false, reason: calendarFailure(error) }
  }
}

// ─── Booking ────────────────────────────────────────────────────────────────

export type SlotRejection = 'invalid_start' | 'in_past' | 'too_soon' | 'beyond_booking_window' | 'outside_hours' | 'slot_taken' | 'day_full'

/** Why a requested start isn't in the free list, plus up to three nearby free times. */
export function explainRejectedStart(
  rules: SlotRules,
  busy: BusyInterval[],
  startMs: number,
  now: Date,
  tz: string,
  full: Set<string> = new Set(),
): { reason: SlotRejection; alternatives: AvailableSlot[] } {
  const date = localDateOf(startMs, tz)
  const day = formatIsoDate(date)
  const range = { from: day, to: day }
  const free = full.has(day) ? [] : generateSlots(rules, busy, range, null, 'any', now, tz)
  const nearest = [...free].sort((a, b) => Math.abs(a.startMs - startMs) - Math.abs(b.startMs - startMs)).slice(0, 3)
  const alternatives = nearest.sort((a, b) => a.startMs - b.startMs)

  if (startMs <= now.getTime()) return { reason: 'in_past', alternatives }
  if (startMs < now.getTime() + rules.min_notice_minutes * 60_000) return { reason: 'too_soon', alternatives }
  const lastBookable = addDays(localDateOf(now.getTime(), tz), rules.max_days_ahead)
  if (compareDates(date, lastBookable) > 0) return { reason: 'beyond_booking_window', alternatives }
  const withoutBusy = generateSlots(rules, [], range, null, 'any', now, tz)
  if (!withoutBusy.some((slot) => slot.startMs === startMs)) return { reason: 'outside_hours', alternatives }
  if (full.has(day)) return { reason: 'day_full', alternatives }
  return { reason: 'slot_taken', alternatives }
}

export interface BookAppointmentInput {
  db: SupabaseClient
  log: Logger
  orgId: string
  agentId: string | null
  callId: string | null
  calendarId: string
  rules: SlotRules
  dailyCap: number | null
  timezone: string
  startMs: number
  callerName: string
  callerPhone: string | null
  notes: string | null
  /** Made during a test call: the calendar event says so, so the owner can tell it apart. */
  isTest?: boolean
  now: Date
  signal?: AbortSignal
  /** Test seam: the org's calendar client. */
  client?: calendar_v3.Calendar | null
  /** Test seam: lease attempts and wait between them. */
  lockOptions?: { attempts?: number; waitMs?: number }
}

export type BookAppointmentResult =
  | { ok: true; booking: Booking; duplicate: boolean }
  | { ok: false; reason: SlotRejection | CalendarFailure | 'in_progress' | 'storage_error'; alternatives?: AvailableSlot[] }

function eventSummary(callerName: string, isTest = false): string {
  return `${isTest ? '[Test] ' : ''}Appointment: ${callerName}`
}

function eventDescription(input: { callerName: string; callerPhone: string | null; notes: string | null; isTest?: boolean }): string {
  return [
    `Name: ${input.callerName}`,
    input.callerPhone ? `Phone: ${input.callerPhone}` : null,
    input.notes ? `Notes: ${input.notes}` : null,
    '',
    'Booked by your AI phone assistant during a call.',
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
async function recoverCreatedEvent(client: calendar_v3.Calendar, orgId: string, calendarId: string, bookingId: string, log: Logger): Promise<string | null> {
  try {
    return await findBookingEvent(client, { orgId, calendarId, bookingId, signal: AbortSignal.timeout(EVENT_LOOKUP_TIMEOUT_MS) })
  } catch (error) {
    log.error('booking.event_recovery_failed', error, { orgId, reason: calendarFailure(error) })
    return null
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
 * - the time was booked earlier in the call and then cancelled → a numbered
 *   key (`base#2`, `base#3`…), so booking it again isn't mistaken for a retry
 *   of the old booking. Pure.
 */
export function resolveIdempotencyKey<T extends IdempotencyRow>(rows: readonly T[], base: string, startMs: number): { key: string; duplicate: T | null } {
  const own = rows.filter((row) => row.idempotency_key === base || row.idempotency_key?.startsWith(`${base}#`))
  const live = own.find((row) => isActiveStatus(row.status) && Date.parse(row.starts_at) === startMs)
  if (live) return { key: live.idempotency_key ?? base, duplicate: live }
  const taken = new Set(own.map((row) => row.idempotency_key))
  if (!taken.has(base)) return { key: base, duplicate: null }
  let n = 2
  while (taken.has(`${base}#${n}`)) n += 1
  return { key: `${base}#${n}`, duplicate: null }
}

async function lookUpIdempotency(db: SupabaseClient, orgId: string, base: string, startMs: number): Promise<{ key: string; duplicate: Booking | null }> {
  const { data, error } = await db
    .from('bookings')
    .select(`${BOOKING_COLUMNS}, idempotency_key`)
    .eq('org_id', orgId)
    // Keys are `<uuid>:<ISO instant>[#n]`: no LIKE wildcards inside the prefix.
    .like('idempotency_key', `${base}%`)
    .limit(50)
  if (error) throw new Error(`bookings lookup failed: ${error.message}`)
  const rows = (data ?? []) as unknown as (Record<string, unknown> & IdempotencyRow)[]
  const { key, duplicate } = resolveIdempotencyKey(rows, base, startMs)
  if (!duplicate) return { key, duplicate: null }
  const booking: Record<string, unknown> = { ...duplicate }
  delete booking.idempotency_key
  return { key, duplicate: toBooking(booking) }
}

export async function bookAppointment(input: BookAppointmentInput): Promise<BookAppointmentResult> {
  const { db, log } = input
  const tz = safeTimeZone(input.timezone)
  const startMs = input.startMs
  if (!Number.isFinite(startMs)) return { ok: false, reason: 'invalid_start' }

  const baseKey = input.callId ? `${input.callId}:${new Date(startMs).toISOString()}` : null
  let idempotencyKey: string | null = baseKey
  const resolveKey = async (): Promise<BookAppointmentResult | null> => {
    if (!baseKey) return null
    const resolved = await lookUpIdempotency(db, input.orgId, baseKey, startMs)
    // A pending duplicate is still being written by the first request: never confirm it.
    if (resolved.duplicate) return resolved.duplicate.status === 'booked' ? { ok: true, booking: resolved.duplicate, duplicate: true } : { ok: false, reason: 'in_progress' }
    idempotencyKey = resolved.key
    return null
  }
  try {
    const early = await resolveKey()
    if (early) return early
  } catch (error) {
    log.error('booking.idempotency_lookup_failed', error, { orgId: input.orgId })
    return { ok: false, reason: 'storage_error' }
  }

  let client: calendar_v3.Calendar | null
  try {
    client = await calendarClient(input.orgId, input.client)
  } catch (error) {
    return { ok: false, reason: calendarFailure(error) }
  }
  if (!client) return { ok: false, reason: 'not_connected' }
  const calendar = client

  let outcome: BookAppointmentResult | 'locked'
  try {
    outcome = await withOrgBookingLock(
      db,
      input.orgId,
      log,
      async (): Promise<BookAppointmentResult> => {
        // A retry that waited for this lock would otherwise find its own booking busy.
        try {
          const again = await resolveKey()
          if (again) return again
        } catch (error) {
          log.error('booking.idempotency_lookup_failed', error, { orgId: input.orgId })
          return { ok: false, reason: 'storage_error' }
        }
        const date = localDateOf(startMs, tz)
        let view: BusyView
        try {
          view = await loadBusy(db, calendar, { orgId: input.orgId, calendarId: input.calendarId, from: date, to: date, signal: input.signal })
        } catch (error) {
          return { ok: false, reason: calendarFailure(error) }
        }
        const day = formatIsoDate(date)
        const full = fullDays(view.local, input.dailyCap, tz)
        const free = full.has(day) ? [] : generateSlots(input.rules, view.busy, { from: day, to: day }, null, 'any', input.now, tz)
        const slot = free.find((candidate) => candidate.startMs === startMs)
        if (!slot) return { ok: false, ...explainRejectedStart(input.rules, view.busy, startMs, input.now, tz, full) }
        // The caller's deadline passed while checking: don't start writing now.
        if (input.signal?.aborted) return { ok: false, reason: 'timeout' }

        const inserted = await db
          .from('bookings')
          .insert({
            org_id: input.orgId,
            agent_id: input.agentId,
            call_id: input.callId,
            calendar_id: input.calendarId,
            caller_name: input.callerName,
            caller_phone: input.callerPhone,
            notes: input.notes,
            starts_at: new Date(slot.startMs).toISOString(),
            ends_at: new Date(slot.endMs).toISOString(),
            timezone: tz,
            status: 'pending',
            source: 'voice_tool',
            idempotency_key: idempotencyKey,
          })
          .select(BOOKING_COLUMNS)
          .single()
        if (inserted.error || !inserted.data) {
          if (inserted.error?.code === '23505') {
            // A parallel retry inserted the same key first, or another caller holds this start.
            const again = baseKey ? await lookUpIdempotency(db, input.orgId, baseKey, startMs).catch(() => null) : null
            if (again?.duplicate) return again.duplicate.status === 'booked' ? { ok: true, booking: again.duplicate, duplicate: true } : { ok: false, reason: 'in_progress' }
            return { ok: false, ...explainRejectedStart(input.rules, [...view.busy, { start: slot.startMs, end: slot.endMs }], startMs, input.now, tz, full) }
          }
          log.error('booking.insert_failed', inserted.error, { orgId: input.orgId })
          return { ok: false, reason: 'storage_error' }
        }
        const booking = toBooking(inserted.data as Record<string, unknown>)

        let eventId: string
        try {
          const event = await createEvent(calendar, {
            orgId: input.orgId,
            calendarId: input.calendarId,
            summary: eventSummary(input.callerName, input.isTest),
            description: eventDescription(input),
            startMs: slot.startMs,
            endMs: slot.endMs,
            timezone: tz,
            properties: { ntv_booking_id: booking.id, ntv_call_id: input.callId },
            // The caller's deadline decided whether the write starts, not whether it finishes.
            signal: AbortSignal.timeout(CALENDAR_WRITE_TIMEOUT_MS),
          })
          eventId = event.id
        } catch (error) {
          const reason = calendarFailure(error)
          const recovered = reason === 'timeout' || reason === 'calendar_error' ? await recoverCreatedEvent(calendar, input.orgId, input.calendarId, booking.id, log) : null
          if (!recovered) {
            // No calendar event means no booking: remove the row so the time stays free.
            const removal = await db.from('bookings').delete().eq('id', booking.id).eq('org_id', input.orgId)
            if (removal.error) log.error('booking.unconfirmed_removal_failed', removal.error, { orgId: input.orgId })
            return { ok: false, reason }
          }
          log.warn('booking.event_recovered', { orgId: input.orgId })
          eventId = recovered
        }
        const { error } = await db.from('bookings').update({ google_event_id: eventId, status: 'booked' }).eq('id', booking.id).eq('org_id', input.orgId)
        if (error) {
          // The event exists in the business's calendar: that is the booking (Google's busy
          // time keeps it from being offered again). Our mirror row stays 'pending'.
          log.error('booking.confirm_write_failed', error, { orgId: input.orgId })
        }
        return { ok: true, booking: { ...booking, google_event_id: eventId, status: 'booked' }, duplicate: false }
      },
      input.signal,
      input.lockOptions,
    )
  } catch (error) {
    log.error('booking.lock_failed', error, { orgId: input.orgId })
    return { ok: false, reason: 'storage_error' }
  }
  if (outcome === 'locked') return { ok: false, reason: 'in_progress' }
  return outcome
}
