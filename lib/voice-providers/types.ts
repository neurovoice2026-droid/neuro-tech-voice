// Normalized, provider-independent types. UI components, API routes and the
// call store depend on these, never on raw ElevenLabs/Cartesia payloads.
// Pure type module (safe to import from client components with `import type`).

import type { VoiceProvider } from './errors'
import type { ComposePromptInput } from './prompt'
import type { CallChannel, CallMetadata } from './call-metadata'

export type { VoiceProvider } from './errors'

export type ResourceStatus = 'pending' | 'ready' | 'failed' | 'degraded'
export type VoiceSyncStatus = 'pending' | 'saving' | 'synced' | 'failed'
export type RoutingMode = 'app_routed' | 'native_elevenlabs'

// ─── Agent configuration (what the dashboard edits) ──────────────────────────

export interface ConversationSettings {
  /** Caller may interrupt (barge-in). */
  allow_interruptions: boolean
  /** Seconds of caller silence before the agent re-prompts. */
  turn_timeout_seconds: number
  /** End the call after this many seconds of silence (null = never). */
  silence_end_call_seconds: number | null
  /** Hard cap on call length in minutes. */
  max_call_duration_minutes: number
  /** How quickly the agent takes its turn. */
  turn_eagerness: 'patient' | 'normal' | 'eager'
  /** Let the agent end the call itself when the conversation is over. */
  allow_end_call: boolean
  /** Detect voicemail on outbound calls and leave this message (null = hang up). */
  voicemail_detection: boolean
  voicemail_message: string | null
  /** Speak a recording notice in the first message (consent, where required). */
  recording_notice: boolean
  /** Always disclose the caller is talking to an AI (on by default; cannot be disabled by prompt). */
  ai_disclosure: boolean
  temperature: number | null
  /**
   * Extra languages the agent can switch to when the caller speaks them (max 3,
   * never the primary language). ElevenLabs only: the Cartesia fallback agent
   * stays on the primary language.
   */
  additional_languages: string[]
  /** Business words boosted in speech recognition: staff, services, streets (the business name is always added). */
  asr_keywords: string[]
  /** Say a short localized filler ("One moment, please.") when a reply takes longer than 3 s. */
  soft_timeout_fillers: boolean
  /** Short acknowledgements ("mhm", "da", "ok") do not interrupt the agent. */
  ignore_backchannels: boolean
  /** The agent waits quietly when the caller asks for a moment, then checks in. */
  skip_turn: boolean
  /** Filter background voices (TV, other people) so they do not trigger turns. */
  background_voice_detection: boolean
}

export const DEFAULT_CONVERSATION_SETTINGS: ConversationSettings = {
  allow_interruptions: true,
  turn_timeout_seconds: 7,
  silence_end_call_seconds: 20,
  max_call_duration_minutes: 15,
  turn_eagerness: 'normal',
  allow_end_call: true,
  voicemail_detection: false,
  voicemail_message: null,
  recording_notice: false,
  ai_disclosure: true,
  temperature: null,
  additional_languages: [],
  asr_keywords: [],
  soft_timeout_fillers: true,
  ignore_backchannels: true,
  skip_turn: true,
  background_voice_detection: false,
}

export interface TransferSettings {
  enabled: boolean
  /** E.164 number of the human to transfer to. */
  number: string | null
  /** When the agent should transfer (natural-language condition). */
  condition: string | null
  /** Shown/spoken name of the destination ("our front desk"). */
  label: string | null
  /**
   * Keys dialed once the destination answers (an extension behind a PBX):
   * digits, * and #; w = 0.5 s pause, W = 1 s. null = none.
   */
  extension?: string | null
  /** Native numbers: 'conference' (warm message to the human, default) or 'blind' (direct, keeps the caller's number). */
  transfer_type?: 'conference' | 'blind'
  /** Smart-routed numbers: announce the caller's reason to the human before connecting. */
  whisper?: boolean
}

export const DEFAULT_TRANSFER_SETTINGS: TransferSettings = {
  enabled: false,
  number: null,
  condition: null,
  label: null,
  extension: null,
  transfer_type: 'conference',
  whisper: false,
}

export interface DataCollectionField {
  id: string
  type: 'string' | 'boolean' | 'integer' | 'number'
  description: string
}

export interface SuccessCriterion {
  id: string
  name: string
  prompt: string
}

