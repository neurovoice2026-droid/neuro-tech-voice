import 'server-only'
import crypto from 'node:crypto'
import { ApiError } from '@/lib/api/http'
import { env, isElevenLabsConfigured, isElevenLabsWebhookConfigured } from '@/lib/env'
import { timingSafeEqualString } from '@/lib/security/signing'

// ─── ElevenLabs client ───────────────────────────────────────────────────────
// ElevenLabs is the fallback provider: a warm standby agent per organisation
// (lib/voice/sync/elevenlabs-standby.ts), register-call for the router, and
// the legacy conversation history until every call lives in our database.
//
// Rules: every request has a timeout (Twilio gives the router seconds, not
// minutes); a missing key is an ApiError 503 not_configured; errors keep the
// upstream body for server logs only, and their message never includes it.

export const ELEVENLABS_API_BASE = 'https://api.elevenlabs.io'

const DEFAULT_TIMEOUT_MS = 15_000
const UPLOAD_TIMEOUT_MS = 60_000
const AUDIO_TIMEOUT_MS = 60_000
const MAX_ERROR_BODY_CHARS = 2_000

export class ElevenLabsError extends Error {
  /** HTTP status; 0 when no response arrived (timeout or network failure). */
  readonly status: number
  /** Upstream body, truncated. Server logs only: never send it to a browser. */
  readonly body: string
  readonly path: string
  readonly method: string

  constructor(status: number, body: string, path: string, method = 'GET') {
    super(
      status === 0
        ? `ElevenLabs ${method} ${path} ${body === 'timeout' ? 'timed out' : 'could not be reached'}`
        : `ElevenLabs ${method} ${path} failed (${status})`
    )
    this.name = 'ElevenLabsError'
    this.status = status
    this.body = body.slice(0, MAX_ERROR_BODY_CHARS)
    this.path = path
    this.method = method
  }

  get timedOut(): boolean {
    return this.status === 0 && this.body === 'timeout'
  }
}

/** True when ELEVENLABS_API_KEY is set (placeholders don't count). */
export function isConfigured(): boolean {
  return isElevenLabsConfigured()
}

/** True when an ElevenLabs webhook signing secret is configured. */
export function isWebhookConfigured(): boolean {
  return isElevenLabsWebhookConfigured()
}

function apiKey(): string {
  const key = env.ELEVENLABS_API_KEY
  if (!key) throw new ApiError(503, 'not_configured', 'ElevenLabs is not configured.')
  return key
}

export interface ElevenLabsRequestOptions {
  /** Whole request, default 15 s. */
  timeoutMs?: number
  signal?: AbortSignal
  headers?: Record<string, string>
  /** Return the Response untouched (audio, TwiML). */
  rawResponse?: boolean
}

function withPathQuery(path: string, query?: Record<string, string | number | boolean | undefined | null | readonly string[]>): string {
  const qs = new URLSearchParams()
  for (const [key, value] of Object.entries(query ?? {})) {
    if (value === undefined || value === null || value === '') continue
    if (Array.isArray(value)) value.forEach((item) => qs.append(key, item))
    else qs.set(key, String(value))
  }
  const q = qs.toString()
  return q ? `${path}?${q}` : path
}

async function send(
  method: string,
  path: string,
  body: BodyInit | undefined,
  contentType: string | null,
  opts?: ElevenLabsRequestOptions
): Promise<Response> {
  const headers: Record<string, string> = { 'xi-api-key': apiKey(), ...opts?.headers }
  if (contentType) headers['Content-Type'] = contentType
  const signals = [AbortSignal.timeout(opts?.timeoutMs ?? DEFAULT_TIMEOUT_MS)]
  if (opts?.signal) signals.push(opts.signal)

  let res: Response
  try {
    res = await fetch(`${ELEVENLABS_API_BASE}${path}`, {
      method,
      headers,
      body,
      signal: AbortSignal.any(signals),
      cache: 'no-store',
    })
  } catch (error) {
    // A caller cancellation stays an AbortError; our own timeout becomes a typed error.
    if (opts?.signal?.aborted) throw error
    const timedOut = error instanceof Error && error.name === 'TimeoutError'
    throw new ElevenLabsError(0, timedOut ? 'timeout' : 'network_error', path.split('?')[0], method)
  }

  if (!res.ok) {
    const text = await res.text().catch(() => '')
    throw new ElevenLabsError(res.status, text, path.split('?')[0], method)
  }
  return res
}

