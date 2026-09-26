import 'server-only'
import { ApiError } from '@/lib/api/http'
import { env, envString } from '@/lib/env'
import type {
  CartesiaAccent,
  CartesiaAgentCall,
  CartesiaAgentCreate,
  CartesiaAgentModel,
  CartesiaAgentSummary,
  CartesiaAgentUpdate,
  CartesiaAgentUsageBucket,
  CartesiaCreditsBucket,
  CartesiaErrorBody,
  CartesiaFolder,
  CartesiaGender,
  CartesiaManagedAgent,
  CartesiaPage,
  CartesiaTool,
  CartesiaToolCreate,
  CartesiaVoice,
  CartesiaVoiceAccent,
  CartesiaVoiceMetadata,
} from './types'

// Raw-fetch Cartesia client for the app (the JS SDK has no coverage of
// /v1/agents, usage, folders or documents, and adds retries we don't want on
// billable POSTs). The voice gateway talks to the WebSockets itself; this
// module only covers REST.
//
// Rules: every call carries a timeout; POSTs are never retried (a retried TTS
// or clone bills twice); a missing key is an ApiError 503 so routes answer
// { error: { code: 'not_configured' } } instead of crashing. Callers log with
// their own context tag and never forward CartesiaError messages to clients.

export const CARTESIA_API_VERSION = '2026-08-14'
export const CARTESIA_API_BASE = 'https://api.cartesia.ai'
/** Pinned snapshot: cached audio and voices stay stable across Sonic releases. */
export const DEFAULT_CARTESIA_TTS_MODEL = 'sonic-3.6-2026-08-27'
/** Listed by GET /v1/agents/models on 2026-09-17 (827 ms average latency). */
export const DEFAULT_CARTESIA_AGENT_MODEL = 'gpt-5.6-luna'
/** Batch STT only accepts ink-whisper. */
export const CARTESIA_BATCH_STT_MODEL = 'ink-whisper'

const DEFAULT_TIMEOUT_MS = 15_000
const LONG_TIMEOUT_MS = 60_000
const DOWNLOAD_TIMEOUT_MS = 300_000
const RETRY_DELAY_MS = 300
const MAX_LIST_PAGES = 10

export function cartesiaTtsModel(): string {
  return envString('CARTESIA_TTS_MODEL', DEFAULT_CARTESIA_TTS_MODEL)
}

export function cartesiaAgentModel(): string {
  return envString('CARTESIA_AGENT_MODEL', DEFAULT_CARTESIA_AGENT_MODEL)
}

// ─── Errors ──────────────────────────────────────────────────────────────────

export class CartesiaError extends Error {
  /** HTTP status; 0 when no response arrived (network failure or timeout). */
  readonly status: number
  /** Cartesia `error_code` (null for plain validation errors), or `timeout` / `network_error` / `invalid_response`. */
  readonly errorCode: string | null
  readonly title: string | null
  readonly requestId: string | null
  /** `METHOD /path`, for logs. */
  readonly endpoint: string

  constructor(init: {
    status: number
    message: string
    errorCode?: string | null
    title?: string | null
    requestId?: string | null
    endpoint?: string
    cause?: unknown
  }) {
    super(init.message, init.cause === undefined ? undefined : { cause: init.cause })
    this.name = 'CartesiaError'
    this.status = init.status
    this.errorCode = init.errorCode ?? null
    this.title = init.title ?? null
    this.requestId = init.requestId ?? null
    this.endpoint = init.endpoint ?? ''
  }
}

// Also accepts the WebSocket error event shape ({ error_code, status_code })
// so app code handling gateway-reported events can reuse the same checks.
function errorFacts(e: unknown): { status: number | null; code: string | null } {
  if (e instanceof CartesiaError) return { status: e.status, code: e.errorCode }
  if (isRecord(e)) {
    const status = typeof e.status_code === 'number' ? e.status_code : typeof e.status === 'number' ? e.status : null
    const code = typeof e.error_code === 'string' ? e.error_code : typeof e.errorCode === 'string' ? e.errorCode : null
    return { status, code }
  }
  return { status: null, code: null }
}

