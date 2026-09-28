import type WebSocket from 'ws'
import type { ChannelAudioFormat } from '../audio/codec'
import type { Logger } from '../log'
import { TypedEmitter } from '../util/emitter'
import { ProviderError } from './errors'
import type { TtsProvider, TtsStream, TtsStreamEvents } from './tts'
import { closeSocket, connectWebSocket, parseJsonObject, rawDataToString, safeSend } from './ws'

// ElevenLabs component fallback for TTS: the multi-context WebSocket
// (elevenlabs-fallback.md §2.4). One socket per call, one context per segment:
//   {context_id, text:' '} opens a context, sentences go out with flush:true,
//   close_context finishes it (already-flushed text keeps generating) and the
//   server answers isFinal. Barge-in closes the context and drops its audio.
// Contexts time out after `inactivity_timeout` (max 180 s), so idle sockets are
// replaced before that.

const INACTIVITY_TIMEOUT_S = 180
const MAX_PENDING_MESSAGES = 500
/**
 * After close_context, a context counts as finished once no audio arrived for
 * this long, even without isFinal: the reference documents isFinal only as "the
 * final message for the context", not when it is sent, and a missing one must
 * never leave the agent stuck mid-turn.
 */
const DEFAULT_FINAL_QUIET_MS = 2_500

export interface ElevenLabsTtsOptions {
  apiKey: string
  wsBase: string
  voiceId: string
  modelId: string
  language: string
  speed: number | null
  callId: string
  format: ChannelAudioFormat
  connectTimeoutMs: number
  log: Logger
  /** Test hook for the isFinal watchdog. */
  finalQuietMs?: number
}

class ElevenLabsTtsStream extends TypedEmitter<TtsStreamEvents> implements TtsStream {
  readonly provider = 'elevenlabs' as const
  characters = 0
  finished = false
  cancelled = false
  private opened = false
  private ended = false
  private finalTimer: NodeJS.Timeout | null = null

  constructor(
    readonly id: string,
    private readonly owner: ElevenLabsTts,
    private readonly finalQuietMs: number
  ) {
    super()
  }

  push(text: string): void {
    if (this.finished || this.cancelled || !text.trim()) return
    if (!this.opened) {
      this.opened = true
      this.owner.openContext(this.id)
    }
    this.characters += [...text].length
    this.owner.characters += [...text].length
    // ElevenLabs expects each text piece to end with a space.
    this.owner.send({ context_id: this.id, text: /\s$/.test(text) ? text : `${text} `, flush: true })
  }

  end(): void {
    if (this.finished || this.cancelled || this.ended) return
    if (!this.opened) {
      this.finished = true
      this.owner.forget(this.id)
      queueMicrotask(() => this.emit('done'))
      return
    }
    this.ended = true
    this.owner.send({ context_id: this.id, close_context: true })
    this.armFinalWatchdog()
  }

  cancel(): void {
    if (this.finished || this.cancelled) return
    this.cancelled = true
    this.clearFinalWatchdog()
    if (this.opened) this.owner.send({ context_id: this.id, close_context: true })
    this.owner.forget(this.id)
  }

  handle(msg: Record<string, unknown>): void {
    if (this.cancelled || this.finished) return
    if (typeof msg.audio === 'string' && msg.audio.length > 0) {
      this.emit('audio', Buffer.from(msg.audio, 'base64'))
      if (this.ended) this.armFinalWatchdog()
    }
    // Only a final after close_context ends the stream: text keeps coming into
    // an open context, and a context id reused after a server-side close starts afresh.
    if (this.ended && (msg.isFinal === true || msg.is_final === true)) this.finish()
  }

  fail(error: ProviderError): void {
    if (this.cancelled || this.finished) return
    this.finished = true
    this.clearFinalWatchdog()
    this.emit('error', error)
  }

  private finish(): void {
    if (this.finished || this.cancelled) return
    this.finished = true
    this.clearFinalWatchdog()
    this.owner.forget(this.id)
    this.emit('done')
  }

  private armFinalWatchdog(): void {
    this.clearFinalWatchdog()
    this.finalTimer = setTimeout(() => this.finish(), this.finalQuietMs)
    this.finalTimer.unref()
  }

  private clearFinalWatchdog(): void {
    if (this.finalTimer) clearTimeout(this.finalTimer)
    this.finalTimer = null
  }
}

export class ElevenLabsTts implements TtsProvider {
  readonly name = 'elevenlabs' as const
  private ws: WebSocket | null = null
  private connecting: Promise<WebSocket> | null = null
  private readonly streams = new Map<string, ElevenLabsTtsStream>()
  private readonly pending: string[] = []
  private counter = 0
  characters = 0
  private closed = false
  private lastActivity = Date.now()
  private idleTimer: NodeJS.Timeout | null = null

  constructor(private readonly options: ElevenLabsTtsOptions) {}

  async connect(): Promise<void> {
    await this.ensureSocket()
    this.idleTimer ??= setInterval(() => this.checkIdle(), 15_000)
    this.idleTimer.unref()
  }

  createStream(): TtsStream {
    this.counter += 1
    const stream = new ElevenLabsTtsStream(`${this.options.callId}-el-${this.counter}`, this, this.options.finalQuietMs ?? DEFAULT_FINAL_QUIET_MS)
    this.streams.set(stream.id, stream)
    return stream
  }

