// Wire contracts shared by the Next.js app and the voice gateway
// (services/voice-gateway). This file must stay dependency-free: no imports,
// only types and constants, because the gateway bundles it directly.
//
// Topology (see docs/voice-architecture.md):
//   Twilio number ── voice_url ──> app  /api/telephony/inbound   (router, owns the number)
//        │                                  │ decides the pipeline mode per call
//        │ <Connect><Stream>                ▼
//        └───────────────> gateway  wss://…/twilio   ── cartesia_self:    Cartesia Ink STT + OpenAI + Cartesia Sonic TTS
//                                                     ── cartesia_managed: Cartesia Managed Agent WebSocket (bridge)
//                                                     ── elevenlabs:       ElevenLabs agent WebSocket (bridge, fallback)
//   The gateway calls back into the app over signed HTTPS (VOICE_GATEWAY_SECRET)
//   for session config, tool execution, call control and call finalisation.

// ─── Modes ────────────────────────────────────────────────────────────────────

/**
 * How one call is served.
 * - `cartesia_self`: our orchestration. Cartesia STT + TTS paid from monthly
 *   model credits, OpenAI (gpt-5.6-luna) as the LLM.
 * - `cartesia_managed`: Cartesia Managed Agents, paid from voice-agent dollars.
 *   Cartesia hosts STT, LLM and TTS.
 * - `elevenlabs`: fallback when Cartesia (or the gateway) is unavailable.
 */
export type VoicePipelineMode = 'cartesia_self' | 'cartesia_managed' | 'elevenlabs'

export const VOICE_PIPELINE_MODES: readonly VoicePipelineMode[] = [
  'cartesia_self',
  'cartesia_managed',
  'elevenlabs',
] as const

/** Where the audio comes from. */
export type VoiceChannel = 'twilio' | 'browser'

export type CallDirection = 'inbound' | 'outbound'

// ─── Session token (router → gateway, inside <Stream><Parameter>) ────────────

/**
 * Compact payload signed with VOICE_GATEWAY_SECRET.
 * Encoded as `base64url(JSON).base64url(HMAC-SHA256)`; must stay < 450 chars
 * because Twilio caps a <Parameter> name+value at 500 characters.
 */
export interface SessionTokenPayload {
  /** Token format version. */
  v: 1
  /** calls.id of the row the router pre-created; also the session id. */
  sid: string
  /** organizations.id */
  org: string
  /** agents.id */
  agt: string
  ch: VoiceChannel
  mode: VoicePipelineMode
  /** Unix seconds. Twilio tokens live 120 s, browser tokens 60 s. */
  exp: number
}

// ─── Internal HTTP signing (both directions) ──────────────────────────────────

/** Header carrying `t=<unix seconds>,v1=<hex HMAC-SHA256(secret, `${t}.${rawBody}`)>`. */
export const INTERNAL_SIGNATURE_HEADER = 'x-ntv-signature'
/** Accepted clock skew for signed internal requests, in seconds. */
export const INTERNAL_SIGNATURE_TOLERANCE_SECONDS = 300

// ─── Session config (app → gateway) ───────────────────────────────────────────

export type SttModel = 'ink-2' | 'ink-preview' | 'ink-whisper'

export interface SttConfig {
  model: SttModel
  /** `turns` = /stt/turns/websocket (native turn detection); `manual` = /stt/websocket + finalize. */
  endpoint: 'turns' | 'manual'
  /** ISO 639-1. Only sent to Cartesia for ink-whisper. */
  language: string
  /** Up to 100 terms / 1200 chars total. Only for ink-2 and ink-preview. */
  keyterms: string[]
  /** Turn thresholds for the turns endpoint; null = Cartesia defaults. */
  turn: {
    start_threshold: number
    eager_end_threshold: number
    end_threshold: number
    end_timeout_ms: number
  } | null
  /** Manual endpoint (ink-whisper) silence auto-finalisation. */
  manual: {
    min_volume: number
    max_silence_duration_secs: number
  } | null
}

export interface CartesiaVoiceConfig {
  voice_id: string
  /** Pinned snapshot, e.g. `sonic-3.6-2026-08-27`. */
  tts_model: string
  /** ISO 639-1 language for TTS (`language` field; never also `locale`). */
  language: string
  /** 0.6–1.5, null = default. Ignored by Pro Voice Clones. */
  speed: number | null
  /** 0.5–2.0, null = default. */
  volume: number | null
  /** Primary emotion (English only in Cartesia), null = none. */
  emotion: string | null
  pronunciation_dict_id: string | null
}

