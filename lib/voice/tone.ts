// The six tones the site, onboarding and dashboard offer, and what each one
// actually changes: a speaking-style block in the system prompt plus Sonic
// speed/emotion suggestions. Pure data, safe to import from client code.
//
// Labels and blurbs mirror lib/site.ts TONES word for word (a test enforces
// it), so the tone a visitor picks on the marketing page is the tone the
// agent gets.

import { AGENT_TONES, type AgentTone } from '@/types'

/**
 * Emotions the Cartesia TTS WebSocket accepts ("must match a valid option
 * exactly"). /tts/bytes knows more, but live calls stream over the WebSocket,
 * where any other value fails every sentence.
 */
export const SONIC_EMOTIONS = ['neutral', 'calm', 'angry', 'content', 'sad'] as const
export type SonicEmotion = (typeof SONIC_EMOTIONS)[number]

export function isSonicEmotion(value: unknown): value is SonicEmotion {
  return typeof value === 'string' && (SONIC_EMOTIONS as readonly string[]).includes(value)
}

export interface ToneProfile {
  id: AgentTone
  label: string
  blurb: string
  /** Style block injected into the system prompt. */
  promptStyle: string
  /** Suggested Sonic speed (0.6-1.5); null = voice default. */
  speed: number | null
  /** Suggested Sonic emotion; Cartesia only honours emotions on English voices. */
  emotion: string | null
}

export const TONE_PROFILES: Record<AgentTone, ToneProfile> = {
  formal: {
    id: 'formal',
    label: 'Formal',
    blurb: 'Structured, precise, authoritative',
    promptStyle:
      'Speak formally and precisely. Use complete, well-structured sentences, courteous phrasing and no slang, jokes or small talk. Sound composed and authoritative, and let the caller finish before you answer.',
    speed: 0.98,
    emotion: null,
  },
  professional: {
    id: 'professional',
    label: 'Professional',
    blurb: 'Businesslike and unhurried, never stiff',
    promptStyle:
      'Sound businesslike, calm and unhurried, never stiff. Be courteous and efficient: acknowledge what the caller needs, then move it forward. A little warmth is welcome; small talk is not.',
    speed: null,
    emotion: null,
  },
  empathetic: {
    id: 'empathetic',
    label: 'Empathetic',
    blurb: 'Patient and reassuring, takes its time',
    promptStyle:
      'Be patient and reassuring. Acknowledge how the caller feels before you solve anything, in a few sincere words. Slow down, give one piece of information at a time and check the caller is comfortable before moving on.',
    speed: 0.94,
    emotion: 'calm',
  },
  casual: {
    id: 'casual',
    label: 'Casual',
    blurb: 'Relaxed and natural, like a good receptionist',
    promptStyle:
      'Sound relaxed and natural, like a good receptionist who knows the regulars. Use everyday words and short, easy sentences. Stay polite and focused on what the caller needs.',
    speed: null,
    emotion: null,
  },
  friendly: {
    id: 'friendly',
    label: 'Friendly',
    blurb: 'Warm and conversational, quick to reassure',
    promptStyle:
      "Be warm and conversational. Use the caller's name once you know it, reassure quickly and keep the conversation light, while staying focused on helping.",
    speed: null,
    emotion: 'content',
  },
  energetic: {
    id: 'energetic',
    label: 'Energetic',
    blurb: 'Upbeat and brisk, keeps the call moving',
    promptStyle:
      'Be upbeat and brisk. Keep sentences short, show real enthusiasm about helping and keep the call moving, without ever rushing the caller or talking over them.',
    speed: 1.08,
    emotion: null,
  },
}

// Tones that existed before the list was unified (the old dashboard offered
// "educational"). Anything unknown lands on the default.
const LEGACY_TONES: Record<string, AgentTone> = {
  educational: 'professional',
}

export function normalizeTone(value: unknown): AgentTone {
  if (typeof value !== 'string') return 'professional'
  const key = value.trim().toLowerCase()
  if ((AGENT_TONES as readonly string[]).includes(key)) return key as AgentTone
  return LEGACY_TONES[key] ?? 'professional'
}

const SPEED_MIN = 0.6
const SPEED_MAX = 1.5

/**
 * Resolves the Sonic speed and emotion for an agent. An explicit agent
 * setting wins over the tone suggestion; emotion is dropped for non-English
 * voices because Cartesia's emotion control is English-only (sending it
 * elsewhere is at best ignored, at worst audibly off).
 */
export function voiceStyleFor(input: {
  tone: AgentTone | string | null | undefined
  language: string | null | undefined
  speed?: number | null
  emotion?: string | null
}): { speed: number | null; emotion: string | null } {
  const profile = TONE_PROFILES[normalizeTone(input.tone)]
  const rawSpeed = typeof input.speed === 'number' && Number.isFinite(input.speed) ? input.speed : profile.speed
  const speed = rawSpeed === null ? null : Math.min(SPEED_MAX, Math.max(SPEED_MIN, Math.round(rawSpeed * 100) / 100))
  const isEnglish = (input.language ?? 'en').trim().toLowerCase().split(/[-_]/)[0] === 'en'
  // A stored value the WebSocket would reject (an older free-text setting) falls back to the tone's suggestion.
  const trimmedEmotion = input.emotion?.trim().toLowerCase() || null
  const explicitEmotion = isSonicEmotion(trimmedEmotion) ? trimmedEmotion : null
  const emotion = isEnglish ? explicitEmotion ?? profile.emotion : null
  return { speed, emotion }
}
