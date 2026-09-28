import WebSocket from 'ws'
import type { BrowserServerMessage } from '../contracts'
import type { Logger } from '../log'
import { closeSocket, parseJsonObject, rawDataToString, safeSend } from '../providers/ws'
import { deferred, TypedEmitter } from '../util/emitter'
import type { CallChannel, ChannelEvents } from './types'

// Twilio Media Streams, bidirectional (<Connect><Stream>), cartesia-docs.md §8.1.
// In:  connected, start {streamSid, callSid, customParameters, mediaFormat},
//      media {track, payload base64 μ-law 8 kHz}, dtmf {digit}, mark {name}, stop.
// Out: media {payload}, mark {name}, clear. A clear flushes Twilio's buffer and
//      echoes the pending marks back, which PlaybackTracker treats as "cleared".

export interface TwilioStart {
  streamSid: string
  callSid: string | null
  customParameters: Record<string, string>
}

const SLOW_CONSUMER_BYTES = 1024 * 1024
/**
 * About six minutes of μ-law audio as base64 JSON. A Twilio edge that stopped
 * reading that long ago isn't coming back: close the stream so the call ends
 * (and the app's <Connect action> fallback can answer) instead of buffering on.
 */
export const STALLED_CONSUMER_BYTES = 4 * 1024 * 1024

export class TwilioChannel extends TypedEmitter<ChannelEvents> implements CallChannel {
  readonly kind = 'twilio' as const
  readonly format = 'mulaw_8000' as const
  private streamSid: string | null = null
  private closedFired = false
  private warnedSlow = false
  failed = false
  private readonly startDeferred = deferred<TwilioStart | null>()

  constructor(
    private readonly ws: WebSocket,
    private readonly log: Logger
  ) {
    super()
    ws.on('message', (data, isBinary) => {
      if (isBinary) return
      const msg = parseJsonObject(rawDataToString(data))
      if (msg) this.handle(msg)
    })
    ws.on('error', (err) => this.log.warn('twilio socket error', { error: err.message }))
    ws.on('close', (code) => {
      this.startDeferred.resolve(null)
      if (this.closedFired) return
      this.closedFired = true
      this.emit('closed', code)
    })
  }

  get isOpen(): boolean {
    return this.ws.readyState === WebSocket.OPEN
  }

  /** Resolves with the start payload, or null if the socket closed or the timeout passed first. */
  waitForStart(timeoutMs: number): Promise<TwilioStart | null> {
    const timer = setTimeout(() => this.startDeferred.resolve(null), timeoutMs)
    timer.unref()
    return this.startDeferred.promise.finally(() => clearTimeout(timer))
  }

  sendAudio(chunk: Buffer): void {
    if (!this.streamSid || chunk.length === 0) return
    if (this.failed) return
    this.send({ event: 'media', streamSid: this.streamSid, media: { payload: chunk.toString('base64') } })
    const buffered = this.ws.bufferedAmount
    if (!this.warnedSlow && buffered > SLOW_CONSUMER_BYTES) {
      this.warnedSlow = true
      this.log.warn('twilio socket is not draining outbound audio', { buffered_bytes: buffered })
    }
    if (buffered > STALLED_CONSUMER_BYTES) {
      this.failed = true
      this.log.error('twilio socket stalled; closing the stream', { buffered_bytes: buffered })
      closeSocket(this.ws, 1011, 'stalled', 500)
    }
  }

  sendMark(name: string): void {
    if (!this.streamSid) return
    this.send({ event: 'mark', streamSid: this.streamSid, mark: { name } })
  }

  clear(): void {
    if (!this.streamSid) return
    this.send({ event: 'clear', streamSid: this.streamSid })
  }

  notify(_message: BrowserServerMessage): void {}

  close(code = 1000, reason = ''): void {
    closeSocket(this.ws, code, reason)
  }

  private send(message: Record<string, unknown>): void {
    safeSend(this.ws, JSON.stringify(message))
  }

  private handle(msg: Record<string, unknown>): void {
    switch (msg.event) {
      case 'connected':
        return
      case 'start': {
        const start = msg.start as Record<string, unknown> | undefined
        const streamSid = typeof start?.streamSid === 'string' ? start.streamSid : typeof msg.streamSid === 'string' ? msg.streamSid : null
        if (!start || !streamSid) {
          this.log.warn('twilio start without streamSid')
          return
        }
        const format = start.mediaFormat as Record<string, unknown> | undefined
        if (format && (format.encoding !== 'audio/x-mulaw' || Number(format.sampleRate) !== 8000)) {
          this.log.error('unexpected twilio media format', { encoding: format.encoding, sample_rate: format.sampleRate })
        }
        this.streamSid = streamSid
        const params: Record<string, string> = {}
        if (start.customParameters && typeof start.customParameters === 'object') {
          for (const [k, v] of Object.entries(start.customParameters as Record<string, unknown>)) {
            if (typeof v === 'string') params[k] = v
          }
        }
        this.startDeferred.resolve({ streamSid, callSid: typeof start.callSid === 'string' ? start.callSid : null, customParameters: params })
        return
      }
      case 'media': {
        const media = msg.media as Record<string, unknown> | undefined
        if (!media || typeof media.payload !== 'string') return
        if (media.track !== undefined && media.track !== 'inbound' && media.track !== 'inbound_track') return
        this.emit('audio', Buffer.from(media.payload, 'base64'))
        return
      }
      case 'dtmf': {
        const digit = (msg.dtmf as Record<string, unknown> | undefined)?.digit
        if (typeof digit === 'string' && /^[0-9*#]$/.test(digit)) this.emit('dtmf', digit)
        return
      }
      case 'mark': {
        const name = (msg.mark as Record<string, unknown> | undefined)?.name
        if (typeof name === 'string') this.emit('mark', name)
        return
      }
      case 'stop':
        this.emit('stop')
        return
      default:
        return
    }
  }
}
