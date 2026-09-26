// The tools a voice agent can call, defined once and converted for each
// provider: OpenAI strict function tools (self-run pipeline) and Cartesia
// client tools (Managed Agents, executed by the gateway through the app).
//
// Descriptions are written for the model: when to call, what comes back and
// what the caller must confirm first. Facts the app already knows (caller
// number, org, agent, time zone) are never parameters; the tool runner injects
// them, so the model can't book or text on someone else's behalf.
//
// Order matters: toolsFor returns tools in this file's order, and OpenAI's
// prompt cache only hits when the tools array is byte-identical.

import type { FunctionTool } from 'openai/resources/responses/responses'
import type {
  ToolParameterSchema,
  ToolPropertySchema,
  VoicePipelineMode,
  VoiceToolDefinition,
  VoiceToolName,
} from '@/lib/voice/contracts'
import type { CartesiaClientToolCreate, CartesiaClientToolParam, CartesiaToolScalarType } from '@/lib/cartesia/types'

export interface ToolCapabilities {
  calendar: boolean
  knowledge: boolean
  sms: boolean
  transfer: boolean
  take_message: boolean
  waitlist: boolean
  lead_fields: boolean
}

type Props = Record<string, ToolPropertySchema>

/** Strict schema: every property required, nullable ones typed `[type, 'null']`. */
function schema(properties: Props): ToolParameterSchema {
  return { type: 'object', properties, required: Object.keys(properties), additionalProperties: false }
}

const URGENCY: ToolPropertySchema = {
  type: 'string',
  enum: ['normal', 'urgent'],
  description: 'urgent only when it cannot wait for a normal callback (safety risk, emergency, something time-critical today); otherwise normal.',
}

const ISO_START = 'Exact start value copied from check_availability: ISO 8601 with UTC offset, for example 2026-03-18T14:30:00+02:00.'

