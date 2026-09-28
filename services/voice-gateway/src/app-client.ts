import type {
  CallControlRequest,
  CallControlResponse,
  FinalizeRequest,
  SessionRequest,
  ToolAction,
  ToolRequest,
  ToolResponse,
  VoiceEventRequest,
  VoiceSessionConfig,
} from './contracts'
import { INTERNAL_SIGNATURE_HEADER, VOICE_PIPELINE_MODES } from './contracts'
import { keepAliveFetch } from './http'
import type { Logger } from './log'
import { signInternalBody } from './signing'
import { delay } from './util/emitter'

// Signed HTTPS calls from the gateway to the app (contract §5.1). Every body is
// signed over its exact bytes; responses are validated before the call relies
// on them. Timeouts are per endpoint; only finalize retries (3 attempts with
// backoff) because it is idempotent on call_id and losing it loses the call.

export class AppClientError extends Error {
  constructor(
    message: string,
    readonly endpoint: string,
    readonly status: number | null,
    readonly code: string | null
  ) {
    super(message)
    this.name = 'AppClientError'
  }
}

export interface AppClientOptions {
  appUrl: string
  secret: string
  log: Logger
  /** Per-endpoint timeouts (ms). */
  timeouts?: Partial<Record<Endpoint, number>>
  /** Finalize backoff delays between attempts (ms). */
  finalizeBackoffMs?: number[]
  fetchImpl?: typeof fetch
}

type Endpoint = 'session' | 'tools' | 'events' | 'call-control' | 'finalize'

const DEFAULT_TIMEOUTS: Record<Endpoint, number> = {
  session: 5_000,
  // The app gives each tool an 8 s budget; leave headroom for the round trip.
  tools: 10_000,
  events: 5_000,
  'call-control': 8_000,
  finalize: 15_000,
}

const MAX_TOOL_RESULT_BYTES = 4 * 1024

export class AppClient {
  private readonly timeouts: Record<Endpoint, number>
  private readonly fetchImpl: typeof fetch

  constructor(private readonly options: AppClientOptions) {
    this.timeouts = { ...DEFAULT_TIMEOUTS, ...options.timeouts }
    this.fetchImpl = options.fetchImpl ?? keepAliveFetch
  }

  async session(body: SessionRequest): Promise<VoiceSessionConfig> {
    const data = await this.post('session', body)
    return parseSessionConfig(data)
  }

  /** Never throws: a failed tool becomes an instruction the model can act on. */
  async tool(body: ToolRequest): Promise<ToolResponse> {
    try {
      const data = await this.post('tools', body)
      return parseToolResponse(data)
    } catch (error) {
      this.options.log.warn('tool call failed', { tool: body.name, error: describeError(error) })
      return {
        ok: false,
        result: 'The tool is temporarily unavailable. Apologise briefly, offer to take a message or have someone call back, and do not retry it.',
        action: null,
      }
    }
  }

  /** Fire-and-log: events never block or fail a call. */
  async event(body: VoiceEventRequest): Promise<void> {
    try {
      await this.post('events', body)
    } catch (error) {
      this.options.log.warn('event delivery failed', { type: body.type, error: describeError(error) })
    }
  }

  async callControl(body: CallControlRequest): Promise<CallControlResponse> {
    try {
      const data = await this.post('call-control', body)
      if (!data || typeof data !== 'object') return { ok: false, error: 'invalid_response' }
      const record = data as Record<string, unknown>
      return { ok: record.ok === true, ...(typeof record.error === 'string' ? { error: record.error } : {}) }
    } catch (error) {
      this.options.log.warn('call control failed', { action: body.action, error: describeError(error) })
      return { ok: false, error: error instanceof AppClientError ? (error.code ?? 'request_failed') : 'request_failed' }
    }
  }

  async finalize(body: FinalizeRequest): Promise<boolean> {
    const backoff = this.options.finalizeBackoffMs ?? [1_000, 4_000]
    for (let attempt = 0; attempt <= backoff.length; attempt++) {
      try {
        await this.post('finalize', body)
        return true
      } catch (error) {
        const status = error instanceof AppClientError ? error.status : null
        // 4xx other than 408/429 won't get better by retrying.
        const permanent = status !== null && status >= 400 && status < 500 && status !== 408 && status !== 429
        this.options.log.error('finalize failed', { attempt: attempt + 1, permanent, error: describeError(error) })
        if (permanent || attempt === backoff.length) return false
        await delay(backoff[attempt])
      }
    }
    return false
  }

