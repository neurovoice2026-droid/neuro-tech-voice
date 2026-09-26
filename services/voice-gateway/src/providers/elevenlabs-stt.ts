import WebSocket from 'ws'
import { bytesForMs, bytesPerSecond, channelFormat, Framer, type ChannelAudioFormat } from '../audio/codec'
import { PacedSender } from '../audio/pacer'
import type { Logger } from '../log'
import { TypedEmitter } from '../util/emitter'
import { ProviderError } from './errors'
import type { SttEvents, SttStream } from './stt'
import { closeSocket, connectWebSocket, parseJsonObject, rawDataToString, safeSend } from './ws'

// ElevenLabs Scribe v2 Realtime as the STT component fallback
// (elevenlabs-fallback.md §2.5): VAD commit strategy, base64 audio chunks,
// partial_transcript → turn start/update, committed_transcript → turn end.
// Errors arrive as a message before the socket closes; session-limit and
// low-activity closes are not failures and reconnect transparently.

const MODEL = 'scribe_v2_realtime'
const FRAME_MS = 100
const RECONNECT_CODES = new Set(['session_time_limit_exceeded', 'insufficient_audio_activity'])
const ERROR_TYPES = new Set([
  'auth_error',
  'quota_exceeded',
  'transcriber_error',
  'input_error',
  'invalid_request',
  'error',
  'commit_throttled',
  'unaccepted_terms',
  'rate_limited',
  'queue_overflow',
  'resource_exhausted',
  'session_time_limit_exceeded',
  'chunk_size_exceeded',
  'insufficient_audio_activity',
])

export interface ElevenLabsSttOptions {
  apiKey: string
  wsBase: string
  language: string
  format: ChannelAudioFormat
  connectTimeoutMs: number
  maxAudioLagMs: number
  log: Logger
}

export class ElevenLabsStt extends TypedEmitter<SttEvents> implements SttStream {
  readonly provider = 'elevenlabs' as const
  readonly model = MODEL
  private ws: WebSocket | null = null
  private closing = false
  private failed = false
  private inTurn = false
  private reconnecting = false
  private readonly framer: Framer
  private readonly sender: PacedSender
  private readonly sampleRate: number

  constructor(private readonly options: ElevenLabsSttOptions) {
    super()
    const format = channelFormat(options.format)
    this.sampleRate = format.sampleRate
    this.framer = new Framer(bytesForMs(format, FRAME_MS))
    this.sender = new PacedSender({
      bytesPerSecond: bytesPerSecond(format),
      burstBytes: bytesForMs(format, FRAME_MS * 2),
      maxQueueBytes: bytesForMs(format, options.maxAudioLagMs),
      // The 2 s replay after a switch catches up with live audio within ~2 s.
      catchUpRate: 2,
      send: (frame) => this.sendFrame(frame),
    })
  }

  get audioSeconds(): number {
    return this.sender.sentBytes / bytesPerSecond(channelFormat(this.options.format))
  }

  async connect(): Promise<void> {
    const params = new URLSearchParams({
      model_id: MODEL,
      audio_format: this.options.format === 'mulaw_8000' ? 'ulaw_8000' : 'pcm_16000',
      language_code: this.options.language,
      commit_strategy: 'vad',
    })
    const ws = await connectWebSocket(`${this.options.wsBase}/v1/speech-to-text/realtime?${params}`, {
      provider: 'elevenlabs',
      component: 'stt',
      headers: { 'xi-api-key': this.options.apiKey },
      timeoutMs: this.options.connectTimeoutMs,
    })
    this.attach(ws)
  }

  sendAudio(chunk: Buffer): void {
    if (this.closing || this.failed || chunk.length === 0) return
    for (const frame of this.framer.push(chunk)) this.sender.enqueue(frame)
  }

  async close(): Promise<void> {
    if (this.closing) return
    this.closing = true
    this.sender.stop()
    const ws = this.ws
    this.ws = null
    if (!ws) return
    closeSocket(ws, 1000, '', 1_000)
  }

  private attach(ws: WebSocket): void {
    this.ws = ws
    ws.on('message', (data, isBinary) => {
      if (isBinary) return
      const msg = parseJsonObject(rawDataToString(data))
      if (msg) this.handle(msg)
    })
    ws.on('error', (err) => this.options.log.warn('elevenlabs stt socket error', { error: err.message }))
    ws.on('close', (code) => {
      if (this.ws !== ws) return
      this.ws = null
      if (this.closing || this.failed || this.reconnecting) return
      this.fail(
        new ProviderError({
          provider: 'elevenlabs',
          component: 'stt',
          message: `ElevenLabs STT socket closed unexpectedly (${code})`,
          code: `ws_close_${code}`,
          status: 503,
        })
      )
    })
  }

  private handle(msg: Record<string, unknown>): void {
    const type = typeof msg.message_type === 'string' ? msg.message_type : typeof msg.type === 'string' ? msg.type : ''
    const text = typeof msg.text === 'string' ? msg.text.trim() : ''
    if (type === 'session_started') return
    if (type === 'partial_transcript') {
      if (!text) return
      if (!this.inTurn) {
        this.inTurn = true
        this.emit('turn_start')
      }
      this.emit('turn_update', text)
      return
    }
    if (type === 'committed_transcript') {
      if (!text && !this.inTurn) return
      if (!this.inTurn) this.emit('turn_start')
      this.inTurn = false
      this.emit('turn_end', text)
      return
    }
    if (ERROR_TYPES.has(type)) {
      if (RECONNECT_CODES.has(type)) {
        void this.reconnect(type)
        return
      }
      this.fail(
        new ProviderError({
          provider: 'elevenlabs',
          component: 'stt',
          code: type,
          status: type === 'auth_error' ? 401 : type === 'rate_limited' ? 429 : type === 'quota_exceeded' ? 402 : null,
          message: `ElevenLabs STT error: ${type}`,
        })
      )
    }
  }

  private async reconnect(reason: string): Promise<void> {
    if (this.reconnecting || this.closing) return
    this.reconnecting = true
    this.options.log.info('elevenlabs stt session renewed', { reason })
    const old = this.ws
    this.ws = null
    closeSocket(old)
    try {
      await this.connect()
    } catch (error) {
      this.fail(
        error instanceof ProviderError
          ? error
          : new ProviderError({ provider: 'elevenlabs', component: 'stt', message: 'ElevenLabs STT reconnect failed', code: 'network_error' })
      )
    } finally {
      this.reconnecting = false
    }
  }

  private sendFrame(frame: Buffer): boolean {
    const ws = this.ws
    if (!ws || ws.readyState !== WebSocket.OPEN) return false
    if (ws.bufferedAmount > (bytesPerSecond(channelFormat(this.options.format)) * this.options.maxAudioLagMs) / 1000) return false
    return safeSend(
      ws,
      JSON.stringify({ message_type: 'input_audio_chunk', audio_base_64: frame.toString('base64'), commit: false, sample_rate: this.sampleRate })
    )
  }

  private fail(error: ProviderError): void {
    if (this.failed || this.closing) return
    this.failed = true
    this.sender.stop()
    closeSocket(this.ws)
    this.ws = null
    this.emit('error', error)
  }
}
