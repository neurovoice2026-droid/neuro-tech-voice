import { randomUUID } from 'node:crypto'
import type WebSocket from 'ws'
import { wsBase } from './config'
import { silence, channelFormat } from './audio/codec'
import { PlaybackTracker } from './audio/playback'
import { AppClient, AppClientError } from './app-client'
import { failureKind, type LocalBreakerKey, type LocalBreakers } from './breaker'
import { BrowserChannel } from './channels/browser'
import { TwilioChannel } from './channels/twilio'
import type { CallChannel } from './channels/types'
import type { GatewayConfig } from './config'
import {
  STREAM_SESSION_PARAMETER,
  type CallEndReason,
  type CallUsage,
  type FinalizeRequest,
  type TranscriptTurn,
  type VoiceEventRequest,
  type VoiceEventType,
  type VoicePipelineMode,
  type VoiceSessionConfig,
} from './contracts'
import { CartesiaManagedEngine } from './engines/cartesia-managed'
import { CartesiaSelfEngine } from './engines/cartesia-self'
import { ElevenLabsAgentEngine, type ElevenLabsHandoff } from './engines/elevenlabs-agent'
import type { Engine, EngineHost, HandoffRequest } from './engines/types'
import type { Logger } from './log'
import { CartesiaTts } from './providers/cartesia-tts'
import { isProviderError, ProviderError } from './providers/errors'
import { closeSocket } from './providers/ws'
import { verifySessionToken } from './signing'
import { background } from './util/background'
import { GOODBYE_SILENCE, localized, STILL_THERE, WRAP_UP } from './text/phrases'

// One phone call (or dashboard test call), from the first socket message to
// the finalize POST:
//   auth (signed session token) → /session config → engine for the routed
//   mode → failover to the ElevenLabs agent when the engine can't continue →
//   silence and max-duration timers → transcript and usage → /finalize.
// When nothing inside the gateway can serve the call, a Twilio stream is simply
// closed: the app's <Connect action> then answers with its own fallback
// (ElevenLabs register-call, apology line, or the on-call contact).

const MAX_TRANSCRIPT_TURNS = 1_000
const MAX_TURN_CHARS = 2_000
const MAX_FINALIZE_BYTES = 1_800_000
const EVENT_FLUSH_TIMEOUT_MS = 5_000
const ENGINE_STOP_TIMEOUT_MS = 3_000
const SILENCE_FILL_TICK_MS = 100
/** Bridged agents talk on their own; hang up after this many silence timeouts of total inactivity. */
const BRIDGE_SILENCE_MULTIPLIER = 2

export class SessionRegistry {
  private readonly connections = new Set<CallSession>()
  private readonly bySessionId = new Map<string, CallSession>()
  private idleWaiters: (() => void)[] = []
  draining = false

  get activeCount(): number {
    return this.connections.size
  }

  /** Connections that haven't authenticated yet (Twilio before `start`). */
  get pendingCount(): number {
    let pending = 0
    for (const session of this.connections) if (!session.isAuthenticated && !session.isEnded) pending++
    return pending
  }

  /** Unauthenticated connections from one address. */
  pendingCountFor(clientIp: string): number {
    let pending = 0
    for (const session of this.connections) if (!session.isAuthenticated && !session.isEnded && session.clientIp === clientIp) pending++
    return pending
  }

  add(session: CallSession): void {
    this.connections.add(session)
  }

  /** One live connection per call id: a replayed token can't fork a call. */
  claim(sessionId: string, session: CallSession): boolean {
    const existing = this.bySessionId.get(sessionId)
    if (existing && existing !== session) return false
    this.bySessionId.set(sessionId, session)
    return true
  }

  remove(session: CallSession): void {
    this.connections.delete(session)
    for (const [id, s] of this.bySessionId) if (s === session) this.bySessionId.delete(id)
    if (this.connections.size === 0) {
      const waiters = this.idleWaiters
      this.idleWaiters = []
      for (const resolve of waiters) resolve()
    }
  }

