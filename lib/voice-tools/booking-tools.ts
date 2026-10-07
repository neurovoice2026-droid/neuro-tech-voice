import 'server-only'
// check_availability and book_appointment: the in-call booking tools. The
// booking rules live in lib/scheduling (ported from commit e7c7974); this
// file turns outcomes into short, safe instructions the model can act on,
// remembers which slots were offered on the call, and only books one of them.

import type { calendar_v3 } from 'googleapis/build/src/apis/calendar'
import type { Logger } from '@/lib/observability/logger'
import { bookAppointment, checkAvailability, type CalendarFailure, type SlotRejection } from '@/lib/scheduling/bookings'
import { slotRulesFor } from '@/lib/scheduling/settings'
import { spreadSlots, type AvailableSlot } from '@/lib/scheduling/slots'
import { formatIsoDate, localDateOf, parseIsoDate, resolveDateArgument } from '@/lib/scheduling/time'
import { formatSmsDateTime } from '@/lib/sms/templates'
import { sanitizeToolText } from '@/lib/voice-tools/text'
import type { ToolCallContext } from './call-context'
import { claimInvocation, completeInvocation, IN_PROGRESS_MESSAGE, releaseInvocation, type ToolAnswer } from './invocations'
import { parseToolArguments } from './schemas'

/** At most this many times are offered per check (the prompt asks for 2 or 3 aloud). */
export const MAX_OFFERED_SLOTS = 3

const BOOKING_OFF =
  'Booking appointments is not available on this call. Do not suggest or confirm any time; offer to take a message with the caller’s name, number and preferred times so the team can call back.'

export interface AvailabilityAnswer extends ToolAnswer {
  slots?: Array<{ id: string; label: string }>
  slot_ids?: string[]
}

/** "s" + local YYYYMMDDHHmm: deterministic per start, so offering a time twice gives the same id. */
export function slotIdOf(slot: Pick<AvailableSlot, 'date' | 'time'>): string {
  return `s${slot.date.replace(/-/g, '')}${slot.time.replace(':', '')}`
}

function calendarProblem(reason: CalendarFailure | 'storage_error' | 'in_progress', nothingChanged: string): string {
  switch (reason) {
    case 'not_connected':
    case 'calendar_auth':
      return `Online booking isn't available right now (the business calendar isn't connected), so ${nothingChanged}. Don't promise a time; offer to take a message so the team can call back.`
    case 'calendar_not_found':
      return `The business calendar isn't set up correctly, so ${nothingChanged}. Offer to take a message so the team can call back.`
    case 'in_progress':
      return 'Another booking is being saved at this moment. Wait a second, then call the same tool again with the same values.'
    default:
      return `The calendar didn't respond, so ${nothingChanged}. Apologise briefly and offer to try again in a moment or to take a message.`
  }
}

function dayLabel(date: string, language: string): string {
  const parsed = parseIsoDate(date)
  if (!parsed) return date
  return new Intl.DateTimeFormat(language === 'en' ? 'en-GB' : language, { timeZone: 'UTC', weekday: 'long', day: 'numeric', month: 'long' }).format(
    new Date(Date.UTC(parsed.year, parsed.month - 1, parsed.day)),
  )
}

function rejectionText(reason: SlotRejection): string {
  switch (reason) {
    case 'in_past':
      return 'That time has already passed, so nothing was booked.'
    case 'too_soon':
      return 'That time is too soon to book (the business needs more notice), so nothing was booked.'
    case 'beyond_booking_window':
      return 'That date is further ahead than this business takes bookings, so nothing was booked.'
    case 'outside_hours':
      return 'That time is not a bookable time any more, so nothing was booked.'
    case 'day_full':
      return 'That day is fully booked now, so nothing was booked.'
    case 'invalid_start':
      return 'That time is not valid, so nothing was booked.'
    case 'slot_taken':
    default:
      return 'That time was just taken by someone else, so nothing was booked. Apologise.'
  }
}

