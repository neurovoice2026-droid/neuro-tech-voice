import 'server-only'
import {
  bookAppointment,
  cancelBooking,
  checkAvailability,
  findUpcomingBookings,
  rescheduleBooking,
  type CalendarFailure,
  type SlotRejection,
  type SmsOutcome,
} from '@/lib/scheduling/bookings'
import { spreadSlots, type AvailableSlot } from '@/lib/scheduling/slots'
import { formatIsoDate, localDateOf, parseIsoDate, resolveDateArgument } from '@/lib/scheduling/time'
import { isDeliverableEmail } from '@/lib/notifications/recipients'
import { parseToolArguments } from '@/lib/voice/tools/schemas'
import { capUtf8, failure, lastFour, spokenDateTime, success, type ToolContext, type ToolHandler, type ToolOutcome } from '@/lib/voice/tools/runtime'

// check_availability, book_appointment, find_booking, reschedule_appointment,
// cancel_appointment. Booking rules live in lib/scheduling/bookings.ts; this
// file turns outcomes into short instructions the model can act on.

const NOT_IN_PLAN =
  "Booking by phone isn't included in this business's plan, so no appointment can be made or changed on this call. Don't offer times; offer to take a message so the team can arrange it."
const NO_CALLER_NUMBER =
  "The caller's number is withheld or unknown, so their bookings can't be found or changed by phone. Offer to take a message so the team can help."

function bookingGate(ctx: ToolContext): ToolOutcome | null {
  return ctx.entitlements.googleIntegrations ? null : failure(NOT_IN_PLAN)
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
    case 'timeout':
    case 'calendar_error':
    case 'storage_error':
    default:
      return `The calendar didn't respond, so ${nothingChanged}. Apologise briefly and offer to try again in a moment or to take a message.`
  }
}

function dayLabel(date: string): string {
  const parsed = parseIsoDate(date)
  if (!parsed) return date
  return new Intl.DateTimeFormat('en-GB', { timeZone: 'UTC', weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }).format(
    new Date(Date.UTC(parsed.year, parsed.month - 1, parsed.day))
  )
}

function slotLines(slots: readonly AvailableSlot[]): string {
  const byDay = new Map<string, AvailableSlot[]>()
  for (const slot of slots) {
    const list = byDay.get(slot.date)
    if (list) list.push(slot)
    else byDay.set(slot.date, [slot])
  }
  return [...byDay.entries()]
    .map(([date, list]) => `- ${dayLabel(date)}: ${list.map((slot) => `${slot.time} [start=${slot.start}]`).join(', ')}`)
    .join('\n')
}

function alternativesText(alternatives: readonly AvailableSlot[] | undefined): string {
  if (!alternatives || alternatives.length === 0) return ' Call check_availability to find other times.'
  return ` Free times close to it:\n${slotLines(alternatives)}\nOffer these instead.`
}

function rejectionText(reason: SlotRejection, alternatives: AvailableSlot[] | undefined, action: string): string {
  switch (reason) {
    case 'invalid_start':
      return `The start value isn't a valid time, so nothing was ${action}. Use the exact start value returned by check_availability.`
    case 'in_past':
      return `That time has already passed, so nothing was ${action}.${alternativesText(alternatives)}`
    case 'too_soon':
      return `That time is too soon to book (the business needs more notice), so nothing was ${action}.${alternativesText(alternatives)}`
    case 'beyond_booking_window':
      return `That date is further ahead than this business takes bookings, so nothing was ${action}. Offer an earlier date.`
    case 'outside_hours':
      return `That time isn't one of the bookable times (outside business hours or off the schedule), so nothing was ${action}.${alternativesText(alternatives)}`
    case 'slot_taken':
    default:
      return `That time was just taken, so nothing was ${action}. Apologise.${alternativesText(alternatives)}`
  }
}

function smsText(sms: SmsOutcome, phone: string | null): string {
  switch (sms) {
    case 'sent':
      return ` A confirmation text was sent to the caller's phone${lastFour(phone) ? ` ending in ${lastFour(phone)}` : ''}.`
    case 'failed':
      return " The confirmation text couldn't be sent; tell the caller the booking stands anyway."
    case 'disabled':
      return " This business doesn't send text confirmations; don't promise one."
    case 'no_phone':
      return " There's no mobile number on this call, so no text was sent; don't promise one."
    default:
      return ''
  }
}

function isRejection(reason: string): reason is SlotRejection {
  return ['invalid_start', 'in_past', 'too_soon', 'beyond_booking_window', 'outside_hours', 'slot_taken'].includes(reason)
}

// ─── check_availability ─────────────────────────────────────────────────────

