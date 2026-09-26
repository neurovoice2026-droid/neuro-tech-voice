// Cartesia REST shapes for API version 2026-08-14, as far as the app uses them.
// Sources: the per-endpoint reference pages (cartesia-docs.md) plus live reads
// on 2026-09-17. Cartesia adds optional fields and enum values within a
// version, so every response type is a floor, not a ceiling: parse leniently
// and never switch exhaustively on provider enums.

// ─── Errors ──────────────────────────────────────────────────────────────────

/**
 * HTTP error body. TTS/STT/voices send `error_code` (null for plain validation
 * errors); v1 agents send the PublicErrorResponse variant where `error_code`
 * may be missing. Seen live: `{request_id, message, title, error_code?}`.
 */
export interface CartesiaErrorBody {
  error_code?: string | null
  title?: string
  message?: string
  request_id?: string
  doc_url?: string
}

// ─── Voices ──────────────────────────────────────────────────────────────────

export type CartesiaGender = 'masculine' | 'feminine' | 'gender_neutral'

export interface CartesiaVoiceAccent {
  /** Accent id, e.g. `general-american`, `romanian`. */
  accent: string
  /** e.g. `en-US`, `ro-MD`. */
  locale: string
  is_native: boolean
}

export interface CartesiaVoice {
  id: string
  name: string
  description: string | null
  tagline: string | null
  gender: CartesiaGender | null
  /** Deprecated in favour of `accents[].locale`, still returned. */
  language: string | null
  country: string | null
  accents: CartesiaVoiceAccent[]
  is_owner: boolean
  is_pro: boolean
  /** `active` for every public voice seen live. */
  status: string | null
  access: string | null
  visibility: string | null
  created_at: string | null
  /**
   * Only present with `expand[]=preview_file_url`, and null for roughly two
   * thirds of the library (live count 2026-09-17). Requires the API key, may
   * move, never store or hand it to a browser.
   */
  preview_file_url?: string | null
}

/** Response of POST /voices/clone. */
export interface CartesiaVoiceMetadata {
  id: string
  name: string
  description: string | null
  tagline: string | null
  language: string
  access?: string
  visibility?: string
  created_at: string
  /** Deprecated. */
  user_id?: string
}

export interface CartesiaAccent {
  id: string
  name: string
  language: string
  locale: string
  is_locale_default?: boolean
  is_localizable?: boolean
}

// ─── Managed Agents (v1) ─────────────────────────────────────────────────────

export type CartesiaPreToolSpeech = 'auto' | 'force'
export type CartesiaNoiseSuppression = 'off' | 'auto' | 'max'
export type CartesiaDynamicValue = string | number | boolean

export interface CartesiaSystemToolSlot {
  /** null = Cartesia's built-in description. */
  description: string | null
  pre_tool_speech: CartesiaPreToolSpeech
}

export interface CartesiaTransferRule {
  /** E.164 or a single dynamic variable such as `{{transfer_number}}`. */
  destination: { type: 'phone'; phone_number: string }
  /** ≤ 1000 chars: when the agent should transfer here. */
  condition: string
}

export interface CartesiaSystemTools {
  end_call: CartesiaSystemToolSlot | null
  send_dtmf: CartesiaSystemToolSlot | null
  transfer_to_number: (CartesiaSystemToolSlot & { transfers: CartesiaTransferRule[] }) | null
}

export interface CartesiaBackgroundSound {
  file_id: string
  /** 0–2 */
  volume: number
}

/** Normalised config returned by GET/POST/PATCH /v1/agents (all keys present). */
export interface CartesiaAgentConfig {
  instructions: string
  /** null = wait for the caller to speak first. */
  initial_message: string | null
  model: {
    /** From GET /v1/agents/models. */
    id: string
    /** 0–1; must stay null for models that report `fixed_temperature`. */
    temperature: number | null
    /** 1–4096, null = no limit. */
    max_output_tokens: number | null
  }
  language: { primary: string }
  audio: {
    input: { noise_suppression: CartesiaNoiseSuppression; keyterms: string[] }
    output: {
      voice_id: string
      /** 0.6–1.5 */
      speed: number | null
      /** 0.5–2 */
      volume: number | null
      emotion: string | null
      pronunciation_dictionary_id: string | null
      background_sound: CartesiaBackgroundSound | null
    }
  }
  tools: { id: string }[]
  system_tools: CartesiaSystemTools
  /** Playground sample values only; production calls never use them. */
  dynamic_variable_placeholders: Record<string, CartesiaDynamicValue>
  /** IANA zone for `{{system__time}}`, default UTC. */
  timezone: string
  /** Returned live (2026-09-17) but absent from the create/update reference; read-only for now. */
  event_webhook_id?: string | null
  /** Returned live (2026-09-17) but absent from the create/update reference; read-only for now. */
  user_inactivity_timeout_secs?: number | null
}

