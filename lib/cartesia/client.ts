import 'server-only'
// ─── Cartesia API client (Managed Agents + voices + TTS preview) ─────────────
// Verified against docs.cartesia.ai (2026-10, Cartesia-Version 2026-08-14):
// - /v1/agents* (managed agents, models, tools) accept ONLY 2026-08-14.
// - /agents/* (calls, phone numbers, providers, webhooks, legacy agent PATCH)
//   accept 2026-08-14 and 2026-03-01; we pin 2026-08-14 everywhere.
// Every call goes through providerRequest() (timeouts, retries, breaker).

import { providerRequest, NO_RETRY } from '@/lib/voice-providers/http'
import { ProviderError } from '@/lib/voice-providers/errors'

export const CARTESIA_API_VERSION_DEFAULT = '2026-08-14'

export function isConfigured(): boolean {
  const k = (process.env.CARTESIA_API_KEY ?? '').trim()
  return k.length > 0 && k !== 'your-cartesia-api-key'
}

function apiVersion(): string {
  const v = (process.env.CARTESIA_API_VERSION ?? '').trim()
  return /^\d{4}-\d{2}-\d{2}$/.test(v) ? v : CARTESIA_API_VERSION_DEFAULT
}

function baseUrl(): string {
  return (process.env.CARTESIA_API_BASE_URL ?? 'https://api.cartesia.ai').trim().replace(/\/+$/, '') || 'https://api.cartesia.ai'
}

function key(operation: string): string {
  if (!isConfigured()) throw new ProviderError({ system: 'cartesia', operation, code: 'not_configured' })
  return (process.env.CARTESIA_API_KEY ?? '').trim()
}

type Ctx = { orgId?: string | null; agentId?: string | null; callId?: string | null }

function req<T>(
  operation: string,
  path: string,
  opts: {
    method?: 'GET' | 'POST' | 'PATCH' | 'DELETE'
    body?: unknown
    timeoutMs?: number
    idempotent?: boolean
    responseKind?: 'json' | 'text' | 'arrayBuffer' | 'response' | 'none'
    query?: Record<string, string | number | boolean | string[] | null | undefined>
    ctx?: Ctx
    retry?: typeof NO_RETRY
  } = {},
) {
  const qs = new URLSearchParams()
  for (const [k, v] of Object.entries(opts.query ?? {})) {
    if (v === undefined || v === null || v === '') continue
    if (Array.isArray(v)) v.forEach((x) => qs.append(k, x))
    else qs.set(k, String(v))
  }
  const q = qs.toString()
  return providerRequest<T>({
    system: 'cartesia',
    operation,
    url: `${baseUrl()}${path}${q ? `?${q}` : ''}`,
    method: opts.method ?? 'GET',
    headers: { 'X-API-Key': key(operation), 'Cartesia-Version': apiVersion() },
    body: opts.body,
    timeoutMs: opts.timeoutMs ?? (opts.method && opts.method !== 'GET' ? 15_000 : 8_000),
    idempotent: opts.idempotent,
    responseKind: opts.responseKind,
    context: opts.ctx,
    retry: opts.retry,
  }).then((r) => r.data)
}

// ─── Managed agents ──────────────────────────────────────────────────────────

export interface CartesiaAgentConfig {
  instructions: string
  initial_message: string | null
  timezone: string
  model: { id: string; temperature: number | null; max_output_tokens: number | null }
  language: { primary: string }
  audio: {
    input: { noise_suppression: 'off' | 'auto' | 'max'; keyterms: string[] }
    output: { voice_id: string; speed: number | null; volume: number | null; emotion: string | null }
  }
  turn: { inactivity_end_call_secs: number; inactivity_check_in_secs: number | null }
  tools: Array<{ id: string }>
  system_tools: {
    end_call: { description: string | null; pre_tool_speech: 'auto' | 'force' } | null
    send_dtmf: null
    transfer_to_number:
      | { description: string | null; pre_tool_speech: 'auto' | 'force'; transfers: Array<{ destination: { type: 'phone'; phone_number: string }; condition: string }> }
      | null
  }
  dynamic_variable_placeholders: Record<string, string>
}

export interface CartesiaAgent {
  id: string
  name: string
  description: string | null
  config: Partial<CartesiaAgentConfig> & Record<string, unknown>
  version?: { id: string } | null
  version_id?: string | null
  updated_at?: string
}