  private async post(endpoint: Endpoint, body: unknown): Promise<unknown> {
    const raw = JSON.stringify(body)
    const res = await this.fetchImpl(`${this.options.appUrl}/api/voice/internal/${endpoint}`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        [INTERNAL_SIGNATURE_HEADER]: signInternalBody(raw, this.options.secret),
        'user-agent': 'ntv-voice-gateway/1',
      },
      body: raw,
      signal: AbortSignal.timeout(this.timeouts[endpoint]),
    }).catch((error: unknown) => {
      const timedOut = error instanceof Error && (error.name === 'TimeoutError' || error.name === 'AbortError')
      throw new AppClientError(timedOut ? `${endpoint} timed out` : `${endpoint} request failed`, endpoint, null, timedOut ? 'timeout' : 'network_error')
    })
    if (res.status === 204) return null
    const text = await res.text().catch(() => '')
    let data: unknown = null
    if (text) {
      try {
        data = JSON.parse(text)
      } catch {
        data = null
      }
    }
    if (!res.ok) {
      const errorObj = data && typeof data === 'object' ? (data as { error?: { code?: unknown } }).error : undefined
      const code = errorObj && typeof errorObj.code === 'string' ? errorObj.code : null
      throw new AppClientError(`${endpoint} returned ${res.status}`, endpoint, res.status, code)
    }
    return data
  }
}

function describeError(error: unknown): Record<string, unknown> {
  if (error instanceof AppClientError) return { endpoint: error.endpoint, status: error.status, code: error.code, message: error.message }
  return { message: error instanceof Error ? error.message : String(error) }
}

// ─── Response validation ──────────────────────────────────────────────────────

function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === 'object' && !Array.isArray(value)
}

function str(value: unknown, field: string): string {
  if (typeof value !== 'string' || value.length === 0) throw new AppClientError(`session config: ${field} missing`, 'session', null, 'invalid_session_config')
  return value
}

function strOrNull(value: unknown): string | null {
  return typeof value === 'string' && value.length > 0 ? value : null
}

const STT_MODELS: readonly unknown[] = ['ink-2', 'ink-preview', 'ink-whisper']

function intIn(value: unknown, min: number, max: number, fallback: number): number {
  return typeof value === 'number' && Number.isInteger(value) && value >= min && value <= max ? value : fallback
}

