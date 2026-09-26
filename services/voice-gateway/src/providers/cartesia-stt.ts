import WebSocket from 'ws'
import type { SttConfig } from '../contracts'
import { bytesForMs, bytesPerSecond, channelFormat, decodeToSamples, Framer, type ChannelAudioFormat } from '../audio/codec'
import { PacedSender } from '../audio/pacer'
import { EnergyVad } from '../audio/vad'
import type { Logger } from '../log'
import { TypedEmitter } from '../util/emitter'
import { ProviderError } from './errors'
import type { SttEvents, SttStream } from './stt'
import { closeSocket, connectWebSocket, parseJsonObject, rawDataToString, safeSend } from './ws'

// Cartesia Ink realtime STT (cartesia-docs.md §3.2–3.4, live captures 08/09):
//   turns  (ink-2, ink-preview): /stt/turns/websocket, native turn events that
//          all carry turn_id; transcript is cumulative within a turn; close
//          with the JSON {"type":"close"}
//   manual (ink-whisper):        /stt/websocket, no interim transcripts; our
//          energy VAD detects speech, text `finalize` after the silence
//          window, the turn text is the concatenated is_final deltas until
//          flush_done; close with the text `close`
// Both get continuous, real-time paced 100 ms frames.

const FRAME_MS = 100
const FINALIZE_TIMEOUT_MS = 3_000

export interface CartesiaSttOptions {
  apiKey: string
  wsBase: string
  version: string
  config: SttConfig
  format: ChannelAudioFormat
  connectTimeoutMs: number
  maxAudioLagMs: number
  /** Manual endpoint: silence after speech before `finalize`. */
  finalizeSilenceMs: number
  log: Logger
}

function encodingParams(format: ChannelAudioFormat): { encoding: string; sample_rate: string } {
  return format === 'mulaw_8000' ? { encoding: 'pcm_mulaw', sample_rate: '8000' } : { encoding: 'pcm_s16le', sample_rate: '16000' }
}

abstract class CartesiaSttBase extends TypedEmitter<SttEvents> implements SttStream {
  readonly provider = 'cartesia' as const
  protected ws: WebSocket | null = null
  protected closing = false
  protected failed = false
  private readonly framer: Framer
  private readonly sender: PacedSender
  private droppedBytes = 0
  private lastDropLog = 0

  constructor(protected readonly options: CartesiaSttOptions) {
    super()
    const format = channelFormat(options.format)
    this.framer = new Framer(bytesForMs(format, FRAME_MS))
    const bps = bytesPerSecond(format)
    this.sender = new PacedSender({
      bytesPerSecond: bps,
      burstBytes: bytesForMs(format, FRAME_MS * 2),
      maxQueueBytes: bytesForMs(format, options.maxAudioLagMs),
      // Cartesia errors on large bursts, so a backlog drains gently (1.5x real time).
      catchUpRate: 1.5,
      send: (frame) => this.sendFrame(frame, bps),
      onDrop: (bytes) => this.noteDrop(bytes),
    })
  }

  get model(): string {
    return this.options.config.model
  }

  get audioSeconds(): number {
    return this.sender.sentBytes / bytesPerSecond(channelFormat(this.options.format))
  }

  protected abstract url(): string

  async connect(): Promise<void> {
    const ws = await connectWebSocket(this.url(), {
      provider: 'cartesia',
      component: 'stt',
      headers: { 'X-API-Key': this.options.apiKey },
      timeoutMs: this.options.connectTimeoutMs,
    })
    this.ws = ws
    ws.on('message', (data, isBinary) => {
      if (isBinary) return
      const msg = parseJsonObject(rawDataToString(data))
      if (msg) this.handle(msg)
    })
    ws.on('error', (err) => this.options.log.warn('cartesia stt socket error', { error: err.message }))
    ws.on('close', (code) => {
      this.ws = null
      this.sender.stop()
      if (this.closing || this.failed) return
      this.fail(
        new ProviderError({
          provider: 'cartesia',
          component: 'stt',
          message: `Cartesia STT socket closed unexpectedly (${code})`,
          code: `ws_close_${code}`,
          status: code === 1008 ? 400 : 503,
        })
      )
    })
  }

