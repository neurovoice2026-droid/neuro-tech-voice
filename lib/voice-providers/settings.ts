// Zod schemas for every agent setting the dashboard edits. The same schemas
// validate API input (strict) and parse stored JSONB (lenient: invalid or
// missing fields fall back to safe defaults instead of breaking a call).
// Client-safe (zod only).

import { z } from 'zod'
import {
  DEFAULT_ANALYSIS_SETTINGS,
  DEFAULT_CONVERSATION_SETTINGS,
  DEFAULT_PRIVACY_SETTINGS,
  DEFAULT_TRANSFER_SETTINGS,
  type AnalysisSettings,
  type ConversationSettings,
  type PrivacySettings,
  type TransferSettings,
  type VoiceTuning,
} from './types'
import { DEFAULT_AFTER_HOURS, type AfterHoursConfig, type WorkingHours } from './working-hours'
import { E164_REGEX } from '@/lib/phone/e164'
import { WEEKDAYS } from '@/lib/scheduling/time'
import { AGENT_LANGUAGES, type AgentLanguageCode } from '@/lib/agent-languages'
import { PLATFORM_VARIABLE_MESSAGE, hasNoPlatformVariables } from './template-variables'

export const e164 = z.string().trim().regex(E164_REGEX, 'Use the international format, e.g. +40712345678')

const shortText = (max: number) => z.string().trim().max(max)

/**
 * Tenant-authored text that reaches the agent: it must not reference platform
 * variables ({{ntv_*}}, {{secret__*}}, most {{system__*}}); the agent builder
 * strips them as well (defense in depth).
 */
export const tenantText = (max: number) => shortText(max).refine(hasNoPlatformVariables, PLATFORM_VARIABLE_MESSAGE)

/** Extra languages one agent can switch to (ElevenLabs language presets). */
export const MAX_ADDITIONAL_LANGUAGES = 3
/** Tenant ASR keywords (the business name is always added on top). */
export const ASR_KEYWORDS_MAX = 30
export const ASR_KEYWORD_MAX_CHARS = 50

const LANGUAGE_CODES = AGENT_LANGUAGES.map((l) => l.value) as unknown as readonly [AgentLanguageCode, ...AgentLanguageCode[]]

/** Control characters → space, inner whitespace collapsed, trimmed. */
export function cleanKeyword(raw: string): string {
  // \p{Cc} = C0/C1 control characters (escaped so the file stays plain text).
  return raw.replace(/\p{Cc}/gu, ' ').replace(/\s+/g, ' ').trim()
}