  sessions(): CallSession[] {
    return [...this.connections]
  }

  waitForIdle(timeoutMs: number): Promise<boolean> {
    if (this.connections.size === 0) return Promise.resolve(true)
    return new Promise((resolve) => {
      const timer = setTimeout(() => resolve(false), timeoutMs)
      this.idleWaiters.push(() => {
        clearTimeout(timer)
        resolve(true)
      })
    })
  }
}

export interface SessionDeps {
  config: GatewayConfig
  log: Logger
  breakers: LocalBreakers
  registry: SessionRegistry
  app?: AppClient
}

function emptyUsage(): CallUsage {
  return {
    tts_characters: 0,
    stt_seconds: 0,
    stt_model: null,
    agent_seconds: 0,
    elevenlabs_seconds: 0,
    elevenlabs_tts_characters: 0,
    llm_input_tokens: 0,
    llm_cached_input_tokens: 0,
    llm_output_tokens: 0,
  }
}

function breakerKeyFor(error: ProviderError): LocalBreakerKey {
  if (error.provider === 'openai') return 'openai'
  if (error.provider === 'cartesia') return error.component === 'tts' ? 'cartesia_tts' : error.component === 'stt' ? 'cartesia_stt' : 'cartesia_managed'
  return error.component === 'tts' ? 'elevenlabs_tts' : error.component === 'stt' ? 'elevenlabs_stt' : 'elevenlabs_agent'
}

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T | undefined> {
  return Promise.race([promise, new Promise<undefined>((resolve) => setTimeout(() => resolve(undefined), ms).unref())])
}

export class CallSession implements EngineHost {
  readonly connectionId = randomUUID()
  readonly gateway: GatewayConfig
  readonly breakers: LocalBreakers
  readonly app: AppClient
  readonly playback: PlaybackTracker
  readonly usage: CallUsage = emptyUsage()
  log: Logger
  private config: VoiceSessionConfig | null = null
  private engine: Engine | null = null
  private lastMode: VoicePipelineMode | null = null
  private readonly turns: TranscriptTurn[] = []
  private readonly pendingEvents = new Set<Promise<void>>()
  private startedAt = new Date()
  private startedMs = Date.now()
  private began = false
  private ended = false
  private endPromise: Promise<void> | null = null
  private fallbackUsed = false
  private fallbackReason: string | null = null
  private cartesiaCallId: string | null = null
  private elevenLabsConversationId: string | null = null
  private handoffInProgress = false
  private transferring = false
  private silenceTimer: NodeJS.Timeout | null = null
  private silenceStage = 0
  private readonly timers = new Set<NodeJS.Timeout>()
  private fillTimer: NodeJS.Timeout | null = null
  private lastChannelAudioAt = Date.now()
  private warmTts: Promise<WebSocket | null> | null = null
  /** Where the connection came from (per-IP pre-auth limits). */
  clientIp: string | null = null

  private constructor(
    readonly channel: CallChannel,
    private readonly deps: SessionDeps
  ) {
    this.gateway = deps.config
    this.breakers = deps.breakers
    this.log = deps.log.child({ connection_id: this.connectionId, channel: channel.kind })
    this.app = deps.app ?? new AppClient({ appUrl: deps.config.appUrl, secret: deps.config.gatewaySecret, log: this.log })
    this.playback = new PlaybackTracker(channel)
  }

  // ─── Entry points ───────────────────────────────────────────────────────────

  static async runTwilio(ws: WebSocket, deps: SessionDeps, clientIp: string | null = null): Promise<CallSession> {
    const channel = new TwilioChannel(ws, deps.log)
    const session = new CallSession(channel, deps)
    session.clientIp = clientIp
    deps.registry.add(session)
    channel.on('closed', () => {
      if (!session.began) session.abortBeforeStart()
    })
    const start = await channel.waitForStart(deps.config.timings.twilioStartTimeoutMs)
    if (!start) {
      session.log.warn('twilio stream never sent start')
      session.abortBeforeStart(1008, 'no start')
      return session
    }
    const token = start.customParameters[STREAM_SESSION_PARAMETER] ?? ''
    await session.begin(token, start.callSid, start.streamSid)
    return session
  }

