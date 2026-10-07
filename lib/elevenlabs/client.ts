import 'server-only'
// ─── ElevenLabs API client ────────────────────────────────────────────────────
// Thin, typed wrapper over the endpoints the platform uses, verified against
// the official OpenAPI spec (api.elevenlabs.io/openapi.json, 2026-10). Every
// call goes through providerRequest(): explicit timeout, retry only when safe,
// circuit breaker, telemetry, and errors that never carry upstream bodies.
//
// Removed vs the previous client:
// - POST /v1/convai/agents/{id}/add-to-knowledge-base: no longer in the API.
//   Documents are attached by sending the full prompt.knowledge_base array.
// - TTS model eleven_turbo_v2_5: deprecated, replaced by eleven_flash_v2_5.

import { providerRequest, NO_RETRY } from '@/lib/voice-providers/http'
import { ProviderError } from '@/lib/voice-providers/errors'
import { readTextPrefix } from './api/body'
import type { TelephonyCallConfig, TwilioOutboundCallResponse } from './api/telephony'

const PLACEHOLDER_KEYS = new Set(['', 'your-elevenlabs-api-key'])

export function isConfigured(): boolean {
  return !PLACEHOLDER_KEYS.has((process.env.ELEVENLABS_API_KEY ?? '').trim())
}

function baseUrl(): string {
  const raw = (process.env.ELEVENLABS_API_BASE_URL ?? 'https://api.elevenlabs.io').trim().replace(/\/+$/, '')
  return raw || 'https://api.elevenlabs.io'
}

function key(operation: string): string {
  const k = (process.env.ELEVENLABS_API_KEY ?? '').trim()
  if (PLACEHOLDER_KEYS.has(k)) {
    throw new ProviderError({ system: 'elevenlabs', operation, code: 'not_configured' })
  }
  return k
}

export type Ctx = { orgId?: string | null; agentId?: string | null; callId?: string | null }

// Timeouts per class of call. Register-call is on the live call path: Twilio
// waits at most 15 s for our TwiML and we still need time for a fallback.
export const T = {
  read: 8_000,
  write: 15_000,
  upload: 60_000,
  tts: 20_000,
  registerCall: 4_500,
  outbound: 10_000,
} as const

// async: a missing key must reject the returned promise, never throw synchronously.
// Exported (as `req`) for the per-area modules in lib/elevenlabs/api/*.
export async function req<T>(
  operation: string,
  path: string,
  opts: {
    method?: 'GET' | 'POST' | 'PATCH' | 'PUT' | 'DELETE'
    body?: unknown
    timeoutMs?: number
    idempotent?: boolean
    responseKind?: 'json' | 'text' | 'arrayBuffer' | 'response' | 'none'
    query?: Record<string, string | number | boolean | string[] | null | undefined>
    ctx?: Ctx
    accept?: string
    retry?: typeof NO_RETRY
    /** Feed the routing circuit breaker (live-call requests only). */
    breaker?: boolean
  } = {},
) {
  const qs = new URLSearchParams()
  for (const [k, v] of Object.entries(opts.query ?? {})) {
    if (v === undefined || v === null || v === '') continue
    if (Array.isArray(v)) v.forEach((x) => qs.append(k, x))
    else qs.set(k, String(v))
  }
  const q = qs.toString()
  return await providerRequest<T>({
    system: 'elevenlabs',
    operation,
    url: `${baseUrl()}${path}${q ? `?${q}` : ''}`,
    method: opts.method ?? 'GET',
    headers: { 'xi-api-key': key(operation), ...(opts.accept ? { Accept: opts.accept } : {}) },
    body: opts.body,
    timeoutMs: opts.timeoutMs ?? (opts.method && opts.method !== 'GET' ? T.write : T.read),
    idempotent: opts.idempotent,
    responseKind: opts.responseKind,
    context: opts.ctx,
    retry: opts.retry,
    breaker: opts.breaker ?? false,
  }).then((r) => r.data)
}

// ─── Agents ──────────────────────────────────────────────────────────────────

