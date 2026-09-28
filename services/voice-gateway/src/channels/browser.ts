import WebSocket from 'ws'
import type { BrowserServerMessage } from '../contracts'
import type { Logger } from '../log'
import { closeSocket, parseJsonObject, rawDataToBuffer, rawDataToString, safeSend } from '../providers/ws'
import { TypedEmitter } from '../util/emitter'
import type { CallChannel, ChannelEvents } from './types'

// Dashboard test call: binary frames of PCM16 LE 16 kHz mono in both
// directions, JSON control messages from lib/voice/contracts.ts.
// The browser gives no playback feedback, so marks are simulated from the
// audio we queued: a mark fires when the audio sent before it has had time to
// play. A clear cancels the pending ones.

const BYTES_PER_SECOND = 32_000
/** Largest single inbound frame (1 s). Real clients send 20–100 ms. */
const MAX_FRAME_BYTES = BYTES_PER_SECOND
/** Inbound audio faster than real time is capped (2× with a 1 s burst). */
const INBOUND_RATE = BYTES_PER_SECOND * 2
const INBOUND_BURST = BYTES_PER_SECOND

export class BrowserChannel extends TypedEmitter<ChannelEvents> implements CallChannel {
  readonly kind = 'browser' as const
  readonly format = 'pcm_16000' as const
  private playheadEnd = 0
  private readonly markTimers = new Set<NodeJS.Timeout>()
  private closedFired = false
  private tokens = INBOUND_BURST
  private lastRefill = Date.now()
  private droppedFrames = 0
  private outCarry: Buffer | null = null

  constructor(
    private readonly ws: WebSocket,
    private readonly log: Logger
  ) {
    super()
    ws.on('message', (data, isBinary) => {
      if (isBinary) this.handleAudio(rawDataToBuffer(data))
      else this.handleControl(rawDataToString(data))
    })
    ws.on('error', (err) => this.log.warn('browser socket error', { error: err.message }))
    ws.on('close', (code) => {
      this.cancelMarks()
      if (this.closedFired) return
      this.closedFired = true
      this.emit('closed', code)
    })
  }

  get isOpen(): boolean {
    return this.ws.readyState === WebSocket.OPEN
  }

  sendAudio(chunk: Buffer): void {
    if (chunk.length === 0 || !this.isOpen) return
    // The client reads each binary frame as whole Int16 samples: never send a
    // dangling byte (a provider chunk split mid-sample), carry it to the next frame.
    let frame = chunk
    if (this.outCarry) {
      frame = Buffer.concat([this.outCarry, chunk])
      this.outCarry = null
    }
    if (frame.length % 2 === 1) {
      this.outCarry = Buffer.from(frame.subarray(frame.length - 1))
      frame = frame.subarray(0, frame.length - 1)
    }
    if (frame.length === 0) return
    const now = Date.now()
    this.playheadEnd = Math.max(now, this.playheadEnd) + (frame.length / BYTES_PER_SECOND) * 1000
    safeSend(this.ws, frame)
  }

  sendMark(name: string): void {
    const wait = Math.max(0, this.playheadEnd - Date.now())
    const timer = setTimeout(() => {
      this.markTimers.delete(timer)
      this.emit('mark', name)
    }, wait)
    timer.unref()
    this.markTimers.add(timer)
  }

  clear(): void {
    this.cancelMarks()
    this.outCarry = null
    this.playheadEnd = 0
    this.notify({ type: 'clear' })
  }

  notify(message: BrowserServerMessage): void {
    safeSend(this.ws, JSON.stringify(message))
  }

  close(code = 1000, reason = ''): void {
    this.cancelMarks()
    closeSocket(this.ws, code, reason)
  }

  private cancelMarks(): void {
    for (const timer of this.markTimers) clearTimeout(timer)
    this.markTimers.clear()
  }

  private handleAudio(frame: Buffer): void {
    if (frame.length === 0 || frame.length % 2 !== 0 || frame.length > MAX_FRAME_BYTES) {
      this.dropFrame('invalid frame size')
      return
    }
    const now = Date.now()
    this.tokens = Math.min(INBOUND_BURST, this.tokens + ((now - this.lastRefill) * INBOUND_RATE) / 1000)
    this.lastRefill = now
    if (this.tokens < frame.length) {
      this.dropFrame('faster than real time')
      return
    }
    this.tokens -= frame.length
    this.emit('audio', frame)
  }

  private dropFrame(reason: string): void {
    this.droppedFrames += 1
    if (this.droppedFrames === 1 || this.droppedFrames % 500 === 0) {
      this.log.warn('browser audio frame dropped', { reason, dropped: this.droppedFrames })
    }
  }

  private handleControl(text: string): void {
    const msg = parseJsonObject(text)
    if (msg?.type === 'hangup') this.emit('stop')
  }
}
