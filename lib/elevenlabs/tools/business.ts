// In-call business tools (slice B2): check_availability, book_appointment
// and take_message. Workspace webhook tools shared by every tenant (one per
// deployment), attached to an agent only when the owner enabled them (and,
// for booking, connected Google Calendar). Like every platform tool they are
// authenticated by the X-NTV-Tool-Key and X-NTV-Call-Token headers: the org,
// agent, calendar, caller number and alert recipients are resolved on our
// server from the call, never from these parameters.

import { READ_BEHAVIOUR, WRITE_BEHAVIOUR } from './behaviour'
import type { WebhookToolDefinition } from './types'

/**
 * Dynamic variable holding the slot ids the last check_availability offered
 * (a JSON list, written by the tool's assignment). book_appointment's slot_id
 * is restricted to it at runtime (allowed_values); the server re-validates
 * against the offers stored for the call anyway.
 */
export const OFFERED_SLOTS_VARIABLE = 'ntv_offered_slots'

export const CHECK_AVAILABILITY_TOOL: WebhookToolDefinition = {
  key: 'elevenlabs.tool.check_availability',
  name: 'check_availability',
  description:
    "Lists free appointment times in the business calendar. Call it before you offer, suggest or confirm any time, and again whenever the caller asks about another day. It returns at most three free times, each with an id and a label to read out, or a note that nothing is free. Offer two or three of them; never offer, guess or confirm a time it did not return. If the result has ok = false, follow its message.",
  path: '/api/telephony/tools/check-availability',
  method: 'POST',
  behaviour: READ_BEHAVIOUR,
  body: {
    properties: {
      date_from: {
        type: 'string',
        description: 'First day to search: a date as YYYY-MM-DD in the business time zone, or the word today or tomorrow.',
      },
      date_to: {
        type: 'string',
        description: 'Last day to search as YYYY-MM-DD. Leave it empty to search only date_from.',
      },
      time_of_day: {
        type: 'string',
        enum: ['any', 'morning', 'afternoon', 'evening'],
        description: "The caller's preferred part of the day, or any.",
      },
    },
    required: ['date_from'],
  },
  // The ids stay visible to the LLM in slots[] (it passes one back); the
  // list itself only feeds the allowed-values variable.
  assignments: [{ dynamicVariable: OFFERED_SLOTS_VARIABLE, valuePath: 'slot_ids', preserveNativeType: true, sanitize: true }],
  responseFilter: { mode: 'allow', filters: ['ok', 'message', 'slots', 'slot_ids'] },
}

export const BOOK_APPOINTMENT_TOOL: WebhookToolDefinition = {
  key: 'elevenlabs.tool.book_appointment',
  name: 'book_appointment',
  description:
    "Books the appointment time the caller chose. Call it only after check_availability offered that time, you read the date and time back, the caller clearly said yes to it, and you have their name. The caller's phone number is attached automatically. Only tell the caller the appointment is booked when the result has ok = true; if it has ok = false, follow its message.",
  path: '/api/telephony/tools/book-appointment',
  method: 'POST',
  behaviour: WRITE_BEHAVIOUR,
  body: {
    properties: {
      slot_id: {
        type: 'string',
        description: 'The id of the chosen time, exactly as check_availability returned it (for example s202610081430).',
        allowedValuesVariable: OFFERED_SLOTS_VARIABLE,
      },
      caller_name: {
        type: 'string',
        description: "The caller's full name, as they confirmed it.",
      },
      notes: {
        type: 'string',
        description: 'Optional: the reason for the visit in a few words. Never phone numbers, card numbers or health details.',
      },
    },
    required: ['slot_id', 'caller_name'],
  },
  responseFilter: { mode: 'allow', filters: ['ok', 'message'] },
}

export const TAKE_MESSAGE_TOOL: WebhookToolDefinition = {
  key: 'elevenlabs.tool.take_message',
  name: 'take_message',
  description:
    'Saves a message for the team and alerts them right away. Call it once per call, after you collected the reason and read the callback number back to the caller (call it again only to correct the details). If the result has ok = false, follow its message.',
  path: '/api/telephony/tools/take-message',
  method: 'POST',
  behaviour: WRITE_BEHAVIOUR,
  body: {
    properties: {
      caller_name: {
        type: 'string',
        description: "The caller's name, if they gave it.",
      },
      callback_number: {
        type: 'string',
        description:
          'Only when the caller wants to be called back on a different number than the one they are calling from: that number, digits exactly as confirmed with them. Otherwise leave it empty (the number they are calling from is used).',
      },
      reason: {
        type: 'string',
        description: 'The message for the team in one or two sentences: who it is for and what the caller wants.',
      },
      urgency: {
        type: 'string',
        enum: ['normal', 'urgent'],
        description: 'urgent only when it cannot wait for a normal callback (a safety risk, an emergency, something time-critical today); otherwise normal.',
      },
    },
    required: ['reason', 'urgency'],
  },
  responseFilter: { mode: 'allow', filters: ['ok', 'message'] },
}

export const BUSINESS_TOOLS = [CHECK_AVAILABILITY_TOOL, BOOK_APPOINTMENT_TOOL, TAKE_MESSAGE_TOOL] as const