export const checkAvailabilityTool: ToolHandler = async (ctx, args) => {
  const parsed = parseToolArguments('check_availability', args)
  if (!parsed.ok) return failure(parsed.message)
  const gate = bookingGate(ctx)
  if (gate) return gate

  const today = formatIsoDate(localDateOf(ctx.now.getTime(), ctx.timezone))
  const from = resolveDateArgument(parsed.data.date_from, ctx.now, ctx.timezone)
  if (!from) {
    return failure(`date_from must be a date in YYYY-MM-DD format (today is ${today}). Call check_availability again with a valid date.`)
  }
  const to = parsed.data.date_to ? resolveDateArgument(parsed.data.date_to, ctx.now, ctx.timezone) : null

  const result = await checkAvailability({
    orgId: ctx.org.id,
    dateFrom: from,
    dateTo: to,
    service: parsed.data.service,
    timeOfDay: parsed.data.time_of_day,
    timezone: ctx.timezone,
    now: ctx.now,
    fallbackHours: ctx.agent?.working_hours,
    signal: ctx.signal,
  })
  if (!result.ok) {
    if (result.reason === 'beyond_booking_window') {
      return failure(
        `Those dates are outside the booking window: this business takes bookings from today (${today}) up to ${result.maxDaysAhead ?? 0} days ahead. Offer dates within that window.`
      )
    }
    return failure(calendarProblem(result.reason, 'no times could be checked'))
  }

  const lines: string[] = []
  const serviceLabel = result.service ? `${result.service.name} (${result.durationMinutes} minutes)` : `an appointment (${result.durationMinutes} minutes)`
  if (parsed.data.service && !result.service && result.services.length > 0) {
    lines.push(
      `Note: "${parsed.data.service}" isn't one of the listed services (${result.services.map((s) => s.name).join(', ')}). If the length matters, ask which one they mean and check again.`
    )
  }
  const range = result.from === result.to ? dayLabel(result.from) : `${dayLabel(result.from)} to ${dayLabel(result.to)}`
  const partOfDay = parsed.data.time_of_day === 'any' ? '' : ` in the ${parsed.data.time_of_day}`

  if (result.slots.length > 0) {
    lines.push(`Free start times for ${serviceLabel}${partOfDay}, ${range}, in ${result.timezone} time:`)
    lines.push(slotLines(spreadSlots(result.slots, 6, 24)))
    lines.push('Offer the caller two or three of these, spoken naturally. To book, pass the exact start value to book_appointment.')
  } else if (result.later.length > 0) {
    lines.push(`Nothing is free for ${serviceLabel}${partOfDay} on ${range}. The next free start times (${result.timezone} time) are:`)
    lines.push(slotLines(spreadSlots(result.later, 4, 16)))
    lines.push('Tell the caller that day is full and offer two or three of these. To book, pass the exact start value to book_appointment.')
  } else {
    lines.push(`Nothing is free for ${serviceLabel}${partOfDay} on ${range} or the following days that can be booked.`)
    lines.push('Tell the caller, then offer to check other dates, to add them to the waitlist if that is available, or to take a message.')
  }
  return success(capUtf8(lines.join('\n')))
}

// ─── book_appointment ───────────────────────────────────────────────────────

export const bookAppointmentTool: ToolHandler = async (ctx, args) => {
  const parsed = parseToolArguments('book_appointment', args)
  if (!parsed.ok) return failure(parsed.message)
  const gate = bookingGate(ctx)
  if (gate) return gate

  const knownEmail = ctx.call.extracted.email
  const callerEmail = isDeliverableEmail(knownEmail) ? knownEmail.trim() : null
  const result = await bookAppointment({
    orgId: ctx.org.id,
    agentId: ctx.agent?.id ?? null,
    callId: ctx.call.id,
    timezone: ctx.timezone,
    language: ctx.language,
    businessName: ctx.businessName,
    agentName: ctx.agent?.name ?? null,
    fallbackHours: ctx.agent?.working_hours,
    start: parsed.data.start,
    callerName: parsed.data.caller_name,
    callerPhone: ctx.callerPhone,
    callerEmail,
    service: parsed.data.service,
    notes: parsed.data.notes,
    sendSmsConfirmation: parsed.data.send_sms_confirmation,
    isTest: ctx.call.is_test,
    now: ctx.now,
    signal: ctx.signal,
  })

  if (!result.ok) {
    if (isRejection(result.reason)) return failure(capUtf8(rejectionText(result.reason, result.alternatives, 'booked')))
    return failure(calendarProblem(result.reason as CalendarFailure | 'storage_error' | 'in_progress', 'nothing was booked'))
  }

  const booking = result.booking
  const when = spokenDateTime(booking.starts_at, ctx.timezone)
  const what = booking.service ? booking.service : 'Appointment'
  if (result.duplicate) {
    return success(
      `This appointment was already booked earlier in this call: ${what} on ${when} for ${booking.caller_name} (booking_id ${booking.id}). Don't book it again; just confirm it to the caller.`
    )
  }
  const invite = booking.caller_email ? ` A calendar invitation was emailed to ${booking.caller_email}.` : ''
  return success(
    `Booked: ${what} on ${when} (${ctx.timezone} time) for ${booking.caller_name}. booking_id ${booking.id}.${smsText(result.sms, ctx.callerPhone)}${invite} Confirm the day and time back to the caller.`
  )
}

// ─── find_booking ───────────────────────────────────────────────────────────