export interface ELAgent {
  agent_id: string
  name: string
  tags?: string[] | null
  version_id?: string | null
  branch_id?: string | null
  conversation_config: Record<string, unknown> & {
    agent?: {
      first_message?: string
      language?: string
      prompt?: { prompt?: string; llm?: string; knowledge_base?: Array<{ type: string; name: string; id: string; usage_mode?: string }>; tool_ids?: string[] }
    }
    tts?: { voice_id?: string; model_id?: string; agent_output_audio_format?: string }
    asr?: { user_input_audio_format?: string }
  }
  platform_settings?: Record<string, unknown>
  metadata?: { created_at_unix_secs?: number; updated_at_unix_secs?: number }
}

export interface AgentBody {
  name: string
  tags: string[]
  conversation_config: Record<string, unknown>
  platform_settings: Record<string, unknown>
  version_description?: string
}

export interface ELAgentSummary {
  agent_id: string
  name: string
  voice_id?: string | null
  tags?: string[]
  created_at_unix_secs?: number
  archived?: boolean
}

export const agents = {
  /** Not idempotent at the provider: never retried automatically. */
  create(body: Omit<AgentBody, 'version_description'>, ctx?: Ctx) {
    return req<{ agent_id: string }>('agents.create', '/v1/convai/agents/create', { method: 'POST', body, ctx, retry: NO_RETRY })
  },
  get(agentId: string, ctx?: Ctx) {
    return req<ELAgent>('agents.get', `/v1/convai/agents/${encodeURIComponent(agentId)}`, { ctx })
  },
  /** Full-config PATCH: re-sending the same config is idempotent, so it may be retried. */
  update(agentId: string, body: Partial<AgentBody>, ctx?: Ctx) {
    return req<ELAgent>('agents.update', `/v1/convai/agents/${encodeURIComponent(agentId)}`, { method: 'PATCH', body, idempotent: true, ctx })
  },
  delete(agentId: string, ctx?: Ctx) {
    return req<void>('agents.delete', `/v1/convai/agents/${encodeURIComponent(agentId)}`, { method: 'DELETE', responseKind: 'none', ctx })
  },
  list(params: { tags?: string[]; search?: string; cursor?: string | null; page_size?: number }) {
    return req<{ agents: ELAgentSummary[]; next_cursor?: string | null; has_more?: boolean }>('agents.list', '/v1/convai/agents', {
      query: { tags: params.tags, search: params.search, cursor: params.cursor ?? undefined, page_size: params.page_size ?? 100 },
    })
  },
}

// ─── Platform tools (webhook tool used for app-routed human transfer) ────────

export const tools = {
  create(toolConfig: Record<string, unknown>) {
    return req<{ id: string }>('tools.create', '/v1/convai/tools', { method: 'POST', body: { tool_config: toolConfig }, retry: NO_RETRY })
  },
  get(toolId: string) {
    return req<{ id: string; tool_config: Record<string, unknown> }>('tools.get', `/v1/convai/tools/${encodeURIComponent(toolId)}`)
  },
  update(toolId: string, toolConfig: Record<string, unknown>) {
    return req<{ id: string }>('tools.update', `/v1/convai/tools/${encodeURIComponent(toolId)}`, {
      method: 'PATCH',
      body: { tool_config: toolConfig },
      idempotent: true,
    })
  },
}

export async function listLlms() {
  return req<{ llms: Array<{ llm: string; deprecation_info?: { is_deprecated?: boolean; replacement_model?: string | null; is_in_fallback_period?: boolean } | null }> }>(
    'llm.list',
    '/v1/convai/llm/list',
  )
}

// ─── Conversations ───────────────────────────────────────────────────────────

export interface ELTranscriptTurn {
  role: string
  message?: string | null
  time_in_call_secs?: number | null
}

export interface ELPhoneCallMeta {
  type?: string
  direction?: 'inbound' | 'outbound'
  phone_number_id?: string
  agent_number?: string
  external_number?: string
  call_sid?: string
}

