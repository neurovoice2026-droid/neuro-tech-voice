// Central model choices for ElevenLabs agents. Values come from env so they can
// be changed without a deploy of new code, but are validated against the enums
// in the official OpenAPI spec (2026-10): an unknown value is ignored (logged by
// diagnostics) rather than sent to the API and turned into a 422 on every save.
//
// TTS: the Agents Platform model guide recommends eleven_flash_v2 for English
// and eleven_flash_v2_5 for other languages (both ~75 ms). eleven_turbo_v2_5,
// used before, is deprecated in favour of eleven_flash_v2_5. All 14 languages
// the product offers are covered by eleven_flash_v2_5.

export const TTS_CONVERSATIONAL_MODELS = [
  'eleven_turbo_v2',
  'eleven_turbo_v2_5',
  'eleven_flash_v2',
  'eleven_flash_v2_5',
  'eleven_multilingual_v2',
  'eleven_v3_conversational',
  'eleven_v4',
  'eleven_v4_turbo',
] as const
export type TtsConversationalModel = (typeof TTS_CONVERSATIONAL_MODELS)[number]

const DEPRECATED_TTS: Partial<Record<TtsConversationalModel, TtsConversationalModel>> = {
  eleven_turbo_v2_5: 'eleven_flash_v2_5',
  eleven_turbo_v2: 'eleven_flash_v2',
}

export const DEFAULT_LLM = 'gpt-5.4-mini'
const DEFAULT_TTS_EN: TtsConversationalModel = 'eleven_flash_v2'
const DEFAULT_TTS_MULTI: TtsConversationalModel = 'eleven_flash_v2_5'

function validTts(raw: string | undefined, fallback: TtsConversationalModel): TtsConversationalModel {
  const v = (raw ?? '').trim() as TtsConversationalModel
  if (!TTS_CONVERSATIONAL_MODELS.includes(v)) return fallback
  return (Object.hasOwn(DEPRECATED_TTS, v) ? DEPRECATED_TTS[v] : undefined) ?? v
}

/** LLM id: only shape-checked here; diagnostics validate it against GET /v1/convai/llm/list. */
export function agentLlm(): string {
  const v = (process.env.ELEVENLABS_LLM ?? '').trim()
  return /^[a-z0-9][a-z0-9.@_-]{1,63}$/i.test(v) ? v : DEFAULT_LLM
}

export function ttsModelFor(language: string | null | undefined): TtsConversationalModel {
  const lang = (language ?? 'en').toLowerCase()
  if (lang === 'en') {
    const en = validTts(process.env.ELEVENLABS_TTS_MODEL_EN, DEFAULT_TTS_EN)
    // flash_v2 / turbo_v2 are English-only; never let them leak to other languages.
    return en
  }
  const multi = validTts(process.env.ELEVENLABS_TTS_MODEL_MULTILINGUAL, DEFAULT_TTS_MULTI)
  return multi === 'eleven_flash_v2' || multi === 'eleven_turbo_v2' ? DEFAULT_TTS_MULTI : multi
}

/** Model for one-off preview synthesis (plain TTS endpoint, not the agent). */
export function previewTtsModel(language: string | null | undefined): string {
  return (language ?? 'en') === 'en' ? 'eleven_flash_v2' : 'eleven_flash_v2_5'
}

/** Embedding model for RAG: multilingual for anything but English. */
export function ragEmbeddingModel(language: string | null | undefined): 'e5_mistral_7b_instruct' | 'multilingual_e5_large_instruct' {
  return (language ?? 'en') === 'en' ? 'e5_mistral_7b_instruct' : 'multilingual_e5_large_instruct'
}

export function isDeprecatedTts(model: string | null | undefined): boolean {
  return !!model && Object.hasOwn(DEPRECATED_TTS, model)
}