  sendAudio(chunk: Buffer): void {
    if (this.closing || this.failed || chunk.length === 0) return
    this.onAudio(chunk)
    for (const frame of this.framer.push(chunk)) this.sender.enqueue(frame)
  }

  async close(): Promise<void> {
    if (this.closing) return
    this.closing = true
    this.sender.stop()
    const ws = this.ws
    if (!ws) return
    this.sendClose(ws)
    await new Promise<void>((resolve) => {
      if (ws.readyState === WebSocket.CLOSED) return resolve()
      const timer = setTimeout(() => {
        closeSocket(ws)
        resolve()
      }, 2_000)
      timer.unref()
      ws.once('close', () => {
        clearTimeout(timer)
        resolve()
      })
    })
  }

  protected abstract sendClose(ws: WebSocket): void
  protected abstract handle(msg: Record<string, unknown>): void
  protected onAudio(_chunk: Buffer): void {}

  protected fail(error: ProviderError): void {
    if (this.failed || this.closing) return
    this.failed = true
    this.sender.stop()
    closeSocket(this.ws)
    this.emit('error', error)
  }

  protected errorFrom(msg: Record<string, unknown>): ProviderError {
    return new ProviderError({
      provider: 'cartesia',
      component: 'stt',
      status: typeof msg.status_code === 'number' ? msg.status_code : null,
      code: typeof msg.error_code === 'string' ? msg.error_code : null,
      message: `Cartesia STT error${typeof msg.title === 'string' ? `: ${msg.title}` : ''}`,
    })
  }

  private sendFrame(frame: Buffer, bps: number): boolean {
    const ws = this.ws
    if (!ws || ws.readyState !== WebSocket.OPEN) return false
    // Provider stalled: more than the lag budget is already queued in the socket.
    if (ws.bufferedAmount > (bps * this.options.maxAudioLagMs) / 1000) return false
    try {
      ws.send(frame, { binary: true })
      return true
    } catch {
      return false
    }
  }

  private noteDrop(bytes: number): void {
    this.droppedBytes += bytes
    const now = Date.now()
    if (now - this.lastDropLog > 5_000) {
      this.lastDropLog = now
      this.options.log.warn('cartesia stt dropping audio (provider stalled or not connected)', { dropped_bytes: this.droppedBytes })
    }
  }
}

/** ink-2 / ink-preview with native turn detection. */
export class CartesiaTurnsStt extends CartesiaSttBase {
  private inTurn = false

  protected url(): string {
    const { config } = this.options
    const params = new URLSearchParams({
      model: config.model,
      ...encodingParams(this.options.format),
      cartesia_version: this.options.version,
    })
    if (config.turn) {
      params.set('turn_start_threshold', String(config.turn.start_threshold))
      params.set('turn_eager_end_threshold', String(config.turn.eager_end_threshold))
      params.set('turn_end_threshold', String(config.turn.end_threshold))
      params.set('turn_end_timeout_ms', String(config.turn.end_timeout_ms))
    }
    // URLSearchParams writes a space as '+'; Cartesia documents multi-word
    // keyterms joined with %20 ("keyterm=Ink%202"), so they are encoded by hand.
    const keyterms = config.keyterms.map((term) => `&keyterm=${encodeURIComponent(term)}`).join('')
    return `${this.options.wsBase}/stt/turns/websocket?${params}${keyterms}`
  }

  protected sendClose(ws: WebSocket): void {
    safeSend(ws, JSON.stringify({ type: 'close' }))
  }

