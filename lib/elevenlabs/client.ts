// ─── ElevenLabs Conversational AI Client ─────────────────────────────────────
// Comprehensive wrapper for all ElevenLabs API endpoints used by the platform.

import crypto from 'crypto'

const BASE = 'https://api.elevenlabs.io'

function headers(extra?: Record<string, string>): Record<string, string> {
  return {
    'xi-api-key': process.env.ELEVENLABS_API_KEY!,
    'Content-Type': 'application/json',
    ...extra,
  }
}

async function request<T>(
  method: string,
  path: string,
  body?: unknown,
  opts?: { rawResponse?: boolean; headers?: Record<string, string> }
): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers: headers(opts?.headers),
    ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
  })

  if (!res.ok) {
    const text = await res.text()
    throw new ElevenLabsError(res.status, text, path)
  }

  if (opts?.rawResponse) return res as unknown as T

  const contentType = res.headers.get('content-type') ?? ''
  if (contentType.includes('application/json')) {
    return res.json() as Promise<T>
  }
  return res.text() as unknown as T
}

async function requestFormData<T>(path: string, formData: FormData): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    method: 'POST',
    headers: { 'xi-api-key': process.env.ELEVENLABS_API_KEY! },
    body: formData,
  })

  if (!res.ok) {
    const text = await res.text()
    throw new ElevenLabsError(res.status, text, path)
  }

  return res.json() as Promise<T>
}

export class ElevenLabsError extends Error {
  constructor(
    public status: number,
    public body: string,
    public path: string
  ) {
    super(`ElevenLabs API error ${status} on ${path}: ${body}`)
    this.name = 'ElevenLabsError'
  }
}

export function isConfigured(): boolean {
  const key = process.env.ELEVENLABS_API_KEY
  return !!key && key !== 'your-elevenlabs-api-key'
}

/** True when an ElevenLabs webhook signing secret is configured. */
export function isWebhookConfigured(): boolean {
  const secret = process.env.ELEVENLABS_WEBHOOK_SECRET
  return !!secret && secret !== 'your-elevenlabs-webhook-secret'
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
  const secret = process.env.ELEVENLABS_WEBHOOK_SECRET
  if (!secret || !signatureHeader) return false

  const parts = signatureHeader.split(',')
  const t = parts.find((p) => p.startsWith('t='))?.slice(2)
  const v0 = parts.find((p) => p.startsWith('v0='))?.slice(3)
  if (!t || !v0) return false

  const timestamp = Number(t)
  if (!Number.isFinite(timestamp)) return false
  if (Math.abs(Date.now() / 1000 - timestamp) > toleranceSeconds) return false

  const expected = crypto
    .createHmac('sha256', secret)
    .update(`${t}.${rawBody}`)
    .digest('hex')

  const a = Buffer.from(expected)
  const b = Buffer.from(v0)
  return a.length === b.length && crypto.timingSafeEqual(a, b)
}

// ─── Agents ──────────────────────────────────────────────────────────────────

export interface ELAgent {
  agent_id: string
  name: string
  conversation_config: {
    agent?: {
      prompt?: { prompt?: string }
      first_message?: string
      language?: string
    }
    tts?: { voice_id?: string }
  }
  platform_settings?: Record<string, unknown>
  metadata?: Record<string, unknown>
  [key: string]: unknown
}

export interface CreateAgentParams {
  name: string
  conversation_config: {
    agent: {
      prompt?: { prompt: string }
      first_message?: string
      language?: string
    }
    tts?: { voice_id?: string; model_id?: string }
  }
  platform_settings?: Record<string, unknown>
}

export interface UpdateAgentParams {
  conversation_config?: {
    agent?: {
      prompt?: { prompt: string }
      first_message?: string
      language?: string
    }
    tts?: { voice_id?: string; model_id?: string }
  }
  name?: string
  platform_settings?: Record<string, unknown>
}