/** Credits or agent dollars ran out. HTTP status for TTS/STT quota errors is undocumented, so the code wins. */
export function isCartesiaQuotaError(e: unknown): boolean {
  const { status, code } = errorFacts(e)
  return code === 'quota_exceeded' || status === 402
}

const CONFIG_ERROR_CODES = new Set([
  'voice_not_found',
  'model_not_found',
  'voice_model_mismatch',
  'language_not_supported',
  'model_sunsetted',
  'unsupported_audio_format',
  'file_too_large',
  'plan_upgrade_required',
  'preview_not_found',
])
const CONFIG_ERROR_STATUSES = new Set([400, 404, 413, 422])

/**
 * Our request or configuration is wrong (bad voice, model, language, payload).
 * Retrying or failing over won't help and these must never trip the breaker.
 */
export function isCartesiaConfigError(e: unknown): boolean {
  if (isCartesiaQuotaError(e)) return false
  const { status, code } = errorFacts(e)
  if (code !== null && CONFIG_ERROR_CODES.has(code)) return true
  return status !== null && CONFIG_ERROR_STATUSES.has(status)
}

/** Worth one more attempt later: no response, timeout, rate/concurrency limit or a 5xx. */
export function isCartesiaTransientError(e: unknown): boolean {
  if (isCartesiaQuotaError(e)) return false
  const { status, code } = errorFacts(e)
  if (code === 'concurrency_limited') return true
  return status === 0 || status === 408 || status === 429 || (status !== null && status >= 500)
}

/** Builds a CartesiaError from a non-2xx response without surfacing raw bodies (HTML error pages, etc.). */
export async function parseCartesiaError(res: Response, endpoint: string): Promise<CartesiaError> {
  let text = ''
  try {
    text = await res.text()
  } catch {
    // Body already consumed or the stream broke; the status is enough.
  }

  let errorCode: string | null = null
  let title: string | null = null
  let detail: string | null = null
  let requestId: string | null = null

  const parsed = safeJsonParse(text)
  // Some endpoints wrap the error: { "error": { "message", "title", "request_id" } }.
  const json = isRecord(parsed) && isRecord(parsed.error) && parsed.error_code === undefined ? parsed.error : parsed
  if (isRecord(json)) {
    const body = json as CartesiaErrorBody & { description?: unknown }
    errorCode = str(body.error_code)
    title = str(body.title)
    // Call-log 404s use { message, description } instead of { title, message }.
    detail = str(body.message) ?? str(body.description) ?? title
    requestId = str(body.request_id)
  } else if (text && text.length <= 500 && !/^\s*</.test(text)) {
    // Versions before 2026-03-01 answer "Title: Message" in plain text.
    const match = /^([^:\n]{1,80}):\s*([\s\S]+)$/.exec(text.trim())
    if (match) {
      title = match[1].trim()
      detail = match[2].trim()
    }
  }

  requestId ??= res.headers.get('x-request-id')
  const summary = [String(res.status), errorCode].filter(Boolean).join(' ')
  return new CartesiaError({
    status: res.status,
    errorCode,
    title,
    requestId,
    endpoint,
    message: `Cartesia ${endpoint} failed (${summary}): ${detail ?? 'no error details'}`,
  })
}

// ─── Transport ───────────────────────────────────────────────────────────────

type QueryValue = string | number | boolean | null | undefined | readonly string[]

interface SendOptions {
  method?: 'GET' | 'POST' | 'PATCH' | 'DELETE'
  query?: Record<string, QueryValue>
  json?: unknown
  form?: FormData
  /** Usage endpoints need the admin key; everything else the standard key. */
  auth?: 'standard' | 'admin'
  /** Whole request including reading the body. */
  timeoutMs?: number
  /** Streaming responses: time allowed until headers arrive (the body keeps `timeoutMs`). */
  headersTimeoutMs?: number
  signal?: AbortSignal
  /** One retry on network errors, 408/429/5xx. Only for idempotent requests. */
  retry?: boolean
}

function apiKey(auth: 'standard' | 'admin'): string {
  const key = auth === 'admin' ? env.CARTESIA_ADMIN_API_KEY : env.CARTESIA_API_KEY
  if (!key) {
    throw new ApiError(
      503,
      'not_configured',
      auth === 'admin' ? 'Cartesia usage reporting is not configured.' : 'Cartesia is not configured.'
    )
  }
  return key
}

