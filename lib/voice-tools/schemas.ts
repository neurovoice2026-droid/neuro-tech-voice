// Argument validation for the in-call business tools. The model's arguments
// are usually exact, but models sometimes send "", "null" or "true" as
// strings, so every schema is tolerant: blanks become null, enums are
// coerced, long text is shortened instead of rejected, unknown keys are
// ignored. Only a missing required value fails, with a message that tells the
// model what to ask for. Pure.
//
// Ported from commit e7c7974 (lib/voice/tools/schemas.ts): the helpers are
// unchanged; the schemas are those of this branch's tools.

import { z } from 'zod'

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

/** One line: control characters and line breaks become spaces. */
function oneLine(value: string): string {
  return value.replace(/\p{Cc}+/gu, ' ').replace(/\s+/g, ' ').trim()
}

export function nullableText(max: number) {
  return z.preprocess(blankToNull, z.string().nullable()).transform((value) => (value === null ? null : shorten(oneLine(value), max)))
}

export function requiredText(max: number, field: string) {
  return z.preprocess(blankToNull, z.string({ error: `${field} is missing` })).transform((value) => shorten(oneLine(value), max))
}

export function flexibleEnum<const T extends readonly [string, ...string[]]>(values: T, fallback: T[number]) {
  return z.preprocess((value) => {
    if (typeof value !== 'string') return fallback
    const v = value.trim().toLowerCase().replace(/[\s-]+/g, '_')
    return (values as readonly string[]).includes(v) ? v : fallback
  }, z.enum(values))
}

/** Slot ids returned by check_availability: "s" + local YYYYMMDDHHmm. */
export const SLOT_ID = /^s\d{12}$/

export const TOOL_ARGUMENT_SCHEMAS = {
  check_availability: z.object({
    date_from: requiredText(40, 'date_from'),
    date_to: nullableText(40),
    time_of_day: flexibleEnum(['any', 'morning', 'afternoon', 'evening'] as const, 'any'),
  }),
  book_appointment: z.object({
    slot_id: z.preprocess(
      (value) => (typeof value === 'string' ? value.trim().toLowerCase() : value),
      z.string({ error: 'slot_id is missing' }).regex(SLOT_ID, 'slot_id must be one of the ids check_availability returned'),
    ),
    caller_name: requiredText(120, 'caller_name'),
    notes: nullableText(300),
  }),
  take_message: z.object({
    caller_name: nullableText(120),
    callback_number: nullableText(40),
    reason: requiredText(1000, 'reason'),
    urgency: flexibleEnum(['normal', 'urgent'] as const, 'normal'),
  }),
}

export type BusinessToolName = keyof typeof TOOL_ARGUMENT_SCHEMAS
export type ToolArguments<N extends BusinessToolName> = z.output<(typeof TOOL_ARGUMENT_SCHEMAS)[N]>

export type ParsedToolArguments<N extends BusinessToolName> = { ok: true; data: ToolArguments<N> } | { ok: false; message: string }

/**
 * Validates arguments for a tool. On failure the message names the fields and
 * tells the model to collect them and call again.
 */
export function parseToolArguments<N extends BusinessToolName>(name: N, args: unknown): ParsedToolArguments<N> {
  const input = args && typeof args === 'object' && !Array.isArray(args) ? args : {}
  const schema: z.ZodType = TOOL_ARGUMENT_SCHEMAS[name]
  const result = schema.safeParse(input)
  if (result.success) return { ok: true, data: result.data as ToolArguments<N> }
  const problems = [
    ...new Set(
      result.error.issues.map((issue) => {
        const field = issue.path.map(String).join('.')
        return issue.message.includes(field) || !field ? issue.message : `${field}: ${issue.message}`
      }),
    ),
  ].slice(0, 4)
  return {
    ok: false,
    message: `The ${name} call is missing information (${problems.join('; ')}). Ask the caller for what is missing if needed, then call ${name} again with every required value.`,
  }
}