  static async runBrowser(ws: WebSocket, token: string, deps: SessionDeps): Promise<CallSession> {
    const channel = new BrowserChannel(ws, deps.log)
    const session = new CallSession(channel, deps)
    deps.registry.add(session)
    channel.on('closed', () => {
      if (!session.began) session.abortBeforeStart()
    })
    await session.begin(token, null, null)
    return session
  }

  // ─── EngineHost ─────────────────────────────────────────────────────────────

  get session(): VoiceSessionConfig {
    if (!this.config) throw new Error('session config not loaded')
    return this.config
  }

  elapsedSeconds(): number {
    return Math.round(((Date.now() - this.startedMs) / 1000) * 100) / 100
  }

  addTranscript(turn: TranscriptTurn, options: { notify?: boolean } = {}): void {
    if (turn.message.length > MAX_TURN_CHARS) turn.message = `${turn.message.slice(0, MAX_TURN_CHARS)}…`
    if (this.turns.length >= MAX_TRANSCRIPT_TURNS) this.turns.shift()
    this.turns.push(turn)
    if (turn.role === 'agent' && turn.message && options.notify !== false) {
      this.channel.notify({ type: 'agent_text', text: turn.message, ...(turn.interrupted ? { interrupted: true } : {}) })
    }
  }

  takeWarmTtsSocket(): Promise<WebSocket | null> | null {
    const warm = this.warmTts
    this.warmTts = null
    return warm
  }

  private discardWarmTts(): void {
    const warm = this.takeWarmTtsSocket()
    if (warm) void warm.then((ws) => closeSocket(ws))
  }

  transcript(): readonly TranscriptTurn[] {
    return this.turns
  }

  emitEvent(type: VoiceEventType, data: VoiceEventRequest['data']): void {
    if (!this.config) return
    if (type === 'component_fallback') {
      // A component swap is a fallback too: the call record says so.
      this.fallbackUsed = true
      this.fallbackReason ??= `${data.component ?? 'component'}_fallback`
    }
    const body: VoiceEventRequest = { session_id: this.config.session_id, call_id: this.config.call_id, type, at: new Date().toISOString(), data }
    const pending = this.app.event(body).finally(() => this.pendingEvents.delete(pending))
    this.pendingEvents.add(pending)
    this.log.info('voice event', { type, provider: data.provider ?? null, component: data.component ?? null, code: data.code ?? null })
  }

  reportProviderError(error: ProviderError): void {
    const kind = failureKind({ status: error.status, code: error.code }, { provider: error.provider })
    if (kind) this.breakers.failure(breakerKeyFor(error), kind)
    this.log.warn('provider error', error.toJSON())
    this.emitEvent('provider_error', {
      provider: error.provider,
      component: error.component,
      code: error.code ?? (error.status !== null ? String(error.status) : null),
      message: error.message.slice(0, 300),
    })
  }

  noteCallerActivity(): void {
    this.silenceStage = 0
    this.clearSilenceTimer()
  }

  noteAgentSpeaking(): void {
    this.clearSilenceTimer()
  }

  noteAgentIdle(): void {
    if (this.ended || !this.config) return
    const timeout = this.config.behavior.silence_timeout_seconds
    if (timeout === null || timeout <= 0) return
    this.clearSilenceTimer()
    const engine = this.engine
    const bridged = !!engine && engine.mode !== 'cartesia_self'
    const ms = timeout * 1000 * (bridged ? BRIDGE_SILENCE_MULTIPLIER : 1)
    this.silenceTimer = setTimeout(() => background(this.onSilence(), this.log, 'silence handling'), ms)
    this.silenceTimer.unref()
  }

