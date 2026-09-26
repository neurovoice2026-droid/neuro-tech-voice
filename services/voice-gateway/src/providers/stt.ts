import type { TypedEmitter } from '../util/emitter'
import type { ProviderError } from './errors'

/**
 * Turn events every STT adapter emits, whatever the provider does natively:
 * Cartesia turns endpoint maps 1:1; Cartesia manual (ink-whisper) derives them
 * from our VAD + finalize/flush_done; ElevenLabs Scribe from partial/committed
 * transcripts. Every turn starts with turn_start; eager_end is always followed
 * by turn_end or resume.
 */
export type SttEvents = {
  turn_start: () => void
  /** Cumulative transcript of the current turn so far. */
  turn_update: (transcript: string) => void
  /** Likely end of turn: a speculative LLM run may start. */
  eager_end: (transcript: string) => void
  /** The caller kept talking after eager_end. */
  resume: () => void
  /** Final transcript of the turn (may be empty for noise). */
  turn_end: (transcript: string) => void
  error: (error: ProviderError) => void
}

export interface SttStream extends TypedEmitter<SttEvents> {
  readonly provider: 'cartesia' | 'elevenlabs'
  /** Billing model name (ink-2, ink-preview, ink-whisper, scribe_v2_realtime). */
  readonly model: string
  connect(): Promise<void>
  /** Channel-format audio of any chunk size, in real time. */
  sendAudio(chunk: Buffer): void
  /** Drain and close; resolves when the provider closed or after a grace period. */
  close(): Promise<void>
  /** Seconds of audio actually sent (metering). */
  readonly audioSeconds: number
}