export interface LlmConfig {
  /** e.g. `gpt-5.6-luna` */
  model: string
  max_output_tokens: number
  reasoning_effort: 'none' | 'low'
  /** Max model→tool round trips per caller turn. */
  max_tool_hops: number
}

export interface CallBehavior {
  allow_interruptions: boolean
  /** Hang up after this many seconds of caller silence; null = never. */
  silence_timeout_seconds: number | null
  /** Hard cap for the call. */
  max_duration_seconds: number
  record: boolean
  voicemail_detection: boolean
}

/** JSON-schema subset used by both OpenAI strict function tools and Cartesia client tools. */
export interface ToolParameterSchema {
  type: 'object'
  properties: Record<string, ToolPropertySchema>
  /** OpenAI strict mode: every property listed. Nullable props use a `null` type. */
  required: string[]
  additionalProperties: false
}

export interface ToolPropertySchema {
  type: 'string' | 'integer' | 'number' | 'boolean' | ['string', 'null'] | ['integer', 'null'] | ['number', 'null'] | ['boolean', 'null']
  description?: string
  enum?: string[]
}

export type VoiceToolName =
  | 'get_call_context'
  | 'search_knowledge'
  | 'check_availability'
  | 'book_appointment'
  | 'find_booking'
  | 'reschedule_appointment'
  | 'cancel_appointment'
  | 'add_to_waitlist'
  | 'send_sms'
  | 'take_message'
  | 'notify_team'
  | 'transfer_call'
  | 'save_lead_details'
  | 'end_call'

export interface VoiceToolDefinition {
  name: VoiceToolName
  description: string
  parameters: ToolParameterSchema
  /** Speak a short filler ("One moment…") before running it. */
  pre_tool_speech: boolean
  /** Has side effects outside the call (booking, SMS, notification). */
  side_effects: boolean
}

export interface ElevenLabsFallbackConfig {
  /** agents.elevenlabs_agent_id; null = ElevenLabs fallback unavailable for this agent. */
  agent_id: string | null
  voice_id: string | null
  /** Overrides sent in conversation_initiation_client_data so a stale sync can't serve old config. */
  prompt: string
  first_message: string | null
  language: string
}

export interface VoiceSessionConfig {
  /** = calls.id */
  session_id: string
  call_id: string
  org_id: string
  agent_id: string
  mode: VoicePipelineMode
  channel: VoiceChannel
  direction: CallDirection
  is_test: boolean
  /** E.164 or null (browser). */
  from_number: string | null
  to_number: string | null
  twilio_call_sid: string | null
  /** Agent language, ISO 639-1. */
  language: string
  /** IANA zone of the organisation, e.g. `Europe/Bucharest`. */
  timezone: string
  agent_name: string
  business_name: string
  /** Stable, cacheable system prompt (no per-call data). */
  instructions: string
  /** Per-call context (date/time, caller number…) sent as a developer message after the stable prefix. */
  call_context: string
  /** Spoken first: greeting with the AI disclosure (and recording notice) already applied. null = wait for caller. */
  initial_message: string | null
  /** Said when the agent did not understand or cannot help. */
  fallback_message: string
  /** Said when the gateway itself has to give up (all providers failed). */
  apology_message: string
  voice: CartesiaVoiceConfig
  stt: SttConfig
  llm: LlmConfig
  tools: VoiceToolDefinition[]
  behavior: CallBehavior
  /** Cartesia Managed Agent id (agents.cartesia_agent_id); required for cartesia_managed. */
  cartesia_agent_id: string | null
  elevenlabs: ElevenLabsFallbackConfig
  /** sha256(org_id) truncated, sent to OpenAI as safety_identifier. Never a phone number. */
  safety_identifier: string
}

// ─── Internal API request/response bodies ─────────────────────────────────────

/** POST /api/voice/internal/session */
export interface SessionRequest {
  session_token: string
  /** Twilio only. */
  call_sid: string | null
  stream_sid: string | null
}

/** Result of one tool invocation. `result` is what the model reads (≤ 4 KiB, UTF-8). */
export interface ToolResponse {
  ok: boolean
  result: string
  /** Something the gateway must do after speaking the model's reply. */
  action: ToolAction | null
  /** Knowledge passages used, recorded on the transcript turn ("Answered from"). */
  sources?: KnowledgeSourceRef[]
}

export type ToolAction =
  | { type: 'transfer'; to_e164: string; announce: string | null }
  | { type: 'end_call'; reason: string }

/** POST /api/voice/internal/tools */
export interface ToolRequest {
  session_id: string
  call_id: string
  tool_call_id: string
  name: VoiceToolName
  /** Parsed JSON arguments from the model. */
  arguments: Record<string, unknown>
}