export interface ELConversation {
  conversation_id: string
  agent_id: string
  status: string
  transcript?: ELTranscriptTurn[]
  metadata?: {
    start_time_unix_secs?: number
    call_duration_secs?: number
    cost?: number | null
    cost_fiat?: number | null
    termination_reason?: string | null
    phone_call?: ELPhoneCallMeta | null
    conversation_initiation_source?: string
  }
  analysis?: {
    call_successful?: 'success' | 'failure' | 'unknown'
    transcript_summary?: string
    call_summary_title?: string | null
    evaluation_criteria_results?: Record<string, { criteria_id?: string; result?: string; rationale?: string }>
    data_collection_results?: Record<string, { data_collection_id?: string; value?: unknown; rationale?: string }>
  } | null
  conversation_initiation_client_data?: { dynamic_variables?: Record<string, unknown> } | null
  has_audio?: boolean
}

export interface ELConversationSummary {
  conversation_id: string
  agent_id: string
  status: string
  start_time_unix_secs: number
  call_duration_secs: number
  call_successful?: 'success' | 'failure' | 'unknown'
  direction?: 'inbound' | 'outbound' | null
  transcript_summary?: string | null
  call_summary_title?: string | null
  termination_reason?: string | null
}

export const conversations = {
  list(params: { agent_id: string; cursor?: string | null; page_size?: number; call_start_after_unix?: number }) {
    return req<{ conversations: ELConversationSummary[]; next_cursor?: string | null; has_more?: boolean }>(
      'conversations.list',
      '/v1/convai/conversations',
      { query: { agent_id: params.agent_id, cursor: params.cursor ?? undefined, page_size: params.page_size ?? 100, call_start_after_unix: params.call_start_after_unix } },
    )
  },
  get(conversationId: string, ctx?: Ctx) {
    return req<ELConversation>('conversations.get', `/v1/convai/conversations/${encodeURIComponent(conversationId)}`, { ctx })
  },
  /** Streams audio/mpeg; the caller proxies it after an ownership check. */
  audio(conversationId: string, ctx?: Ctx) {
    return req<Response>('conversations.audio', `/v1/convai/conversations/${encodeURIComponent(conversationId)}/audio`, {
      responseKind: 'response',
      timeoutMs: T.upload,
      ctx,
    })
  },
  delete(conversationId: string, ctx?: Ctx) {
    return req<void>('conversations.delete', `/v1/convai/conversations/${encodeURIComponent(conversationId)}`, { method: 'DELETE', responseKind: 'none', ctx })
  },
}

// ─── Phone numbers (native Twilio import) ────────────────────────────────────

export interface ELPhoneNumber {
  phone_number_id: string
  phone_number: string
  label?: string
  provider?: string
  assigned_agent?: { agent_id: string; agent_name?: string } | null
}

// No workspace-wide listing here: the shared workspace holds every tenant's
// imports. Lookups go through lib/elevenlabs/api/phone-numbers.ts (v2, always
// narrowed to one number or this deployment's label, platform code only).
export const phoneNumbers = {
  get(id: string, ctx?: Ctx) {
    return req<ELPhoneNumber>('phone_numbers.get', `/v1/convai/phone-numbers/${encodeURIComponent(id)}`, { ctx })
  },
  /**
   * Imports a Twilio number. ElevenLabs then points the number's voice webhook
   * at its own endpoint (native mode). enable_sms=false keeps SMS routing ours.
   * Never retried: a lost response is recovered by adopting the existing
   * import (lib/telephony/binding.ts).
   */
  importTwilio(params: { phone_number: string; label: string; agent_id?: string | null; sid: string; token: string }, ctx?: Ctx) {
    return req<{ phone_number_id: string }>('phone_numbers.import', '/v1/convai/phone-numbers', {
      method: 'POST',
      body: { provider: 'twilio', enable_sms: false, ...params },
      retry: NO_RETRY,
      ctx,
    })
  },
  update(id: string, params: { agent_id?: string | null; label?: string }, ctx?: Ctx) {
    return req<ELPhoneNumber>('phone_numbers.update', `/v1/convai/phone-numbers/${encodeURIComponent(id)}`, { method: 'PATCH', body: params, idempotent: true, ctx })
  },
  delete(id: string, ctx?: Ctx) {
    return req<void>('phone_numbers.delete', `/v1/convai/phone-numbers/${encodeURIComponent(id)}`, { method: 'DELETE', responseKind: 'none', ctx })
  },
}

// ─── Twilio call control ─────────────────────────────────────────────────────

