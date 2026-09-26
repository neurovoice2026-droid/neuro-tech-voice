import type WebSocket from 'ws'
import type { PlaybackTracker } from '../audio/playback'
import type { AppClient } from '../app-client'
import type { LocalBreakers } from '../breaker'
import type { CallChannel } from '../channels/types'
import type { GatewayConfig } from '../config'
import type {
  CallEndReason,
  CallUsage,
  TranscriptTurn,
  VoiceEventRequest,
  VoiceEventType,
  VoicePipelineMode,
  VoiceSessionConfig,
} from '../contracts'
import type { Logger } from '../log'
import type { ProviderError } from '../providers/errors'

/** Why an engine wants the call moved to the ElevenLabs agent bridge. */
export interface HandoffRequest {
  reason: 'quota_exceeded' | 'provider_error' | 'llm_error' | 'agent_failed' | 'not_configured' | 'breaker_open'
  error?: ProviderError | null
  /** Which budget ran out, for quota_exceeded. */
  budget?: 'model_credits' | 'agent_dollars'
}

/** What the CallSession gives an engine. Engines never touch sockets of other engines or the app directly. */
export interface EngineHost {
  readonly session: VoiceSessionConfig
  readonly gateway: GatewayConfig
  readonly channel: CallChannel
  readonly playback: PlaybackTracker
  readonly app: AppClient
  readonly log: Logger
  readonly breakers: LocalBreakers
  /** Mutable per-call usage accumulators. */
  readonly usage: CallUsage
  /** Seconds since the stream started. */
  elapsedSeconds(): number
  /**
   * Records a turn for finalize. Agent turns are also shown on a browser test
   * call unless `notify` is false (the engine already streamed them).
   */
  addTranscript(turn: TranscriptTurn, options?: { notify?: boolean }): void
  transcript(): readonly TranscriptTurn[]
  emitEvent(type: VoiceEventType, data: VoiceEventRequest['data']): void
  /** Reports a provider failure to the app (breaker) and the local breaker. */
  reportProviderError(error: ProviderError): void
  /** Caller speech started or ended: silence timers reset. */
  noteCallerActivity(): void
  /** The agent is producing speech: silence timers pause. */
  noteAgentSpeaking(): void
  /** The agent finished and the caller heard it: silence countdown starts. */
  noteAgentIdle(): void
  /**
   * Moves the call to the ElevenLabs agent bridge; returns true when that is
   * happening (this engine will be stopped). When it returns false for any
   * reason other than 'quota_exceeded', the session ends the call itself
   * (Twilio: closes the stream so the app's <Connect action> fallback answers).
   * For quota the engine may still try component fallbacks.
   */
  requestHandoff(request: HandoffRequest): boolean
  /** Ends the call (hangs up the phone line through the app where needed). */
  endCall(reason: CallEndReason): void
  /** Twilio transfer through the app; resolves false if it didn't happen. */
  transfer(toE164: string): Promise<boolean>
  /**
   * A Cartesia TTS socket opened while the session config was loading, for
   * the first engine that wants it (null when there is none). Hand-over only.
   */
  takeWarmTtsSocket(): Promise<WebSocket | null> | null
  setCartesiaCallId(id: string): void
  setElevenLabsConversationId(id: string): void
}

export interface Engine {
  readonly mode: VoicePipelineMode
  /** Connects providers and starts talking/listening. Throws ProviderError if it can't. */
  start(): Promise<void>
  onCallerAudio(chunk: Buffer): void
  onDtmf(digit: string): void
  /**
   * Speaks a gateway line (silence prompt, wrap-up, transfer announcement).
   * Resolves true once played; false when interrupted or when the engine can't
   * inject speech (bridged agents).
   */
  say(text: string): Promise<boolean>
  /** True while the agent is generating or playing speech. */
  isBusy(): boolean
  /** Stops providers; the call itself may continue on another engine. */
  stop(): Promise<void>
}
