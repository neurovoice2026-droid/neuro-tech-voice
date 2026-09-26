// Energy voice-activity detector for the paths without native turn events:
// Cartesia ink-whisper (manual endpoint, no interim transcripts) needs it for
// barge-in and for deciding when to send `finalize`; the outbound voicemail
// heuristic uses it to measure how long the first utterance runs.
//
// Frame energy is compared with an adaptive noise floor, so a noisy line
// doesn't read as permanent speech. Speech starts after `startMs` of voiced
// frames and ends after `hangoverMs` of unvoiced ones.

import { rms } from './codec'

export interface VadOptions {
  /** Absolute RMS (0…1) a frame must exceed to count as voiced. */
  minRms: number
  /** A voiced frame must also be this many times above the noise floor. */
  noiseFactor: number
  /** Continuous voiced time before speech_start fires. */
  startMs: number
  /** Continuous unvoiced time after speech before speech_end fires. */
  hangoverMs: number
}

export const DEFAULT_VAD_OPTIONS: VadOptions = {
  // Phone speech sits around 0.03–0.2 RMS; line hiss well under 0.01.
  minRms: 0.02,
  noiseFactor: 3,
  startMs: 180,
  hangoverMs: 700,
}

export type VadEvent =
  | { type: 'speech_start'; atMs: number }
  | { type: 'speech_end'; atMs: number; speechMs: number }

export class EnergyVad {
  private readonly options: VadOptions
  private noiseFloor = 0.003
  private voicedMs = 0
  private unvoicedMs = 0
  private speaking = false
  private speechStartedAt = 0
  private clockMs = 0

  constructor(
    private readonly sampleRate: number,
    options: Partial<VadOptions> = {}
  ) {
    this.options = { ...DEFAULT_VAD_OPTIONS, ...options }
  }

  get isSpeaking(): boolean {
    return this.speaking
  }

  /** Feed PCM16 samples (any chunk size); returns the transitions they caused. */
  process(samples: Int16Array): VadEvent[] {
    const events: VadEvent[] = []
    // 20 ms analysis frames regardless of how the caller chunks audio.
    const frame = Math.max(1, Math.round(this.sampleRate * 0.02))
    for (let offset = 0; offset < samples.length; offset += frame) {
      const slice = samples.subarray(offset, Math.min(samples.length, offset + frame))
      const ms = (slice.length / this.sampleRate) * 1000
      const level = rms(slice)
      const voiced = level >= this.options.minRms && level >= this.noiseFloor * this.options.noiseFactor
      this.clockMs += ms

      if (!voiced) {
        // Track the floor on unvoiced frames only; fall fast, rise slowly.
        this.noiseFloor = level < this.noiseFloor ? this.noiseFloor * 0.9 + level * 0.1 : this.noiseFloor * 0.995 + level * 0.005
        this.noiseFloor = Math.max(0.0005, Math.min(this.noiseFloor, this.options.minRms))
      }

      if (voiced) {
        this.voicedMs += ms
        this.unvoicedMs = 0
        if (!this.speaking && this.voicedMs >= this.options.startMs) {
          this.speaking = true
          this.speechStartedAt = this.clockMs - this.voicedMs
          events.push({ type: 'speech_start', atMs: this.speechStartedAt })
        }
      } else {
        this.unvoicedMs += ms
        if (!this.speaking) this.voicedMs = 0
        if (this.speaking && this.unvoicedMs >= this.options.hangoverMs) {
          this.speaking = false
          this.voicedMs = 0
          const endAt = this.clockMs - this.unvoicedMs
          events.push({ type: 'speech_end', atMs: endAt, speechMs: Math.max(0, endAt - this.speechStartedAt) })
        }
      }
    }
    return events
  }

  reset(): void {
    this.voicedMs = 0
    this.unvoicedMs = 0
    this.speaking = false
  }
}