export interface KnowledgeSourceRef {
  document_id: string
  document_name: string
  chunk_id: string
  /** First ~160 chars of the passage. */
  excerpt: string
  similarity: number
}

export type VoiceEventType =
  | 'stream_started'
  | 'mode_switched'
  | 'component_fallback'
  | 'quota_exceeded'
  | 'provider_error'
  | 'agent_ended'
  | 'transferred'

/** POST /api/voice/internal/events */
export interface VoiceEventRequest {
  session_id: string
  call_id: string
  type: VoiceEventType
  at: string
  data: {
    /** For mode_switched / quota_exceeded / provider_error. */
    provider?: 'cartesia' | 'openai' | 'elevenlabs' | 'gateway'
    component?: 'stt' | 'tts' | 'llm' | 'agent'
    from_mode?: VoicePipelineMode
    to_mode?: VoicePipelineMode
    /** Cartesia error_code, OpenAI error code, WS close code… */
    code?: string | null
    message?: string | null
    /** quota_exceeded: which budget ran out. */
    budget?: 'model_credits' | 'agent_dollars'
    cartesia_call_id?: string | null
    stream_sid?: string | null
  }
}

/** POST /api/voice/internal/call-control — Twilio REST lives only in the app. */
export interface CallControlRequest {
  session_id: string
  call_id: string
  action: 'hangup' | 'transfer' | 'start_recording'
  /** transfer: E.164 destination. */
  to_e164?: string
}

export interface CallControlResponse {
  ok: boolean
  error?: string
}

export interface TranscriptTurn {
  role: 'agent' | 'user'
  message: string
  /** Seconds from call start. */
  time_in_call_secs: number
  interrupted?: boolean
  sources?: KnowledgeSourceRef[]
  tool_calls?: { name: VoiceToolName; ok: boolean }[]
}

export interface CallUsage {
  /** Characters sent to Cartesia TTS. */
  tts_characters: number
  /** Seconds of audio streamed to Cartesia STT. */
  stt_seconds: number
  stt_model: SttModel | null
  /** Seconds bridged to a Cartesia Managed Agent. */
  agent_seconds: number
  /** Seconds bridged to ElevenLabs (agent or components). */
  elevenlabs_seconds: number
  elevenlabs_tts_characters: number
  llm_input_tokens: number
  llm_cached_input_tokens: number
  llm_output_tokens: number
}

export type CallEndReason =
  | 'caller_hangup'
  | 'agent_hangup'
  | 'transferred'
  | 'silence_timeout'
  | 'max_duration'
  | 'voicemail'
  | 'error'
  | 'test_ended'

/** POST /api/voice/internal/finalize */
export interface FinalizeRequest {
  session_id: string
  call_id: string
  started_at: string
  ended_at: string
  end_reason: CallEndReason
  mode: VoicePipelineMode
  fallback_used: boolean
  fallback_reason: string | null
  transcript: TranscriptTurn[]
  usage: CallUsage
  /** Cartesia Managed Agent call id (ac_…), if any. */
  cartesia_call_id: string | null
  /** ElevenLabs conversation id, if the call was bridged there. */
  elevenlabs_conversation_id: string | null
}

// ─── Browser channel (dashboard test call) ────────────────────────────────────

/** Browser ↔ gateway audio: binary frames of PCM signed 16-bit little-endian, 16 kHz, mono. */
export const BROWSER_SAMPLE_RATE = 16000

export type BrowserServerMessage =
  | { type: 'ready'; mode: VoicePipelineMode }
  | { type: 'user_transcript'; text: string; final: boolean }
  /**
   * Agent speech for the live transcript.
   * - With `turn` (cartesia_self): one sentence at a time, sent as its audio
   *   starts playing; every sentence of one agent turn carries the same id.
   *   After a barge-in, `interrupted: true` carries the text the caller really
   *   heard, which replaces that turn's sentences ('' = nothing was heard).
   * - Without `turn` (bridged engines): a whole turn at once; `interrupted`
   *   marks a turn the caller cut short.
   */
  | { type: 'agent_text'; text: string; turn?: number; interrupted?: boolean }
  | { type: 'clear' }
  | { type: 'mode_switched'; mode: VoicePipelineMode }
  | { type: 'ended'; reason: CallEndReason }
  | { type: 'error'; message: string }

export type BrowserClientMessage = { type: 'hangup' }

// ─── Twilio parameters ────────────────────────────────────────────────────────

/** Name of the <Stream><Parameter> that carries the signed session token. */
export const STREAM_SESSION_PARAMETER = 'session'
