// ─── Voice activity detection ────────────────────────────────────────────────
// Decides when the caller started talking and, more importantly, when they
// stopped — that second decision is what triggers the agent to reply, so its
// tuning is the single biggest lever on perceived responsiveness.
//
// This is energy-based rather than a neural VAD (Silero et al.) on purpose:
// it runs in microseconds per frame with no model to load, which matters when
// one process handles many concurrent calls. The tradeoff is that it cannot
// distinguish speech from steady background noise, so the noise floor is
// tracked adaptively below instead of being a fixed constant.

/** Telnyx sends 20ms frames; at 8kHz that is 160 samples. */
export const FRAME_MS = 20
export const SAMPLE_RATE = 8000

export interface VADConfig {
  /**
   * How much louder than the ambient floor a frame must be to count as
   * speech. 2.5× is deliberately forgiving — a missed word start is far more
   * damaging to the conversation than a slightly late endpoint.
   */
  speechThresholdRatio: number
  /** Consecutive speech frames before declaring speech started (debounce). */
  speechFrames: number
  /**
   * Silence before declaring the turn over. 700ms is the compromise: below
   * ~500ms the agent interrupts people who pause mid-sentence, above ~900ms
   * the conversation feels sluggish.
   */
  silenceMs: number
  /** Absolute floor so pure digital silence never reads as speech. */
  minRms: number
}

export const DEFAULT_VAD: VADConfig = {
  speechThresholdRatio: 2.5,
  speechFrames: 2,
  silenceMs: 700,
  minRms: 180,
}

export type VADEvent = 'speech-start' | 'speech-end' | null

export class VAD {
  private noiseFloor = 300
  private speechRun = 0
  private silenceRun = 0
  private inSpeech = false

  constructor(private cfg: VADConfig = DEFAULT_VAD) {}

  private get silenceFrames(): number {
    return Math.ceil(this.cfg.silenceMs / FRAME_MS)
  }

  /**
   * Feed one frame of 16-bit PCM. Returns a transition event, or null when
   * nothing changed.
   */
  push(pcm: Buffer): VADEvent {
    const rms = rootMeanSquare(pcm)
    const isSpeech = rms > this.cfg.minRms && rms > this.noiseFloor * this.cfg.speechThresholdRatio

    if (isSpeech) {
      this.speechRun++
      this.silenceRun = 0
    } else {
      this.silenceRun++
      this.speechRun = 0
      // Adapt the floor only on non-speech frames, and only slowly. Adapting
      // during speech would let a long utterance raise the floor until the
      // speaker's own voice stops registering.
      this.noiseFloor = this.noiseFloor * 0.95 + rms * 0.05
    }

    if (!this.inSpeech && this.speechRun >= this.cfg.speechFrames) {
      this.inSpeech = true
      return 'speech-start'
    }

    if (this.inSpeech && this.silenceRun >= this.silenceFrames) {
      this.inSpeech = false
      return 'speech-end'
    }

    return null
  }

  get active(): boolean {
    return this.inSpeech
  }

  reset() {
    this.speechRun = 0
    this.silenceRun = 0
    this.inSpeech = false
  }
}

function rootMeanSquare(pcm: Buffer): number {
  if (pcm.length < 2) return 0
  let sum = 0
  const n = pcm.length >> 1
  for (let i = 0; i < pcm.length - 1; i += 2) {
    const s = pcm.readInt16LE(i)
    sum += s * s
  }
  return Math.sqrt(sum / n)
}
