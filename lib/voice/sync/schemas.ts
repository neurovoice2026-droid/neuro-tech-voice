import '@/lib/zod-setup'
import { z } from 'zod'
import { AGENT_TONES, type Plan } from '@/types'
import { AGENT_LANGUAGES } from '@/lib/agent-languages'
import { AGENT_LIMITS } from './limits'
import { SONIC_EMOTIONS } from '@/lib/voice/tone'

// Request bodies for the agent settings routes and onboarding completion.
// Client-safe (no server imports) so hooks and forms share the exact types and
// limits the server enforces.

export { AGENT_LIMITS } from './limits'

export const WEEKDAYS = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'] as const

const LANGUAGE_CODES = AGENT_LANGUAGES.map((l) => l.value) as [string, ...string[]]
const PLAN_VALUES = ['trial', 'starter', 'pro', 'business', 'custom'] as const satisfies readonly Plan[]

/** Trimmed text; an empty string means "use the default" and is stored as null. */
function optionalText(max: number) {
  return z
    .string()
    .trim()
    .max(max, `Must be ${max} characters or fewer`)
    .nullable()
    .transform((value) => (value ? value : null))
}

const TIME = /^([01]\d|2[0-3]):[0-5]\d$/
const DATE = /^\d{4}-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/

/** Cartesia voice ids are UUIDs today; allow the id alphabet in general, never paths or spaces. */
export const zVoiceId = z
  .string()
  .trim()
  .min(1, 'Please pick a voice')
  .max(100)
  .regex(/^[A-Za-z0-9_-]+$/, 'Must be a valid voice id')

export const zTimezone = z
  .string()
  .trim()
  .min(1)
  .max(64)
  .refine((zone) => {
    try {
      new Intl.DateTimeFormat('en-US', { timeZone: zone })
      return true
    } catch {
      return false
    }
  }, 'Must be a valid time zone, for example Europe/Bucharest')

const workingHourSlotSchema = z
  .object({
    start: z.string().regex(TIME, 'Use HH:MM, for example 09:00'),
    end: z.string().regex(TIME, 'Use HH:MM, for example 18:00'),
    enabled: z.boolean(),
  })
  .refine((slot) => !slot.enabled || slot.start < slot.end, { message: 'Closing time must be after opening time', path: ['end'] })

export const workingHoursSchema = z.partialRecord(z.enum(WEEKDAYS), workingHourSlotSchema)

export const behaviorSettingsSchema = z.object({
  allow_interruptions: z.boolean(),
  auto_end_call: z.boolean(),
  auto_end_silence_seconds: z.number().int().min(5).max(120),
  max_call_duration_enabled: z.boolean(),
  max_call_duration_minutes: z.number().int().min(1).max(60),
  record_calls: z.boolean(),
  voicemail_detection: z.boolean(),
})

export const outsideHoursSchema = z.object({
  type: z.enum(['message', 'voicemail', 'always_answer']),
  message: z.string().trim().max(AGENT_LIMITS.scheduleMessage),
  notify_email: z.union([z.literal(''), z.email('Must be a valid email address')]),
})

export const holidayModeSchema = z
  .object({
    enabled: z.boolean(),
    from: z.union([z.literal(''), z.string().regex(DATE, 'Use YYYY-MM-DD')]),
    to: z.union([z.literal(''), z.string().regex(DATE, 'Use YYYY-MM-DD')]),
    message: z.string().trim().max(AGENT_LIMITS.scheduleMessage),
  })
  .refine((h) => !h.enabled || (h.from !== '' && h.to !== '' && h.from <= h.to), {
    message: 'Pick a start and end date, with the end on or after the start',
    path: ['to'],
  })

export const leadFieldSchema = z.object({
  key: z.string().trim().regex(/^[a-z][a-z0-9_]{0,39}$/, 'Use lowercase letters, digits and underscores'),
  label: z.string().trim().min(1).max(60),
  question: z.string().trim().min(1).max(200),
  required: z.boolean(),
})

export const leadFieldsSchema = z
  .array(leadFieldSchema)
  .max(AGENT_LIMITS.leadFields, `Up to ${AGENT_LIMITS.leadFields} questions`)
  .refine((fields) => new Set(fields.map((f) => f.key)).size === fields.length, 'Each question needs a unique key')

// Unknown metadata keys are dropped rather than rejected: older dashboard
// screens send the whole stored metadata object back.
export const agentMetadataPatchSchema = z
  .object({
    behavior_settings: behaviorSettingsSchema,
    outside_hours: outsideHoursSchema,
    holiday_mode: holidayModeSchema,
    not_in_documents_message: optionalText(AGENT_LIMITS.notInDocumentsMessage),
    /** Legacy tone field; mapped onto `tone` when `tone` itself isn't sent. */
    personality: z.string().trim().max(40),
  })
  .partial()

