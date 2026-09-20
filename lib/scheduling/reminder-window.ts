// Which bookings get a reminder text on this run. The reminder job runs once
// a day, so each booking is caught by a 24-hour window centred on
// "reminder_hours_before" ahead of now: every start time falls into exactly
// one daily window.
//
// Catch-up: a booking made after the run whose window covered its start time
// (booked this afternoon for tomorrow morning) would otherwise never be
// reminded. Such bookings, and ones an earlier run skipped, are picked up by
// the next run as long as they start at least CATCH_UP_MIN_LEAD_HOURS ahead
// and were made at least CATCH_UP_MIN_AGE_HOURS ago. reminder_sent_at still
// guarantees a single text per booking. Pure.

import type { BookingStatus } from '@/types'

export const REMINDER_WINDOW_HALF_WIDTH_HOURS = 12
/** A confirmation text sent this recently makes a reminder redundant. */
export const RECENT_CONFIRMATION_HOURS = 6
/** A late reminder is still useful, a last-minute one isn't. */
export const CATCH_UP_MIN_LEAD_HOURS = 2
/** Someone who booked a few hours ago remembers; don't text them straight away. */
export const CATCH_UP_MIN_AGE_HOURS = 6

const HOUR_MS = 3_600_000

export interface ReminderCandidate {
  org_id: string
  starts_at: string
  status: BookingStatus
  reminder_sent_at: string | null
  confirmation_sent_at: string | null
  caller_phone: string | null
  /** When the booking was made; needed for catch-up reminders. */
  created_at?: string | null
}

export interface ReminderRules {
  send_reminders: boolean
  reminder_hours_before: number
}

/** [start, end) in epoch ms for bookings due a reminder now. */
export function reminderWindow(now: Date, hoursBefore: number): { start: number; end: number } {
  const hours = Number.isFinite(hoursBefore) ? Math.max(0, hoursBefore) : 24
  const centre = now.getTime() + hours * HOUR_MS
  return {
    start: centre - REMINDER_WINDOW_HALF_WIDTH_HOURS * HOUR_MS,
    end: centre + REMINDER_WINDOW_HALF_WIDTH_HOURS * HOUR_MS,
  }
}

function isCatchUp(booking: ReminderCandidate, startsAt: number, now: Date): boolean {
  if (startsAt < now.getTime() + CATCH_UP_MIN_LEAD_HOURS * HOUR_MS) return false
  const createdAt = booking.created_at ? Date.parse(booking.created_at) : NaN
  return Number.isFinite(createdAt) && now.getTime() - createdAt >= CATCH_UP_MIN_AGE_HOURS * HOUR_MS
}

export function isDueForReminder(booking: ReminderCandidate, rules: ReminderRules, now: Date): boolean {
  if (!rules.send_reminders) return false
  if (booking.status !== 'booked' && booking.status !== 'rescheduled') return false
  if (booking.reminder_sent_at) return false
  if (!booking.caller_phone) return false

  const startsAt = Date.parse(booking.starts_at)
  if (!Number.isFinite(startsAt) || startsAt <= now.getTime()) return false

  const window = reminderWindow(now, rules.reminder_hours_before)
  if (startsAt >= window.end) return false
  if (startsAt < window.start && !isCatchUp(booking, startsAt, now)) return false

  const confirmedAt = booking.confirmation_sent_at ? Date.parse(booking.confirmation_sent_at) : NaN
  if (Number.isFinite(confirmedAt) && now.getTime() - confirmedAt < RECENT_CONFIRMATION_HOURS * HOUR_MS) return false
  return true
}

export function selectDueReminders<T extends ReminderCandidate>(
  bookings: readonly T[],
  rulesFor: (orgId: string) => ReminderRules,
  now: Date
): T[] {
  return bookings.filter((booking) => isDueForReminder(booking, rulesFor(booking.org_id), now))
}
