import type { CallChannel } from '../channels/types'
import { bytesPerSecond, channelFormat } from './codec'

// Tracks how much agent audio the caller has actually heard.
//
// Every write advances a byte offset; a progress mark is sent every ~200 ms of
// audio and at each explicit markEnd(). Mark echoes anchor the playhead, and
// between echoes it is extrapolated at the audio byte rate (capped at what was
// written). Marks are namespaced by an epoch that a clear() bumps, so marks
// Twilio flushes back on `clear` resolve as "cleared" instead of "played".
// The heard position drives barge-in transcripts (what the caller really
// heard) and "act after the reply finished playing" (transfer, hang-up).

const PROGRESS_MARK_MS = 200

export type PlaybackOutcome = 'played' | 'cleared'

interface Waiter {
  epoch: number
  offset: number
  resolve: (outcome: PlaybackOutcome) => void
}

export class PlaybackTracker {
  private readonly bps: number
  private epoch = 0
  private written = 0
  private anchorOffset = 0
  private anchorAt = Date.now()
  private lastProgressMark = 0
  private readonly waiters = new Map<string, Waiter>()
  private seq = 0
  private readonly detach: () => void

  constructor(private readonly channel: CallChannel) {
    this.bps = bytesPerSecond(channelFormat(channel.format))
    this.detach = channel.on('mark', (name) => this.onMark(name))
  }

  /** Total bytes written since the call started. */
  get writtenBytes(): number {
    return this.written
  }

  /** Best estimate of the byte offset the caller has heard up to. */
  playedBytes(now = Date.now()): number {
    const estimate = this.anchorOffset + ((now - this.anchorAt) * this.bps) / 1000
    return Math.min(this.written, Math.max(this.anchorOffset, Math.floor(estimate)))
  }

  /** True when everything written has (by estimate) finished playing. */
  isIdle(now = Date.now()): boolean {
    return this.playedBytes(now) >= this.written
  }

  write(chunk: Buffer): void {
    if (chunk.length === 0) return
    const now = Date.now()
    // Audio written into an empty buffer starts playing now.
    if (this.isIdle(now)) {
      this.anchorOffset = this.written
      this.anchorAt = now
    }
    this.channel.sendAudio(chunk)
    this.written += chunk.length
    if (this.written - this.lastProgressMark >= (this.bps * PROGRESS_MARK_MS) / 1000) {
      this.lastProgressMark = this.written
      this.channel.sendMark(this.markName(this.written))
    }
  }

  /** Resolves when everything written so far has played, or with 'cleared' if a clear() dropped it. */
  markEnd(): Promise<PlaybackOutcome> {
    const offset = this.written
    const name = this.markName(offset)
    return new Promise((resolve) => {
      this.waiters.set(name, { epoch: this.epoch, offset, resolve })
      this.channel.sendMark(name)
    })
  }

  /** Barge-in: drops queued audio on the channel; returns the offset heard up to. */
  clear(): number {
    const heard = this.playedBytes()
    this.channel.clear()
    this.epoch += 1
    // Nothing queued remains: the playhead jumps to the end of what was written.
    this.anchorOffset = this.written
    this.anchorAt = Date.now()
    for (const [name, waiter] of this.waiters) {
      this.waiters.delete(name)
      waiter.resolve('cleared')
    }
    return heard
  }

  /** Seconds of audio that `bytes` represents. */
  seconds(bytes: number): number {
    return bytes / this.bps
  }

  dispose(): void {
    this.detach()
    for (const waiter of this.waiters.values()) waiter.resolve('cleared')
    this.waiters.clear()
  }

  private markName(offset: number): string {
    this.seq += 1
    return `ntv:${this.epoch}:${offset}:${this.seq}`
  }

  private onMark(name: string): void {
    const parts = name.split(':')
    if (parts.length !== 4 || parts[0] !== 'ntv') return
    const epoch = Number(parts[1])
    const offset = Number(parts[2])
    const waiter = this.waiters.get(name)
    if (waiter) this.waiters.delete(name)
    if (epoch !== this.epoch) {
      waiter?.resolve('cleared')
      return
    }
    if (Number.isFinite(offset) && offset >= this.anchorOffset) {
      this.anchorOffset = offset
      this.anchorAt = Date.now()
    }
    waiter?.resolve('played')
  }
}
