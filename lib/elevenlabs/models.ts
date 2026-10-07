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

/**
 * LLM enum of the spec (PromptAgentAPIModel.llm, 2026-10), without
 * 'custom-llm' (it needs a custom_llm endpoint we never configure). Used only
 * when the live catalogue (GET /v1/convai/llm/list) cannot be read: new
 * models the catalogue offers are accepted without updating this list.
 */
export const AGENT_LLMS = [
  'gpt-4o-mini', 'gpt-4o', 'gpt-4', 'gpt-4-turbo', 'gpt-4.1', 'gpt-4.1-mini', 'gpt-4.1-nano', 'gpt-5', 'gpt-5.1', 'gpt-5.2',
  'gpt-5.2-chat-latest', 'gpt-5.4', 'gpt-5.4-mini', 'gpt-5.4-nano', 'gpt-5.5', 'gpt-5.6-sol', 'gpt-5.6-terra', 'gpt-5.6-luna',
  'gpt-6-astra', 'gpt-6-sol', 'gpt-6-luna', 'gpt-6.1-sol', 'gpt-5-mini', 'gpt-5-nano', 'gpt-3.5-turbo', 'gemini-1.5-pro',
  'gemini-1.5-flash', 'gemini-2.0-flash', 'gemini-2.0-flash-lite', 'gemini-2.5-flash-lite', 'gemini-2.5-flash',
  'gemini-3-pro-preview', 'gemini-3-flash-preview', 'gemini-3.1-pro-preview', 'gemini-3.1-flash-lite-preview',
  'gemini-3.1-flash-lite', 'gemini-3.5-flash', 'gemini-3.5-flash-lite', 'gemini-3.6-flash', 'gemini-3.7-flash',
  'gemini-3.8-flash', 'claude-sonnet-4-5', 'claude-opus-4-7', 'claude-opus-4-8', 'claude-opus-5', 'claude-opus-5-5',
  'claude-sonnet-4-6', 'claude-sonnet-5', 'claude-sonnet-5-5', 'claude-sonnet-4', 'claude-haiku-4-5', 'claude-3-7-sonnet',
  'claude-3-5-sonnet', 'claude-3-5-sonnet-v1', 'claude-3-haiku', 'grok-beta', 'qwen3-4b', 'qwen3-30b-a3b',
  'qwen36-35b-a3b', 'qwen35-397b-a17b', 'gpt-oss-20b', 'gpt-oss-120b', 'glm-45-air-fp8', 'glm-52', 'deepseek-v41-flash',
  'gemini-2.5-flash-preview-09-2025', 'gemini-2.5-flash-lite-preview-09-2025', 'gemini-2.5-flash-preview-05-20',
  'gemini-2.5-flash-preview-04-17', 'gemini-2.5-flash-lite-preview-06-17', 'gemini-2.0-flash-lite-001',
  'gemini-2.0-flash-001', 'gemini-1.5-flash-002', 'gemini-1.5-flash-001', 'gemini-1.5-pro-002', 'gemini-1.5-pro-001',
  'claude-sonnet-4@20250514', 'claude-sonnet-4-5@20250929', 'claude-haiku-4-5@20251001', 'claude-3-7-sonnet@20250219',
  'claude-3-5-sonnet@20240620', 'claude-3-5-sonnet-v2@20241022', 'claude-3-haiku@20240307', 'gpt-5-2025-08-07',
  'gpt-5.1-2025-11-13', 'gpt-5.2-2025-12-11', 'gpt-5.4-2026-03-05', 'gpt-5.4-mini-2026-03-17', 'gpt-5.4-nano-2026-03-17',
  'gpt-5.5-2026-04-23', 'gpt-5-mini-2025-08-07', 'gpt-5-nano-2025-08-07', 'gpt-4.1-2025-04-14', 'gpt-4.1-mini-2025-04-14',
  'gpt-4.1-nano-2025-04-14', 'gpt-4o-mini-2024-07-18', 'gpt-4o-2024-11-20', 'gpt-4o-2024-08-06', 'gpt-4o-2024-05-13',
  'gpt-4-0613', 'gpt-4-0314', 'gpt-4-turbo-2024-04-09', 'gpt-3.5-turbo-0125', 'gpt-3.5-turbo-1106', 'watt-tool-8b',
  'watt-tool-70b',
] as const

/** Whether `llm` is in the vendored spec enum (custom-llm excluded). */
export function isKnownAgentLlm(llm: string | null | undefined): boolean {
  return !!llm && (AGENT_LLMS as readonly string[]).includes(llm)
}

/**
 * The CONFIGURED LLM id (ELEVENLABS_LLM, shape-checked; 'custom-llm' is
 * rejected because it needs a custom endpoint). What agents actually get is
 * decided by lib/elevenlabs/llm-selection.ts against GET /v1/convai/llm/list:
 * an unknown, unavailable or deprecated model is replaced by the platform
 * default there, and reported by the admin diagnostics.
 */
export function agentLlm(): string {
  const v = (process.env.ELEVENLABS_LLM ?? '').trim()
  return /^[a-z0-9][a-z0-9.@_-]{1,63}$/i.test(v) && v.toLowerCase() !== 'custom-llm' ? v : DEFAULT_LLM
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
