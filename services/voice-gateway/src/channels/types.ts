import type { ChannelAudioFormat } from '../audio/codec'
import type { BrowserServerMessage, VoiceChannel } from '../contracts'
import type { TypedEmitter } from '../util/emitter'

export type ChannelEvents = {
  /** Caller audio in the channel format, in real time. */
  audio: (chunk: Buffer) => void
  dtmf: (digit: string) => void
  /** A playback mark we sent was reached (or flushed by a clear, on Twilio). */
  mark: (name: string) => void
  /** The far end ended the call (Twilio `stop`, browser `hangup`). */
  stop: () => void
  /** The socket is gone, for whatever reason. Fires once. */
  closed: (code: number) => void
}

/** Where call audio comes from and goes to. Engines only talk to this interface. */
export interface CallChannel extends TypedEmitter<ChannelEvents> {
  readonly kind: VoiceChannel
  readonly format: ChannelAudioFormat
  readonly isOpen: boolean
  /** The channel gave up on a peer that stopped reading (the call should end as an error). */
  readonly failed?: boolean
  /** Queue agent audio (channel format) for playback. */
  sendAudio(chunk: Buffer): void
  /** Ask to be told (via the `mark` event) when playback reaches this point. */
  sendMark(name: string): void
  /** Drop all queued agent audio immediately (barge-in). */
  clear(): void
  /** Browser control messages; a no-op on Twilio. */
  notify(message: BrowserServerMessage): void
  close(code?: number, reason?: string): void
}