// Letters (any script, with combining marks), digits, spaces and the
// punctuation found in names: "Dr. Ionescu", "Str. Mihai Eminescu 12", "B&B".
const KEYWORD_CHARS = /^[\p{L}\p{M}\p{N} .,'’&+\-/()]+$/u

const asrKeyword = z
  .string()
  .transform(cleanKeyword)
  .pipe(
    z
      .string()
      .min(1, 'Enter a word or name')
      .max(ASR_KEYWORD_MAX_CHARS, `At most ${ASR_KEYWORD_MAX_CHARS} characters`)
      .regex(KEYWORD_CHARS, 'Use letters, digits, spaces and . , \' & - + / ( ) only'),
  )

const distinct = (values: readonly string[]) => new Set(values.map((v) => v.toLocaleLowerCase())).size === values.length

export const ConversationSettingsSchema = z.object({
  allow_interruptions: z.boolean(),
  turn_timeout_seconds: z.number().int().min(1).max(30),
  silence_end_call_seconds: z.number().int().min(10).max(600).nullable(),
  max_call_duration_minutes: z.number().int().min(1).max(120),
  turn_eagerness: z.enum(['patient', 'normal', 'eager']),
  allow_end_call: z.boolean(),
  voicemail_detection: z.boolean(),
  voicemail_message: tenantText(500).nullable(),
  recording_notice: z.boolean(),
  // AI disclosure cannot be turned off from the API (product + legal requirement).
  ai_disclosure: z.literal(true),
  temperature: z.number().min(0).max(1).nullable(),
  // The primary language is excluded where the agent language is known (UI,
  // agent builder): the two live in different columns.
  additional_languages: z
    .array(z.enum(LANGUAGE_CODES))
    .max(MAX_ADDITIONAL_LANGUAGES, `At most ${MAX_ADDITIONAL_LANGUAGES} additional languages`)
    .refine(distinct, 'Each language only once'),
  asr_keywords: z
    .array(asrKeyword)
    .max(ASR_KEYWORDS_MAX, `At most ${ASR_KEYWORDS_MAX} keywords`)
    .refine(distinct, 'Each keyword only once'),
  soft_timeout_fillers: z.boolean(),
  ignore_backchannels: z.boolean(),
  skip_turn: z.boolean(),
  background_voice_detection: z.boolean(),
})

export const TransferSettingsSchema = z
  .object({
    enabled: z.boolean(),
    number: e164.nullable(),
    condition: tenantText(500).nullable(),
    label: tenantText(80).nullable(),
  })
  .refine((t) => !t.enabled || !!t.number, { message: 'A transfer number is required when transfer is enabled', path: ['number'] })

const fieldId = z.string().regex(/^[a-z][a-z0-9_]{0,39}$/, 'Use lowercase letters, digits and underscores')

export const AnalysisSettingsSchema = z.object({
  success_criteria: z
    .array(z.object({ id: fieldId, name: shortText(100).min(1), prompt: shortText(2000).min(1) }))
    .max(30),
  data_collection: z
    .array(z.object({ id: fieldId, type: z.enum(['string', 'boolean', 'integer', 'number']), description: shortText(1000).min(1) }))
    .max(25),
})

export const PrivacySettingsSchema = z.object({
  record_audio: z.boolean(),
  retention_days: z.number().int().min(-1).max(3650),
})

export const VoiceTuningSchema = z.object({
  stability: z.number().min(0).max(1).nullable(),
  similarity_boost: z.number().min(0).max(1).nullable(),
  speed: z.number().min(0.7).max(1.2).nullable(),
})

const clock = z.string().regex(/^(([01]\d|2[0-3]):[0-5]\d|24:00)$/, 'Use HH:MM')
export const WorkingHoursSchema = z.object(
  Object.fromEntries(WEEKDAYS.map((d) => [d, z.object({ start: clock, end: clock, enabled: z.boolean() }).optional()])) as Record<
    (typeof WEEKDAYS)[number],
    z.ZodOptional<z.ZodObject<{ start: typeof clock; end: typeof clock; enabled: z.ZodBoolean }>>
  >,
)

export const AfterHoursSchema = z
  .object({
    enabled: z.boolean(),
    mode: z.enum(['message', 'forward', 'ai']),
    message: tenantText(500).nullable().optional(),
    forward_number: e164.nullable().optional(),
  })
  .refine((a) => !(a.enabled && a.mode === 'forward') || !!a.forward_number, {
    message: 'A forwarding number is required',
    path: ['forward_number'],
  })

export const DynamicVariablesSchema = z
  .record(
    z.string().regex(/^[a-zA-Z][a-zA-Z0-9_]{0,39}$/).refine((k) => !/^(system__|secret__|ntv_)/.test(k) && !['after_hours', 'business_name'].includes(k), 'Reserved variable name'),
    z.string().max(500).refine(hasNoPlatformVariables, PLATFORM_VARIABLE_MESSAGE),
  )
  .refine((r) => Object.keys(r).length <= 20, 'At most 20 variables')

// ─── Lenient readers for stored JSONB ────────────────────────────────────────

function lenient<T extends object>(schema: z.ZodType<T>, defaults: T, raw: unknown): T {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return { ...defaults }
  const merged: Record<string, unknown> = { ...(defaults as Record<string, unknown>), ...(raw as Record<string, unknown>) }
  const parsed = schema.safeParse(merged)
  if (parsed.success) return parsed.data
  // Keep every known field that is valid on its own and reset only the invalid
  // ones (unknown keys are dropped). Checking fields independently keeps the
  // result independent of key order (Postgres jsonb reorders keys).
  const shape = (schema as unknown as { shape?: Record<string, z.ZodType> }).shape
  if (!shape) return { ...defaults }
  const out: Record<string, unknown> = { ...(defaults as Record<string, unknown>) }
  for (const [k, v] of Object.entries(raw as Record<string, unknown>)) {
    if (Object.hasOwn(shape, k) && shape[k].safeParse(v).success) out[k] = v
  }
  const repaired = schema.safeParse(out)
  if (repaired.success) return repaired.data
  // A cross-field rule still fails (e.g. transfer enabled without a number):
  // reset one field at a time, in the defaults' declaration order (`enabled`
  // first, so the safe outcome is "off"), and keep the first valid result.
  for (const k of Object.keys(defaults)) {
    const candidate = schema.safeParse({ ...out, [k]: (defaults as Record<string, unknown>)[k] })
    if (candidate.success) return candidate.data
  }
  return { ...defaults }
}

export function readConversationSettings(raw: unknown): ConversationSettings {
  // Legacy keys from metadata.behavior_settings (auto_end_call, auto_end_silence_seconds,
  // max_call_duration_enabled, max_call_duration_minutes, record_calls).
  const r = (raw && typeof raw === 'object' ? { ...(raw as Record<string, unknown>) } : {}) as Record<string, unknown>
  if ('auto_end_silence_seconds' in r && !('silence_end_call_seconds' in r)) {
    r.silence_end_call_seconds = r.auto_end_call === false ? null : Math.max(10, Number(r.auto_end_silence_seconds) || 20)
  }
  if ('max_call_duration_enabled' in r && r.max_call_duration_enabled === false) {
    r.max_call_duration_minutes = DEFAULT_CONVERSATION_SETTINGS.max_call_duration_minutes
  }
  for (const legacy of ['auto_end_call', 'auto_end_silence_seconds', 'max_call_duration_enabled', 'record_calls']) delete r[legacy]
  return lenient(ConversationSettingsSchema as unknown as z.ZodType<ConversationSettings>, DEFAULT_CONVERSATION_SETTINGS, r)
}

export function readTransferSettings(raw: unknown): TransferSettings {
  return lenient(TransferSettingsSchema as unknown as z.ZodType<TransferSettings>, DEFAULT_TRANSFER_SETTINGS, raw)
}

export function readAnalysisSettings(raw: unknown): AnalysisSettings {
  if (!raw || typeof raw !== 'object') return DEFAULT_ANALYSIS_SETTINGS
  const parsed = AnalysisSettingsSchema.safeParse(raw)
  return parsed.success ? parsed.data : DEFAULT_ANALYSIS_SETTINGS
}

export function readPrivacySettings(raw: unknown, legacyRecordCalls?: unknown): PrivacySettings {
  const base = lenient(PrivacySettingsSchema as unknown as z.ZodType<PrivacySettings>, DEFAULT_PRIVACY_SETTINGS, raw)
  if (typeof legacyRecordCalls === 'boolean' && !(raw && typeof raw === 'object' && 'record_audio' in (raw as object))) {
    return { ...base, record_audio: legacyRecordCalls }
  }
  return base
}

export function readVoiceTuning(raw: unknown): VoiceTuning {
  return lenient(VoiceTuningSchema as unknown as z.ZodType<VoiceTuning>, { stability: null, similarity_boost: null, speed: null }, raw)
}

export function readAfterHours(raw: unknown): AfterHoursConfig {
  return lenient(AfterHoursSchema as unknown as z.ZodType<AfterHoursConfig>, DEFAULT_AFTER_HOURS, raw)
}

export function readWorkingHours(raw: unknown): WorkingHours {
  const parsed = WorkingHoursSchema.safeParse(raw ?? {})
  return parsed.success ? (parsed.data as WorkingHours) : {}
}

export function readDynamicVariables(raw: unknown): Record<string, string> {
  const parsed = DynamicVariablesSchema.safeParse(raw ?? {})
  if (parsed.success) return parsed.data
  // Keep every valid entry (one bad value must not drop all the others).
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return {}
  const out: Record<string, string> = {}
  for (const [k, v] of Object.entries(raw as Record<string, unknown>)) {
    if (Object.keys(out).length >= 20) break
    if (DynamicVariablesSchema.safeParse({ [k]: v }).success) out[k] = v as string
  }
  return out
}