/** Validates the shape the gateway depends on; unknown extra fields are kept. */
export function parseSessionConfig(data: unknown): VoiceSessionConfig {
  if (!isRecord(data)) throw new AppClientError('session config is not an object', 'session', null, 'invalid_session_config')
  const mode = data.mode
  if (typeof mode !== 'string' || !(VOICE_PIPELINE_MODES as readonly string[]).includes(mode)) {
    throw new AppClientError('session config: invalid mode', 'session', null, 'invalid_session_config')
  }
  if (data.channel !== 'twilio' && data.channel !== 'browser') throw new AppClientError('session config: invalid channel', 'session', null, 'invalid_session_config')
  str(data.session_id, 'session_id')
  str(data.call_id, 'call_id')
  str(data.org_id, 'org_id')
  str(data.agent_id, 'agent_id')
  str(data.language, 'language')
  str(data.instructions, 'instructions')
  if (typeof data.call_context !== 'string') throw new AppClientError('session config: call_context missing', 'session', null, 'invalid_session_config')
  str(data.fallback_message, 'fallback_message')
  str(data.apology_message, 'apology_message')
  if (!isRecord(data.voice)) throw new AppClientError('session config: voice missing', 'session', null, 'invalid_session_config')
  str(data.voice.voice_id, 'voice.voice_id')
  str(data.voice.tts_model, 'voice.tts_model')
  if (!isRecord(data.stt) || (data.stt.endpoint !== 'turns' && data.stt.endpoint !== 'manual')) {
    throw new AppClientError('session config: stt missing', 'session', null, 'invalid_session_config')
  }
  if (typeof data.stt.model !== 'string' || !STT_MODELS.includes(data.stt.model)) {
    throw new AppClientError('session config: invalid stt model', 'session', null, 'invalid_session_config')
  }
  if (!isRecord(data.llm)) throw new AppClientError('session config: llm missing', 'session', null, 'invalid_session_config')
  if (!Array.isArray(data.tools)) throw new AppClientError('session config: tools missing', 'session', null, 'invalid_session_config')
  if (!isRecord(data.behavior) || typeof data.behavior.max_duration_seconds !== 'number' || !Number.isFinite(data.behavior.max_duration_seconds)) {
    throw new AppClientError('session config: behavior missing', 'session', null, 'invalid_session_config')
  }
  if (!isRecord(data.elevenlabs)) throw new AppClientError('session config: elevenlabs missing', 'session', null, 'invalid_session_config')
  const config = data as unknown as VoiceSessionConfig
  const { llm, behavior, stt } = config
  const silence = data.behavior.silence_timeout_seconds
  return {
    ...config,
    // Numbers the turn loop and timers depend on: a missing or out-of-range
    // value falls back to the app's defaults instead of silently breaking the call.
    llm: {
      model: typeof llm.model === 'string' ? llm.model : '',
      max_output_tokens: intIn(llm.max_output_tokens, 64, 4_096, 400),
      reasoning_effort: llm.reasoning_effort === 'low' ? 'low' : 'none',
      max_tool_hops: intIn(llm.max_tool_hops, 0, 10, 4),
    },
    behavior: {
      allow_interruptions: behavior.allow_interruptions !== false,
      silence_timeout_seconds: typeof silence === 'number' && Number.isFinite(silence) && silence > 0 ? silence : null,
      max_duration_seconds: Math.min(Math.max(behavior.max_duration_seconds, 10), 4 * 60 * 60),
      record: behavior.record === true,
      voicemail_detection: behavior.voicemail_detection === true,
    },
    stt: { ...stt, keyterms: Array.isArray(stt.keyterms) ? stt.keyterms.filter((k): k is string => typeof k === 'string') : [] },
    tools: config.tools.filter((t) => isRecord(t) && typeof t.name === 'string' && isRecord(t.parameters)),
    initial_message: strOrNull(data.initial_message),
    from_number: strOrNull(data.from_number),
    to_number: strOrNull(data.to_number),
    twilio_call_sid: strOrNull(data.twilio_call_sid),
    cartesia_agent_id: strOrNull(data.cartesia_agent_id),
    safety_identifier: typeof data.safety_identifier === 'string' ? data.safety_identifier.slice(0, 64) : '',
    timezone: typeof data.timezone === 'string' && data.timezone ? data.timezone : 'UTC',
  }
}

function parseAction(value: unknown): ToolAction | null {
  if (!isRecord(value)) return null
  if (value.type === 'transfer' && typeof value.to_e164 === 'string' && /^\+[1-9]\d{6,14}$/.test(value.to_e164)) {
    return { type: 'transfer', to_e164: value.to_e164, announce: strOrNull(value.announce) }
  }
  if (value.type === 'end_call') return { type: 'end_call', reason: typeof value.reason === 'string' ? value.reason : 'completed' }
  return null
}

/** Truncates to `maxBytes` of UTF-8 without splitting a character. */
export function truncateUtf8(text: string, maxBytes: number): string {
  if (Buffer.byteLength(text, 'utf8') <= maxBytes) return text
  const suffix = '…'
  let bytes = Buffer.byteLength(suffix, 'utf8')
  let out = ''
  for (const ch of text) {
    const size = Buffer.byteLength(ch, 'utf8')
    if (bytes + size > maxBytes) break
    out += ch
    bytes += size
  }
  return out + suffix
}

export function parseToolResponse(data: unknown): ToolResponse {
  if (!isRecord(data) || typeof data.ok !== 'boolean' || typeof data.result !== 'string') {
    throw new AppClientError('tool response has an invalid shape', 'tools', null, 'invalid_tool_response')
  }
  const response: ToolResponse = {
    ok: data.ok,
    result: truncateUtf8(data.result, MAX_TOOL_RESULT_BYTES),
    action: parseAction(data.action),
  }
  if (Array.isArray(data.sources)) {
    response.sources = data.sources
      .filter(isRecord)
      .filter((s) => typeof s.document_id === 'string' && typeof s.chunk_id === 'string')
      .slice(0, 10)
      .map((s) => ({
        document_id: String(s.document_id),
        document_name: typeof s.document_name === 'string' ? s.document_name : '',
        chunk_id: String(s.chunk_id),
        excerpt: typeof s.excerpt === 'string' ? s.excerpt.slice(0, 200) : '',
        similarity: typeof s.similarity === 'number' ? s.similarity : 0,
      }))
  }
  return response
}
