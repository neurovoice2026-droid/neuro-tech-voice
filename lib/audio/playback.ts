// Gapless playback of the agent's PCM16 16 kHz audio in the browser. Each
// binary chunk from the gateway becomes an AudioBuffer scheduled to start
// exactly where the previous one ends, so chunk boundaries never click or
// drift; `clear` (the caller interrupted) stops everything already queued.
// The context's own rate doesn't matter: Web Audio resamples a 16 kHz buffer.

import { BROWSER_SAMPLE_RATE } from '@/lib/voice/contracts'
import { createPcm16Decoder } from './pcm'

/** The subset of BaseAudioContext the player needs (a fake one in tests). */
export type PlayerContext = Pick<BaseAudioContext, 'currentTime' | 'createBuffer' | 'createBufferSource'>

export interface PcmPlayerOptions {
  /** Where audio goes: the context destination, or an analyser in front of it. */
  output: AudioNode
  sampleRate?: number
  /** Headroom before the first chunk after silence, so it isn't scheduled in the past. */
  leadSeconds?: number
}

/**
 * When the next chunk should start: right after the queued audio while
 * something is still playing (gapless), otherwise a short lead from now.
 */
export function scheduleStartTime(now: number, queueEnd: number, leadSeconds: number): number {
  return queueEnd > now ? queueEnd : now + leadSeconds
}

export class PcmPlayer {
  private readonly decoder = createPcm16Decoder()
  private readonly sources = new Set<AudioBufferSourceNode>()
  private readonly sampleRate: number
  private readonly leadSeconds: number
  private queueEnd = 0
  private closed = false

  constructor(
    private readonly context: PlayerContext,
    private readonly options: PcmPlayerOptions
  ) {
    this.sampleRate = options.sampleRate ?? BROWSER_SAMPLE_RATE
    this.leadSeconds = options.leadSeconds ?? 0.05
  }

  enqueue(chunk: ArrayBuffer | Uint8Array): void {
    if (this.closed) return
    const samples = this.decoder.decode(chunk)
    if (samples.length === 0) return

    const buffer = this.context.createBuffer(1, samples.length, this.sampleRate)
    buffer.getChannelData(0).set(samples)
    const source = this.context.createBufferSource()
    source.buffer = buffer
    source.connect(this.options.output)
    source.onended = () => {
      this.sources.delete(source)
      source.disconnect()
    }

    const startAt = scheduleStartTime(this.context.currentTime, this.queueEnd, this.leadSeconds)
    source.start(startAt)
    this.sources.add(source)
    this.queueEnd = startAt + buffer.duration
  }

  /** Stops queued and playing audio at once (barge-in). */
  clear(): void {
    // stop() only throws for a source that was never started; every source
    // here was started before it was added.
    for (const source of this.sources) source.stop()
    this.sources.clear()
    this.queueEnd = 0
    // A half sample from the interrupted stream must not shift the next one.
    this.decoder.reset()
  }

  /** True while agent audio is playing or queued. */
  isPlaying(): boolean {
    return this.queueEnd > this.context.currentTime
  }

  /** Seconds of agent audio still to play. */
  bufferedSeconds(): number {
    return Math.max(0, this.queueEnd - this.context.currentTime)
  }

  close(): void {
    this.clear()
    this.closed = true
  }
}