  requestHandoff(request: HandoffRequest): boolean {
    if (this.ended) return false
    const current = this.engine
    const canHandOff = !!current && current.mode !== 'elevenlabs' && !this.handoffInProgress && this.elevenLabsAgentAvailable()
    if (!canHandOff) {
      // Self-orchestrated calls may still survive quota on ElevenLabs components.
      const componentsMayRecover = request.reason === 'quota_exceeded' && request.budget === 'model_credits' && current?.mode === 'cartesia_self'
      if (!componentsMayRecover) background(this.failCall(request), this.log, 'fail call')
      return false
    }
    this.handoffInProgress = true
    setImmediate(() => background(this.handoff(current!, request), this.log, 'handoff'))
    return true
  }

  endCall(reason: CallEndReason): void {
    void this.end(reason, { hangup: true })
  }

  async transfer(toE164: string): Promise<boolean> {
    if (this.ended || !this.config) return false
    if (this.channel.kind === 'browser') {
      // A test call has no phone line to transfer; show where it would have gone.
      this.emitEvent('transferred', { message: 'transfer simulated on a browser test call' })
      void this.end('transferred', { hangup: false })
      return true
    }
    this.transferring = true
    const result = await this.app.callControl({ session_id: this.config.session_id, call_id: this.config.call_id, action: 'transfer', to_e164: toE164 })
    if (!result.ok) {
      this.transferring = false
      this.log.warn('transfer failed', { error: result.error ?? null })
      return false
    }
    this.emitEvent('transferred', {})
    // Twilio replaces the call's TwiML, which ends this stream; don't wait forever for that.
    this.schedule(() => void this.end('transferred', { hangup: false }), this.gateway.timings.hangupGraceMs)
    return true
  }

  setCartesiaCallId(id: string): void {
    this.cartesiaCallId = id
  }

  setElevenLabsConversationId(id: string): void {
    this.elevenLabsConversationId = id
  }

  // ─── Lifecycle ──────────────────────────────────────────────────────────────

  private abortBeforeStart(code = 1000, reason = ''): void {
    if (this.began) return
    this.closeWithoutConfig(code, reason)
  }

  /**
   * Tears down a connection whose session config never loaded. Nothing is
   * finalized (the app has nothing to record); a Twilio stream closed here
   * falls back through the app's <Connect action>.
   */
  private closeWithoutConfig(code: number, reason: string): void {
    if (this.ended) return
    this.ended = true
    this.discardWarmTts()
    this.channel.close(code, reason)
    this.playback.dispose()
    this.deps.registry.remove(this)
  }

  private async begin(token: string, callSid: string | null, streamSid: string | null): Promise<void> {
    if (this.ended) return
    const payload = token ? verifySessionToken(token, this.gateway.gatewaySecret) : null
    if (!payload || payload.ch !== this.channel.kind) {
      this.log.warn('rejected stream: invalid or expired session token')
      this.channel.notify({ type: 'error', message: 'This test call link has expired. Start the call again.' })
      this.abortBeforeStart(1008, 'invalid session')
      return
    }
    if (!this.deps.registry.claim(payload.sid, this)) {
      this.log.warn('rejected stream: session already connected', { call_id: payload.sid })
      this.abortBeforeStart(1008, 'session already active')
      return
    }
    this.began = true
    this.log = this.log.child({ call_id: payload.sid })
    // The Cartesia TTS handshake needs no call settings: start it while the
    // session config loads, when the token says the call runs cartesia_self.
    if (payload.mode === 'cartesia_self' && this.gateway.cartesia.apiKey && this.breakers.phase('cartesia_tts') !== 'open') {
      this.warmTts = CartesiaTts.preconnect({
        apiKey: this.gateway.cartesia.apiKey,
        wsBase: wsBase(this.gateway.cartesia.apiBase),
        version: this.gateway.cartesia.version,
        connectTimeoutMs: this.gateway.timings.componentConnectTimeoutMs,
      })
    }

    let config: VoiceSessionConfig
    try {
      config = await this.app.session({ session_token: token, call_sid: callSid, stream_sid: streamSid })
    } catch (error) {
      if (this.ended) return
      const status = error instanceof AppClientError ? error.status : null
      this.log.error('could not load session config', { status, code: error instanceof AppClientError ? error.code : null })
      this.channel.notify({ type: 'error', message: "We couldn't start this call. Please try again in a moment." })
      this.closeWithoutConfig(1011, 'session unavailable')
      return
    }
    // Ended while the config was loading (graceful shutdown): already closed.
    if (this.ended) return
    if (config.session_id !== payload.sid || config.channel !== this.channel.kind) {
      this.log.error('session config does not match the token', { mode: config.mode })
      this.closeWithoutConfig(1008, 'session mismatch')
      return
    }
    this.config = config
    this.lastMode = config.mode
    this.startedAt = new Date()
    this.startedMs = Date.now()
    this.log = this.log.child({ mode: config.mode, is_test: config.is_test })

    if (!this.channel.isOpen) {
      // The caller hung up while we were loading the session.
      await this.end(this.channel.kind === 'twilio' ? 'caller_hangup' : 'test_ended', { hangup: false })
      return
    }

    this.wireChannel()
    this.emitEvent('stream_started', { stream_sid: streamSid })
    this.startCallTimers()
    await this.startInitialEngine()
  }

