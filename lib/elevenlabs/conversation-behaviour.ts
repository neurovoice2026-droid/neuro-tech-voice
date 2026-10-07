// Conversation-behaviour parts of the ElevenLabs agent body: speech
// recognition, turn-taking, speech synthesis, language presets, the built-in
// tools that shape a conversation (skip_turn, language_detection) and the
// data-collection property format. Kept out of agent-config.ts so the full
// body stays readable. Pure: no I/O, unit-tested.
//
// Every field name, enum and limit below was checked against the official
// OpenAPI spec (2026-10): ASRConversationalConfig, TurnConfig,
// SoftTimeoutConfig, TTSConversationalConfig-Input, VADConfig, DTMFInputConfig,
// LanguagePreset-Input / ConversationConfigClientOverride-Input,
// SkipTurnToolConfig, LanguageDetectionToolConfig and AnalysisProperty.
// tests/elevenlabs-spec-contract.test.ts enforces it.

import type { AgentSpec, DataCollectionField } from '@/lib/voice-providers/types'
import { DATA_COLLECTION_OUTCOME_VALUES } from '@/lib/voice-providers/types'
import { cleanKeyword } from '@/lib/voice-providers/settings'
import { effectiveAdditionalLanguages } from '@/lib/voice-providers/language-presets'
import { backchannelTerms, maxDurationMessage, softTimeoutMessages } from '@/lib/voice/conversation-phrases'
import { supportsExpressiveMode, textNormalisationType, ttsModelFor } from './models'

const clamp = (v: number, min: number, max: number) => Math.min(max, Math.max(min, v))

/** Seconds of LLM silence before a filler is spoken (conversation-flow guide: 3 s). */
export const SOFT_TIMEOUT_SECONDS = 3
/** Fillers per slow reply (spec 1-8): more than two starts to sound robotic. */
export const MAX_SOFT_TIMEOUTS_PER_GENERATION = 2
/** Seconds the agent waits after skip_turn before a contextual check-in (end-call-after-silence is paused meanwhile). */
export const SKIP_TURN_WAIT_SECONDS = 20
/** Keypad (DTMF) collection: a little more time between digits than the 2 s default, # ends the entry. */
export const DTMF_INPUT_SETTINGS = { dtmf_input_timeout: 3, hash_terminator: true, redact_input: false } as const
/** TTSConversationalConfig defaults (spec), sent explicitly when the tenant chose "default". */
export const TTS_TUNING_DEFAULTS = { stability: 0.5, similarity_boost: 0.8, speed: 1.0 } as const

const ASR_KEYWORDS_LIMIT = 50
const ASR_KEYWORD_MAX_CHARS = 50
const IGNORE_TERMS_LIMIT = 100

type Spec = Pick<AgentSpec, 'language' | 'conversation'>

/** The agent's additional languages, as the body uses them (see effectiveAdditionalLanguages). */
export function additionalLanguagesOf(spec: Spec): string[] {
  return effectiveAdditionalLanguages(spec.language, spec.conversation.additional_languages)
}

function distinctTerms(terms: readonly (string | null | undefined)[], limit: number, maxChars: number): string[] {
  const seen = new Set<string>()
  const out: string[] = []
  for (const raw of terms) {
    if (typeof raw !== 'string') continue
    const term = cleanKeyword(raw)
    if (!term || term.length > maxChars) continue
    const key = term.toLocaleLowerCase()
    if (seen.has(key)) continue
    seen.add(key)
    out.push(term)
    if (out.length === limit) break
  }
  return out
}

/** Business name first (capped at 50 chars, as before), then the tenant's keywords. */
export function asrKeywords(spec: Pick<AgentSpec, 'orgName' | 'conversation'>): string[] {
  const name = spec.orgName ? cleanKeyword(spec.orgName).slice(0, ASR_KEYWORD_MAX_CHARS) : null
  return distinctTerms([name, ...(spec.conversation.asr_keywords ?? [])], ASR_KEYWORDS_LIMIT, ASR_KEYWORD_MAX_CHARS)
}

export function asrConfig(spec: Pick<AgentSpec, 'orgName' | 'conversation'>, audioFormat: string) {
  return {
    quality: 'high',
    // Pinned (the spec default) so a change of default shows up as drift.
    provider: 'scribe_realtime',
    user_input_audio_format: audioFormat,
    keywords: asrKeywords(spec),
  }
}

function softTimeoutMessagesFor(language: string) {
  const [message, ...rest] = softTimeoutMessages(language)
  return { message, additional_soft_timeout_messages: rest.slice(0, 3) }
}

/** Localized filler while the LLM (or a RAG lookup / tool) is slow; timeout -1 disables it. */
export function softTimeoutConfig(spec: Spec) {
  return {
    timeout_seconds: spec.conversation.soft_timeout_fillers ? SOFT_TIMEOUT_SECONDS : -1,
    ...softTimeoutMessagesFor(spec.language),
    use_llm_generated_message: false,
    randomize_fillers: true,
    max_soft_timeouts_per_generation: MAX_SOFT_TIMEOUTS_PER_GENERATION,
    // Never over the greeting (it carries the AI disclosure).
    disable_until_first_user_message: true,
  }
}

