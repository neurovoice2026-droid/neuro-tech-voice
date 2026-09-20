// Argument validation for voice tools. The model's arguments are usually
// exact (OpenAI strict mode), but Cartesia client tools drop nullable fields
// and models sometimes send "", "null" or "true" as strings, so every schema
// is tolerant: blanks become null, booleans and enums are coerced, long text
// is shortened instead of rejected, unknown keys are ignored. Only a missing
// required value fails, with a message that tells the model what to ask for.
// Pure.

import '@/lib/zod-setup'
import { z } from 'zod'
import type { VoiceToolName } from '@/lib/voice/contracts'

const NULL_WORDS = /^(null|none|undefined|n\/a|na|unknown|nil|-)$/i

export function blankToNull(value: unknown): unknown {
  if (value === undefined || value === null) return null
  if (typeof value === 'number' || typeof value === 'boolean') return String(value)
  if (typeof value !== 'string') return value
  const trimmed = value.trim()
  return !trimmed || NULL_WORDS.test(trimmed) ? null : trimmed
}

function shorten(value: string, max: number): string {
  const chars = Array.from(value)
  return chars.length <= max ? value : chars.slice(0, max).join('')
}

export function nullableText(max: number) {
  return z
    .preprocess(blankToNull, z.string().nullable())
    .transform((value) => (value === null ? null : shorten(value, max)))
}

export function requiredText(max: number, field: string) {
  return z
    .preprocess(blankToNull, z.string({ error: `${field} is missing` }))
    .transform((value) => shorten(value, max))
}

export function flexibleBoolean(defaultValue: boolean) {
  return z.preprocess((value) => {
    if (typeof value === 'boolean') return value
    if (typeof value === 'number') return value !== 0
    if (typeof value === 'string') {
      const v = value.trim().toLowerCase()
      if (['true', 'yes', 'y', '1', 'on'].includes(v)) return true
      if (['false', 'no', 'n', '0', 'off', ''].includes(v)) return false
    }
    return defaultValue
  }, z.boolean())
}

export function flexibleEnum<const T extends readonly [string, ...string[]]>(values: T, fallback: T[number]) {
  return z.preprocess((value) => {
    if (typeof value !== 'string') return fallback
    const v = value.trim().toLowerCase().replace(/[\s-]+/g, '_')
    return (values as readonly string[]).includes(v) ? v : fallback
  }, z.enum(values))
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

function bookingId() {
  return z.preprocess(
    (value) => (typeof value === 'string' ? value.trim().toLowerCase() : value),
    z.string({ error: 'booking_id is missing' }).regex(UUID, 'booking_id must be the booking_id returned by find_booking')
  )
}

const urgency = flexibleEnum(['normal', 'urgent'] as const, 'normal')

export const TOOL_ARGUMENT_SCHEMAS = {
  get_call_context: z.object({}),
  search_knowledge: z.object({ query: requiredText(500, 'query') }),
  check_availability: z.object({
    date_from: requiredText(40, 'date_from'),
    date_to: nullableText(40),
    service: nullableText(120),
    time_of_day: flexibleEnum(['any', 'morning', 'afternoon', 'evening'] as const, 'any'),
  }),
  book_appointment: z.object({
    start: requiredText(60, 'start'),
    caller_name: requiredText(120, 'caller_name'),
    service: nullableText(120),
    notes: nullableText(1000),
    send_sms_confirmation: flexibleBoolean(false),
  }),
  find_booking: z.object({}),
  reschedule_appointment: z.object({
    booking_id: bookingId(),
    new_start: requiredText(60, 'new_start'),
  }),
  cancel_appointment: z.object({ booking_id: bookingId() }),
  add_to_waitlist: z.object({
    caller_name: nullableText(120),
    service: nullableText(120),
    preferred_times: nullableText(300),
  }),
  send_sms: z.object({ message: requiredText(1000, 'message') }),
  take_message: z.object({
    recipient: nullableText(120),
    caller_name: nullableText(120),
    callback_number: nullableText(40),
    message: requiredText(2000, 'message'),
    urgency,
  }),
  notify_team: z.object({
    summary: requiredText(1000, 'summary'),
    urgency,
  }),
  transfer_call: z.object({
    reason: nullableText(300),
    contact: nullableText(120),
  }),
  save_lead_details: z.object({
    name: nullableText(120),
    email: nullableText(254),
    need: nullableText(500),
    budget: nullableText(200),
    timing: nullableText(200),
    notes: nullableText(1500),
  }),
  end_call: z.object({ reason: nullableText(200) }),
} satisfies Record<VoiceToolName, z.ZodType>

export type ToolArguments<N extends VoiceToolName> = z.output<(typeof TOOL_ARGUMENT_SCHEMAS)[N]>

export type ParsedToolArguments<N extends VoiceToolName> =
  | { ok: true; data: ToolArguments<N> }
  | { ok: false; message: string }

/**
 * Validates arguments for a tool. On failure the message names the fields and
 * tells the model to collect them and call again.
 */
export function parseToolArguments<N extends VoiceToolName>(name: N, args: unknown): ParsedToolArguments<N> {
  const input = args && typeof args === 'object' && !Array.isArray(args) ? args : {}
  const schema: z.ZodType = TOOL_ARGUMENT_SCHEMAS[name]
  const result = schema.safeParse(input)
  if (result.success) return { ok: true, data: result.data as ToolArguments<N> }
  const problems = [
    ...new Set(
      result.error.issues.map((issue) => {
        const field = issue.path.map(String).join('.')
        return issue.message.includes(field) || !field ? issue.message : `${field}: ${issue.message}`
      })
    ),
  ].slice(0, 4)
  return {
    ok: false,
    message: `The ${name} call is missing information (${problems.join('; ')}). Ask the caller for what is missing if needed, then call ${name} again with every required value.`,
  }
}
