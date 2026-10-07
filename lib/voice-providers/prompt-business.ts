// Platform prompt rules for the in-call business tools (slice B2): booking
// (check_availability + book_appointment) and take_message. Composed into
// the platform rules by ./prompt.ts for both providers. Pure, client-safe.

export type BookingPromptMode = 'tools' | 'take_message'

export interface BusinessPromptInput {
  /**
   * 'tools': check_availability and book_appointment are attached.
   * 'take_message': booking is enabled but cannot happen on this agent
   * (Google Calendar not connected, tools unavailable, fallback agent): never
   * promise a time, take the request as a message.
   * null/undefined: booking is off (no rule).
   */
  bookingMode?: BookingPromptMode | null
  /** take_message is attached (ElevenLabs platform tool or the Cartesia fallback's webhook tool). */
  takeMessageTool?: boolean
  callContext: 'variables' | 'tool' | 'none'
  /** {{…}} name of the per-call id variable ("unknown" when the call carries no tool token). */
  callIdVariable: string
}

const TOOL_RESULT_RULE = 'If one of these tools answers ok = false, never pretend it worked: follow the message it returns.'

export function businessToolRules(input: BusinessPromptInput): string[] {
  const rules: string[] = []
  const booking = input.bookingMode ?? null
  const bookingTools = booking === 'tools'
  const messageTool = !!input.takeMessageTool

  if (bookingTools) {
    rules.push(
      'Appointments: to book, first call check_availability for the day the caller wants (a date as YYYY-MM-DD in the business time zone, or today / tomorrow). Offer at most 2 or 3 of the times it returns, and never invent, guess or promise availability it did not return. When the caller picks a time, read the date and time back and ask them to confirm, make sure you have their name, then call book_appointment with the id of that time. Tell the caller the appointment is booked only after book_appointment answers ok = true, and then repeat the day and time.'
    )
  } else if (booking === 'take_message') {
    rules.push(
      `Appointments: you cannot see the calendar or book appointments on this call. If the caller wants an appointment, do not suggest, promise or confirm any time; ${
        messageTool ? 'take a message with take_message' : 'take a message'
      } with their name, callback number and the days and times that suit them, and tell them the team will call back to confirm.`
    )
  }

  if (messageTool) {
    rules.push(
      'Messages: when the caller wants to leave a message or to be called back, collect their name, what it is about and whether it is urgent. The callback number is the number they are calling from unless they give another one: read the callback number back in short groups of digits and ask them to confirm it. Then call take_message once (again only to correct the details) and tell the caller their message was passed on only after it answers ok = true. Do not promise a time for the callback.'
    )
  }

  if (bookingTools || messageTool) {
    rules.push(TOOL_RESULT_RULE)
    if (input.callContext === 'variables') {
      const names = [bookingTools ? 'check_availability, book_appointment' : null, messageTool ? 'take_message' : null].filter(Boolean).join(' and ')
      rules.push(
        `If the variable {{${input.callIdVariable}}} is "unknown", the ${names} tools cannot be used on this call: do not call them; take the caller's name, number and reason by voice and tell them the team will call back.`
      )
    } else if (messageTool) {
      rules.push('If take_message is not available or fails, repeat the details back to the caller: they are kept in the call record.')
    }
  }
  return rules
}