export const agents = {
  create(params: CreateAgentParams) {
    return request<ELAgent>('POST', '/v1/convai/agents/create', params)
  },

  get(agentId: string) {
    return request<ELAgent>('GET', `/v1/convai/agents/${agentId}`)
  },

  list(params?: { page_size?: number; search?: string; cursor?: string }) {
    const qs = new URLSearchParams()
    if (params?.page_size) qs.set('page_size', String(params.page_size))
    if (params?.search) qs.set('search', params.search)
    if (params?.cursor) qs.set('cursor', params.cursor)
    const q = qs.toString()
    return request<{ agents: ELAgent[]; next_cursor?: string }>(
      'GET',
      `/v1/convai/agents${q ? `?${q}` : ''}`
    )
  },

  update(agentId: string, params: UpdateAgentParams) {
    return request<ELAgent>('PATCH', `/v1/convai/agents/${agentId}`, params)
  },

  delete(agentId: string) {
    return request<void>('DELETE', `/v1/convai/agents/${agentId}`)
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
    start_time_unix?: number
    end_time_unix?: number
    call_duration_secs?: number
    cost?: number
    from_number?: string
    to_number?: string
    direction?: string
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
  start_time_unix?: number
  end_time_unix?: number
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
    const qs = new URLSearchParams()
    if (params?.agent_id) qs.set('agent_id', params.agent_id)
    if (params?.page_size) qs.set('page_size', String(params.page_size))
    if (params?.cursor) qs.set('cursor', params.cursor)
    if (params?.call_successful) qs.set('call_successful', params.call_successful)
    if (params?.call_start_after_unix) qs.set('call_start_after_unix', String(params.call_start_after_unix))
    if (params?.call_start_before_unix) qs.set('call_start_before_unix', String(params.call_start_before_unix))
    if (params?.call_duration_min_secs) qs.set('call_duration_min_secs', String(params.call_duration_min_secs))
    if (params?.call_duration_max_secs) qs.set('call_duration_max_secs', String(params.call_duration_max_secs))
    if (params?.search) qs.set('search', params.search)
    if (params?.exclude_statuses) {
      for (const s of params.exclude_statuses) qs.append('exclude_statuses', s)
    }
    const q = qs.toString()
    return request<ListConversationsResponse>(
      'GET',
      `/v1/convai/conversations${q ? `?${q}` : ''}`
    )
  },

  get(conversationId: string) {
    return request<ELConversation>('GET', `/v1/convai/conversations/${conversationId}`)
  },

  delete(conversationId: string) {
    return request<void>('DELETE', `/v1/convai/conversations/${conversationId}`)
  },

  async getAudioUrl(conversationId: string): Promise<string> {
    // Returns a URL that streams the audio — we proxy this
    return `${BASE}/v1/convai/conversations/${conversationId}/audio`
  },

  async getAudio(conversationId: string): Promise<Response> {
    const res = await fetch(
      `${BASE}/v1/convai/conversations/${conversationId}/audio`,
      { headers: { 'xi-api-key': process.env.ELEVENLABS_API_KEY! } }
    )
    if (!res.ok) {
      throw new ElevenLabsError(res.status, await res.text(), 'conversations/audio')
    }
    return res
  },
}

// ─── Phone Numbers ───────────────────────────────────────────────────────────

export interface ELPhoneNumber {
  phone_number_id: string
  phone_number: string
  label?: string
  agent_id?: string
  provider?: string
  [key: string]: unknown
}

export interface ImportPhoneNumberParams {
  phone_number: string
  label?: string
  agent_id?: string
  provider_config: {
    twilio: {
      account_sid: string
      auth_token: string
      phone_number_sid: string
    }
  }
}

export const phoneNumbers = {
  // Unlike every other list endpoint in this file (agents, conversations,
  // voices, knowledge-base, webhooks all wrap their array in an object), this
  // one returns a bare array at the top level - confirmed against ElevenLabs'
  // actual API reference. Do not "fix" this to match the others.
  list() {
    return request<ELPhoneNumber[]>('GET', '/v1/convai/phone-numbers')
  },

  get(phoneNumberId: string) {
    return request<ELPhoneNumber>(
      'GET',
      `/v1/convai/phone-numbers/${phoneNumberId}`
    )
  },

  create(params: ImportPhoneNumberParams) {
    return request<ELPhoneNumber>('POST', '/v1/convai/phone-numbers', params)
  },

  update(phoneNumberId: string, params: { agent_id?: string; label?: string }) {
    return request<ELPhoneNumber>(
      'PATCH',
      `/v1/convai/phone-numbers/${phoneNumberId}`,
      params
    )
  },

  delete(phoneNumberId: string) {
    return request<void>('DELETE', `/v1/convai/phone-numbers/${phoneNumberId}`)
  },
}

// ─── Twilio Integration ──────────────────────────────────────────────────────

export interface TwilioOutboundCallParams {
  agent_id: string
  agent_phone_number_id: string
  to_number: string
  conversation_initiation_client_data?: Record<string, unknown>
}