/** Backchannels for every language the agent speaks; empty when barge-in is off or the tenant disabled it. */
export function interruptionIgnoreTerms(spec: Spec): string[] {
  const c = spec.conversation
  if (!c.allow_interruptions || !c.ignore_backchannels) return []
  const terms = [spec.language, ...additionalLanguagesOf(spec)].flatMap((l) => backchannelTerms(l))
  return distinctTerms(terms, IGNORE_TERMS_LIMIT, 50)
}

/** Turn-taking fields added to the turn block (turn_timeout & co. stay in agent-config.ts). */
export function turnBehaviour(spec: Spec) {
  return {
    spelling_patience: 'auto',
    // Explicit list only: curated defaults may not exist for Romanian, and
    // an unknown language code must never be able to fail a sync.
    interruption_ignore_terms: interruptionIgnoreTerms(spec),
    interruption_ignore_term_languages: [] as string[],
    merge_with_default_ignore_terms: false,
    // Speech during a non-interruptible turn (the protected greeting, or
    // barge-in off) is kept for the next turn instead of being dropped.
    transcribe_on_disabled_interruptions: true,
    soft_timeout_config: softTimeoutConfig(spec),
  }
}

export function ttsConfig(spec: Pick<AgentSpec, 'language' | 'voiceId' | 'voiceTuning'>, audioFormat: string): Record<string, unknown> {
  const model = ttsModelFor(spec.language)
  const t = spec.voiceTuning
  const tts: Record<string, unknown> = {
    model_id: model,
    agent_output_audio_format: audioFormat,
    // Spec: only meaningful for v3/v4 models (disabled by the API for the others).
    expressive_mode: supportsExpressiveMode(model),
    text_normalisation_type: textNormalisationType(),
  }
  if (spec.voiceId) tts.voice_id = spec.voiceId
  // Never omitted: a value pushed earlier must not survive a reset to "default".
  tts.stability = clamp(t.stability ?? TTS_TUNING_DEFAULTS.stability, 0, 1)
  tts.similarity_boost = clamp(t.similarity_boost ?? TTS_TUNING_DEFAULTS.similarity_boost, 0, 1)
  tts.speed = clamp(t.speed ?? TTS_TUNING_DEFAULTS.speed, 0.7, 1.2)
  return tts
}

export function vadConfig(spec: Spec) {
  return { background_voice_detection: spec.conversation.background_voice_detection }
}

/**
 * language_presets: one entry per additional language with its disclosed
 * greeting, closing line, fillers and a TTS model that speaks it (flash_v2 is
 * English-only). A language without a composed greeting is skipped: a preset
 * must never open a call without the AI disclosure.
 */
export function languagePresets(spec: Pick<AgentSpec, 'language' | 'conversation' | 'languagePresetGreetings'>) {
  const presets: Record<string, { overrides: Record<string, unknown> }> = {}
  for (const lang of additionalLanguagesOf(spec)) {
    const greeting = spec.languagePresetGreetings?.[lang]?.trim()
    if (!greeting) continue
    presets[lang] = {
      overrides: {
        agent: { first_message: greeting, language: lang, max_conversation_duration_message: maxDurationMessage(lang) },
        tts: { model_id: ttsModelFor(lang) },
        turn: { soft_timeout_config: softTimeoutMessagesFor(lang) },
      },
    }
  }
  return presets
}

export function skipTurnTool() {
  return {
    type: 'system',
    name: 'skip_turn',
    description: '',
    params: { system_tool_type: 'skip_turn', wait_timeout_secs: SKIP_TURN_WAIT_SECONDS },
  }
}

/** Only with language presets; switching is limited to the first two caller turns (fewer false switches). */
export function languageDetectionTool() {
  return {
    type: 'system',
    name: 'language_detection',
    description: '',
    params: { system_tool_type: 'language_detection', only_at_conversation_start: true },
  }
}

/** Description of the voicemail tool: outbound calls only (paired with a prompt rule on ntv_call_direction). */
export const VOICEMAIL_TOOL_DESCRIPTION =
  'Use only on a call you placed for the business (call direction outbound), when an answering machine or voicemail greeting answered instead of a person. Never use it on a call where the caller phoned the business.'

/** AnalysisProperty for a data-collection field; the platform 'outcome' field is limited to its machine-safe values. */
export function dataCollectionProperty(f: DataCollectionField): { type: string; description: string; enum?: string[] } {
  const property: { type: string; description: string; enum?: string[] } = { type: f.type, description: f.description.slice(0, 1000) }
  if (f.id === 'outcome' && f.type === 'string') property.enum = [...DATA_COLLECTION_OUTCOME_VALUES]
  return property
}