  private wireChannel(): void {
    this.channel.on('audio', (chunk) => {
      this.lastChannelAudioAt = Date.now()
      this.engine?.onCallerAudio(chunk)
    })
    this.channel.on('dtmf', (digit) => this.engine?.onDtmf(digit))
    this.channel.on('stop', () => {
      void this.end(this.remoteEndReason(), { hangup: false })
    })
    this.channel.on('closed', () => {
      void this.end(this.remoteEndReason(), { hangup: false })
    })
    // Providers need continuous audio (Cartesia STT waits for missing audio; the
    // managed agent closes after 120 s without client events).
    const format = channelFormat(this.channel.format)
    const frame = silence(format, SILENCE_FILL_TICK_MS)
    this.fillTimer = setInterval(() => {
      if (!this.engine || this.ended) return
      if (Date.now() - this.lastChannelAudioAt >= this.gateway.timings.silenceFillAfterMs) this.engine.onCallerAudio(frame)
    }, SILENCE_FILL_TICK_MS)
    this.fillTimer.unref()
  }

  private remoteEndReason(): CallEndReason {
    if (this.transferring) return 'transferred'
    if (this.channel.failed) return 'error'
    return this.channel.kind === 'twilio' ? 'caller_hangup' : 'test_ended'
  }

  private elevenLabsAgentAvailable(): boolean {
    return !!this.gateway.elevenlabs.apiKey && !!this.config?.elevenlabs.agent_id && this.breakers.phase('elevenlabs_agent') !== 'open'
  }

  private async startInitialEngine(): Promise<void> {
    const config = this.session
    const unavailable = this.initialModeProblem(config.mode)
    if (unavailable) {
      this.log.warn('routed mode unavailable on this gateway', { reason: unavailable })
      if (config.mode !== 'elevenlabs' && this.elevenLabsAgentAvailable()) {
        this.fallbackUsed = true
        this.fallbackReason = unavailable
        this.emitEvent('mode_switched', { from_mode: config.mode, to_mode: 'elevenlabs', provider: 'gateway', code: unavailable, message: `Routed mode unavailable (${unavailable})` })
        await this.runEngine(new ElevenLabsAgentEngine(this, null), true)
        return
      }
      await this.failCall({ reason: 'not_configured', error: null })
      return
    }
    let engine: Engine
    try {
      engine =
        config.mode === 'cartesia_self'
          ? new CartesiaSelfEngine(this)
          : config.mode === 'cartesia_managed'
            ? new CartesiaManagedEngine(this)
            : new ElevenLabsAgentEngine(this, null)
    } catch (error) {
      this.log.error('engine could not be created', { error: error instanceof Error ? error.message : String(error) })
      if (!this.requestHandoffFromNothing(error)) await this.failCall({ reason: 'not_configured', error: isProviderError(error) ? error : null })
      return
    }
    await this.runEngine(engine, false)
  }

