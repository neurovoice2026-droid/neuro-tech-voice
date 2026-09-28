// Our recommended voices (lib/voice/voice-map.ts) in the picker's Voice shape,
// so they can be shown and selected before the catalogue has loaded them.
// Pure and client-safe.

import { DEFAULT_CARTESIA_VOICES, defaultCartesiaVoice, type DefaultVoice } from '@/lib/voice/voice-map'
import { normalizeAgentLanguage } from '@/lib/voice/languages'
import type { Voice } from '@/types'

function toVoice(voice: DefaultVoice, language: string): Voice {
  return {
    provider: 'cartesia',
    id: voice.voice_id,
    name: voice.name,
    description: null,
    tagline: null,
    gender: voice.gender,
    language,
    accents: [],
    is_owner: false,
    is_pro: false,
    preview_url: `/api/voices/${encodeURIComponent(voice.voice_id)}/preview`,
  }
}

/** Feminine and masculine recommended voice ids for a language. */
export function recommendedVoiceIds(language: string | null | undefined): string[] {
  const pair = DEFAULT_CARTESIA_VOICES[normalizeAgentLanguage(language)]
  return pair ? [pair.feminine.voice_id, pair.masculine.voice_id] : []
}

/** The recommended voice for a language (feminine unless masculine is asked for). */
export function defaultVoiceFor(language: string | null | undefined, gender?: 'masculine' | 'feminine' | null): Voice {
  const code = normalizeAgentLanguage(language)
  return toVoice(defaultCartesiaVoice(code, gender), code)
}

/** A recommended voice by id, with the language it is recommended for. */
export function defaultVoiceById(voiceId: string): Voice | null {
  for (const [language, pair] of Object.entries(DEFAULT_CARTESIA_VOICES)) {
    for (const voice of [pair.feminine, pair.masculine]) {
      if (voice.voice_id === voiceId) return toVoice(voice, language)
    }
  }
  return null
}