function isRejection(reason: string): reason is SlotRejection {
  return ['invalid_start', 'in_past', 'too_soon', 'beyond_booking_window', 'outside_hours', 'slot_taken', 'day_full'].includes(reason)
}

/** Remembers the offered slots of the call (book_appointment only accepts these). */
async function storeOffers(ctx: ToolCallContext, slots: readonly AvailableSlot[], log: Logger): Promise<boolean> {
  if (slots.length === 0) return true
  const rows = slots.map((s) => ({
    call_id: ctx.call.id,
    org_id: ctx.org.id,
    slot_id: slotIdOf(s),
    starts_at: new Date(s.startMs).toISOString(),
    ends_at: new Date(s.endMs).toISOString(),
  }))
  const { error } = await ctx.db.from('call_slot_offers').upsert(rows, { onConflict: 'call_id,slot_id', ignoreDuplicates: true })
  if (error) {
    log.error('tools.slot_offers_write_failed', error)
    return false
  }
  return true
}

export async function checkAvailabilityTool(
  ctx: ToolCallContext,
  args: unknown,
  log: Logger,
  opts: { client?: calendar_v3.Calendar | null } = {},
): Promise<AvailabilityAnswer> {
  const booking = ctx.agent.booking
  if (!booking.enabled) return { ok: false, message: BOOKING_OFF }
  const parsed = parseToolArguments('check_availability', args)
  if (!parsed.ok) return { ok: false, message: parsed.message }

  const tz = ctx.org.timezone
  const today = formatIsoDate(localDateOf(ctx.now.getTime(), tz))
  const from = resolveDateArgument(parsed.data.date_from, ctx.now, tz)
  if (!from) return { ok: false, message: `date_from must be a date as YYYY-MM-DD (today is ${today}). Call check_availability again with a valid date.` }
  const to = parsed.data.date_to ? resolveDateArgument(parsed.data.date_to, ctx.now, tz) : null

  const rules = slotRulesFor(booking, ctx.agent.workingHours)
  const result = await checkAvailability({
    db: ctx.db,
    orgId: ctx.org.id,
    calendarId: booking.calendar_id,
    rules,
    dailyCap: booking.daily_cap,
    dateFrom: from,
    dateTo: to,
    timeOfDay: parsed.data.time_of_day,
    timezone: tz,
    now: ctx.now,
    client: opts.client,
  })
  if (!result.ok) {
    if (result.reason === 'beyond_booking_window') {
      return {
        ok: false,
        message: `Those dates are outside the booking window: this business takes bookings from today (${today}) up to ${result.maxDaysAhead ?? 0} days ahead. Offer dates within that window.`,
      }
    }
    log.warn('tools.availability_failed', { reason: result.reason })
    return { ok: false, message: calendarProblem(result.reason, 'no times could be checked') }
  }

  const lang = ctx.agent.language
  const range = result.from === result.to ? dayLabel(result.from, lang) : `${dayLabel(result.from, lang)} – ${dayLabel(result.to, lang)}`
  const partOfDay = parsed.data.time_of_day === 'any' ? '' : ` (${parsed.data.time_of_day})`
  const pool = result.slots.length > 0 ? result.slots : result.later
  const offered = spreadSlots(pool, MAX_OFFERED_SLOTS, MAX_OFFERED_SLOTS)
  if (offered.length === 0) {
    return {
      ok: true,
      message: `Nothing is free for a ${result.durationMinutes}-minute appointment${partOfDay} on ${range} or the days after it that can be booked. Tell the caller, then offer to check other dates or to take a message.`,
      slots: [],
      slot_ids: [],
    }
  }
  if (!(await storeOffers(ctx, offered, log))) {
    return { ok: false, message: calendarProblem('storage_error', 'no times could be offered') }
  }
  const slots = offered.map((s) => ({ id: slotIdOf(s), label: formatSmsDateTime(new Date(s.startMs), tz, lang) }))
  const intro =
    result.slots.length > 0
      ? `Free times for a ${result.durationMinutes}-minute appointment${partOfDay}, ${range} (${tz} time):`
      : `Nothing is free${partOfDay} on ${range}. The next free times (${tz} time) are:`
  return {
    ok: true,
    message: `${intro} ${slots.map((s) => `${s.label} (id ${s.id})`).join('; ')}. Offer these to the caller. When they choose one, read the date and time back, confirm their name, then call book_appointment with that id.`,
    slots,
    slot_ids: slots.map((s) => s.id),
  }
}