  /** Engine construction failed before anything ran: go straight to the ElevenLabs agent when possible. */
  private requestHandoffFromNothing(error: unknown): boolean {
    const config = this.session
    if (config.mode === 'elevenlabs' || !this.elevenLabsAgentAvailable()) return false
    this.fallbackUsed = true
    this.fallbackReason = 'engine_unavailable'
    this.emitEvent('mode_switched', {
      from_mode: config.mode,
      to_mode: 'elevenlabs',
      provider: 'gateway',
      code: isProviderError(error) ? error.code : 'engine_unavailable',
      message: 'The routed engine could not be created on the gateway',
    })
    background(this.runEngine(new ElevenLabsAgentEngine(this, null), true), this.log, 'elevenlabs engine start')
    return true
  }

  private initialModeProblem(mode: VoicePipelineMode): string | null {
    const { gateway, breakers } = this
    const config = this.session
    if (mode === 'cartesia_self') {
      if (!gateway.cartesia.apiKey) return 'gateway_cartesia_not_configured'
      if (!gateway.openai.apiKey) return 'gateway_openai_not_configured'
      if (breakers.phase('openai') === 'open' && this.elevenLabsAgentAvailable()) return 'openai_breaker_open'
      return null
    }
    if (mode === 'cartesia_managed') {
      if (!gateway.cartesia.apiKey) return 'gateway_cartesia_not_configured'
      if (!config.cartesia_agent_id) return 'managed_agent_missing'
      if (!breakers.admit('cartesia_managed') && this.elevenLabsAgentAvailable()) return 'managed_breaker_open'
      return null
    }
    if (!gateway.elevenlabs.apiKey) return 'gateway_elevenlabs_not_configured'
    if (!config.elevenlabs.agent_id) return 'elevenlabs_agent_missing'
    return null
  }

  private async runEngine(engine: Engine, switched: boolean): Promise<void> {
    if (this.ended) return
    this.engine = engine
    this.lastMode = engine.mode
    this.channel.notify(switched ? { type: 'mode_switched', mode: engine.mode } : { type: 'ready', mode: engine.mode })
    try {
      const starting = engine.start()
      // Only the self-run pipeline uses the warm TTS socket (it took it in start()).
      this.discardWarmTts()
      await starting
    } catch (error) {
      if (this.engine !== engine || this.ended) return
      await this.onEngineStartFailure(engine, error)
      return
    }
    if (this.engine === engine && engine.mode !== 'cartesia_self') this.noteAgentIdle()
  }

  private async onEngineStartFailure(engine: Engine, raw: unknown): Promise<void> {
    const error = isProviderError(raw)
      ? raw
      : new ProviderError({ provider: 'cartesia', component: 'agent', message: raw instanceof Error ? raw.message : String(raw), code: 'start_failed' })
    this.log.error('engine failed to start', { mode: engine.mode, ...error.toJSON() })
    if (error.isQuota && error.provider === 'cartesia') {
      const budget = engine.mode === 'cartesia_managed' ? 'agent_dollars' : 'model_credits'
      this.emitEvent('quota_exceeded', { provider: 'cartesia', component: error.component, budget, code: error.code ?? 'quota_exceeded', message: 'Cartesia balance exhausted' })
      if (!this.requestHandoff({ reason: 'quota_exceeded', error, budget }) && !this.ended) await this.failCall({ reason: 'quota_exceeded', error, budget })
      return
    }
    if (!(error.code === 'not_configured' || error.code === 'agent_not_found')) this.reportProviderError(error)
    this.requestHandoff({ reason: 'provider_error', error })
  }