export const findBookingTool: ToolHandler = async (ctx, args) => {
  const parsed = parseToolArguments('find_booking', args)
  if (!parsed.ok) return failure(parsed.message)
  const gate = bookingGate(ctx)
  if (gate) return gate
  if (!ctx.callerPhone) return failure(NO_CALLER_NUMBER)

  let bookings: Awaited<ReturnType<typeof findUpcomingBookings>>
  try {
    bookings = await findUpcomingBookings(ctx.org.id, ctx.callerPhone, ctx.now)
  } catch {
    return failure("Bookings couldn't be looked up right now. Apologise and offer to take a message so the team can help.")
  }
  if (bookings.length === 0) {
    return success(
      "No upcoming bookings were found for the number the caller is calling from. If they booked under a different number, offer to take a message so the team can find it."
    )
  }
  const lines = bookings.map(
    (b) => `- booking_id ${b.id}: ${b.service || 'Appointment'} on ${spokenDateTime(b.starts_at, ctx.timezone)} for ${b.caller_name}`
  )
  return success(
    capUtf8(
      `Upcoming bookings for this caller (${ctx.timezone} time):\n${lines.join('\n')}\nConfirm with the caller which one they mean before changing or cancelling it.`
    )
  )
}

// ─── reschedule_appointment ─────────────────────────────────────────────────

export const rescheduleAppointmentTool: ToolHandler = async (ctx, args) => {
  const parsed = parseToolArguments('reschedule_appointment', args)
  if (!parsed.ok) return failure(parsed.message)
  const gate = bookingGate(ctx)
  if (gate) return gate
  if (!ctx.callerPhone) return failure(NO_CALLER_NUMBER)

  const result = await rescheduleBooking({
    orgId: ctx.org.id,
    agentId: ctx.agent?.id ?? null,
    callId: ctx.call.id,
    timezone: ctx.timezone,
    language: ctx.language,
    businessName: ctx.businessName,
    agentName: ctx.agent?.name ?? null,
    fallbackHours: ctx.agent?.working_hours,
    bookingId: parsed.data.booking_id,
    newStart: parsed.data.new_start,
    callerPhone: ctx.callerPhone,
    notifyCaller: true,
    now: ctx.now,
    signal: ctx.signal,
    defer: ctx.defer,
  })

  if (!result.ok) {
    if (result.reason === 'not_found') {
      return failure("No active booking with that booking_id belongs to this caller's number. Call find_booking and use one of the booking_id values it returns.")
    }
    if (isRejection(result.reason)) return failure(capUtf8(rejectionText(result.reason, result.alternatives, 'changed')))
    return failure(calendarProblem(result.reason as CalendarFailure | 'storage_error' | 'in_progress', 'the booking was not changed'))
  }
  const booking = result.booking
  if (result.unchanged) {
    return success(`That booking is already at ${spokenDateTime(booking.starts_at, ctx.timezone)}. Nothing needed changing; confirm it to the caller.`)
  }
  return success(
    `Rescheduled: ${booking.service || 'Appointment'} for ${booking.caller_name} moved from ${spokenDateTime(result.previousStartsAt, ctx.timezone)} to ${spokenDateTime(booking.starts_at, ctx.timezone)} (${ctx.timezone} time). booking_id ${booking.id}.${smsText(result.sms, ctx.callerPhone)} Confirm the new day and time back to the caller.`
  )
}

// ─── cancel_appointment ─────────────────────────────────────────────────────

export const cancelAppointmentTool: ToolHandler = async (ctx, args) => {
  const parsed = parseToolArguments('cancel_appointment', args)
  if (!parsed.ok) return failure(parsed.message)
  const gate = bookingGate(ctx)
  if (gate) return gate
  if (!ctx.callerPhone) return failure(NO_CALLER_NUMBER)

  const result = await cancelBooking(ctx.org.id, parsed.data.booking_id, {
    callerPhone: ctx.callerPhone,
    notifyCaller: false,
    offerToWaitlist: true,
    onlyUpcoming: true,
    actor: { timezone: ctx.timezone, language: ctx.language, businessName: ctx.businessName },
    now: ctx.now,
    signal: ctx.signal,
    defer: ctx.defer,
  })
  if (!result.ok) {
    switch (result.reason) {
      case 'not_found':
        return failure("No booking with that booking_id belongs to this caller's number. Call find_booking and use one of the booking_id values it returns.")
      case 'not_cancellable':
        return failure("That appointment has already taken place or been closed, so it can't be cancelled. Tell the caller, and offer to take a message if they need something else.")
      default:
        return failure(calendarProblem(result.reason, 'the booking was not cancelled'))
    }
  }
  const booking = result.booking
  if (result.alreadyCancelled) {
    return success(`That booking (${booking.service || 'Appointment'} on ${spokenDateTime(booking.starts_at, ctx.timezone)}) was already cancelled. Nothing else to do; tell the caller.`)
  }
  return success(
    `Cancelled: ${booking.service || 'Appointment'} on ${spokenDateTime(booking.starts_at, ctx.timezone)} for ${booking.caller_name}. Confirm the cancellation to the caller and ask whether they'd like to book another time.`
  )
}