export const agents = {
  create(body: { name: string; description: string | null; config: CartesiaAgentConfig }, ctx?: Ctx) {
    return req<CartesiaAgent>('agents.create', '/v1/agents', { method: 'POST', body, retry: NO_RETRY, ctx })
  },
  get(id: string, ctx?: Ctx) {
    return req<CartesiaAgent>('agents.get', `/v1/agents/${encodeURIComponent(id)}`, { ctx })
  },
  /** Full config each time: tools/transfers lists are replaced by PATCH. */
  update(id: string, body: { name?: string; description?: string | null; config?: CartesiaAgentConfig; version_description?: string }, ctx?: Ctx) {
    return req<CartesiaAgent>('agents.update', `/v1/agents/${encodeURIComponent(id)}`, { method: 'PATCH', body, idempotent: true, ctx })
  },
  delete(id: string, ctx?: Ctx) {
    return req<void>('agents.delete', `/v1/agents/${encodeURIComponent(id)}`, { method: 'DELETE', responseKind: 'none', ctx })
  },
  list(params: { q?: string; starting_after?: string | null; limit?: number }) {
    return req<{ data: Array<{ id: string; name: string; description: string | null; updated_at?: string }>; has_more: boolean; next_page?: string | null }>(
      'agents.list',
      '/v1/agents',
      { query: { q: params.q, starting_after: params.starting_after ?? undefined, limit: params.limit ?? 100 } },
    )
  },
  /** Legacy endpoint, the documented way to attach a call-event webhook. */
  attachWebhook(id: string, webhookId: string | null, ctx?: Ctx) {
    return req<unknown>('agents.attach_webhook', `/agents/${encodeURIComponent(id)}`, { method: 'PATCH', body: { webhook_id: webhookId }, idempotent: true, ctx })
  },
  models() {
    return req<{ data: Array<{ id: string; display_name?: string }>; has_more: boolean }>('agents.models', '/v1/agents/models', { query: { limit: 100 } })
  },
}

export const tools = {
  create(body: Record<string, unknown>) {
    return req<{ id: string }>('tools.create', '/v1/agents/tools', { method: 'POST', body, retry: NO_RETRY })
  },
  update(id: string, body: Record<string, unknown>) {
    return req<{ id: string }>('tools.update', `/v1/agents/tools/${encodeURIComponent(id)}`, { method: 'PATCH', body, idempotent: true })
  },
}

// ─── Telephony: SIP provider + numbers ───────────────────────────────────────

export interface CartesiaPhoneNumber {
  id: string
  number: string
  label?: string | null
  agent?: { id: string; name?: string } | null
}

export const telephony = {
  listProviders() {
    return req<Array<{ id: string; type: string; label?: string | null }>>('providers.list', '/agents/phone-numbers/providers')
  },
  createSipProvider(body: { label: string; inbound: { credentials?: { username: string; password: string }; allowed_addresses?: string[]; allowed_numbers?: string[]; media_encryption?: 'disabled' | 'allowed' | 'required' } }) {
    return req<{ id: string }>('providers.create_sip', '/agents/phone-numbers/providers', { method: 'POST', body: { type: 'sip_trunk', ...body }, retry: NO_RETRY })
  },
  importNumber(body: { label: string; number: string; provider: { id: string }; agent_id?: string | null }) {
    return req<CartesiaPhoneNumber>('numbers.import', '/agents/phone-numbers', { method: 'POST', body, retry: NO_RETRY })
  },
  updateNumber(id: string, body: { agent_id?: string | null; label?: string }) {
    return req<CartesiaPhoneNumber>('numbers.update', `/agents/phone-numbers/${encodeURIComponent(id)}`, { method: 'PATCH', body, idempotent: true })
  },
  getNumber(id: string) {
    return req<CartesiaPhoneNumber>('numbers.get', `/agents/phone-numbers/${encodeURIComponent(id)}`)
  },
  deleteNumber(id: string) {
    return req<void>('numbers.delete', `/agents/phone-numbers/${encodeURIComponent(id)}`, { method: 'DELETE', responseKind: 'none' })
  },
}

// ─── Calls ───────────────────────────────────────────────────────────────────

export interface CartesiaTranscriptTurn {
  role: 'user' | 'assistant' | 'system'
  text: string | null
  start_timestamp?: number | null
  end_timestamp?: number | null
}

export interface CartesiaCall {
  id: string
  agent_id: string
  status: 'created' | 'started' | 'completed' | 'failed'
  start_time: string | null
  end_time: string | null
  end_reason?: string | null
  error_message?: string | null
  summary?: string | null
  transcript?: CartesiaTranscriptTurn[] | null
  telephony_params?: { to?: string; from?: string; call_sid?: string; direction?: string; headers?: Record<string, string>; connection_type?: string } | null
  telephony_account_type?: string | null
  dynamic_variables?: Record<string, unknown> | null
}