export interface ClientData {
  dynamic_variables?: Record<string, string | number | boolean>
  conversation_config_override?: Record<string, unknown>
  user_id?: string
}

export const twilio = {
  /**
   * App-routed calls: returns the TwiML (text) that connects the Twilio call to
   * the agent. Requires the agent to use ulaw_8000 in and out. Not retried:
   * the router falls back to the other provider instead, within Twilio's budget.
   */
  registerCall(params: { agent_id: string; from_number: string; to_number: string; direction: 'inbound' | 'outbound'; conversation_initiation_client_data?: ClientData }, ctx?: Ctx) {
    return req<string>('twilio.register_call', '/v1/convai/twilio/register-call', {
      method: 'POST',
      body: params,
      responseKind: 'text',
      timeoutMs: T.registerCall,
      retry: NO_RETRY,
      breaker: true,
      ctx,
    })
  },
  /**
   * Native numbers only (needs the ElevenLabs phone_number_id). Places a
   * billed call: never retried. Not on the inbound live path, so it never
   * feeds the shared routing circuit (one tenant's failed or rate-limited
   * outbound attempts must not fail every tenant's inbound calls over).
   */
  outboundCall(
    params: {
      agent_id: string
      agent_phone_number_id: string
      to_number: string
      conversation_initiation_client_data?: ClientData
      telephony_call_config?: TelephonyCallConfig
    },
    ctx?: Ctx,
  ) {
    return req<TwilioOutboundCallResponse>('twilio.outbound_call', '/v1/convai/twilio/outbound-call', {
      method: 'POST',
      body: params,
      timeoutMs: T.outbound,
      retry: NO_RETRY,
      breaker: false,
      ctx,
    })
  },
}

// ─── Knowledge base ──────────────────────────────────────────────────────────

export interface ELDocumentRef {
  id: string
  name: string
  folder_path?: Array<{ id: string; name?: string | null }>
}

/** Default cap for content(): callers keep a short excerpt, never the whole document. */
export const KB_CONTENT_MAX_BYTES = 256 * 1024
const KB_CONTENT_BODY_TIMEOUT_MS = 20_000