export interface CartesiaAgentVersion {
  id: string
  description: string | null
  created_at: string
  created_by: string | null
}

export interface CartesiaManagedAgent {
  id: string
  name: string
  description: string | null
  /** Returned live, not in the reference. */
  zdr?: boolean
  created_at: string
  updated_at: string
  config: CartesiaAgentConfig
  version: CartesiaAgentVersion
}

export interface CartesiaAgentSummary {
  id: string
  name: string
  description: string | null
  created_at: string
  updated_at: string
  version_id: string
  zdr?: boolean
}

/**
 * Writable config. Create accepts any subset (the schema has no required
 * list); PATCH is sparse: `tools` replaces the whole list, a system tool slot
 * set to null disables it, `{}` enables it with defaults.
 */
export interface CartesiaAgentConfigInput {
  instructions?: string
  initial_message?: string | null
  model?: { id?: string; temperature?: number | null; max_output_tokens?: number | null }
  language?: { primary?: string }
  audio?: {
    input?: { noise_suppression?: CartesiaNoiseSuppression; keyterms?: string[] }
    output?: {
      voice_id?: string
      speed?: number | null
      volume?: number | null
      emotion?: string | null
      pronunciation_dictionary_id?: string | null
      background_sound?: { file_id: string; volume?: number } | null
    }
  }
  tools?: { id: string }[]
  system_tools?: {
    end_call?: Partial<CartesiaSystemToolSlot> | null
    send_dtmf?: Partial<CartesiaSystemToolSlot> | null
    transfer_to_number?: (Partial<CartesiaSystemToolSlot> & { transfers: CartesiaTransferRule[] }) | null
  }
  /** Replaces saved samples; `{}` clears them. */
  dynamic_variable_placeholders?: Record<string, CartesiaDynamicValue>
  timezone?: string
  /** Hang up after this many silent seconds (writable although not in the reference; verified live). */
  user_inactivity_timeout_secs?: number | null
}

export interface CartesiaAgentCreate {
  /** 1–64 chars, not unique. */
  name: string
  description?: string | null
  config: CartesiaAgentConfigInput
}

export interface CartesiaAgentUpdate {
  name?: string
  description?: string | null
  config?: CartesiaAgentConfigInput
  /** Only allowed when `config` changes. */
  version_description?: string
}

/** One entry of GET /v1/agents/models (14 models live on 2026-09-17). */
export interface CartesiaAgentModel {
  id: string
  display_name?: string
  provider?: string
  description?: string | null
  average_latency_ms?: number | null
  /** Not in the reference; non-null (e.g. 1 for claude-sonnet-5) means temperature can't be set. */
  fixed_temperature?: number | null
  pricing?: {
    currency: string
    input_per_million_tokens: string
    output_per_million_tokens: string
    cache_read_per_million_tokens?: string
    cache_write_per_million_tokens?: string
  }
}

// ─── Agent tools ─────────────────────────────────────────────────────────────

export type CartesiaToolScalarType = 'string' | 'integer' | 'number' | 'boolean'

export interface CartesiaClientToolParam {
  type: CartesiaToolScalarType | 'array'
  /** ≤ 1000 chars */
  description?: string
  /** Strings only, 1–64 values. */
  enum?: string[]
  /** Required when `type` is `array`. */
  items?: { type: CartesiaToolScalarType }
}

export interface CartesiaClientToolParameters {
  type: 'object'
  properties?: Record<string, CartesiaClientToolParam>
  /** Names the agent must provide; ≤ 64. */
  required?: string[]
}

interface CartesiaToolBase {
  /** `^[a-zA-Z][a-zA-Z0-9_-]{0,63}$`, case-sensitive. */
  name: string
  /** 1–2000 chars. */
  description: string
  pre_tool_speech: CartesiaPreToolSpeech
  /** `immediate` runs inside the turn and can be interrupted; `async` lets the turn finish. */
  execution_mode: 'immediate' | 'async'
  /** 1–120, default 20. */
  response_timeout_secs?: number
}