export async function bookAppointmentTool(
  ctx: ToolCallContext,
  args: unknown,
  log: Logger,
  opts: { client?: calendar_v3.Calendar | null } = {},
): Promise<ToolAnswer> {
  const booking = ctx.agent.booking
  if (!booking.enabled) return { ok: false, message: BOOKING_OFF }
  const parsed = parseToolArguments('book_appointment', args)
  if (!parsed.ok) return { ok: false, message: parsed.message }

  // Only a slot this call was offered (never a time the model made up).
  const { data: offer, error: offerErr } = await ctx.db
    .from('call_slot_offers')
    .select('slot_id, starts_at, ends_at')
    .eq('call_id', ctx.call.id)
    .eq('org_id', ctx.org.id)
    .eq('slot_id', parsed.data.slot_id)
    .maybeSingle()
  if (offerErr) {
    log.error('tools.slot_offer_read_failed', offerErr)
    return { ok: false, message: calendarProblem('storage_error', 'nothing was booked') }
  }
  if (!offer) {
    return {
      ok: false,
      message: 'That time was not offered on this call, so nothing was booked. Call check_availability, offer the times it returns, then book one of them with its id.',
    }
  }

  // Idempotent per call and slot: a repeat returns the first answer.
  const claim = await claimInvocation(ctx.db, { orgId: ctx.org.id, callId: ctx.call.id, tool: 'book_appointment', key: parsed.data.slot_id }, log, ctx.now.getTime())
  if (claim.kind === 'replay') return claim.answer
  if (claim.kind === 'in_progress') return { ok: false, message: IN_PROGRESS_MESSAGE }

  const tz = ctx.org.timezone
  const result = await bookAppointment({
    db: ctx.db,
    log,
    orgId: ctx.org.id,
    agentId: ctx.agent.id,
    callId: ctx.call.id,
    calendarId: booking.calendar_id,
    rules: slotRulesFor(booking, ctx.agent.workingHours),
    dailyCap: booking.daily_cap,
    timezone: tz,
    startMs: Date.parse(String(offer.starts_at)),
    callerName: parsed.data.caller_name,
    callerPhone: ctx.callerPhone,
    notes: parsed.data.notes ? sanitizeToolText(parsed.data.notes, 300) : null,
    isTest: ctx.call.is_test,
    now: ctx.now,
    client: opts.client,
  })

  if (!result.ok) {
    if (isRejection(result.reason)) {
      // Definitive for this slot: replay it to exact repeats.
      const answer = { ok: false, message: `${rejectionText(result.reason)} Call check_availability again and offer the new times.` }
      await completeInvocation(ctx.db, claim, answer, log)
      return answer
    }
    // Transient (lock busy, calendar or storage hiccup): a retry with the same values may succeed.
    await releaseInvocation(ctx.db, claim, log)
    log.warn('tools.booking_failed', { reason: result.reason })
    return { ok: false, message: calendarProblem(result.reason as CalendarFailure | 'storage_error' | 'in_progress', 'nothing was booked') }
  }

  const when = formatSmsDateTime(result.booking.starts_at, tz, ctx.agent.language)
  const answer = result.duplicate
    ? { ok: true, message: `This appointment was already booked earlier in this call: ${when}. Don't book it again; confirm the day and time to the caller.` }
    : { ok: true, message: `Booked: ${when} (${tz} time). Confirm the day and time back to the caller.` }
  await completeInvocation(ctx.db, claim, answer, log)
  log.info('tools.booked', { duplicate: result.duplicate })
  return answer
}