export const agentPatchSchema = z
  .object({
    name: z.string().trim().min(1, 'Please give your agent a name').max(AGENT_LIMITS.name),
    language: z.enum(LANGUAGE_CODES),
    system_prompt: optionalText(AGENT_LIMITS.systemPrompt),
    first_message: optionalText(AGENT_LIMITS.firstMessage),
    fallback_message: optionalText(AGENT_LIMITS.fallbackMessage),
    tone: z.enum(AGENT_TONES),
    cartesia_voice_id: zVoiceId,
    cartesia_voice_name: z.string().trim().max(AGENT_LIMITS.voiceName).nullable(),
    voice_speed: z.number().min(0.6).max(1.5).nullable(),
    voice_emotion: z.enum(SONIC_EMOTIONS, { error: 'Must be one of neutral, calm, angry, content or sad' }).nullable(),
    keyterms: z
      .array(z.string().trim().min(1).max(AGENT_LIMITS.keytermChars))
      .max(AGENT_LIMITS.keyterms, `Up to ${AGENT_LIMITS.keyterms} words or phrases`),
    lead_fields: leadFieldsSchema,
    recording_notice: z.boolean(),
    working_hours: workingHoursSchema,
    is_active: z.boolean(),
    metadata: agentMetadataPatchSchema,
  })
  .partial()
  .strict()

export type AgentPatchInput = z.input<typeof agentPatchSchema>
export type AgentPatch = z.output<typeof agentPatchSchema>

export const agentVoiceSchema = z
  .object({
    cartesia_voice_id: zVoiceId,
    cartesia_voice_name: z.string().trim().max(AGENT_LIMITS.voiceName).optional(),
  })
  .strict()

export const agentToggleSchema = z.object({ is_active: z.boolean() }).strict()

/** Fields that change what a provider agent says or sounds like. */
const PROVIDER_FIELDS = new Set<keyof AgentPatch>([
  'name', 'language', 'system_prompt', 'first_message', 'fallback_message', 'tone',
  'cartesia_voice_id', 'voice_speed', 'voice_emotion', 'keyterms', 'lead_fields', 'recording_notice',
])

export function patchAffectsProviders(patch: AgentPatch): boolean {
  for (const key of Object.keys(patch) as (keyof AgentPatch)[]) {
    if (PROVIDER_FIELDS.has(key)) return true
  }
  // Recording on/off changes the spoken recording notice; the legacy tone field changes the tone;
  // the not-in-documents line is part of the managed agent's instructions.
  return (
    patch.metadata?.behavior_settings !== undefined ||
    patch.metadata?.personality !== undefined ||
    patch.metadata?.not_in_documents_message !== undefined
  )
}

/** "example.com" → "https://example.com"; null when empty. Values that don't parse are returned trimmed (the schema rejects them). */
export function normalizeWebsite(value: string | null | undefined): string | null {
  const raw = value?.trim()
  if (!raw) return null
  try {
    const url = new URL(/^https?:\/\//i.test(raw) ? raw : `https://${raw}`)
    return url.toString().replace(/\/$/, '')
  } catch {
    return raw
  }
}

const websiteSchema = z
  .string()
  .trim()
  .max(300)
  .nullish()
  .refine((value) => {
    if (!value) return true
    try {
      const url = new URL(/^https?:\/\//i.test(value) ? value : `https://${value}`)
      return (url.protocol === 'https:' || url.protocol === 'http:') && url.hostname.includes('.')
    } catch {
      return false
    }
  }, 'Must be a website address, for example acme.com')
  .transform((value) => normalizeWebsite(value))

export const onboardingCompleteSchema = z.object({
  plan: z.enum(PLAN_VALUES),
  annual: z.boolean().optional().default(false),
  company: z.object({
    name: z.string().trim().min(1, 'Please enter your business name').max(AGENT_LIMITS.companyName),
    industry: z
      .string()
      .trim()
      .max(60)
      .nullish()
      .transform((value) => value || null),
    website: websiteSchema,
    description: z
      .string()
      .trim()
      .max(AGENT_LIMITS.companyDescription)
      .nullish()
      .transform((value) => value || null),
    timezone: zTimezone.nullish().transform((value) => value || null),
  }),
  agent: z.object({
    name: z.string().trim().min(1, 'Please give your agent a name').max(AGENT_LIMITS.name),
    language: z.enum(LANGUAGE_CODES),
    system_prompt: z
      .string()
      .trim()
      .max(AGENT_LIMITS.systemPrompt)
      .nullish()
      .transform((value) => value || null),
    first_message: z
      .string()
      .trim()
      .max(AGENT_LIMITS.firstMessage)
      .nullish()
      .transform((value) => value || null),
    tone: z.enum(AGENT_TONES).nullish().transform((value) => value ?? 'professional'),
  }),
  voice: z
    .object({
      // The onboarding store starts with an empty id until a voice is picked.
      cartesia_voice_id: z
        .union([z.literal(''), zVoiceId])
        .nullish()
        .transform((value) => value || null),
      cartesia_voice_name: z
        .string()
        .trim()
        .max(AGENT_LIMITS.voiceName)
        .nullish()
        .transform((value) => value || null),
      gender: z.enum(['masculine', 'feminine', 'gender_neutral']).nullish().transform((value) => value ?? null),
    })
    .nullish()
    .transform((value) => value ?? { cartesia_voice_id: null, cartesia_voice_name: null, gender: null }),
})

export type OnboardingCompleteInput = z.input<typeof onboardingCompleteSchema>
export type OnboardingComplete = z.output<typeof onboardingCompleteSchema>