export const TOOL_DEFINITIONS: Record<VoiceToolName, VoiceToolDefinition> = {
  get_call_context: {
    name: 'get_call_context',
    description:
      "Returns the facts for this call: today's date and the current time in the business time zone, the business hours, whether the call is inbound or outbound, and the caller's phone number if known. Call it when you need any of these and don't already have them. No side effects.",
    parameters: schema({}),
    pre_tool_speech: false,
    side_effects: false,
  },
  search_knowledge: {
    name: 'search_knowledge',
    description:
      "Searches this business's own documents: services, prices, opening hours, policies, location and common questions. Call it before answering any factual question about the business. Returns the most relevant passages. Answer only from those passages, in your own words; if none is relevant, say you don't have that information. Never mention documents or searching to the caller.",
    parameters: schema({
      query: { type: 'string', description: 'What to look up: a few words or a short question in the caller\'s terms, for example "parking" or "price of a cleaning".' },
    }),
    pre_tool_speech: true,
    side_effects: false,
  },
  check_availability: {
    name: 'check_availability',
    description:
      'Lists free appointment times. Call it before you offer, suggest or confirm any time, and again whenever the caller asks about a different day. Returns free start times in the business time zone, each with the exact start value to pass to book_appointment or reschedule_appointment, or a note that nothing is free in that range. Offer two or three options aloud, never the whole list.',
    parameters: schema({
      date_from: { type: 'string', description: 'First day to search, YYYY-MM-DD in the business time zone. Use today for "as soon as possible".' },
      date_to: { type: ['string', 'null'], description: 'Last day to search, YYYY-MM-DD, or null to search only date_from.' },
      service: { type: ['string', 'null'], description: 'The service the caller wants, matching a service the business offers where possible, or null if not known.' },
      time_of_day: { type: 'string', enum: ['any', 'morning', 'afternoon', 'evening'], description: "The caller's preferred part of the day, or any." },
    }),
    pre_tool_speech: true,
    side_effects: false,
  },
  book_appointment: {
    name: 'book_appointment',
    description:
      "Books an appointment for the caller. Call it only after check_availability returned the time AND the caller clearly said yes to that exact date and time AND you have their name. The caller's phone number is attached automatically. Returns the booking_id and confirmed time, or why it failed; if the time was just taken, check availability again and offer new times.",
    parameters: schema({
      start: { type: 'string', description: ISO_START },
      caller_name: { type: 'string', description: "The caller's full name, as confirmed with them." },
      service: { type: ['string', 'null'], description: 'The service being booked, or null.' },
      notes: { type: ['string', 'null'], description: 'Anything the team should know, such as the reason for the visit or a special request, or null.' },
      send_sms_confirmation: { type: 'boolean', description: 'true only if the caller agreed to receive a text confirmation.' },
    }),
    pre_tool_speech: true,
    side_effects: true,
  },
  find_booking: {
    name: 'find_booking',
    description:
      "Looks up upcoming appointments booked under the caller's phone number. Call it when the caller wants to check, change or cancel an appointment. Returns each booking's booking_id, service and start time, or that none were found for this number.",
    parameters: schema({}),
    pre_tool_speech: true,
    side_effects: false,
  },
  reschedule_appointment: {
    name: 'reschedule_appointment',
    description:
      'Moves an existing appointment to a new time. Call it only after find_booking identified the booking, check_availability returned the new time, and the caller clearly said yes to the change. Returns the confirmed new time, or why it failed.',
    parameters: schema({
      booking_id: { type: 'string', description: 'booking_id returned by find_booking.' },
      new_start: { type: 'string', description: ISO_START },
    }),
    pre_tool_speech: true,
    side_effects: true,
  },
  cancel_appointment: {
    name: 'cancel_appointment',
    description:
      'Cancels an existing appointment. Call it only after find_booking identified the booking and the caller clearly confirmed they want to cancel that specific appointment. Returns whether the cancellation succeeded.',
    parameters: schema({
      booking_id: { type: 'string', description: 'booking_id returned by find_booking.' },
    }),
    pre_tool_speech: true,
    side_effects: true,
  },
  add_to_waitlist: {
    name: 'add_to_waitlist',
    description:
      "Adds the caller to the waitlist so the team can offer them a time that opens up. Call it only when no suitable time is free and the caller agreed to join the waitlist. The caller's phone number is attached automatically. Returns whether they were added.",
    parameters: schema({
      caller_name: { type: ['string', 'null'], description: "The caller's name, or null if they didn't give it." },
      service: { type: ['string', 'null'], description: 'The service they are waiting for, or null.' },
      preferred_times: { type: ['string', 'null'], description: 'When they could come, in their words (for example "weekday mornings"), or null.' },
    }),
    pre_tool_speech: false,
    side_effects: true,
  },
  send_sms: {
    name: 'send_sms',
    description:
      "Sends a text message to the caller's own phone number; it cannot text anyone else. Use it for details that are easier to read than hear, such as an address or instructions, and only after the caller agreed to receive a text. Returns whether it was sent; if not, tell the caller and give the information aloud instead.",
    parameters: schema({
      message: { type: 'string', description: "Plain text in the caller's language, under 300 characters, no links unless the business instructions provide them." },
    }),
    pre_tool_speech: false,
    side_effects: true,
  },
  take_message: {
    name: 'take_message',
    description:
      'Saves a message for the team, who are notified right away. Call it when nobody can help right now, the caller asks for a callback, or you cannot answer their question. First collect the caller\'s name, callback number and message, and read them back. Returns whether the message was saved.',
    parameters: schema({
      recipient: { type: ['string', 'null'], description: 'Who the message is for (a name or role from the team list), or null for the whole team.' },
      caller_name: { type: ['string', 'null'], description: "The caller's name, or null if they didn't give it." },
      callback_number: { type: ['string', 'null'], description: 'Callback number in E.164 format (for example +40712345678) if it differs from the number they are calling from, or null to use that number.' },
      message: { type: 'string', description: 'The message in one to three sentences, including what the caller needs.' },
      urgency: URGENCY,
    }),
    pre_tool_speech: false,
    side_effects: true,
  },
  notify_team: {
    name: 'notify_team',
    description:
      "Immediately alerts the business's on-call team by text or email while the call continues. Use it for emergencies, for complaints the business instructions say to escalate, or for anything the team list says to flag. Tell the caller the team has been alerted. Returns whether the alert was delivered.",
    parameters: schema({
      summary: { type: 'string', description: 'One or two sentences: who is calling, what happened and what they need.' },
      urgency: URGENCY,
    }),
    pre_tool_speech: false,
    side_effects: true,
  },
  transfer_call: {
    name: 'transfer_call',
    description:
      'Transfers the live call to a team member. Call it only when the caller asks for a person or the situation matches a transfer rule in the business instructions or team list, and only after telling the caller who you are connecting them to. Returns whether the transfer is starting; once it connects you leave the call. If it fails, apologise and offer to take a message.',
    parameters: schema({
      reason: { type: 'string', description: 'Short reason for the transfer, passed to the person receiving the call.' },
      contact: { type: ['string', 'null'], description: 'Name or role of the team member from the team list, or null for the default contact.' },
    }),
    pre_tool_speech: false,
    side_effects: true,
  },
  save_lead_details: {
    name: 'save_lead_details',
    description:
      "Saves what you learned about the caller as a lead for the team. Call it once you have asked the qualification questions; call it again if you learn more, since later calls update the same lead. Don't mention it to the caller. Returns whether it was saved.",
    parameters: schema({
      name: { type: ['string', 'null'], description: "The caller's name, or null." },
      email: { type: ['string', 'null'], description: 'Email address, spelled back and confirmed with the caller, or null.' },
      need: { type: ['string', 'null'], description: 'What the caller is looking for, or null.' },
      budget: { type: ['string', 'null'], description: "Budget in the caller's words, or null." },
      timing: { type: ['string', 'null'], description: 'When they want to start or buy, or null.' },
      notes: { type: ['string', 'null'], description: 'Other answers as "question: answer" pairs, or null.' },
    }),
    pre_tool_speech: false,
    side_effects: true,
  },
  end_call: {
    name: 'end_call',
    description:
      'Hangs up after your last sentence has been spoken. Call it only when the conversation is finished and you have said goodbye, or when the caller asks to end the call. Never call it while the caller still needs something.',
    parameters: schema({
      reason: { type: 'string', description: 'Why the call is ending, for example "caller said goodbye".' },
    }),
    pre_tool_speech: false,
    side_effects: false,
  },
}

