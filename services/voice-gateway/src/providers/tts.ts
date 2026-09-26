import type { TypedEmitter } from '../util/emitter'
import type { ProviderError } from './errors'

/** Word timings in seconds from the start of the stream (cumulative, as Cartesia sends them). */
export interface WordTimings {
  words: string[]
  start: number[]
  end: number[]
}

export type TtsStreamEvents = {
  /** Audio in the channel format (μ-law 8 kHz or PCM16 16 kHz). */
  audio: (chunk: Buffer) => void
  words: (timings: WordTimings) => void
  /** Generation finished; no more audio for this stream. */
  done: () => void
  /** The stream failed; `error.fatal` says whether the provider socket is gone too. */
  error: (error: ProviderError) => void
}

/** One utterance segment: text in, audio out. Ids are never reused within a call. */
export interface TtsStream extends TypedEmitter<TtsStreamEvents> {
  readonly id: string
  readonly provider: 'cartesia' | 'elevenlabs'
  /** Characters pushed so far. */
  readonly characters: number
  readonly finished: boolean
  push(text: string): void
  /** No more text: finish generating what was pushed. */
  end(): void
  /** Barge-in: stop, drop any audio still arriving for this stream. */
  cancel(): void
}

export interface TtsProvider {
  readonly name: 'cartesia' | 'elevenlabs'
  connect(): Promise<void>
  createStream(): TtsStream
  close(): void
  /** Characters sent to the provider so far (metering). */
  readonly characters: number
}