export interface AnalysisSettings {
  success_criteria: SuccessCriterion[]
  data_collection: DataCollectionField[]
}

/**
 * Allowed values of the platform 'outcome' data-collection field, sent as the
 * spec `enum` so the post-call analysis returns machine-safe values
 * (CallOutcome without 'missed', which only the platform sets).
 */
export const DATA_COLLECTION_OUTCOME_VALUES = [
  'booked',
  'rescheduled',
  'cancelled',
  'answered',
  'message_taken',
  'transferred',
  'flagged',
  'spam',
  'other',
] as const

export const DEFAULT_ANALYSIS_SETTINGS: AnalysisSettings = {
  success_criteria: [
    { id: 'caller_helped', name: 'Caller helped', prompt: 'The caller received the information or action they called for, or a clear next step was agreed.' },
  ],
  data_collection: [
    { id: 'caller_name', type: 'string', description: "The caller's full name if they gave it, otherwise empty." },
    { id: 'callback_number', type: 'string', description: 'A phone number the caller asked to be called back on, in E.164 if possible.' },
    { id: 'reason_for_call', type: 'string', description: 'One short sentence describing why the caller called.' },
    { id: 'outcome', type: 'string', description: `One of: ${DATA_COLLECTION_OUTCOME_VALUES.join(', ')}.` },
  ],
}

export interface PrivacySettings {
  record_audio: boolean
  /** Days the provider keeps transcripts/audio; -1 = provider default (unlimited), 0 = delete asap. */
  retention_days: number
}

export const DEFAULT_PRIVACY_SETTINGS: PrivacySettings = { record_audio: true, retention_days: 365 }

export interface VoiceTuning {
  stability: number | null
  similarity_boost: number | null
  speed: number | null
}

/** Everything a provider needs to (re)build the external agent. */
export interface AgentSpec {
  localAgentId: string
  orgId: string
  orgName: string | null
  name: string
  language: string
  /** Final, server-composed system prompt for ElevenLabs (per-call variables). */
  systemPrompt: string
  /**
   * The inputs systemPrompt was composed from, so the ElevenLabs adapter can
   * recompose it when a platform tool is unavailable (never promise a transfer
   * that cannot happen). Absent in hand-built specs.
   */
  promptInput?: ComposePromptInput
  /** Same rules composed for the Cartesia fallback agent (context via tool). */
  fallbackSystemPrompt: string
  /** Bounded plain-text knowledge excerpts for the fallback agent (its KB is not yet available for managed agents). */
  knowledgeAppendix: string
  firstMessage: string
  /**
   * First message per additional language (conversation.additional_languages),
   * composed with the same AI disclosure / recording notice as firstMessage.
   */
  languagePresetGreetings: Record<string, string>
  voiceId: string | null
  voiceTuning: VoiceTuning
  /** Explicit voice for a NEW ElevenLabs agent the tenant gave none (curated voice of its language). */
  defaultVoiceId?: string | null
  /** The org's ElevenLabs pronunciation dictionary version (null = none). */
  pronunciationLocator?: { dictionaryId: string; versionId: string } | null
  /** Cartesia voice used by the fallback agent. */
  fallbackVoiceId: string | null
  timezone: string
  conversation: ConversationSettings
  transfer: TransferSettings
  analysis: AnalysisSettings
  privacy: PrivacySettings
  /** Provider document ids already uploaded, per provider. */
  knowledge: Array<{
    name: string
    /** 'folder': an imported website (always used through RAG). */
    type: 'file' | 'url' | 'text' | 'folder'
    elevenlabsId: string | null
    cartesiaId: string | null
    /** 'prompt' = always in the system prompt (capped per organization); default 'auto'. */
    usageMode?: 'auto' | 'prompt'
    /** Size known to the platform (null = unknown); documents under 500 bytes cannot be RAG-indexed. */
    sizeBytes?: number | null
  }>
  /** Static customer-defined variables available to the prompt. */
  dynamicVariables: Record<string, string>
  /** Whether calls reach this agent through our Twilio ingress (μ-law 8 kHz). */
  appRouted: boolean
  /** At least one of the org's numbers is imported natively into ElevenLabs (native_elevenlabs). */
  hasNativeNumbers: boolean
  /**
   * agents.is_active. Native numbers bypass our router, so a paused agent is
   * synced as an "unavailable" variant that only says so and hangs up.
   */
  active: boolean
  /** Per-agent call limits from the org plan (platform-owned; ElevenLabs only). */
  callLimits: { concurrency: number; daily: number; bursting: boolean }
  /** Weekly opening hours in words when the after-hours rule is on (native calls decide from them). */
  openingHours: string | null
  revision: number
}