/** Generic JSON request, exported for modules that need endpoints not wrapped below (register-call). */
export async function elevenLabsRequest<T>(
  method: 'GET' | 'POST' | 'PATCH' | 'DELETE',
  path: string,
  body?: unknown,
  opts?: ElevenLabsRequestOptions
): Promise<T> {
  const res = await send(
    method,
    path,
    body === undefined ? undefined : JSON.stringify(body),
    body === undefined ? null : 'application/json',
    opts
  )
  if (opts?.rawResponse) return res as unknown as T
  const contentType = res.headers.get('content-type') ?? ''
  if (contentType.includes('application/json')) return (await res.json()) as T
  const text = await res.text()
  return (text ? text : undefined) as unknown as T
}

async function requestFormData<T>(path: string, formData: FormData, opts?: ElevenLabsRequestOptions): Promise<T> {
  const res = await send('POST', path, formData, null, { timeoutMs: UPLOAD_TIMEOUT_MS, ...opts })
  return (await res.json()) as T
}

/**
 * Verify an ElevenLabs webhook HMAC signature.
 *
 * Header format: `ElevenLabs-Signature: t=<unix>,v0=<hex>` where the hex value
 * is HMAC-SHA256 of `${t}.${rawBody}` keyed with ELEVENLABS_WEBHOOK_SECRET.
 * Stale timestamps are rejected to mitigate replay attacks.
 */
export function verifyWebhookSignature(
  rawBody: string,
  signatureHeader: string | null,
  toleranceSeconds = 1800
): boolean {
  const secret = env.ELEVENLABS_WEBHOOK_SECRET
  if (!secret || !signatureHeader) return false

  const parts = signatureHeader.split(',')
  const t = parts.find((p) => p.startsWith('t='))?.slice(2)
  const v0 = parts.find((p) => p.startsWith('v0='))?.slice(3)
  if (!t || !v0) return false

  const timestamp = Number(t)
  if (!Number.isFinite(timestamp)) return false
  if (Math.abs(Date.now() / 1000 - timestamp) > toleranceSeconds) return false

  const expected = crypto.createHmac('sha256', secret).update(`${t}.${rawBody}`).digest('hex')
  return timingSafeEqualString(expected, v0)
}

// ─── Agents ──────────────────────────────────────────────────────────────────

export type ElevenLabsAudioFormat = 'ulaw_8000' | 'pcm_16000' | 'pcm_22050' | 'pcm_24000' | 'pcm_44100'

export interface ELAgent {
  agent_id: string
  name: string
  conversation_config: {
    asr?: { user_input_audio_format?: string }
    agent?: {
      prompt?: { prompt?: string; llm?: string }
      first_message?: string
      language?: string
    }
    tts?: { voice_id?: string; model_id?: string; agent_output_audio_format?: string; expressive_mode?: boolean }
  }
  platform_settings?: Record<string, unknown>
  metadata?: Record<string, unknown>
  [key: string]: unknown
}

export interface ElevenLabsConversationConfig {
  asr?: { user_input_audio_format?: ElevenLabsAudioFormat }
  agent?: {
    prompt?: { prompt: string; llm?: string }
    first_message?: string
    language?: string
  }
  tts?: {
    voice_id?: string
    model_id?: string
    agent_output_audio_format?: ElevenLabsAudioFormat
    expressive_mode?: boolean
  }
}

/** Which conversation fields a register-call or WebSocket client may override per call. */
export interface ElevenLabsOverrideSettings {
  conversation_config_override: {
    agent?: { prompt?: { prompt?: boolean }; first_message?: boolean; language?: boolean }
    tts?: { voice_id?: boolean }
  }
}

export interface CreateAgentParams {
  name: string
  conversation_config: ElevenLabsConversationConfig & { agent: NonNullable<ElevenLabsConversationConfig['agent']> }
  platform_settings?: { overrides?: ElevenLabsOverrideSettings } & Record<string, unknown>
  tags?: string[]
}

export interface UpdateAgentParams {
  conversation_config?: ElevenLabsConversationConfig
  name?: string
  platform_settings?: { overrides?: ElevenLabsOverrideSettings } & Record<string, unknown>
  tags?: string[]
}

