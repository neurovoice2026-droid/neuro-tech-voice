import WebSocket from 'ws'
import type { CartesiaVoiceConfig } from '../contracts'
import type { ChannelAudioFormat } from '../audio/codec'
import type { Logger } from '../log'
import { TypedEmitter } from '../util/emitter'
import { ProviderError } from './errors'
import type { TtsProvider, TtsStream, TtsStreamEvents, WordTimings } from './tts'
import { closeSocket, connectWebSocket, parseJsonObject, rawDataToString, safeSend } from './ws'

// Cartesia Sonic over the TTS WebSocket (cartesia-docs.md §2.5 + live capture
// scratchpad/live/07-tts-ws.json). One socket per call, one context per
// utterance segment:
//   - every message repeats model/voice/language/output_format; context ids
//     are `<call>-<n>` and never reused
//   - text goes out as full sentences with continue:true and
//     max_buffer_delay_ms 0, then {transcript:'', continue:false}
//   - cancel only halts work that hasn't started, so chunks that still arrive
//     for a cancelled context are dropped here
//   - flush_done arrives twice per boundary and is ignored; `done` has status 200
//   - error events are per context and leave the socket open
//   - Cartesia closes idle sockets after 5 min: we reconnect before that

const MAX_PENDING_MESSAGES = 500

export interface CartesiaTtsOptions {
  apiKey: string
  wsBase: string
  version: string
  callId: string
  voice: CartesiaVoiceConfig
  format: ChannelAudioFormat
  connectTimeoutMs: number
  idleReconnectMs: number
  log: Logger
  /** Time from first text to first audio, per stream (soft-failure signal). */
  onFirstAudio?: (latencyMs: number) => void
  /** A socket opened ahead of time (see CartesiaTts.preconnect); used for the first connection. */
  preconnected?: Promise<WebSocket | null> | null
}

export interface CartesiaTtsConnectOptions {
  apiKey: string
  wsBase: string
  version: string
  connectTimeoutMs: number
}

function ttsSocketUrl(options: { wsBase: string; version: string }): string {
  return `${options.wsBase}/tts/websocket?cartesia_version=${encodeURIComponent(options.version)}`
}

function outputFormat(format: ChannelAudioFormat) {
  return format === 'mulaw_8000'
    ? { container: 'raw', encoding: 'pcm_mulaw', sample_rate: 8000 }
    : { container: 'raw', encoding: 'pcm_s16le', sample_rate: 16000 }
}

class CartesiaTtsStream extends TypedEmitter<TtsStreamEvents> implements TtsStream {
  readonly provider = 'cartesia' as const
  characters = 0
  finished = false
  cancelled = false
  private sentAny = false
  private firstTextAt = 0
  private gotAudio = false

  constructor(
    readonly id: string,
    private readonly owner: CartesiaTts
  ) {
    super()
  }

  push(text: string): void {
    if (this.finished || this.cancelled || !text) return
    if (!this.sentAny) this.firstTextAt = Date.now()
    this.sentAny = true
    this.characters += [...text].length
    this.owner.sendForStream(this, { transcript: text, continue: true })
  }

  end(): void {
    if (this.finished || this.cancelled) return
    if (!this.sentAny) {
      // Nothing to synthesise: finish locally without burning a context.
      this.finished = true
      queueMicrotask(() => this.emit('done'))
      this.owner.forget(this.id)
      return
    }
    this.owner.sendForStream(this, { transcript: '', continue: false })
  }

  cancel(): void {
    if (this.finished || this.cancelled) return
    this.cancelled = true
    if (this.sentAny) this.owner.sendRaw({ context_id: this.id, cancel: true })
    this.owner.forget(this.id)
  }