export const VOICE_TOOL_NAMES = Object.keys(TOOL_DEFINITIONS) as VoiceToolName[]

const CALENDAR_TOOLS: VoiceToolName[] = [
  'check_availability',
  'book_appointment',
  'find_booking',
  'reschedule_appointment',
  'cancel_appointment',
]

/**
 * Tools for one session. get_call_context is always on; end_call only in the
 * self-run pipeline, because Cartesia Managed Agents and ElevenLabs ship their
 * own end-call system tool. notify_team rides on take_message: both deliver to
 * the team through the same contacts, and an alert is a message that can't wait.
 */
export function toolsFor(capabilities: ToolCapabilities, mode: VoicePipelineMode): VoiceToolDefinition[] {
  const enabled = new Set<VoiceToolName>(['get_call_context'])
  if (capabilities.knowledge) enabled.add('search_knowledge')
  if (capabilities.calendar) CALENDAR_TOOLS.forEach((name) => enabled.add(name))
  if (capabilities.waitlist) enabled.add('add_to_waitlist')
  if (capabilities.sms) enabled.add('send_sms')
  if (capabilities.take_message) {
    enabled.add('take_message')
    enabled.add('notify_team')
  }
  if (capabilities.transfer) enabled.add('transfer_call')
  if (capabilities.lead_fields) enabled.add('save_lead_details')
  if (mode === 'cartesia_self') enabled.add('end_call')
  return VOICE_TOOL_NAMES.filter((name) => enabled.has(name)).map((name) => TOOL_DEFINITIONS[name])
}

function cloneProperty(prop: ToolPropertySchema): Record<string, unknown> {
  const out: Record<string, unknown> = { type: Array.isArray(prop.type) ? [...prop.type] : prop.type }
  if (prop.description) out.description = prop.description
  if (prop.enum) out.enum = [...prop.enum]
  return out
}

/** Responses API function tools (flat format), strict so arguments always match the schema. */
export function toOpenAITools(defs: VoiceToolDefinition[]): FunctionTool[] {
  return defs.map((def) => ({
    type: 'function',
    name: def.name,
    description: def.description,
    strict: true,
    parameters: {
      type: 'object',
      properties: Object.fromEntries(
        Object.entries(def.parameters.properties).map(([key, prop]) => [key, cloneProperty(prop)])
      ),
      required: [...def.parameters.required],
      additionalProperties: false,
    },
  }))
}

export const CARTESIA_TOOL_PREFIX = 'ntv_'

/**
 * Cartesia client tool body. Cartesia's parameter schema has no null types, so
 * nullable properties become plain optional ones (left out of `required`), and
 * names get a prefix so they never collide with Cartesia's system tools.
 */
export function toCartesiaClientTool(def: VoiceToolDefinition): CartesiaClientToolCreate {
  const properties: Record<string, CartesiaClientToolParam> = {}
  const required: string[] = []
  for (const [key, prop] of Object.entries(def.parameters.properties)) {
    const nullable = Array.isArray(prop.type)
    const scalar = (Array.isArray(prop.type) ? prop.type[0] : prop.type) as CartesiaToolScalarType
    const param: CartesiaClientToolParam = { type: scalar }
    if (prop.description) param.description = prop.description
    if (prop.enum && param.type === 'string') param.enum = [...prop.enum]
    properties[key] = param
    if (!nullable) required.push(key)
  }
  return {
    type: 'client',
    name: `${CARTESIA_TOOL_PREFIX}${def.name}`,
    description: def.description,
    pre_tool_speech: def.pre_tool_speech ? 'force' : 'auto',
    execution_mode: 'immediate',
    expects_response: true,
    response_timeout_secs: 15,
    parameters: { type: 'object', properties, required },
  }
}

/** 'ntv_book_appointment' → 'book_appointment'; anything else (including Cartesia system tools) → null. */
export function fromCartesiaToolName(name: string): VoiceToolName | null {
  if (!name.startsWith(CARTESIA_TOOL_PREFIX)) return null
  const bare = name.slice(CARTESIA_TOOL_PREFIX.length)
  return Object.prototype.hasOwnProperty.call(TOOL_DEFINITIONS, bare) ? (bare as VoiceToolName) : null
}
