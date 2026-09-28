// Default voices used when an agent has no voice of its own, one feminine and
// one masculine per agent language. Pure data, safe for client components.
//
// Cartesia picks were verified live on 2026-09-17 (GET /voices/{id}: status
// active, not Pro, gender as listed, native accent in the language; Andrada
// and Daniel also rendered through TTS). Selection rule: a stable, service-oriented voice whose
// native accent matches the country flag shown for the language in
// lib/agent-languages.ts (es-ES, fr-FR, pt-PT, zh-CN, ar-SA…). English uses the
// agent voices Cartesia recommends (Skylar, Daniel). Romanian has only two
// voices in the library, both with a Moldovan (ro-MD) native accent.

export interface DefaultVoice {
  voice_id: string
  name: string
  gender: 'masculine' | 'feminine'
}

type VoicePair = { feminine: DefaultVoice; masculine: DefaultVoice }

function pair(feminine: [string, string], masculine: [string, string]): VoicePair {
  return {
    feminine: { voice_id: feminine[0], name: feminine[1], gender: 'feminine' },
    masculine: { voice_id: masculine[0], name: masculine[1], gender: 'masculine' },
  }
}

export const DEFAULT_CARTESIA_VOICES: Record<string, VoicePair> = {
  // en-US, "Friendly Guide" / "Modern Assistant" (docs-recommended agent voices)
  en: pair(['db6b0ed5-d5d3-463d-ae85-518a07d3c2b4', 'Skylar'], ['47c38ca4-5f35-497b-b1a3-415245fb35e1', 'Daniel']),
  // ro-MD, the only Romanian voices in the library
  ro: pair(['34acfaee-c556-41ee-a5f6-c687fb20357c', 'Andrada'], ['3f64ef99-d87b-4b51-b217-df7351f7886a', 'Andrei']),
  // es-ES
  es: pair(['de38f545-c574-44e8-9b54-a7d6fec1c6b1', 'Marta'], ['13ff5deb-2591-42ad-a356-63a04e524411', 'Marcos']),
  // fr-FR
  fr: pair(['c9f95851-235c-458c-acfb-67cdb2558538', 'Solène'], ['5def377d-908b-4540-8bd7-3c968fcae351', 'Benoît']),
  // de-DE
  de: pair(['38aabb6a-f52b-4fb0-a3d1-988518f4dc06', 'Alina'], ['4ad22058-7cb6-402c-a115-196cbfc25dce', 'Moritz']),
  // it-IT
  it: pair(['90c7d657-9599-4cd0-9ed2-2568359e4d1a', 'Sofia'], ['ee16f140-f6dc-490e-a1ed-c1d537ea0086', 'Lorenzo']),
  // pt-PT (pt-BR alternatives: Alice 9904416a-0831-44ea-b8ee-5f145e8f9bbf, Gustavo 28a942b5-74f3-47bb-9b56-4c3f2562d3ba)
  pt: pair(['d4b44b9a-82bc-4b65-b456-763fce4c52f9', 'Beatriz'], ['250fdc17-cc1b-4ff1-8538-63988791cd3e', 'Paulo']),
  // pl-PL
  pl: pair(['6bc7c014-022b-42ce-8b53-a5ec878a7ca7', 'Agnieszka'], ['43e52207-96fc-4e01-aaf8-cae317e43fdb', 'Kacper']),
  // nl-NL
  nl: pair(['225ba8cf-9fc2-4371-a78c-fe38ba38898a', 'Anneliese'], ['95e9fdaf-cf0b-4739-b1de-3350ca50774a', 'Thijs']),
  // ja-JP
  ja: pair(['861213b7-f057-45c8-9527-0f4c144f1a03', 'Haruka'], ['177df681-25b1-48c2-bb47-03ca5fa27f0a', 'Ren']),
  // ko-KR
  ko: pair(['15628352-2ede-4f1b-89e6-ceda0c983fbc', 'Jiwoo'], ['89f4372f-1f73-4b85-8e1e-5d24ed8bc826', 'Jaewon']),
  // zh-CN (Mandarin)
  zh: pair(['6eb8965c-e295-47bd-a9e4-3eeebb3abcff', 'Jing'], ['16212f18-4955-4be9-a6cd-2196ce2c11d1', 'Hao']),
  // ar-SA
  ar: pair(['731ace69-ee17-41bc-8c6f-665c9f1db95c', 'Fatima'], ['f1cdfb4a-bf7d-4e83-916e-8f0802278315', 'Walid']),
  // hi-IN
  hi: pair(['47f3bbb1-e98f-4e0c-92c5-5f0325e1e206', 'Neha'], ['97303aad-1a66-4edf-870a-58e6ba545005', 'Amrit']),
}

/** 'pt-BR' → 'pt', ' RO ' → 'ro'; unknown or unsupported languages fall back to English. */
function voiceLanguage(language: string | null | undefined): string {
  const base = (language ?? '').trim().toLowerCase().split(/[-_]/)[0]
  return Object.prototype.hasOwnProperty.call(DEFAULT_CARTESIA_VOICES, base) ? base : 'en'
}

/** Feminine unless masculine is asked for, the same rule as elevenLabsFallbackVoice so both paths agree. */
export function defaultCartesiaVoice(language: string, gender?: 'masculine' | 'feminine' | null): DefaultVoice {
  const voices = DEFAULT_CARTESIA_VOICES[voiceLanguage(language)]
  return gender === 'masculine' ? voices.masculine : voices.feminine
}

// ElevenLabs premade voices speak every language of the multilingual models
// (eleven_multilingual_v2, eleven_flash_v2_5), so one pair covers the fallback
// path for all agent languages. Not verified live (no ElevenLabs calls in this
// build); both are long-standing premade ids.
export const ELEVENLABS_FALLBACK_VOICES: VoicePair = {
  feminine: { voice_id: '21m00Tcm4TlvDq8ikWAM', name: 'Rachel', gender: 'feminine' },
  masculine: { voice_id: 'pNInz6obpgDQGcFmaJgB', name: 'Adam', gender: 'masculine' },
}

export function elevenLabsFallbackVoice(gender?: 'masculine' | 'feminine' | 'gender_neutral' | null): DefaultVoice {
  return gender === 'masculine' ? ELEVENLABS_FALLBACK_VOICES.masculine : ELEVENLABS_FALLBACK_VOICES.feminine
}

/**
 * The ElevenLabs voice for the fallback paths. The agent's Cartesia voice
 * decides: its cloned twin when one exists, else a premade voice of the same
 * gender. `legacyVoiceId` (agents.voice_id from the ElevenLabs-only days) is
 * only used for agents that never picked a Cartesia voice.
 */
export function fallbackElevenLabsVoiceId(input: {
  twinVoiceId?: string | null
  cartesiaVoiceId?: string | null
  legacyVoiceId?: string | null
  gender?: 'masculine' | 'feminine' | 'gender_neutral' | null
}): string {
  const twin = input.twinVoiceId?.trim()
  if (twin) return twin
  const legacy = input.legacyVoiceId?.trim()
  if (legacy && !input.cartesiaVoiceId?.trim()) return legacy
  return elevenLabsFallbackVoice(input.gender ?? null).voice_id
}