function buildUrl(pathOrUrl: string, query?: Record<string, QueryValue>): string {
  const url = new URL(pathOrUrl.startsWith('https://') ? pathOrUrl : `${CARTESIA_API_BASE}${pathOrUrl}`)
  for (const [key, value] of Object.entries(query ?? {})) {
    if (value === undefined || value === null) continue
    if (Array.isArray(value)) {
      for (const item of value) url.searchParams.append(key, item)
    } else {
      url.searchParams.set(key, String(value))
    }
  }
  return url.toString()
}

function isTimeout(err: unknown): boolean {
  return isRecord(err) && err.name === 'TimeoutError'
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

async function send(pathOrUrl: string, opts: SendOptions = {}): Promise<Response> {
  const method = opts.method ?? 'GET'
  const endpoint = `${method} ${pathOrUrl.startsWith('https://') ? new URL(pathOrUrl).pathname : pathOrUrl}`
  const url = buildUrl(pathOrUrl, opts.query)
  const headers: Record<string, string> = {
    Authorization: `Bearer ${apiKey(opts.auth ?? 'standard')}`,
    'Cartesia-Version': CARTESIA_API_VERSION,
  }
  let body: string | FormData | undefined
  if (opts.json !== undefined) {
    headers['Content-Type'] = 'application/json'
    body = JSON.stringify(opts.json)
  } else if (opts.form) {
    // fetch sets the multipart boundary itself.
    body = opts.form
  }

  const attempts = opts.retry ? 2 : 1
  for (let attempt = 1; ; attempt++) {
    const headersController = new AbortController()
    const signals = [AbortSignal.timeout(opts.timeoutMs ?? DEFAULT_TIMEOUT_MS), headersController.signal]
    if (opts.signal) signals.push(opts.signal)
    const headersTimer = opts.headersTimeoutMs
      ? setTimeout(
          () => headersController.abort(new DOMException('Cartesia response headers timed out', 'TimeoutError')),
          opts.headersTimeoutMs
        )
      : null

    let res: Response
    try {
      res = await fetch(url, { method, headers, body, signal: AbortSignal.any(signals), cache: 'no-store' })
    } catch (err) {
      // The caller cancelled (barge-in, client disconnect): keep their AbortError.
      if (opts.signal?.aborted) throw err
      const timedOut = isTimeout(err)
      const wrapped = new CartesiaError({
        status: 0,
        errorCode: timedOut ? 'timeout' : 'network_error',
        endpoint,
        message: `Cartesia ${endpoint} ${timedOut ? 'timed out' : 'could not be reached'}`,
        cause: err,
      })
      if (attempt < attempts) {
        await sleep(RETRY_DELAY_MS)
        continue
      }
      throw wrapped
    } finally {
      if (headersTimer) clearTimeout(headersTimer)
    }

    if (res.ok) return res
    const error = await parseCartesiaError(res, endpoint)
    if (attempt < attempts && (res.status === 408 || res.status === 429 || res.status >= 500)) {
      await sleep(RETRY_DELAY_MS)
      continue
    }
    throw error
  }
}

async function readJson<T>(res: Response, endpoint: string): Promise<T> {
  const text = await res.text()
  const parsed = safeJsonParse(text)
  if (parsed === undefined) {
    throw new CartesiaError({
      status: 502,
      errorCode: 'invalid_response',
      endpoint,
      message: `Cartesia ${endpoint} returned a body that is not JSON`,
    })
  }
  return parsed as T
}

async function requestJson<T>(path: string, opts: SendOptions = {}): Promise<T> {
  const res = await send(path, opts)
  return readJson<T>(res, `${opts.method ?? 'GET'} ${path}`)
}

async function requestVoid(path: string, opts: SendOptions): Promise<void> {
  const res = await send(path, opts)
  // Drain so the connection goes back to the pool.
  await res.arrayBuffer().catch(() => undefined)
}

function invalidResponse(endpoint: string, what: string): CartesiaError {
  return new CartesiaError({
    status: 502,
    errorCode: 'invalid_response',
    endpoint,
    message: `Cartesia ${endpoint} returned an unexpected shape: ${what}`,
  })
}

function pageOf<T>(raw: unknown, endpoint: string): CartesiaPage<T> {
  if (!isRecord(raw) || !Array.isArray(raw.data)) throw invalidResponse(endpoint, 'missing data[]')
  return {
    data: raw.data as T[],
    has_more: raw.has_more === true,
    next_page: str(raw.next_page),
  }
}

/** Follows `next_page` (the last id, used as `starting_after`) up to MAX_LIST_PAGES. */
async function listAll<T extends { id: string }>(path: string, query: Record<string, QueryValue>): Promise<T[]> {
  const items: T[] = []
  let startingAfter: string | undefined
  for (let page = 0; page < MAX_LIST_PAGES; page++) {
    const raw = await requestJson<unknown>(path, { query: { ...query, limit: 100, starting_after: startingAfter }, retry: true })
    const result = pageOf<T>(raw, `GET ${path}`)
    items.push(...result.data)
    const next = result.next_page ?? result.data.at(-1)?.id
    if (!result.has_more || !next) break
    startingAfter = next
  }
  return items
}

function seg(id: string): string {
  return encodeURIComponent(id)
}

// ─── Parsing helpers ─────────────────────────────────────────────────────────

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

function str(value: unknown): string | null {
  return typeof value === 'string' ? value : null
}

function num(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null
}

function safeJsonParse(text: string): unknown {
  if (!text) return undefined
  try {
    return JSON.parse(text)
  } catch {
    return undefined
  }
}

const GENDERS: readonly CartesiaGender[] = ['masculine', 'feminine', 'gender_neutral']

/**
 * Whitelists the documented voice fields. Routes may serialise voices, so new
 * upstream fields don't flow to browsers unreviewed.
 */
export function normalizeVoice(raw: unknown): CartesiaVoice {
  const v = isRecord(raw) ? raw : {}
  const accents: CartesiaVoiceAccent[] = Array.isArray(v.accents)
    ? v.accents.flatMap((a) =>
        isRecord(a) && typeof a.accent === 'string' && typeof a.locale === 'string'
          ? [{ accent: a.accent, locale: a.locale, is_native: a.is_native === true }]
          : []
      )
    : []
  const gender = str(v.gender)
  const voice: CartesiaVoice = {
    id: str(v.id) ?? '',
    name: str(v.name) ?? '',
    description: str(v.description),
    tagline: str(v.tagline),
    gender: GENDERS.includes(gender as CartesiaGender) ? (gender as CartesiaGender) : null,
    language: str(v.language),
    country: str(v.country),
    accents,
    is_owner: v.is_owner === true,
    is_pro: v.is_pro === true,
    status: str(v.status),
    access: str(v.access),
    visibility: str(v.visibility),
    created_at: str(v.created_at),
  }
  if ('preview_file_url' in v) voice.preview_file_url = str(v.preview_file_url)
  return voice
}

// ─── TTS helpers ─────────────────────────────────────────────────────────────

export type CartesiaTtsFormat = 'mp3' | 'wav' | 'mulaw8k'

/** Verified live 2026-09-17: mp3 → audio/mpeg, wav → audio/wav, mulaw8k → audio/pcm (raw, no header). */
export function ttsOutputFormat(format: CartesiaTtsFormat): Record<string, string | number> {
  switch (format) {
    case 'mp3':
      return { container: 'mp3', sample_rate: 44100, bit_rate: 128000 }
    case 'wav':
      return { container: 'wav', encoding: 'pcm_s16le', sample_rate: 44100 }
    case 'mulaw8k':
      return { container: 'raw', encoding: 'pcm_mulaw', sample_rate: 8000 }
  }
}

/** Only the knobs that were actually set; an empty object would still be "guidance" upstream. */
export function ttsGenerationConfig(input: {
  speed?: number | null
  volume?: number | null
  emotion?: string | null
}): { speed?: number; volume?: number; emotion?: string } | undefined {
  const config: { speed?: number; volume?: number; emotion?: string } = {}
  if (typeof input.speed === 'number') config.speed = input.speed
  if (typeof input.volume === 'number') config.volume = input.volume
  if (typeof input.emotion === 'string' && input.emotion.trim()) config.emotion = input.emotion.trim()
  return Object.keys(config).length > 0 ? config : undefined
}

// ─── Operations ──────────────────────────────────────────────────────────────

async function getVoice(id: string, opts?: { expandPreview?: boolean }): Promise<CartesiaVoice> {
  const raw = await requestJson<unknown>(`/voices/${seg(id)}`, {
    query: { 'expand[]': opts?.expandPreview ? 'preview_file_url' : undefined },
    retry: true,
  })
  return normalizeVoice(raw)
}

function isCartesiaFileUrl(url: URL): boolean {
  return url.protocol === 'https:' && (url.hostname === 'cartesia.ai' || url.hostname.endsWith('.cartesia.ai'))
}

async function fetchPreview(id: string): Promise<Response> {
  const voice = await getVoice(id, { expandPreview: true })
  if (!voice.preview_file_url) {
    throw new CartesiaError({
      status: 404,
      errorCode: 'preview_not_found',
      endpoint: `GET /voices/${id}`,
      message: 'This voice has no preview clip',
    })
  }
  let url: URL
  try {
    url = new URL(voice.preview_file_url)
  } catch {
    throw invalidResponse(`GET /voices/${id}`, 'preview_file_url is not a URL')
  }
  // The preview host needs our API key; never send it anywhere else.
  if (!isCartesiaFileUrl(url)) throw invalidResponse(`GET /voices/${id}`, 'preview_file_url is not a Cartesia host')
  return send(url.toString(), { headersTimeoutMs: DEFAULT_TIMEOUT_MS, timeoutMs: LONG_TIMEOUT_MS, retry: true })
}

async function getFolder(id: string): Promise<CartesiaFolder> {
  return requestJson<CartesiaFolder>(`/agents/folders/${seg(id)}`, { retry: true })
}

function requireId(raw: unknown, endpoint: string): { id: string } {
  if (!isRecord(raw) || typeof raw.id !== 'string' || !raw.id) throw invalidResponse(endpoint, 'missing id')
  return { id: raw.id }
}

function sumField<K extends string>(raw: unknown, endpoint: string, fields: readonly K[]): Record<K, number> {
  if (!isRecord(raw) || !Array.isArray(raw.data)) throw invalidResponse(endpoint, 'missing data[]')
  const totals = Object.fromEntries(fields.map((f) => [f, 0])) as Record<K, number>
  for (const bucket of raw.data) {
    if (!isRecord(bucket)) continue
    for (const field of fields) totals[field] += num(bucket[field]) ?? 0
  }
  return totals
}

export const cartesia = {
  voices: {
    async list(params: {
      q?: string
      gender?: string
      language?: string
      isOwner?: boolean
      limit?: number
      startingAfter?: string
      expandPreview?: boolean
    }): Promise<{ data: CartesiaVoice[]; has_more: boolean; next_page: string | null }> {
      const limit = params.limit === undefined ? undefined : Math.min(100, Math.max(1, Math.trunc(params.limit)))
      const raw = await requestJson<unknown>('/voices', {
        query: {
          limit,
          q: params.q?.trim() || undefined,
          gender: params.gender,
          language: params.language,
          is_owner: params.isOwner,
          starting_after: params.startingAfter,
          'expand[]': params.expandPreview ? 'preview_file_url' : undefined,
        },
        retry: true,
      })
      const page = pageOf<unknown>(raw, 'GET /voices')
      return { data: page.data.map(normalizeVoice), has_more: page.has_more, next_page: page.next_page }
    },

    get: getVoice,

    async clone(input: {
      clip: Blob
      filename: string
      name: string
      language: string
      accent?: string
      description?: string
      tagline?: string
      baseVoiceId?: string
    }): Promise<CartesiaVoiceMetadata> {
      const form = new FormData()
      form.append('clip', input.clip, input.filename)
      form.append('name', input.name)
      form.append('language', input.language)
      // Customer voices stay private even if Cartesia's default ever changes.
      form.append('access', 'private')
      if (input.accent) form.append('accent', input.accent)
      if (input.description) form.append('description', input.description)
      if (input.tagline) form.append('tagline', input.tagline)
      if (input.baseVoiceId) form.append('base_voice_id', input.baseVoiceId)
      const raw = await requestJson<CartesiaVoiceMetadata>('/voices/clone', {
        method: 'POST',
        form,
        timeoutMs: LONG_TIMEOUT_MS,
      })
      requireId(raw, 'POST /voices/clone')
      return raw
    },

    async update(id: string, patch: { name?: string; description?: string; tagline?: string }): Promise<CartesiaVoice> {
      const raw = await requestJson<unknown>(`/voices/${seg(id)}`, { method: 'PATCH', json: patch })
      return normalizeVoice(raw)
    },

    async delete(id: string): Promise<void> {
      await requestVoid(`/voices/${seg(id)}`, { method: 'DELETE' })
    },

    /** Follows preview_file_url with auth; the caller streams the body (audio/wav, ~1 MB). */
    fetchPreview,

    async listAccents(params?: {
      language?: string
      locale?: string
    }): Promise<{ id: string; name: string; language: string; locale: string }[]> {
      const raw = await requestJson<unknown>('/accents', {
        query: { language: params?.language, locale: params?.locale },
        retry: true,
      })
      if (!isRecord(raw) || !Array.isArray(raw.accents)) throw invalidResponse('GET /accents', 'missing accents[]')
      return (raw.accents as unknown[]).flatMap((a): CartesiaAccent[] =>
        isRecord(a) && typeof a.id === 'string' && typeof a.locale === 'string'
          ? [{
              id: a.id,
              name: str(a.name) ?? a.id,
              language: str(a.language) ?? a.locale.split('-')[0],
              locale: a.locale,
              is_locale_default: a.is_locale_default === true,
              is_localizable: a.is_localizable === true,
            }]
          : []
      )
    },
  },

  tts: {
    /**
     * One generation, streamed back. Returns the upstream Response so routes
     * can pipe the body; the headers must arrive within 15 s, the whole body
     * within 60 s. Never retried (billed per character).
     */
    async bytes(input: {
      transcript: string
      voiceId: string
      language: string
      modelId?: string
      format: CartesiaTtsFormat
      speed?: number | null
      volume?: number | null
      emotion?: string | null
      signal?: AbortSignal
    }): Promise<Response> {
      const generationConfig = ttsGenerationConfig(input)
      return send('/tts/bytes', {
        method: 'POST',
        json: {
          model_id: input.modelId ?? cartesiaTtsModel(),
          transcript: input.transcript,
          voice: input.voiceId,
          // `language` only: sending `locale` too is a 400 (verified live).
          language: input.language,
          output_format: ttsOutputFormat(input.format),
          ...(generationConfig ? { generation_config: generationConfig } : {}),
        },
        headersTimeoutMs: DEFAULT_TIMEOUT_MS,
        timeoutMs: LONG_TIMEOUT_MS,
        signal: input.signal,
      })
    },
  },

  stt: {
    /** Batch ink-whisper (1 credit per 2 s). Words come back with a leading space upstream; trimmed here. */
    async transcribe(input: {
      file: Blob
      filename: string
      language: string
      wordTimestamps?: boolean
      signal?: AbortSignal
      /** Whole request; defaults to 60 s. Long recordings need more (the Voice Lab route allows ~110 s). */
      timeoutMs?: number
    }): Promise<{ text: string; language: string | null; duration: number | null; words: { word: string; start: number; end: number }[] }> {
      const form = new FormData()
      form.append('file', input.file, input.filename)
      form.append('model', CARTESIA_BATCH_STT_MODEL)
      form.append('language', input.language)
      if (input.wordTimestamps) form.append('timestamp_granularities[]', 'word')
      const raw = await requestJson<unknown>('/stt', {
        method: 'POST',
        form,
        timeoutMs: input.timeoutMs ?? LONG_TIMEOUT_MS,
        signal: input.signal,
      })
      if (!isRecord(raw)) throw invalidResponse('POST /stt', 'not an object')
      const words = Array.isArray(raw.words)
        ? raw.words.flatMap((w) => {
            if (!isRecord(w) || typeof w.word !== 'string') return []
            const word = w.word.trim()
            const start = num(w.start)
            const end = num(w.end)
            return word && start !== null && end !== null ? [{ word, start, end }] : []
          })
        : []
      return {
        text: (str(raw.text) ?? '').trim(),
        language: str(raw.language),
        duration: num(raw.duration),
        words,
      }
    },
  },

  /** Short-lived JWT for browsers (`?access_token=` on WebSockets). Only true grants are requested. */
  async accessToken(grants: { tts?: boolean; stt?: boolean; agent?: boolean }, expiresInSeconds: number): Promise<string> {
    if (!Number.isInteger(expiresInSeconds) || expiresInSeconds < 1 || expiresInSeconds > 3600) {
      throw new RangeError('expiresInSeconds must be an integer between 1 and 3600')
    }
    const granted = Object.fromEntries(Object.entries(grants).filter(([, value]) => value === true))
    if (Object.keys(granted).length === 0) throw new RangeError('At least one grant is required')
    const raw = await requestJson<unknown>('/access-token', {
      method: 'POST',
      json: { grants: granted, expires_in: expiresInSeconds },
    })
    if (!isRecord(raw) || typeof raw.token !== 'string' || !raw.token) {
      throw invalidResponse('POST /access-token', 'missing token')
    }
    return raw.token
  },

  agents: {
    async list(params?: { limit?: number; q?: string }): Promise<{ data: CartesiaAgentSummary[]; has_more: boolean }> {
      const raw = await requestJson<unknown>('/v1/agents', {
        query: {
          limit: params?.limit === undefined ? undefined : Math.min(100, Math.max(1, Math.trunc(params.limit))),
          q: params?.q?.trim() || undefined,
        },
        retry: true,
      })
      const page = pageOf<CartesiaAgentSummary>(raw, 'GET /v1/agents')
      return { data: page.data, has_more: page.has_more }
    },

    async get(id: string): Promise<CartesiaManagedAgent> {
      const raw = await requestJson<CartesiaManagedAgent>(`/v1/agents/${seg(id)}`, { retry: true })
      requireId(raw, 'GET /v1/agents/{id}')
      return raw
    },

    async create(body: CartesiaAgentCreate): Promise<CartesiaManagedAgent> {
      const raw = await requestJson<CartesiaManagedAgent>('/v1/agents', { method: 'POST', json: body })
      requireId(raw, 'POST /v1/agents')
      return raw
    },

    async update(id: string, body: CartesiaAgentUpdate): Promise<CartesiaManagedAgent> {
      const raw = await requestJson<CartesiaManagedAgent>(`/v1/agents/${seg(id)}`, { method: 'PATCH', json: body })
      requireId(raw, 'PATCH /v1/agents/{id}')
      return raw
    },

    async delete(id: string): Promise<void> {
      await requestVoid(`/v1/agents/${seg(id)}`, { method: 'DELETE' })
    },

    /** Every model on the account (paginated upstream). */
    async models(): Promise<CartesiaAgentModel[]> {
      return listAll<CartesiaAgentModel>('/v1/agents/models', {})
    },

    tools: {
      /** With `limit`, one page; without, every tool of that type. */
      async list(params?: { type?: 'client' | 'webhook'; limit?: number }): Promise<CartesiaTool[]> {
        if (params?.limit !== undefined) {
          const raw = await requestJson<unknown>('/v1/agents/tools', {
            query: { type: params.type, limit: Math.min(100, Math.max(1, Math.trunc(params.limit))) },
            retry: true,
          })
          return pageOf<CartesiaTool>(raw, 'GET /v1/agents/tools').data
        }
        return listAll<CartesiaTool>('/v1/agents/tools', { type: params?.type })
      },

      async create(body: CartesiaToolCreate): Promise<CartesiaTool> {
        const raw = await requestJson<CartesiaTool>('/v1/agents/tools', { method: 'POST', json: body })
        requireId(raw, 'POST /v1/agents/tools')
        return raw
      },

      async update(id: string, body: Partial<CartesiaToolCreate>): Promise<CartesiaTool> {
        const raw = await requestJson<CartesiaTool>(`/v1/agents/tools/${seg(id)}`, { method: 'PATCH', json: body })
        requireId(raw, 'PATCH /v1/agents/tools/{id}')
        return raw
      },

      /** Cartesia refuses while an agent still references the tool. */
      async delete(id: string): Promise<void> {
        await requestVoid(`/v1/agents/tools/${seg(id)}`, { method: 'DELETE' })
      },
    },
  },

  calls: {
    /**
     * The get-call reference returns `transcript` inline (only the list
     * endpoint documents `expand=transcript`), so `transcript: false` just
     * drops it from the result.
     */
    async get(id: string, opts?: { transcript?: boolean }): Promise<CartesiaAgentCall> {
      const raw = await requestJson<CartesiaAgentCall>(`/agents/calls/${seg(id)}`, { retry: true })
      requireId(raw, 'GET /agents/calls/{id}')
      if (opts?.transcript === false) delete raw.transcript
      return raw
    },

    /** audio/wav; the caller streams it. */
    async audio(id: string): Promise<Response> {
      return send(`/agents/calls/${seg(id)}/audio`, {
        headersTimeoutMs: DEFAULT_TIMEOUT_MS,
        timeoutMs: DOWNLOAD_TIMEOUT_MS,
        retry: true,
      })
    },

    /** Redacts transcript, audio and logs. Documented as idempotent ("retry on 500"). */
    async delete(id: string): Promise<void> {
      await requestVoid(`/agents/calls/${seg(id)}`, { method: 'DELETE', retry: true })
    },
  },

  knowledge: {
    async createFolder(name: string): Promise<{ id: string }> {
      const raw = await requestJson<unknown>('/agents/folders', { method: 'POST', json: { name, parent_id: null } })
      return requireId(raw, 'POST /agents/folders')
    },

    /** Plain text only, ≤ 1 MB (413 above). */
    async createDocument(input: {
      folderId: string
      name: string
      content: string
      metadata?: Record<string, string>
    }): Promise<{ id: string }> {
      const raw = await requestJson<unknown>('/agents/documents', {
        method: 'POST',
        json: {
          folder_id: input.folderId,
          name: input.name,
          content: input.content,
          ...(input.metadata ? { metadata: input.metadata } : {}),
        },
      })
      return requireId(raw, 'POST /agents/documents')
    },

    /** Changing content re-indexes the document. */
    async updateDocument(id: string, input: { name?: string; content?: string }): Promise<void> {
      await requestVoid(`/agents/documents/${seg(id)}`, { method: 'PATCH', json: input })
    },

    async deleteDocument(id: string): Promise<void> {
      await requestVoid(`/agents/documents/${seg(id)}`, { method: 'DELETE' })
    },

    /**
     * PATCH `agents` replaces the folder's whole agent set, so read it first
     * and add this agent to what is already attached.
     */
    async attachFolderToAgent(folderId: string, agentId: string): Promise<void> {
      const folder = await getFolder(folderId)
      const current = (folder.agents ?? []).map((a) => a.id).filter((id): id is string => typeof id === 'string')
      if (current.includes(agentId)) return
      await requestVoid(`/agents/folders/${seg(folderId)}`, {
        method: 'PATCH',
        json: { agents: [...current, agentId].map((id) => ({ id })) },
      })
    },
  },

  usage: {
    /** Credits consumed in [start, end) (UTC-day buckets upstream). Admin key. */
    async credits(startIso: string, endIso: string): Promise<number> {
      const raw = await requestJson<{ data?: CartesiaCreditsBucket[] }>('/usage/credits', {
        auth: 'admin',
        query: { start_ts: startIso, end_ts: endIso },
        retry: true,
      })
      return sumField(raw, 'GET /usage/credits', ['credits'] as const).credits
    },

    /** Managed Agent spend in [start, end). Admin key. */
    async agents(startIso: string, endIso: string): Promise<{ cents: number; minutes: number; calls: number }> {
      const raw = await requestJson<{ data?: CartesiaAgentUsageBucket[] }>('/usage/agents', {
        auth: 'admin',
        query: { start_ts: startIso, end_ts: endIso },
        retry: true,
      })
      return sumField(raw, 'GET /usage/agents', ['cents', 'minutes', 'calls'] as const)
    },
  },
}