  close(): void {
    this.closed = true
    if (this.idleTimer) clearInterval(this.idleTimer)
    this.idleTimer = null
    // Cancelling after `closed` sends nothing; it only stops the streams' watchdogs.
    for (const stream of [...this.streams.values()]) stream.cancel()
    this.streams.clear()
    if (this.ws) safeSend(this.ws, JSON.stringify({ close_socket: true }))
    closeSocket(this.ws)
    this.ws = null
  }

  /** @internal */
  openContext(id: string): void {
    const settings: Record<string, unknown> = {}
    // ElevenLabs accepts 0.7–1.2; Cartesia speeds outside that are clamped.
    if (this.options.speed !== null) settings.speed = Math.min(1.2, Math.max(0.7, this.options.speed))
    this.send({ context_id: id, text: ' ', ...(Object.keys(settings).length ? { voice_settings: settings } : {}) })
  }

  /** @internal */
  send(message: Record<string, unknown>): void {
    if (this.closed) return
    this.lastActivity = Date.now()
    const text = JSON.stringify(message)
    if (this.ws && safeSend(this.ws, text)) return
    if (this.pending.length >= MAX_PENDING_MESSAGES) {
      this.failAll(new ProviderError({ provider: 'elevenlabs', component: 'tts', message: 'ElevenLabs TTS send queue overflow', code: 'queue_overflow' }))
      return
    }
    this.pending.push(text)
    void this.ensureSocket().catch((error: unknown) => {
      this.failAll(
        error instanceof ProviderError
          ? error
          : new ProviderError({ provider: 'elevenlabs', component: 'tts', message: 'ElevenLabs TTS reconnect failed', code: 'network_error', cause: error })
      )
    })
  }

  /** @internal */
  forget(id: string): void {
    this.streams.delete(id)
  }

  private ensureSocket(): Promise<WebSocket> {
    if (this.ws) return Promise.resolve(this.ws)
    if (this.connecting) return this.connecting
    const params = new URLSearchParams({
      model_id: this.options.modelId,
      output_format: this.options.format === 'mulaw_8000' ? 'ulaw_8000' : 'pcm_16000',
      inactivity_timeout: String(INACTIVITY_TIMEOUT_S),
      language_code: this.options.language,
      auto_mode: 'true',
    })
    const url = `${this.options.wsBase}/v1/text-to-speech/${encodeURIComponent(this.options.voiceId)}/multi-stream-input?${params}`
    this.connecting = connectWebSocket(url, {
      provider: 'elevenlabs',
      component: 'tts',
      headers: { 'xi-api-key': this.options.apiKey },
      timeoutMs: this.options.connectTimeoutMs,
    })
      .then((ws) => {
        this.connecting = null
        if (this.closed) {
          closeSocket(ws)
          throw new ProviderError({ provider: 'elevenlabs', component: 'tts', message: 'TTS closed', code: 'closed' })
        }
        this.attach(ws)
        return ws
      })
      .catch((error: unknown) => {
        this.connecting = null
        throw error
      })
    return this.connecting
  }

  private attach(ws: WebSocket): void {
    this.ws = ws
    ws.on('message', (data, isBinary) => {
      if (isBinary) return
      const msg = parseJsonObject(rawDataToString(data))
      if (!msg) return
      const contextId = typeof msg.contextId === 'string' ? msg.contextId : typeof msg.context_id === 'string' ? msg.context_id : null
      if (typeof msg.error === 'string' || (msg.message && msg.audio === undefined && msg.isFinal === undefined && msg.is_final === undefined)) {
        const error = new ProviderError({
          provider: 'elevenlabs',
          component: 'tts',
          code: typeof msg.error === 'string' ? msg.error : typeof msg.code === 'string' ? msg.code : null,
          status: typeof msg.code === 'number' ? msg.code : null,
          message: 'ElevenLabs TTS error',
        })
        if (contextId) this.streams.get(contextId)?.fail(error)
        else this.failAll(error)
        return
      }
      if (contextId) this.streams.get(contextId)?.handle(msg)
    })
    ws.on('error', (err) => this.options.log.warn('elevenlabs tts socket error', { error: err.message }))
    ws.on('close', (code) => {
      if (this.ws !== ws) return
      this.ws = null
      if (this.closed || this.streams.size === 0) return
      this.failAll(
        new ProviderError({
          provider: 'elevenlabs',
          component: 'tts',
          message: `ElevenLabs TTS socket closed (${code})`,
          code: `ws_close_${code}`,
          status: code === 1008 ? 401 : 503,
        })
      )
    })
    for (const text of this.pending.splice(0)) safeSend(ws, text)
  }

  private failAll(error: ProviderError): void {
    this.pending.length = 0
    for (const stream of [...this.streams.values()]) stream.fail(error)
    this.streams.clear()
  }

  private checkIdle(): void {
    if (this.closed || !this.ws || this.streams.size > 0) return
    if (Date.now() - this.lastActivity < (INACTIVITY_TIMEOUT_S - 30) * 1000) return
    const old = this.ws
    this.ws = null
    this.lastActivity = Date.now()
    closeSocket(old)
    void this.ensureSocket().catch((error: unknown) => {
      this.options.log.warn('elevenlabs tts idle reconnect failed', { error: error instanceof Error ? error.message : String(error) })
    })
  }
}