export const calls = {
  get(id: string, ctx?: Ctx) {
    return req<CartesiaCall>('calls.get', `/agents/calls/${encodeURIComponent(id)}`, { ctx })
  },
  list(params: { agent_id: string; start_time_gte?: string; start_time_lte?: string; limit?: number; starting_after?: string | null }) {
    return req<{ data: CartesiaCall[]; has_more: boolean; next_page?: string | null }>('calls.list', '/agents/calls', {
      query: {
        agent_id: params.agent_id,
        start_time_gte: params.start_time_gte,
        start_time_lte: params.start_time_lte,
        expand: 'transcript',
        limit: params.limit ?? 20,
        starting_after: params.starting_after ?? undefined,
      },
    })
  },
  /** Whole-call recording as audio/wav; proxied after an ownership check. */
  audio(id: string, ctx?: Ctx) {
    return req<Response>('calls.audio', `/agents/calls/${encodeURIComponent(id)}/audio`, { responseKind: 'response', timeoutMs: 60_000, ctx })
  },
  /** Redacts a finished call at the provider (transcript + audio). Idempotent. */
  delete(id: string, ctx?: Ctx) {
    return req<unknown>('calls.delete', `/agents/calls/${encodeURIComponent(id)}`, { method: 'DELETE', idempotent: true, ctx })
  },
  outbound(body: { agent_id: string; from_number_id: string; outbound_calls: Array<{ to_number: string; dynamic_variables?: Record<string, string | number | boolean> }>; ringing_timeout_seconds?: number; max_call_duration_minutes?: number }, ctx?: Ctx) {
    return req<{ calls: Array<{ number: string; agent_call_id?: string; error?: Record<string, unknown> }> }>('calls.outbound', '/agents/calls', {
      method: 'POST',
      body,
      retry: NO_RETRY,
      ctx,
    })
  },
}

// ─── Webhooks (platform-level, one per deployment) ───────────────────────────

export const webhooks = {
  create(body: { url: string; secret: string; display_name?: string }) {
    return req<{ id: string }>('webhooks.create', '/agents/webhooks', { method: 'POST', body, retry: NO_RETRY })
  },
  list() {
    return req<{ data: Array<{ id: string; url: string; display_name?: string | null }>; has_more: boolean }>('webhooks.list', '/agents/webhooks')
  },
}

// ─── Voices ──────────────────────────────────────────────────────────────────

export interface CartesiaVoice {
  id: string
  name: string
  description?: string | null
  tagline?: string | null
  language?: string | null
  /** 2026-08-14: masculine | feminine | gender_neutral | null */
  gender?: string | null
  is_owner?: boolean
  status?: string
  access?: string | { type?: string }
  accents?: Array<{ accent?: string; locale?: string; is_native?: boolean }>
  /** Only with expand[]=preview_file_url; needs the API key to download, so it is proxied. */
  preview_file_url?: string | null
}

export const voices = {
  list(params: { language?: string; gender?: 'masculine' | 'feminine' | 'gender_neutral'; q?: string; limit?: number; starting_after?: string | null; is_owner?: boolean }) {
    return req<{ data: CartesiaVoice[]; has_more: boolean; next_page?: string | null }>('voices.list', '/voices', {
      query: {
        language: params.language,
        gender: params.gender,
        q: params.q,
        is_owner: params.is_owner,
        limit: Math.min(params.limit ?? 50, 100),
        starting_after: params.starting_after ?? undefined,
        'expand[]': ['preview_file_url'],
      },
    })
  },
  get(id: string) {
    return req<CartesiaVoice>('voices.get', `/voices/${encodeURIComponent(id)}`, { query: { 'expand[]': ['preview_file_url'] } })
  },
  /** Downloads a preview file (auth required); only Cartesia file URLs are accepted. */
  async previewAudio(fileUrl: string): Promise<Response> {
    const u = new URL(fileUrl)
    if (u.protocol !== 'https:' || !/(^|\.)cartesia\.ai$/i.test(u.hostname)) {
      throw new ProviderError({ system: 'cartesia', operation: 'voices.preview', code: 'validation', detail: 'unexpected preview host' })
    }
    return providerRequest<Response>({
      system: 'cartesia',
      operation: 'voices.preview',
      url: u.toString(),
      headers: { 'X-API-Key': key('voices.preview'), 'Cartesia-Version': apiVersion() },
      timeoutMs: 15_000,
      responseKind: 'response',
    }).then((r) => r.data)
  },
}

// ─── Health ──────────────────────────────────────────────────────────────────

export function ping() {
  return req<{ data: unknown[] }>('agents.list_probe', '/v1/agents', { query: { limit: 1 }, timeoutMs: 5_000 })
}