export interface CartesiaClientToolCreate extends CartesiaToolBase {
  type: 'client'
  expects_response: boolean
  parameters: CartesiaClientToolParameters
}

export interface CartesiaWebhookApiSchema {
  /** HTTPS only, `{name}` placeholders for path params. */
  url: string
  method: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE'
  path_params_schema?: Record<string, unknown>
  query_params_schema?: Record<string, unknown>
  request_body_schema?: Record<string, unknown>
  request_headers?: Record<string, unknown>
  authentication?: Record<string, unknown>
}

export interface CartesiaWebhookToolCreate extends CartesiaToolBase {
  type: 'webhook'
  api_schema: CartesiaWebhookApiSchema
  assignments?: Record<string, unknown>[]
}

export type CartesiaToolCreate = CartesiaClientToolCreate | CartesiaWebhookToolCreate

interface CartesiaToolStored {
  id: string
  created_at: string
  updated_at: string
  response_timeout_secs: number
  /** Only with `expand[]=agents`. */
  agents?: CartesiaAgentSummary[]
}

export type CartesiaTool =
  | (CartesiaClientToolCreate & CartesiaToolStored)
  | (CartesiaWebhookToolCreate & CartesiaToolStored)

// ─── Agent calls ─────────────────────────────────────────────────────────────

export type CartesiaCallStatus = 'created' | 'started' | 'completed' | 'failed'

export type CartesiaCallEndReason =
  | 'agent_hangup'
  | 'client_hangup'
  | 'api_cancelled'
  | 'max_duration'
  | 'inactivity'
  | 'client_disconnected'
  | 'dial_busy'
  | 'dial_failed'
  | 'dial_no_answer'
  | 'error'

export interface CartesiaCallToolCall {
  id?: string
  name: string
  arguments: Record<string, unknown>
  result?: string
  dynamic_variable_updates?: Record<string, unknown>[]
}

export interface CartesiaCallTranscriptTurn {
  /** `user`, `assistant` (the agent) or `system`. */
  role: string
  text?: string | null
  /** Seconds from call start. */
  start_timestamp: number
  end_timestamp: number
  tool_calls?: CartesiaCallToolCall[] | null
  stt_ttfb?: number | null
  tts_ttfb?: number | null
}

export interface CartesiaTelephonyParams {
  /** Omitted for WebSocket calls. The reference describes to/from inverted for inbound; verify before trusting. */
  to?: string
  from?: string
  call_sid?: string
  direction?: string
  parameters?: Record<string, string>
  headers?: Record<string, string>
  connection_type?: 'websocket' | 'phone'
}

/** GET /agents/calls/{id}. No duration or cost: duration = end_time - start_time. */
export interface CartesiaAgentCall {
  id: string
  agent_id: string
  agent_name?: string
  status: CartesiaCallStatus
  start_time?: string | null
  end_time?: string | null
  redacted_at?: string | null
  transcript?: CartesiaCallTranscriptTurn[] | null
  telephony_params?: CartesiaTelephonyParams | null
  telephony_account_type?: 'cartesia' | 'twilio' | 'sip_trunk' | null
  summary?: string | null
  error_message?: string | null
  end_reason?: CartesiaCallEndReason | null
  metadata?: Record<string, unknown>
  dynamic_variables?: Record<string, CartesiaDynamicValue>
}

// ─── Knowledge base (Line surface) ───────────────────────────────────────────

export interface CartesiaFolder {
  id: string
  parent_id: string | null
  name: string
  created_at: string
  agents?: { id: string; name?: string }[]
  documents?: { id: string; name?: string | null; created_at?: string; metadata?: Record<string, string> }[]
}

export interface CartesiaDocument {
  id: string
  name?: string | null
  folder_id?: string
  content?: string
  metadata?: Record<string, string>
  created_at?: string
}

// ─── Usage (admin key) ───────────────────────────────────────────────────────

export interface CartesiaCreditsBucket {
  start_ts: string
  end_ts: string
  credits: number
}

export interface CartesiaAgentUsageBucket {
  start_ts: string
  end_ts: string
  /** Total cost in US cents. */
  cents: number
  minutes: number
  calls: number
}

// ─── Pagination ──────────────────────────────────────────────────────────────

/** `next_page` is the id to pass as `starting_after` (seen live); null on the last page. */
export interface CartesiaPage<T> {
  data: T[]
  has_more: boolean
  next_page: string | null
}