export const agents = {
  create(params: CreateAgentParams) {
    return elevenLabsRequest<ELAgent>('POST', '/v1/convai/agents/create', params)
  },

  get(agentId: string) {
    return elevenLabsRequest<ELAgent>('GET', `/v1/convai/agents/${encodeURIComponent(agentId)}`)
  },

  list(params?: { page_size?: number; search?: string; cursor?: string }) {
    return elevenLabsRequest<{ agents: ELAgent[]; next_cursor?: string }>(
      'GET',
      withPathQuery('/v1/convai/agents', params)
    )
  },

  update(agentId: string, params: UpdateAgentParams) {
    return elevenLabsRequest<ELAgent>('PATCH', `/v1/convai/agents/${encodeURIComponent(agentId)}`, params)
  },

  delete(agentId: string) {
    return elevenLabsRequest<void>('DELETE', `/v1/convai/agents/${encodeURIComponent(agentId)}`)
  },
}

// ─── Conversations ───────────────────────────────────────────────────────────

export interface ELConversation {
  conversation_id: string
  agent_id: string
  status: string
  transcript?: Array<{
    role: string
    message: string
    time_in_call_secs?: number
  }>
  metadata?: {
    start_time_unix_secs?: number
    call_duration_secs?: number
    cost?: number
    from_number?: string
    to_number?: string
    direction?: string
    phone_call?: {
      external_number?: string
      agent_number?: string
      direction?: string
      call_sid?: string
      [key: string]: unknown
    }
    [key: string]: unknown
  }
  analysis?: {
    call_successful?: string
    transcript_summary?: string
    evaluation_criteria_results?: Record<string, unknown>
    data_collection_results?: Record<string, unknown>
    [key: string]: unknown
  }
  conversation_initiation_client_data?: Record<string, unknown>
  [key: string]: unknown
}

export interface ELConversationListItem {
  conversation_id: string
  agent_id: string
  status: string
  start_time_unix_secs?: number
  call_duration_secs?: number
  message_count?: number
  call_successful?: string
  from_phone_number?: string
  to_phone_number?: string
  conversation_initiation_source?: string
  [key: string]: unknown
}

export interface ListConversationsParams {
  agent_id?: string
  page_size?: number
  cursor?: string
  call_successful?: string
  call_start_after_unix?: number
  call_start_before_unix?: number
  call_duration_min_secs?: number
  call_duration_max_secs?: number
  search?: string
  exclude_statuses?: string[]
}

export interface ListConversationsResponse {
  conversations: ELConversationListItem[]
  next_cursor?: string
  has_more?: boolean
  total_count?: number
}

export const conversations = {
  list(params?: ListConversationsParams) {
    return elevenLabsRequest<ListConversationsResponse>('GET', withPathQuery('/v1/convai/conversations', { ...params }))
  },

  get(conversationId: string) {
    return elevenLabsRequest<ELConversation>('GET', `/v1/convai/conversations/${encodeURIComponent(conversationId)}`)
  },

  delete(conversationId: string) {
    return elevenLabsRequest<void>('DELETE', `/v1/convai/conversations/${encodeURIComponent(conversationId)}`)
  },

  /** Upstream URL (needs the API key); only for server-side proxying. */
  async getAudioUrl(conversationId: string): Promise<string> {
    return `${ELEVENLABS_API_BASE}/v1/convai/conversations/${encodeURIComponent(conversationId)}/audio`
  },

  /** The caller streams the body. */
  getAudio(conversationId: string): Promise<Response> {
    return send('GET', `/v1/convai/conversations/${encodeURIComponent(conversationId)}/audio`, undefined, null, {
      timeoutMs: AUDIO_TIMEOUT_MS,
    })
  },
}

// ─── Phone Numbers ───────────────────────────────────────────────────────────
// Legacy native imports. The app router owns every Twilio number now, so the
// app never imports numbers again; list/get/delete remain for removing the
// imports that already exist.

// The agent assigned to a number is NOT a flat `agent_id` field in
// responses: it's nested under `assigned_agent`. (The CREATE/UPDATE request
// body does take a flat top-level `agent_id`.)
export interface ELPhoneNumber {
  phone_number_id: string
  phone_number: string
  label?: string
  assigned_agent?: {
    agent_id: string
    agent_name?: string
    environment?: string | null
    branch_id?: string | null
  } | null
  provider?: string
  [key: string]: unknown
}

// Flat, sibling fields (no provider_config wrapper): sid/token are the Twilio
// Account SID and Auth Token.
export interface ImportPhoneNumberParams {
  phone_number: string
  label: string
  provider: 'twilio'
  agent_id?: string | null
  sid: string
  token: string
}