  private async handoff(from: Engine, request: HandoffRequest): Promise<void> {
    try {
      await withTimeout(from.stop(), ENGINE_STOP_TIMEOUT_MS)
      if (this.ended) return
      const reason = request.reason === 'provider_error' && request.error ? `${request.error.provider}_${request.error.component}_error` : request.reason
      this.fallbackUsed = true
      this.fallbackReason ??= reason
      this.emitEvent('mode_switched', {
        from_mode: from.mode,
        to_mode: 'elevenlabs',
        provider: request.error?.provider ?? 'gateway',
        component: request.error?.component,
        code: request.error?.code ?? request.reason,
        message: request.error?.message.slice(0, 300) ?? request.reason,
        ...(request.budget ? { budget: request.budget } : {}),
        cartesia_call_id: this.cartesiaCallId,
      })
      const handoff: ElevenLabsHandoff = { reason, transcript: [...this.turns] }
      this.playback.clear()
      const next = new ElevenLabsAgentEngine(this, handoff)
      this.handoffInProgress = false
      await this.runEngine(next, true)
    } catch (error) {
      this.handoffInProgress = false
      this.log.error('handoff failed', { error: error instanceof Error ? error.message : String(error) })
      await this.failCall({ reason: 'agent_failed', error: null })
    }
  }

  /** Nothing in the gateway can serve the call any more. */
  private async failCall(request: HandoffRequest): Promise<void> {
    if (this.ended) return
    this.log.error('call cannot continue on the gateway', { reason: request.reason, error: request.error?.toJSON() ?? null })
    if (!this.fallbackReason) this.fallbackReason = request.reason
    if (this.channel.kind === 'browser') {
      this.channel.notify({ type: 'error', message: "The voice service isn't available right now, so the test call ended. Please try again in a few minutes." })
    }
    // Twilio: closing the stream (no hang-up) hands the live call back to the app's <Connect action>.
    await this.end('error', { hangup: false })
  }

  private async onSilence(): Promise<void> {
    if (this.ended || !this.config) return
    const engine = this.engine
    if (!engine || engine.isBusy()) return
    if (engine.mode !== 'cartesia_self') {
      this.log.info('ending bridged call after prolonged silence')
      await this.end('silence_timeout', { hangup: true })
      return
    }
    const language = this.config.language
    if (this.silenceStage === 0) {
      this.silenceStage = 1
      await engine.say(localized(STILL_THERE, language))
      return
    }
    const played = await engine.say(localized(GOODBYE_SILENCE, language))
    // The caller spoke during the goodbye: keep the call.
    if (!played && this.silenceStage === 0) return
    await this.end('silence_timeout', { hangup: true })
  }

  private startCallTimers(): void {
    const config = this.session
    const maxMs = Math.max(10, config.behavior.max_duration_seconds) * 1000
    const wrapUpAt = maxMs - this.gateway.timings.wrapUpBeforeEndMs
    if (wrapUpAt > this.gateway.timings.wrapUpBeforeEndMs) {
      this.schedule(() => {
        if (this.engine?.mode === 'cartesia_self') background(this.engine.say(localized(WRAP_UP, config.language)), this.log, 'wrap-up line')
      }, wrapUpAt)
    }
    this.schedule(() => {
      this.log.info('maximum call duration reached')
      void this.end('max_duration', { hangup: true })
    }, maxMs)
  }

  private schedule(fn: () => void, ms: number): void {
    const timer = setTimeout(() => {
      this.timers.delete(timer)
      fn()
    }, ms)
    timer.unref()
    this.timers.add(timer)
  }

  private clearSilenceTimer(): void {
    if (this.silenceTimer) clearTimeout(this.silenceTimer)
    this.silenceTimer = null
  }

  /** Idempotent. Stops the engine, ends the line when asked, finalizes. */
  end(reason: CallEndReason, opts: { hangup: boolean }): Promise<void> {
    if (this.endPromise) return this.endPromise
    if (!this.config) {
      // Before (or while) loading the config, e.g. a drain timeout: close so the
      // connection can't linger unregistered-but-running.
      this.closeWithoutConfig(reason === 'error' ? 1011 : 1000, 'call ended')
      this.endPromise = Promise.resolve()
      return this.endPromise
    }
    this.endPromise = this.finish(reason, opts).catch((error: unknown) => {
      // Never leave a half-ended call registered (it would block graceful shutdown).
      this.log.error('call teardown failed', { error: error instanceof Error ? error : String(error) })
      this.channel.close(1011, 'teardown failed')
      this.deps.registry.remove(this)
    })
    return this.endPromise
  }