  handle(msg: Record<string, unknown>): void {
    if (this.cancelled || this.finished) return
    switch (msg.type) {
      case 'chunk': {
        if (typeof msg.data !== 'string' || msg.data.length === 0) return
        if (!this.gotAudio) {
          this.gotAudio = true
          this.owner.reportFirstAudio(Date.now() - this.firstTextAt)
        }
        this.emit('audio', Buffer.from(msg.data, 'base64'))
        return
      }
      case 'timestamps': {
        const wt = msg.word_timestamps as Record<string, unknown> | undefined
        if (!wt || !Array.isArray(wt.words) || !Array.isArray(wt.start) || !Array.isArray(wt.end)) return
        const timings: WordTimings = {
          words: wt.words.map(String),
          start: wt.start.map(Number),
          end: wt.end.map(Number),
        }
        this.emit('words', timings)
        return
      }
      case 'flush_done':
        return
      case 'done': {
        this.finished = true
        this.owner.forget(this.id)
        this.emit('done')
        return
      }
      case 'error': {
        this.finished = true
        this.owner.forget(this.id)
        // "Errors will not consume credits": a context Cartesia rejected before
        // any audio (unknown voice, bad model…) is not usage. Otherwise every
        // retry of the same text would be metered again (live run S6).
        if (!this.gotAudio) this.owner.refund(this.characters)
        this.emit(
          'error',
          new ProviderError({
            provider: 'cartesia',
            component: 'tts',
            status: typeof msg.status_code === 'number' ? msg.status_code : null,
            code: typeof msg.error_code === 'string' ? msg.error_code : null,
            message: `Cartesia TTS error${typeof msg.title === 'string' ? `: ${msg.title}` : ''}`,
            // Per-context errors leave the socket usable.
            fatal: false,
          })
        )
        return
      }
      default:
        return
    }
  }

  failSocket(error: ProviderError): void {
    if (this.cancelled || this.finished) return
    this.finished = true
    this.emit('error', error)
  }
}

export class CartesiaTts implements TtsProvider {
  readonly name = 'cartesia' as const
  private ws: WebSocket | null = null
  private connecting: Promise<WebSocket> | null = null
  private readonly streams = new Map<string, CartesiaTtsStream>()
  private readonly pending: string[] = []
  private counter = 0
  characters = 0
  private lastActivity = Date.now()
  private idleTimer: NodeJS.Timeout | null = null
  private closed = false

  private preconnected: Promise<WebSocket | null> | null

  constructor(private readonly options: CartesiaTtsOptions) {
    this.preconnected = options.preconnected ?? null
  }

  /**
   * Opens a TTS socket before the call's voice settings are known (the socket
   * itself only needs the key and API version). Resolves null on failure: the
   * provider then connects normally.
   */
  static preconnect(options: CartesiaTtsConnectOptions): Promise<WebSocket | null> {
    return connectWebSocket(ttsSocketUrl(options), {
      provider: 'cartesia',
      component: 'tts',
      headers: { 'X-API-Key': options.apiKey },
      timeoutMs: options.connectTimeoutMs,
    }).then(
      (ws) => {
        // Nothing is listening yet: keep a late error from becoming an uncaught exception.
        ws.on('error', () => {})
        return ws
      },
      () => null
    )
  }

  async connect(): Promise<void> {
    await this.ensureSocket()
    this.idleTimer ??= setInterval(() => this.checkIdle(), Math.min(30_000, Math.max(1_000, this.options.idleReconnectMs / 4)))
    this.idleTimer.unref()
  }

  createStream(): TtsStream {
    this.counter += 1
    const stream = new CartesiaTtsStream(`${this.options.callId}-${this.counter}`, this)
    this.streams.set(stream.id, stream)
    return stream
  }

  close(): void {
    this.closed = true
    if (this.idleTimer) clearInterval(this.idleTimer)
    this.idleTimer = null
    for (const stream of this.streams.values()) stream.cancel()
    this.streams.clear()
    closeSocket(this.ws)
    this.ws = null
    if (this.preconnected) {
      void this.preconnected.then((ws) => closeSocket(ws))
      this.preconnected = null
    }
  }

  /** @internal */
  sendForStream(stream: CartesiaTtsStream, fields: { transcript: string; continue: boolean }): void {
    const { voice } = this.options
    const generation: Record<string, unknown> = {}
    if (voice.speed !== null) generation.speed = voice.speed
    if (voice.volume !== null) generation.volume = voice.volume
    if (voice.emotion) generation.emotion = voice.emotion
    const message: Record<string, unknown> = {
      model_id: voice.tts_model,
      voice: voice.voice_id,
      language: voice.language,
      context_id: stream.id,
      output_format: outputFormat(this.options.format),
      max_buffer_delay_ms: 0,
      add_timestamps: true,
      ...fields,
    }
    if (Object.keys(generation).length > 0) message.generation_config = generation
    if (voice.pronunciation_dict_id) message.pronunciation_dict_id = voice.pronunciation_dict_id
    this.characters += [...fields.transcript].length
    this.sendRaw(message)
  }