export const twilioIntegration = {
  outboundCall(params: TwilioOutboundCallParams) {
    return request<{ conversation_id: string; call_sid?: string }>(
      'POST',
      '/v1/convai/twilio/outbound-call',
      params
    )
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
    const qs = new URLSearchParams()
    if (params?.page_size) qs.set('page_size', String(params.page_size))
    if (params?.search) qs.set('search', params.search)
    if (params?.cursor) qs.set('cursor', params.cursor)
    if (params?.types) {
      for (const t of params.types) qs.append('types', t)
    }
    const q = qs.toString()
    return request<{ documents: ELDocument[]; next_cursor?: string }>(
      'GET',
      `/v1/convai/knowledge-base${q ? `?${q}` : ''}`
    )
  },

  get(docId: string) {
    return request<ELDocument>('GET', `/v1/convai/knowledge-base/${docId}`)
  },

  createFromUrl(params: { url: string; name?: string }) {
    return request<ELDocument>('POST', '/v1/convai/knowledge-base/url', params)
  },

  createFromText(params: { text: string; name?: string }) {
    return request<ELDocument>('POST', '/v1/convai/knowledge-base/text', params)
  },

  createFromFile(file: File, name?: string) {
    const formData = new FormData()
    formData.append('file', file, file.name)
    if (name) formData.append('name', name)
    return requestFormData<ELDocument>('/v1/convai/knowledge-base/file', formData)
  },

  update(docId: string, params: { name?: string; content?: string }) {
    return request<ELDocument>(
      'PATCH',
      `/v1/convai/knowledge-base/${docId}`,
      params
    )
  },

  delete(docId: string) {
    return request<void>('DELETE', `/v1/convai/knowledge-base/${docId}`)
  },

  // Add a document to an agent's knowledge base (legacy endpoint, still works)
  addToAgent(agentId: string, docId: string) {
    return request<void>(
      'POST',
      `/v1/convai/agents/${agentId}/add-to-knowledge-base`,
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
    const qs = showLegacy ? '?show_legacy=true' : ''
    return request<{ voices: ELVoice[] }>('GET', `/v1/voices${qs}`)
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
    const qs = new URLSearchParams()
    if (params?.page_size) qs.set('page_size', String(params.page_size))
    if (params?.search) qs.set('search', params.search)
    if (params?.category) qs.set('category', params.category)
    if (params?.voice_type) qs.set('voice_type', params.voice_type)
    if (params?.sort) qs.set('sort', params.sort)
    if (params?.sort_direction) qs.set('sort_direction', params.sort_direction)
    if (params?.next_page_token) qs.set('next_page_token', params.next_page_token)
    const q = qs.toString()
    return request<{ voices: ELVoice[]; has_more?: boolean; next_page_token?: string }>(
      'GET',
      `/v2/voices${q ? `?${q}` : ''}`
    )
  },

  get(voiceId: string) {
    return request<ELVoice>('GET', `/v1/voices/${voiceId}`)
  },
}

// ─── Shared voice library (community voices — thousands) ──────────────────────

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
    const qs = new URLSearchParams()
    qs.set('page_size', String(Math.min(params?.page_size ?? 100, 100)))
    if (params?.search) qs.set('search', params.search)
    if (params?.language) qs.set('language', params.language)
    if (params?.gender) qs.set('gender', params.gender)
    if (params?.category) qs.set('category', params.category)
    if (params?.page) qs.set('page', String(params.page))
    return request<{ voices: ELSharedVoice[]; has_more?: boolean }>(
      'GET',
      `/v1/shared-voices?${qs.toString()}`
    )
  },

  /** Add a shared/library voice to the workspace; returns the usable voice_id. */
  add(publicOwnerId: string, voiceId: string, newName: string) {
    return request<{ voice_id: string }>(
      'POST',
      `/v1/voices/add/${publicOwnerId}/${voiceId}`,
      { new_name: newName }
    )
  },
}

// ─── Text-to-Speech ──────────────────────────────────────────────────────────

export async function textToSpeech(
  voiceId: string,
  text: string,
  modelId = 'eleven_turbo_v2'
): Promise<ArrayBuffer> {
  const res = await fetch(`${BASE}/v1/text-to-speech/${voiceId}`, {
    method: 'POST',
    headers: {
      'xi-api-key': process.env.ELEVENLABS_API_KEY!,
      'Content-Type': 'application/json',
      Accept: 'audio/mpeg',
    },
    body: JSON.stringify({
      text,
      model_id: modelId,
      voice_settings: { stability: 0.5, similarity_boost: 0.75 },
    }),
  })

  if (!res.ok) {
    throw new ElevenLabsError(res.status, await res.text(), 'text-to-speech')
  }

  return res.arrayBuffer()
}

// ─── Webhooks ────────────────────────────────────────────────────────────────

export interface ELWebhook {
  webhook_id: string
  name?: string
  url?: string
  is_disabled?: boolean
  [key: string]: unknown
}

export const webhooks = {
  list() {
    return request<{ webhooks: ELWebhook[] }>('GET', '/v1/webhooks')
  },

  create(params: { settings: { url: string; secret?: string } }) {
    return request<ELWebhook>('POST', '/v1/webhooks', params)
  },

  update(webhookId: string, params: { is_disabled: boolean; name: string }) {
    return request<ELWebhook>('PATCH', `/v1/webhooks/${webhookId}`, params)
  },

  delete(webhookId: string) {
    return request<void>('DELETE', `/v1/webhooks/${webhookId}`)
  },
}