export interface ExternalAgentRef {
  provider: VoiceProvider
  externalId: string
  version: string | null
}

// ─── Voices ──────────────────────────────────────────────────────────────────

export type VoiceSource = 'premade' | 'library' | 'cloned' | 'designed' | 'provider'

export interface NormalizedVoice {
  provider: VoiceProvider
  /** Id usable by the agent. For library voices not yet added, the library id. */
  voiceId: string
  name: string
  description: string | null
  language: string | null
  accent: string | null
  gender: 'female' | 'male' | 'neutral' | null
  age: string | null
  category: string | null
  source: VoiceSource
  previewUrl: string | null
  /** Library voices must be provisioned (added to the platform workspace) before use. */
  requiresProvisioning: boolean
  libraryRef: { publicOwnerId: string; voiceId: string } | null
}

export interface VoiceQuery {
  search?: string
  language?: string
  gender?: 'female' | 'male'
  source?: 'workspace' | 'library'
  pageToken?: string | null
  pageSize?: number
}

export interface VoicePage {
  voices: NormalizedVoice[]
  nextPageToken: string | null
}

// ─── Calls ───────────────────────────────────────────────────────────────────

export type NormalizedCallStatus =
  | 'ringing'
  | 'in-progress'
  | 'completed'
  | 'failed'
  | 'busy'
  | 'no-answer'
  | 'canceled'
  | 'after-hours'
  | 'transferred'

export interface NormalizedTranscriptTurn {
  role: 'agent' | 'user'
  message: string
  time_in_call_secs: number
}

export interface NormalizedAnalysis {
  evaluation: Record<string, { result: string; rationale: string | null }>
  data: Record<string, string | number | boolean | null>
}

/**
 * One normalized event from a provider webhook. Several events may concern the
 * same call (transcript, audio, failure); the call store merges them with
 * precedence rules so a partial event never overwrites a complete one.
 */
export interface NormalizedCallEvent {
  provider: VoiceProvider
  kind: 'call.completed' | 'call.recording_available' | 'call.analysis_available' | 'call.initiation_failed' | 'call.started'
  /** Provider conversation/call id. */
  providerCallId: string
  externalAgentId: string | null
  /**
   * Our calls.id when the provider echoes it. Only trusted when
   * localCallIdTrusted is set (our own poll, or a SIP header only our trunk
   * can set) or when localCallToken verifies to the same id: ElevenLabs
   * dynamic variables can also be supplied by a client-started session.
   */
  localCallId: string | null
  /** Signed call token echoed with localCallId (ElevenLabs ntv_call_token). */
  localCallToken?: string | null
  localCallIdTrusted?: boolean
  twilioCallSid: string | null
  direction: 'inbound' | 'outbound' | null
  fromNumber: string | null
  toNumber: string | null
  startedAt: string | null
  durationSeconds: number | null
  status: NormalizedCallStatus
  transcript: NormalizedTranscriptTurn[] | null
  summary: string | null
  summaryTitle: string | null
  callSuccessful: 'success' | 'failure' | 'unknown' | null
  analysis: NormalizedAnalysis | null
  terminationReason: string | null
  costCredits: number | null
  costUsd: number | null
  hasRecording: boolean | null
  failureReason: string | null
  eventTimestamp: number | null
  /** Telephony vs a web/SDK/test session (ElevenLabs post-call data); undefined = not classified. */
  channel?: CallChannel | null
  /** Provider conversation metadata for support (calls.call_metadata, call-metadata.ts). */
  metadata?: CallMetadata | null
  /** Outcome proven by a provider tool result (native transfer, voicemail detection). */
  evidenceOutcome?: 'transferred' | 'voicemail' | null
  /** Provider charging details: service-only (call_provider_costs), never on the calls row. */
  charging?: { isBurst: boolean | null; tier: string | null; devDiscount: boolean | null; llmPrice: number | null; platformPrice: number | null } | null
}

export interface ProviderHealth {
  provider: VoiceProvider
  configured: boolean
  ok: boolean
  latencyMs: number | null
  errorCode: string | null
  checkedAt: string
}
