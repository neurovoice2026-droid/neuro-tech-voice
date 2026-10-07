// Central model choices for ElevenLabs agents. Values come from env so they can
// be changed without a deploy of new code, but are validated against the enums
// in the official OpenAPI spec (2026-10): an unknown value is ignored (reported
// by GET /api/admin/voice/diagnostics, see model-diagnostics.ts) rather than
// sent to the API and turned into a 422 on every save.
//
// TTS: the Agents Platform model guide recommends eleven_flash_v2 for English
// and eleven_flash_v2_5 for other languages (both ~75 ms). eleven_turbo_v2_5,
// used before, is deprecated in favour of eleven_flash_v2_5. All 14 languages
// the product offers are covered by eleven_flash_v2_5. Agents may only use the
// real-time models of AGENT_TTS_MODELS; the high-fidelity models
// (eleven_multilingual_v2, eleven_v4) are positioned for offline synthesis.

/** TTSConversationalModel enum of the spec (every value the API accepts). */
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

/** Platform allow-list: the real-time models an agent may use (ELEVENLABS_TTS_MODEL_* may pick any of them). */
export const AGENT_TTS_MODELS = [
  'eleven_flash_v2',
  'eleven_flash_v2_5',
  'eleven_v4_turbo',
  'eleven_v3_conversational',
] as const satisfies readonly TtsConversationalModel[]
export type AgentTtsModel = (typeof AGENT_TTS_MODELS)[number]

const DEPRECATED_TTS: Partial<Record<TtsConversationalModel, TtsConversationalModel>> = {
  eleven_turbo_v2_5: 'eleven_flash_v2_5',
  eleven_turbo_v2: 'eleven_flash_v2',
}

/** English-only models (official models page): never used for another language. */
const ENGLISH_ONLY_TTS = new Set<string>(['eleven_flash_v2', 'eleven_turbo_v2'])

/** Models whose expressive mode (audio tags) is meaningful; the API disables it for the others. */
const EXPRESSIVE_TTS = new Set<string>(['eleven_v3_conversational', 'eleven_v4', 'eleven_v4_turbo'])

/** Plain text-to-speech equivalent of a conversational-only model (voice previews). */
const PREVIEW_EQUIVALENT: Partial<Record<TtsConversationalModel, string>> = {
  eleven_v3_conversational: 'eleven_v3',
}

export const DEFAULT_LLM = 'gpt-5.4-mini'
const DEFAULT_TTS_EN: AgentTtsModel = 'eleven_flash_v2'
const DEFAULT_TTS_MULTI: AgentTtsModel = 'eleven_flash_v2_5'

function isOneOf<T extends string>(list: readonly T[], value: string): value is T {
  return (list as readonly string[]).includes(value)
}

export function isAgentTtsModel(model: string | null | undefined): model is AgentTtsModel {
  return !!model && isOneOf(AGENT_TTS_MODELS, model)
}

export function isEnglishOnlyTts(model: string | null | undefined): boolean {
  return !!model && ENGLISH_ONLY_TTS.has(model)
}

function validTts(raw: string | undefined, fallback: AgentTtsModel): AgentTtsModel {
  const v = (raw ?? '').trim()
  if (!isOneOf(TTS_CONVERSATIONAL_MODELS, v)) return fallback
  const mapped = (Object.hasOwn(DEPRECATED_TTS, v) ? DEPRECATED_TTS[v] : undefined) ?? v
  return isAgentTtsModel(mapped) ? mapped : fallback
}

/** LLM id: only shape-checked here; diagnostics validate it against GET /v1/convai/llm/list. */
export function agentLlm(): string {
  const v = (process.env.ELEVENLABS_LLM ?? '').trim()
  return /^[a-z0-9][a-z0-9.@_-]{1,63}$/i.test(v) ? v : DEFAULT_LLM
}