  protected handle(msg: Record<string, unknown>): void {
    const transcript = typeof msg.transcript === 'string' ? msg.transcript : ''
    switch (msg.type) {
      case 'connected':
        return
      case 'turn.start':
        this.inTurn = true
        this.emit('turn_start')
        return
      case 'turn.update':
        if (!this.inTurn) {
          this.inTurn = true
          this.emit('turn_start')
        }
        this.emit('turn_update', transcript)
        return
      case 'turn.eager_end':
        this.emit('eager_end', transcript)
        return
      case 'turn.resume':
        this.emit('resume')
        return
      case 'turn.end':
        this.inTurn = false
        this.emit('turn_end', transcript)
        return
      case 'error':
        this.fail(this.errorFrom(msg))
        return
      default:
        return
    }
  }
}

/** ink-whisper on the manual endpoint, with gateway VAD deciding turns. */
export class CartesiaManualStt extends CartesiaSttBase {
  private readonly vad: EnergyVad
  private inTurn = false
  private finalizing = false
  private turnText = ''
  private finalizeTimer: NodeJS.Timeout | null = null

  constructor(options: CartesiaSttOptions) {
    super(options)
    const format = channelFormat(options.format)
    this.vad = new EnergyVad(format.sampleRate, { hangoverMs: options.finalizeSilenceMs })
  }

  protected url(): string {
    const { config } = this.options
    const params = new URLSearchParams({
      model: config.model,
      language: config.language,
      ...encodingParams(this.options.format),
      cartesia_version: this.options.version,
    })
    if (config.manual) {
      params.set('min_volume', String(config.manual.min_volume))
      params.set('max_silence_duration_secs', String(config.manual.max_silence_duration_secs))
    }
    return `${this.options.wsBase}/stt/websocket?${params}`
  }

  protected sendClose(ws: WebSocket): void {
    if (this.finalizeTimer) clearTimeout(this.finalizeTimer)
    safeSend(ws, 'close')
  }

  protected override onAudio(chunk: Buffer): void {
    const samples = decodeToSamples(chunk, channelFormat(this.options.format).encoding)
    for (const event of this.vad.process(samples)) {
      if (event.type === 'speech_start') {
        if (!this.inTurn) {
          this.inTurn = true
          this.turnText = ''
          this.emit('turn_start')
        }
      } else if (this.inTurn) {
        this.requestFinalize()
      }
    }
  }

  protected handle(msg: Record<string, unknown>): void {
    switch (msg.type) {
      case 'transcript': {
        if (msg.is_final !== true || typeof msg.text !== 'string' || msg.text === '') return
        if (!this.inTurn) {
          // Whisper heard speech the VAD didn't (quiet caller): open the turn now.
          this.inTurn = true
          this.turnText = ''
          this.emit('turn_start')
          if (!this.vad.isSpeaking) this.requestFinalize()
        }
        this.turnText += msg.text
        this.emit('turn_update', this.turnText.trim())
        return
      }
      case 'flush_done':
        this.completeTurn()
        return
      case 'done':
        return
      case 'error':
        this.fail(this.errorFrom(msg))
        return
      default:
        return
    }
  }

  private requestFinalize(): void {
    if (this.finalizing || !this.ws) return
    this.finalizing = true
    // Sending finalize mid-speech makes Cartesia error, so only the VAD's
    // end-of-speech (or a transcript during silence) gets here.
    safeSend(this.ws, 'finalize')
    this.finalizeTimer = setTimeout(() => {
      this.options.log.warn('cartesia stt flush_done not received in time; closing the turn with what we have')
      this.completeTurn()
    }, FINALIZE_TIMEOUT_MS)
    this.finalizeTimer.unref()
  }

  private completeTurn(): void {
    if (this.finalizeTimer) clearTimeout(this.finalizeTimer)
    this.finalizeTimer = null
    if (!this.inTurn && !this.finalizing) return
    const text = this.turnText.trim()
    this.inTurn = false
    this.finalizing = false
    this.turnText = ''
    this.emit('turn_end', text)
    // Speech resumed while we were finalizing: the next turn starts right away.
    if (this.vad.isSpeaking) {
      this.inTurn = true
      this.emit('turn_start')
    }
  }
}

export function createCartesiaStt(options: CartesiaSttOptions): SttStream {
  return options.config.endpoint === 'turns' ? new CartesiaTurnsStt(options) : new CartesiaManualStt(options)
}