  /** @internal */
  sendRaw(message: Record<string, unknown>): void {
    if (this.closed) return
    this.lastActivity = Date.now()
    const text = JSON.stringify(message)
    if (this.ws && safeSend(this.ws, text)) return
    if (this.pending.length >= MAX_PENDING_MESSAGES) {
      this.failAll(new ProviderError({ provider: 'cartesia', component: 'tts', message: 'Cartesia TTS send queue overflow', code: 'queue_overflow' }))
      return
    }
    this.pending.push(text)
    void this.ensureSocket().catch((error: unknown) => {
      this.failAll(
        error instanceof ProviderError
          ? error
          : new ProviderError({ provider: 'cartesia', component: 'tts', message: 'Cartesia TTS reconnect failed', code: 'network_error', cause: error })
      )
    })
  }

  /** @internal A context that failed without audio was never billed. */
  refund(characters: number): void {
    this.characters = Math.max(0, this.characters - characters)
  }

  /** @internal */
  forget(id: string): void {
    this.streams.delete(id)
  }

  /** @internal */
  reportFirstAudio(latencyMs: number): void {
    this.options.onFirstAudio?.(latencyMs)
  }

  private ensureSocket(): Promise<WebSocket> {
    if (this.ws) return Promise.resolve(this.ws)
    if (this.connecting) return this.connecting
    const warm = this.preconnected
    this.preconnected = null
    const open = () =>
      connectWebSocket(ttsSocketUrl(this.options), {
        provider: 'cartesia',
        component: 'tts',
        headers: { 'X-API-Key': this.options.apiKey },
        timeoutMs: this.options.connectTimeoutMs,
      })
    const socket = warm
      ? warm.then((ws) => {
          if (ws && ws.readyState === WebSocket.OPEN) return ws
          closeSocket(ws)
          return open()
        })
      : open()
    this.connecting = socket
      .then((ws) => {
        this.connecting = null
        if (this.closed) {
          closeSocket(ws)
          throw new ProviderError({ provider: 'cartesia', component: 'tts', message: 'TTS closed', code: 'closed' })
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
    this.lastActivity = Date.now()
    ws.on('message', (data, isBinary) => {
      if (isBinary) return
      const msg = parseJsonObject(rawDataToString(data))
      if (!msg) return
      const contextId = typeof msg.context_id === 'string' ? msg.context_id : null
      if (contextId) {
        // Unknown ids are cancelled or finished contexts (including the
        // "Invalid context ID" error a late cancel produces): drop them.
        this.streams.get(contextId)?.handle(msg)
        return
      }
      if (msg.type === 'error') {
        this.options.log.warn('cartesia tts socket error event', { code: msg.error_code, status: msg.status_code })
        this.failAll(
          new ProviderError({
            provider: 'cartesia',
            component: 'tts',
            status: typeof msg.status_code === 'number' ? msg.status_code : null,
            code: typeof msg.error_code === 'string' ? msg.error_code : null,
            message: 'Cartesia TTS error',
            fatal: false,
          })
        )
      }
    })
    ws.on('error', (err) => {
      this.options.log.warn('cartesia tts socket error', { error: err.message })
    })
    ws.on('close', (code) => {
      if (this.ws !== ws) return
      this.ws = null
      if (this.closed) return
      if (this.streams.size > 0) {
        this.failAll(
          new ProviderError({
            provider: 'cartesia',
            component: 'tts',
            message: `Cartesia TTS socket closed (${code})`,
            code: `ws_close_${code}`,
            status: code === 1000 ? null : 503,
          })
        )
      }
    })
    const queued = this.pending.splice(0)
    for (const text of queued) safeSend(ws, text)
  }

  private failAll(error: ProviderError): void {
    this.pending.length = 0
    for (const stream of [...this.streams.values()]) stream.failSocket(error)
    this.streams.clear()
  }

  private checkIdle(): void {
    if (this.closed || !this.ws || this.streams.size > 0) return
    if (Date.now() - this.lastActivity < this.options.idleReconnectMs) return
    // Swap sockets while idle so the next utterance doesn't pay a handshake.
    const old = this.ws
    this.ws = null
    this.lastActivity = Date.now()
    closeSocket(old)
    void this.ensureSocket().catch((error: unknown) => {
      this.options.log.warn('cartesia tts idle reconnect failed', { error: error instanceof Error ? error.message : String(error) })
    })
  }
}