  private async finish(reason: CallEndReason, opts: { hangup: boolean }): Promise<void> {
    const config = this.config!
    this.ended = true
    const endedAt = new Date()
    this.clearSilenceTimer()
    this.discardWarmTts()
    for (const timer of this.timers) clearTimeout(timer)
    this.timers.clear()
    if (this.fillTimer) clearInterval(this.fillTimer)
    this.log.info('call ending', { reason, fallback_used: this.fallbackUsed })

    const engine = this.engine
    this.engine = null
    if (engine) await withTimeout(engine.stop(), ENGINE_STOP_TIMEOUT_MS)

    if (this.channel.kind === 'twilio') {
      if (opts.hangup && this.channel.isOpen) {
        const result = await this.app.callControl({ session_id: config.session_id, call_id: config.call_id, action: 'hangup' })
        if (result.ok) await this.waitForChannelClose(this.gateway.timings.hangupGraceMs)
        else this.log.warn('hangup through the app failed; closing the stream', { error: result.error ?? null })
      }
      this.channel.close(1000, 'call ended')
    } else {
      this.channel.notify({ type: 'ended', reason })
      this.channel.close(1000, 'call ended')
    }
    this.playback.dispose()

    if (this.pendingEvents.size > 0) await withTimeout(Promise.allSettled([...this.pendingEvents]), EVENT_FLUSH_TIMEOUT_MS)
    const finalized = await this.app.finalize(this.finalizeRequest(reason, endedAt))
    if (!finalized) this.log.error('call finalize failed after retries; the call record may be incomplete')
    this.deps.registry.remove(this)
  }

  private waitForChannelClose(ms: number): Promise<void> {
    if (!this.channel.isOpen) return Promise.resolve()
    return new Promise((resolve) => {
      const timer = setTimeout(resolve, ms)
      timer.unref()
      this.channel.once('closed', () => {
        clearTimeout(timer)
        resolve()
      })
      this.channel.once('stop', () => {
        clearTimeout(timer)
        resolve()
      })
    })
  }

  finalizeRequest(reason: CallEndReason, endedAt: Date): FinalizeRequest {
    const config = this.session
    let transcript = [...this.turns].sort((a, b) => a.time_in_call_secs - b.time_in_call_secs)
    const base: FinalizeRequest = {
      session_id: config.session_id,
      call_id: config.call_id,
      started_at: this.startedAt.toISOString(),
      ended_at: endedAt.toISOString(),
      end_reason: reason,
      mode: this.lastMode ?? config.mode,
      fallback_used: this.fallbackUsed,
      fallback_reason: this.fallbackUsed || reason === 'error' ? this.fallbackReason : null,
      transcript,
      usage: { ...this.usage },
      cartesia_call_id: this.cartesiaCallId,
      elevenlabs_conversation_id: this.elevenLabsConversationId,
    }
    // Stay under the app's 2 MB body cap: drop the oldest turns if a marathon call needs it.
    while (transcript.length > 0 && Buffer.byteLength(JSON.stringify({ ...base, transcript }), 'utf8') > MAX_FINALIZE_BYTES) {
      transcript = transcript.slice(Math.ceil(transcript.length / 10))
    }
    return { ...base, transcript }
  }

  /** Graceful shutdown: end the call without hanging up (Twilio falls back through the app). */
  forceEnd(): Promise<void> {
    return this.end('error', { hangup: false })
  }

  get isEnded(): boolean {
    return this.ended
  }

  /** The stream presented a valid session token (pre-auth sockets are capped separately). */
  get isAuthenticated(): boolean {
    return this.began
  }
}