export const phoneNumbers = {
  // Unlike the other list endpoints this one returns a bare array.
  list() {
    return elevenLabsRequest<ELPhoneNumber[]>('GET', '/v1/convai/phone-numbers')
  },

  get(phoneNumberId: string) {
    return elevenLabsRequest<ELPhoneNumber>('GET', `/v1/convai/phone-numbers/${encodeURIComponent(phoneNumberId)}`)
  },

  create(params: ImportPhoneNumberParams) {
    return elevenLabsRequest<ELPhoneNumber>('POST', '/v1/convai/phone-numbers', params)
  },

  update(phoneNumberId: string, params: { agent_id?: string; label?: string }) {
    return elevenLabsRequest<ELPhoneNumber>(
      'PATCH',
      `/v1/convai/phone-numbers/${encodeURIComponent(phoneNumberId)}`,
      params
    )
  },

  delete(phoneNumberId: string) {
    return elevenLabsRequest<void>('DELETE', `/v1/convai/phone-numbers/${encodeURIComponent(phoneNumberId)}`)
  },
}

// ─── Twilio Integration ──────────────────────────────────────────────────────

export interface TwilioOutboundCallParams {
  agent_id: string
  agent_phone_number_id: string
  to_number: string
  conversation_initiation_client_data?: Record<string, unknown>
}

/** OpenAPI TwilioOutboundCallResponse: the SID field is `callSid` (camelCase). */
export interface TwilioOutboundCallResult {
  success?: boolean
  message?: string
  conversation_id: string | null
  callSid: string | null
}

export interface RegisterCallParams {
  agent_id: string
  from_number: string
  to_number: string
  direction?: 'inbound' | 'outbound'
  conversation_initiation_client_data?: Record<string, unknown>
}

export const twilioIntegration = {
  outboundCall(params: TwilioOutboundCallParams) {
    return elevenLabsRequest<TwilioOutboundCallResult>('POST', '/v1/convai/twilio/outbound-call', params)
  },

  /** TwiML (text/html upstream) for a call Twilio is holding; keep the timeout short. */
  async registerCall(params: RegisterCallParams, opts?: { timeoutMs?: number; signal?: AbortSignal }): Promise<string> {
    const res = await send('POST', '/v1/convai/twilio/register-call', JSON.stringify(params), 'application/json', {
      timeoutMs: opts?.timeoutMs ?? 3_000,
      signal: opts?.signal,
    })
    return res.text()
  },
}

// ─── Knowledge Base ──────────────────────────────────────────────────────────

export interface ELDocument {
  id: string
  name: string
  type?: string
  source_type?: string
  url?: string
  status?: string
  created_at_unix?: number
  [key: string]: unknown
}

export const knowledgeBase = {
  list(params?: { page_size?: number; search?: string; cursor?: string; types?: string[] }) {
    return elevenLabsRequest<{ documents: ELDocument[]; next_cursor?: string }>(
      'GET',
      withPathQuery('/v1/convai/knowledge-base', params)
    )
  },

  get(docId: string) {
    return elevenLabsRequest<ELDocument>('GET', `/v1/convai/knowledge-base/${encodeURIComponent(docId)}`)
  },

  createFromUrl(params: { url: string; name?: string }) {
    return elevenLabsRequest<ELDocument>('POST', '/v1/convai/knowledge-base/url', params)
  },

  createFromText(params: { text: string; name?: string }) {
    return elevenLabsRequest<ELDocument>('POST', '/v1/convai/knowledge-base/text', params)
  },

  createFromFile(file: File, name?: string) {
    const formData = new FormData()
    formData.append('file', file, file.name)
    if (name) formData.append('name', name)
    return requestFormData<ELDocument>('/v1/convai/knowledge-base/file', formData)
  },

  update(docId: string, params: { name?: string; content?: string }) {
    return elevenLabsRequest<ELDocument>('PATCH', `/v1/convai/knowledge-base/${encodeURIComponent(docId)}`, params)
  },

  /** A document an agent still uses can only be deleted with `force`. */
  delete(docId: string, opts?: { force?: boolean }) {
    return elevenLabsRequest<void>(
      'DELETE',
      withPathQuery(`/v1/convai/knowledge-base/${encodeURIComponent(docId)}`, { force: opts?.force ? 'true' : undefined })
    )
  },

  /** Deletes even when agents still reference the document (detaches it from them). */
  forceDelete(docId: string) {
    return knowledgeBase.delete(docId, { force: true })
  },

  /** Legacy endpoint, absent from the current OpenAPI spec. */
  addToAgent(agentId: string, docId: string) {
    return elevenLabsRequest<void>(
      'POST',
      `/v1/convai/agents/${encodeURIComponent(agentId)}/add-to-knowledge-base`,
      { documentation_id: docId }
    )
  },
}