export function ttsModelFor(language: string | null | undefined): AgentTtsModel {
  const lang = (language ?? 'en').toLowerCase()
  if (lang === 'en') return validTts(process.env.ELEVENLABS_TTS_MODEL_EN, DEFAULT_TTS_EN)
  const multi = validTts(process.env.ELEVENLABS_TTS_MODEL_MULTILINGUAL, DEFAULT_TTS_MULTI)
  // flash_v2 / turbo_v2 are English-only; never let them leak to other languages.
  return isEnglishOnlyTts(multi) ? DEFAULT_TTS_MULTI : multi
}

/**
 * Model for one-off preview synthesis (plain TTS endpoint, not the agent):
 * the live agent's model for that language, so a preview sounds like a call.
 * A conversational-only model is previewed with its plain-TTS sibling.
 */
export function previewTtsModel(language: string | null | undefined): string {
  const model = ttsModelFor(language)
  return PREVIEW_EQUIVALENT[model] ?? model
}

/** True only where the spec says expressive mode applies (v3/v4 families). */
export function supportsExpressiveMode(model: string | null | undefined): boolean {
  return !!model && EXPRESSIVE_TTS.has(model)
}

/**
 * Embedding model for RAG: multilingual as soon as the agent speaks anything
 * but English (its primary language or one of its additional languages).
 */
export function ragEmbeddingModel(
  language: string | null | undefined,
  additionalLanguages: readonly string[] = [],
): 'e5_mistral_7b_instruct' | 'multilingual_e5_large_instruct' {
  const all = [language ?? 'en', ...additionalLanguages]
  return all.every((l) => l === 'en') ? 'e5_mistral_7b_instruct' : 'multilingual_e5_large_instruct'
}

export function isDeprecatedTts(model: string | null | undefined): boolean {
  return !!model && Object.hasOwn(DEPRECATED_TTS, model)
}

// ─── Text normalisation ──────────────────────────────────────────────────────

/** TextNormalisationType enum of the spec. */
export const TEXT_NORMALISATION_TYPES = ['system_prompt', 'elevenlabs'] as const
export type TextNormalisationType = (typeof TEXT_NORMALISATION_TYPES)[number]

/**
 * Who turns numbers, prices, dates and phone numbers into words. Platform
 * default 'elevenlabs' (the normaliser runs after generation, so the LLM keeps
 * writing digits, which keeps transcripts and data collection machine-readable).
 * ELEVENLABS_TEXT_NORMALISATION=system_prompt switches back to prompt-based.
 */
export function textNormalisationType(): TextNormalisationType {
  const v = (process.env.ELEVENLABS_TEXT_NORMALISATION ?? '').trim()
  return isOneOf(TEXT_NORMALISATION_TYPES, v) ? v : 'elevenlabs'
}

// ─── LLM reasoning effort ────────────────────────────────────────────────────

/** LLMReasoningEffort enum of the spec, from least to most reasoning. */
export const LLM_REASONING_EFFORTS = ['none', 'minimal', 'low', 'medium', 'high', 'xhigh', 'max'] as const
export type LlmReasoningEffort = (typeof LLM_REASONING_EFFORTS)[number]

/**
 * The reasoning effort to send for an LLM whose `available_reasoning_efforts`
 * (GET /v1/convai/llm/list) is given: ELEVENLABS_REASONING_EFFORT when the
 * model supports it, otherwise the lowest level the model supports (lowest
 * time-to-first-token). null when the model has no configurable reasoning, in
 * which case the field is not sent at all ("Only available for some models").
 */
export function chooseReasoningEffort(
  available: readonly string[] | null | undefined,
  preference: string | null | undefined = process.env.ELEVENLABS_REASONING_EFFORT,
): LlmReasoningEffort | null {
  if (!available || available.length === 0) return null
  const pref = (preference ?? '').trim().toLowerCase()
  if (pref && isOneOf(LLM_REASONING_EFFORTS, pref) && available.includes(pref)) return pref
  return LLM_REASONING_EFFORTS.find((e) => available.includes(e)) ?? null
}