export const knowledgeBase = {
  /**
   * ElevenLabs scrapes the page before it answers, hence the upload timeout.
   * Never retried: a retry after a late upstream success would create a
   * duplicate document. Auto-sync can only be chosen here (PATCH has no
   * auto-sync field); auto_remove stays false so a temporarily unreachable
   * site never deletes the document behind our back.
   */
  createFromUrl(
    params: {
      url: string
      name?: string
      parent_folder_id?: string | null
      enable_auto_sync?: boolean
      auto_remove?: false
      minimum_frequency_days?: number | null
    },
    ctx?: Ctx,
  ) {
    return req<ELDocumentRef>('kb.create_url', '/v1/convai/knowledge-base/url', { method: 'POST', body: params, timeoutMs: T.upload, retry: NO_RETRY, ctx })
  },
  createFromText(params: { text: string; name?: string; parent_folder_id?: string | null }, ctx?: Ctx) {
    return req<ELDocumentRef>('kb.create_text', '/v1/convai/knowledge-base/text', { method: 'POST', body: params, timeoutMs: T.upload, retry: NO_RETRY, ctx })
  },
  createFromFile(file: Blob, filename: string, name: string, ctx?: Ctx, parentFolderId?: string | null) {
    const form = new FormData()
    form.append('file', file, filename)
    form.append('name', name)
    if (parentFolderId) form.append('parent_folder_id', parentFolderId)
    return req<ELDocumentRef>('kb.create_file', '/v1/convai/knowledge-base/file', { method: 'POST', body: form, timeoutMs: T.upload, retry: NO_RETRY, ctx })
  },
  get(id: string, ctx?: Ctx) {
    return req<{ id: string; name: string; type: string; metadata?: { size_bytes?: number } }>('kb.get', `/v1/convai/knowledge-base/${encodeURIComponent(id)}`, { ctx })
  },
  /**
   * The content the provider extracted (HTML or Markdown), bounded to
   * maxBytes (default 256 KB): used for the fallback agent's short excerpt.
   */
  async content(id: string, ctx?: Ctx, opts: { maxBytes?: number; bodyTimeoutMs?: number } = {}): Promise<string> {
    const res = await req<Response>('kb.content', `/v1/convai/knowledge-base/${encodeURIComponent(id)}/content`, {
      responseKind: 'response',
      timeoutMs: T.upload,
      ctx,
    })
    const prefix = await readTextPrefix(res, {
      maxBytes: opts.maxBytes ?? KB_CONTENT_MAX_BYTES,
      timeoutMs: opts.bodyTimeoutMs ?? KB_CONTENT_BODY_TIMEOUT_MS,
      system: 'elevenlabs',
      operation: 'kb.content',
    })
    return prefix.text
  },
  /** force=true also detaches the document from any agent still referencing it. */
  delete(id: string, force: boolean, ctx?: Ctx) {
    return req<void>('kb.delete', `/v1/convai/knowledge-base/${encodeURIComponent(id)}`, { method: 'DELETE', query: { force }, responseKind: 'none', ctx })
  },
  /** Idempotent: starts indexing if missing, otherwise returns the current status. */
  ragIndex(id: string, model: 'e5_mistral_7b_instruct' | 'multilingual_e5_large_instruct', ctx?: Ctx) {
    return req<{ id: string; status: string; progress_percentage?: number }>('kb.rag_index', `/v1/convai/knowledge-base/${encodeURIComponent(id)}/rag-index`, {
      method: 'POST',
      body: { model },
      idempotent: true,
      ctx,
    })
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
  verified_languages?: Array<{ language: string; model_id?: string | null; accent?: string | null; locale?: string | null; preview_url?: string | null }>
  sharing?: {
    public_owner_id?: string | null
    original_voice_id?: string | null
    /** VoiceSharingResponseModel.status: enabled | disabled | copied | copied_disabled. */
    status?: string | null
    disable_at_unix?: number | null
    notice_period?: number | null
    live_moderation_enabled?: boolean | null
    rate?: number | null
    fiat_rate?: number | null
  } | null
  /** NONE | BAN | CAPTCHA | ENTERPRISE_BAN | ENTERPRISE_CAPTCHA. */
  safety_control?: string | null
}

export interface ELSharedVoice {
  public_owner_id: string
  voice_id: string
  name: string
  accent?: string
  gender?: string
  age?: string
  descriptive?: string
  use_case?: string
  category?: string
  language?: string | null
  locale?: string | null
  description?: string | null
  preview_url?: string | null
  rate?: number | null
  fiat_rate?: number | null
  free_users_allowed?: boolean
  live_moderation_enabled?: boolean
  notice_period?: number | null
  verified_languages?: Array<{ language: string; model_id?: string | null; accent?: string | null; locale?: string | null; preview_url?: string | null }> | null
  featured?: boolean
  cloned_by_count?: number
  is_added_by_user?: boolean | null
}

export const voices = {
  search(params: { search?: string; voice_type?: string; category?: string; page_size?: number; next_page_token?: string | null; voice_ids?: string[] }) {
    return req<{ voices: ELVoice[]; has_more: boolean; next_page_token?: string | null }>('voices.search', '/v2/voices', {
      query: {
        search: params.search,
        voice_type: params.voice_type,
        category: params.category,
        page_size: Math.min(params.page_size ?? 50, 100),
        next_page_token: params.next_page_token ?? undefined,
        include_total_count: false,
        voice_ids: params.voice_ids,
      },
    })
  },
  get(voiceId: string, ctx?: Ctx) {
    return req<ELVoice>('voices.get', `/v1/voices/${encodeURIComponent(voiceId)}`, { ctx })
  },
  delete(voiceId: string, ctx?: Ctx) {
    return req<{ status: string }>('voices.delete', `/v1/voices/${encodeURIComponent(voiceId)}`, { method: 'DELETE', ctx })
  },
  /**
   * Instant voice clone (multipart). Consent is collected and audited by the
   * caller. remove_background_noise defaults to false (spec: it can make clean
   * samples worse); the tenant opts in for noisy recordings.
   */
  addInstantClone(
    params: { name: string; files: Array<{ blob: Blob; filename: string }>; description?: string; labels?: Record<string, string>; removeBackgroundNoise?: boolean },
    ctx?: Ctx,
  ) {
    const form = new FormData()
    form.append('name', params.name)
    for (const f of params.files) form.append('files', f.blob, f.filename)
    if (params.description) form.append('description', params.description)
    if (params.labels) form.append('labels', JSON.stringify(params.labels))
    form.append('remove_background_noise', params.removeBackgroundNoise === true ? 'true' : 'false')
    return req<{ voice_id: string; requires_verification?: boolean }>('voices.ivc', '/v1/voices/add', { method: 'POST', body: form, timeoutMs: T.upload, retry: NO_RETRY, ctx })
  },
}

export const sharedVoices = {
  list(params: { search?: string; language?: string; gender?: string; page?: number; page_size?: number; owner_id?: string; min_notice_period_days?: number }) {
    return req<{ voices: ELSharedVoice[]; has_more: boolean }>('shared_voices.list', '/v1/shared-voices', {
      query: {
        page_size: Math.min(params.page_size ?? 30, 100),
        page: params.page ?? 0,
        search: params.search,
        language: params.language,
        gender: params.gender,
        owner_id: params.owner_id,
        min_notice_period_days: params.min_notice_period_days,
        include_live_moderated: false,
        include_custom_rates: false,
        sort: 'cloned_by_count',
      },
    })
  },
  /** Adds a library voice to the platform workspace; returns the usable voice_id. */
  add(publicOwnerId: string, voiceId: string, newName: string) {
    return req<{ voice_id: string }>('shared_voices.add', `/v1/voices/add/${encodeURIComponent(publicOwnerId)}/${encodeURIComponent(voiceId)}`, {
      method: 'POST',
      body: { new_name: newName.slice(0, 100), bookmarked: true },
      retry: NO_RETRY,
    })
  },
}

// ─── Text-to-speech (previews) ───────────────────────────────────────────────

export interface TextToSpeechOptions {
  /** VoiceSettingsResponseModel overrides for this request only (the agent's tuning). */
  voiceSettings?: { stability?: number; similarity_boost?: number; speed?: number } | null
  /** Up to 3 {pronunciation_dictionary_id, version_id} locators, applied in order. */
  pronunciationLocators?: Array<{ pronunciation_dictionary_id: string; version_id: string }>
  /**
   * enable_logging query flag. false = zero retention mode (nothing kept in the
   * workspace speech history); the spec reserves it for enterprise accounts.
   */
  enableLogging?: boolean
  /** mp3_22050_32 (default) or wav_8000 (telephone band). */
  outputFormat?: 'mp3_22050_32' | 'wav_8000'
}

export async function textToSpeech(voiceId: string, text: string, modelId: string, languageCode?: string, opts: TextToSpeechOptions = {}): Promise<ArrayBuffer> {
  const wav = opts.outputFormat === 'wav_8000'
  const locators = (opts.pronunciationLocators ?? []).slice(0, 3)
  return req<ArrayBuffer>('tts.convert', `/v1/text-to-speech/${encodeURIComponent(voiceId)}`, {
    method: 'POST',
    query: { output_format: wav ? 'wav_8000' : 'mp3_22050_32', ...(opts.enableLogging === undefined ? {} : { enable_logging: opts.enableLogging }) },
    body: {
      text,
      model_id: modelId,
      // Spec: language_code is not supported by eleven_multilingual_v2.
      ...(languageCode && modelId !== 'eleven_multilingual_v2' ? { language_code: languageCode } : {}),
      ...(opts.voiceSettings ? { voice_settings: opts.voiceSettings } : {}),
      ...(locators.length ? { pronunciation_dictionary_locators: locators } : {}),
    },
    responseKind: 'arrayBuffer',
    accept: wav ? 'audio/wav' : 'audio/mpeg',
    timeoutMs: T.tts,
    retry: NO_RETRY,
  })
}

// ─── Health ──────────────────────────────────────────────────────────────────

export function subscription() {
  return req<{ tier?: string; status?: string; character_count?: number; character_limit?: number; voice_slots_used?: number; voice_limit?: number }>(
    'user.subscription',
    '/v1/user/subscription',
    { timeoutMs: 5_000 },
  )
}