// ─── Voices ──────────────────────────────────────────────────────────────────

export interface ELVoice {
  voice_id: string
  name: string
  category: string
  description?: string | null
  preview_url?: string | null
  labels?: Record<string, string>
  [key: string]: unknown
}

export const voices = {
  getAll(showLegacy?: boolean) {
    return elevenLabsRequest<{ voices: ELVoice[] }>('GET', withPathQuery('/v1/voices', { show_legacy: showLegacy ? 'true' : undefined }))
  },

  search(params?: {
    page_size?: number
    search?: string
    category?: string
    voice_type?: string
    sort?: string
    sort_direction?: string
    next_page_token?: string
  }) {
    return elevenLabsRequest<{ voices: ELVoice[]; has_more?: boolean; next_page_token?: string }>(
      'GET',
      withPathQuery('/v2/voices', params)
    )
  },

  get(voiceId: string) {
    return elevenLabsRequest<ELVoice>('GET', `/v1/voices/${encodeURIComponent(voiceId)}`)
  },
}

// ─── Shared voice library (community voices) ─────────────────────────────────

export interface ELSharedVoice {
  voice_id: string
  public_owner_id: string
  name: string
  category?: string
  description?: string | null
  preview_url?: string | null
  language?: string
  accent?: string
  gender?: string
  age?: string
  use_case?: string
  [key: string]: unknown
}

export const sharedVoices = {
  list(params?: {
    page_size?: number
    search?: string
    language?: string
    gender?: string
    category?: string
    page?: number
  }) {
    return elevenLabsRequest<{ voices: ELSharedVoice[]; has_more?: boolean }>(
      'GET',
      withPathQuery('/v1/shared-voices', { ...params, page_size: Math.min(params?.page_size ?? 100, 100) })
    )
  },

  /** Add a shared/library voice to the workspace; returns the usable voice_id. */
  add(publicOwnerId: string, voiceId: string, newName: string) {
    return elevenLabsRequest<{ voice_id: string }>(
      'POST',
      `/v1/voices/add/${encodeURIComponent(publicOwnerId)}/${encodeURIComponent(voiceId)}`,
      { new_name: newName }
    )
  },
}

// ─── Text-to-Speech ──────────────────────────────────────────────────────────

// eleven_turbo_v2_5 is deprecated; eleven_flash_v2_5 covers the same languages
// with lower latency and is what the standby agent and the gateway's component
// fallback use. Declared once here; create-agent.ts re-exports it.
export const TTS_MODEL = 'eleven_flash_v2_5'

export async function textToSpeech(
  voiceId: string,
  text: string,
  modelId = TTS_MODEL,
  opts?: { outputFormat?: 'mp3_44100_128' | 'ulaw_8000'; timeoutMs?: number; signal?: AbortSignal }
): Promise<ArrayBuffer> {
  const res = await send(
    'POST',
    withPathQuery(`/v1/text-to-speech/${encodeURIComponent(voiceId)}`, { output_format: opts?.outputFormat }),
    JSON.stringify({
      text,
      model_id: modelId,
      voice_settings: { stability: 0.5, similarity_boost: 0.75 },
    }),
    'application/json',
    { headers: { Accept: 'audio/mpeg' }, timeoutMs: opts?.timeoutMs ?? DEFAULT_TIMEOUT_MS, signal: opts?.signal }
  )
  return res.arrayBuffer()
}

// ─── Webhooks (workspace) ────────────────────────────────────────────────────

export interface ELWebhook {
  webhook_id: string
  name?: string
  url?: string
  is_disabled?: boolean
  [key: string]: unknown
}

export const webhooks = {
  list() {
    return elevenLabsRequest<{ webhooks: ELWebhook[] }>('GET', '/v1/workspace/webhooks')
  },

  create(params: { settings: { url: string; name?: string; auth_type?: string } }) {
    return elevenLabsRequest<ELWebhook>('POST', '/v1/workspace/webhooks', params)
  },

  update(webhookId: string, params: { is_disabled: boolean; name: string }) {
    return elevenLabsRequest<ELWebhook>('PATCH', `/v1/workspace/webhooks/${encodeURIComponent(webhookId)}`, params)
  },

  delete(webhookId: string) {
    return elevenLabsRequest<void>('DELETE', `/v1/workspace/webhooks/${encodeURIComponent(webhookId)}`)
  },
}
