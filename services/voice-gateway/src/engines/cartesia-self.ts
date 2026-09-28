import type { ResponseInputItem } from 'openai/resources/responses/responses'
import { bytesPerSecond, channelFormat, RingBuffer, bytesForMs } from '../audio/codec'
import { failureKind } from '../breaker'
import { wsBase } from '../config'
import type { ToolAction, VoiceToolName } from '../contracts'
import { createCartesiaStt } from '../providers/cartesia-stt'
import { CartesiaTts } from '../providers/cartesia-tts'
import { ElevenLabsStt } from '../providers/elevenlabs-stt'
import { ElevenLabsTts } from '../providers/elevenlabs-tts'
import { isProviderError, ProviderError } from '../providers/errors'
import { LlmError, OpenAiLlm, type LlmToolCall, type LlmTurnResult } from '../providers/openai-llm'
import type { SttStream } from '../providers/stt'
import type { TtsProvider } from '../providers/tts'
import { FILLER_PHRASES, localizedList } from '../text/phrases'
import { looksLikeVoicemail } from '../text/voicemail'
import { background } from '../util/background'
import { deferred, type Deferred } from '../util/emitter'
import type { Engine, EngineHost } from './types'
import { Utterance, type Segment } from './utterance'

// cartesia_self: Cartesia Ink STT → OpenAI Responses → Cartesia Sonic TTS,
// orchestrated here (contract §6, cartesia-docs.md §8.2).
//
// Turn machine
//   turn_start  caller speaks while the agent talks (interruptions allowed):
//               abort the LLM, cancel TTS, clear the channel, keep only the
//               text the caller heard (interrupted: true)
//   eager_end   agent idle: start a speculative LLM run whose output is held
//   resume      abort the speculative run
//   turn_end    same transcript as eager_end → commit the speculative run
//               (release held output); otherwise start a fresh run
// History is a list of blocks (one per turn: the user/developer message plus
// the items that turn produced) so a run that settles late — a side-effecting
// tool finishing after a barge-in — still lands in the right place.
//
// Failover (contract §1.4): TTS error → ElevenLabs TTS for the rest of the call;
// STT error → ElevenLabs Scribe with a 2 s replay; LLM failure with nothing
// spoken → ElevenLabs agent; Cartesia quota_exceeded → event + ElevenLabs agent.

/**
 * History is trimmed in steps: once it passes MAX_HISTORY_BLOCKS the oldest
 * turns go down to HISTORY_TRIM_TO, so the replayed prefix (and OpenAI's
 * prompt cache over it) changes once every 20 turns, not on every turn.
 */
const MAX_HISTORY_BLOCKS = 60
const HISTORY_TRIM_TO = 40
const DTMF_COLLECT_MS = 1_000
const OUTBOUND_GREETING_WAIT_MS = 2_500
/** Outbound: a noise-only turn before the greeting; greet this soon unless speech follows. */
const NOISE_GREETING_DELAY_MS = 1_000
const VOICEMAIL_WINDOW_MS = 20_000
/** The app keeps at most 50 knowledge sources per transcript turn. */
const MAX_TURN_SOURCES = 50
/** Longest a gateway line (wrap-up, prompts) waits for the agent's current reply. */
const SAY_WAIT_MS = 30_000
/** Time to first TTS audio above this counts as a soft failure (elevenlabs-fallback.md §7). */
const SLOW_FIRST_AUDIO_MS = 1_200

interface HistoryBlock {
  head: ResponseInputItem | null
  items: ResponseInputItem[]
}

type HeldEvent =
  | { kind: 'text'; delta: string; hop: number }
  | { kind: 'tool'; name: string; hop: number; spoken: boolean }
  | { kind: 'hop_end'; hop: number }

class TurnRun {
  readonly controller = new AbortController()
  block: HistoryBlock | null = null
  utterance: Utterance | null = null
  held: HeldEvent[] = []
  readonly commitGate: Deferred<boolean> = deferred<boolean>()
  pendingAction: ToolAction | null = null
  heardOnInterrupt: string | null = null
  finalHopStart = 0
  settled = false
  failed = false
  result: LlmTurnResult | null = null
  readonly fillerHops = new Set<number>()
  readonly toolCalls: { name: VoiceToolName; ok: boolean }[] = []
  readonly sources: NonNullable<Utterance['sources']> = []
  /** end_call came with no reply text in its hop: one more reply (no tools) says goodbye. */
  endCallWithoutText = false
  goodbyeRequested = false
  // Per-turn timings for the log line (ms since epoch; no transcript text is logged).
  readonly createdAt = Date.now()
  turnEndAt: number | null = null
  firstTextAt: number | null = null
  firstAudioAt: number | null = null
  readonly toolTimings: { name: string; ms: number; ok: boolean }[] = []
  logged = false

  constructor(
    public speculative: boolean,
    readonly eagerText: string,
    readonly input: ResponseInputItem[]
  ) {}

  abort(): void {
    this.controller.abort()
    this.commitGate.resolve(false)
  }
}

function userMessage(text: string): ResponseInputItem {
  return { role: 'user', content: text }
}

function assistantMessage(text: string): ResponseInputItem {
  return { role: 'assistant', content: text }
}

function developerMessage(text: string): ResponseInputItem {
  return { role: 'developer', content: text }
}

/** Only failures that might not happen again are worth a second try on Cartesia (not a bad voice id). */
function retryable(error: ProviderError): boolean {
  const kind = failureKind({ status: error.status, code: error.code }, { provider: error.provider })
  return kind === 'hard' || kind === 'soft'
}

function normalizeTranscript(text: string): string {
  return text
    .toLowerCase()
    .replace(/[\p{P}\p{S}]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

export class CartesiaSelfEngine implements Engine {
  readonly mode = 'cartesia_self' as const
  private readonly bps: number
  private readonly ring: RingBuffer
  private readonly llm: OpenAiLlm
  private tts: TtsProvider | null = null
  private cartesiaTts: CartesiaTts | null = null
  private elevenTts: ElevenLabsTts | null = null
  private stt: SttStream | null = null
  private sttSwitching = false
  private readonly retiredStt: SttStream[] = []
  private cartesiaTtsRetried = false
  private cartesiaSttRetried = false
  private readonly blocks: HistoryBlock[] = []
  private committed: TurnRun | null = null
  private speculative: TurnRun | null = null
  private active: Utterance | null = null
  private utteranceSeq = 0
  private pendingUserTexts: string[] = []
  private stopped = false
  private ending = false
  private turnStartedAtSeconds: number | null = null
  private dtmfDigits = ''
  private dtmfTimer: NodeJS.Timeout | null = null
  private greetingTimer: NodeJS.Timeout | null = null
  private voicemailWatch: boolean
  private voicemailTurnStartedAt = 0
  private voicemailTimer: NodeJS.Timeout | null = null
  private greeted = false
  private handedOff = false
  private readonly reportedSegmentErrors = new WeakSet<ProviderError>()
  private retriedTtsError: ProviderError | null = null
  private lastTurnEndAt: number | null = null

  constructor(private readonly host: EngineHost) {
    const { session, gateway } = host
    this.bps = bytesPerSecond(channelFormat(host.channel.format))
    this.ring = new RingBuffer(bytesForMs(channelFormat(host.channel.format), gateway.timings.sttReplayBufferMs))
    if (!gateway.openai.apiKey) {
      throw new ProviderError({ provider: 'openai', component: 'llm', message: 'OpenAI is not configured on the gateway', code: 'not_configured', status: 503 })
    }
    this.llm = new OpenAiLlm({
      apiKey: gateway.openai.apiKey,
      baseUrl: gateway.openai.baseUrl,
      config: { ...session.llm, model: session.llm.model || gateway.openai.model },
      instructions: session.instructions,
      tools: session.tools,
      safetyIdentifier: session.safety_identifier,
      log: host.log.child({ component: 'llm' }),
    })
    this.voicemailWatch = session.direction === 'outbound' && session.behavior.voicemail_detection
  }

  // ─── Lifecycle ──────────────────────────────────────────────────────────────

  async start(): Promise<void> {
    const { gateway, breakers, log } = this.host
    if (!gateway.cartesia.apiKey) {
      throw new ProviderError({ provider: 'cartesia', component: 'tts', message: 'Cartesia is not configured on the gateway', code: 'not_configured', status: 503 })
    }
    // Local breakers: skip a component this process just saw failing, when a fallback exists.
    const elevenLabs = !!gateway.elevenlabs.apiKey
    const ttsStart = elevenLabs && !breakers.admit('cartesia_tts') ? this.createElevenLabsTts() : this.createCartesiaTts()
    const sttStart = elevenLabs && !breakers.admit('cartesia_stt') ? this.createScribe() : this.createCartesiaStt()
    if (ttsStart.name === 'elevenlabs') this.componentFallbackEvent('tts', null, 'breaker_open')
    if (sttStart.provider === 'elevenlabs') this.componentFallbackEvent('stt', null, 'breaker_open')

    const [ttsResult, sttResult] = await Promise.allSettled([ttsStart.connect(), sttStart.connect()])
    if (this.stopped) {
      void sttStart.close()
      return
    }
    this.tts = ttsStart
    if (ttsResult.status === 'rejected') {
      const recovered = await this.recoverTtsAtStart(toProviderError(ttsResult.reason, 'tts'))
      if (!recovered || this.handedOff || this.stopped) {
        void sttStart.close()
        if (this.handedOff || this.stopped) return
        throw toProviderError(ttsResult.reason, 'tts')
      }
    } else {
      breakers.success(ttsStart.name === 'cartesia' ? 'cartesia_tts' : 'elevenlabs_tts')
    }
    if (sttResult.status === 'rejected') {
      const error = toProviderError(sttResult.reason, 'stt')
      this.stt = sttStart
      const recovered = await this.recoverStt(error, false)
      if (this.handedOff || this.stopped) return
      if (!recovered) throw error
    } else {
      breakers.success(sttStart.provider === 'cartesia' ? 'cartesia_stt' : 'elevenlabs_stt')
      this.attachStt(sttStart)
      // Speech while the providers were connecting (an outbound callee's
      // "Hello?") was only buffered; the pacer catches up with live audio.
      sttStart.sendAudio(this.ring.snapshot())
    }
    log.info('cartesia_self engine started', { tts: this.tts?.name, stt: this.stt?.provider, stt_model: this.stt?.model })

    if (this.voicemailWatch) {
      // Outbound: let the callee speak first so a voicemail greeting can be recognised.
      this.greetingTimer = setTimeout(() => this.greet(), OUTBOUND_GREETING_WAIT_MS)
      this.greetingTimer.unref()
      const window = setTimeout(() => (this.voicemailWatch = false), VOICEMAIL_WINDOW_MS)
      window.unref()
    } else {
      this.greet()
    }
  }

  onCallerAudio(chunk: Buffer): void {
    if (this.stopped) return
    this.ring.push(chunk)
    if (!this.sttSwitching) this.stt?.sendAudio(chunk)
  }

  onDtmf(digit: string): void {
    if (this.stopped || this.ending) return
    this.host.noteCallerActivity()
    this.dtmfDigits += digit
    if (this.dtmfTimer) clearTimeout(this.dtmfTimer)
    this.dtmfTimer = setTimeout(() => {
      this.dtmfTimer = null
      const digits = this.dtmfDigits
      this.dtmfDigits = ''
      if (!digits || this.stopped || this.ending) return
      const text = `[caller pressed ${digits.split('').join(' ')}]`
      this.host.addTranscript({ role: 'user', message: text, time_in_call_secs: this.host.elapsedSeconds() })
      this.acceptUserTurn(text)
    }, DTMF_COLLECT_MS)
    this.dtmfTimer.unref()
  }

  async say(text: string): Promise<boolean> {
    if (this.stopped || !this.tts || !text.trim()) return false
    // Never talk over the agent: wait for the current reply (and its run) to finish.
    const deadline = Date.now() + SAY_WAIT_MS
    while ((this.active || this.committed) && !this.stopped && Date.now() < deadline) {
      if (this.active) await Promise.race([this.active.outcome, delayTick(Math.max(1, deadline - Date.now()))])
      else await delayTick(50)
    }
    if (this.stopped) return false
    const utterance = this.newUtterance(null)
    utterance.pushLine(text)
    utterance.close()
    return (await utterance.outcome) === 'played'
  }

  isBusy(): boolean {
    return !!this.active || (!!this.committed && !this.committed.settled)
  }

  async stop(): Promise<void> {
    if (this.stopped) return
    this.stopped = true
    for (const timer of [this.dtmfTimer, this.greetingTimer, this.voicemailTimer]) if (timer) clearTimeout(timer)
    this.speculative?.abort()
    this.committed?.abort()
    this.active?.abandon()
    this.active = null
    this.syncUsage()
    const closing: Promise<void>[] = []
    if (this.stt) closing.push(this.stt.close())
    for (const retired of this.retiredStt) closing.push(retired.close())
    this.cartesiaTts?.close()
    this.elevenTts?.close()
    await Promise.allSettled(closing)
    this.syncUsage()
  }

  // ─── Providers ──────────────────────────────────────────────────────────────

  private createCartesiaTts(): CartesiaTts {
    const { gateway, session, channel, log } = this.host
    this.cartesiaTts = new CartesiaTts({
      apiKey: gateway.cartesia.apiKey!,
      wsBase: wsBase(gateway.cartesia.apiBase),
      version: gateway.cartesia.version,
      callId: session.call_id,
      voice: { ...session.voice, tts_model: session.voice.tts_model || gateway.cartesia.ttsModel },
      format: channel.format,
      connectTimeoutMs: gateway.timings.componentConnectTimeoutMs,
      idleReconnectMs: gateway.timings.ttsIdleReconnectMs,
      // Opened while the session config was loading (call-start latency).
      preconnected: this.host.takeWarmTtsSocket(),
      log: log.child({ component: 'cartesia_tts' }),
      onFirstAudio: (ms) => {
        if (ms > SLOW_FIRST_AUDIO_MS) this.host.breakers.failure('cartesia_tts', 'soft')
        else this.host.breakers.success('cartesia_tts')
      },
    })
    return this.cartesiaTts
  }

  private createElevenLabsTts(): ElevenLabsTts {
    const { gateway, session, channel, log } = this.host
    this.elevenTts ??= new ElevenLabsTts({
      apiKey: gateway.elevenlabs.apiKey!,
      wsBase: wsBase(gateway.elevenlabs.apiBase),
      voiceId: session.elevenlabs.voice_id || 'EXAVITQu4vr4xnSDxMaL',
      modelId: gateway.elevenlabs.ttsModel,
      language: session.language,
      speed: session.voice.speed,
      callId: session.call_id,
      format: channel.format,
      connectTimeoutMs: gateway.timings.componentConnectTimeoutMs,
      log: log.child({ component: 'elevenlabs_tts' }),
    })
    return this.elevenTts
  }

  private createCartesiaStt(): SttStream {
    const { gateway, session, channel, log } = this.host
    return createCartesiaStt({
      apiKey: gateway.cartesia.apiKey!,
      wsBase: wsBase(gateway.cartesia.apiBase),
      version: gateway.cartesia.version,
      config: session.stt,
      format: channel.format,
      connectTimeoutMs: gateway.timings.componentConnectTimeoutMs,
      maxAudioLagMs: gateway.timings.maxAudioLagMs,
      finalizeSilenceMs: gateway.timings.manualFinalizeSilenceMs,
      log: log.child({ component: 'cartesia_stt' }),
    })
  }

  private createScribe(): SttStream {
    const { gateway, session, channel, log } = this.host
    return new ElevenLabsStt({
      apiKey: gateway.elevenlabs.apiKey!,
      wsBase: wsBase(gateway.elevenlabs.apiBase),
      language: session.stt.language || session.language,
      format: channel.format,
      connectTimeoutMs: gateway.timings.componentConnectTimeoutMs,
      maxAudioLagMs: gateway.timings.maxAudioLagMs,
      log: log.child({ component: 'elevenlabs_stt' }),
    })
  }

  private attachStt(stt: SttStream): void {
    this.stt = stt
    stt.on('turn_start', () => this.onTurnStart())
    stt.on('turn_update', (text) => this.onTurnUpdate(text))
    stt.on('eager_end', (text) => this.onEagerEnd(text))
    stt.on('resume', () => this.onResume())
    stt.on('turn_end', (text) => this.onTurnEnd(text))
    stt.on('error', (error) => {
      if (this.stt !== stt) return
      background(this.recoverStt(error, true), this.host.log, 'stt recovery')
    })
  }

  private componentFallbackEvent(component: 'tts' | 'stt', error: ProviderError | null, reason: string): void {
    this.host.emitEvent('component_fallback', {
      provider: 'elevenlabs',
      component,
      code: error?.code ?? reason,
      message: `Cartesia ${component.toUpperCase()} unavailable (${error?.code ?? reason}); ElevenLabs ${component.toUpperCase()} is serving the rest of this call`,
    })
  }

  /** Cartesia quota: event, then the whole call moves to the ElevenLabs agent if possible. */
  private handleQuota(error: ProviderError): boolean {
    this.host.emitEvent('quota_exceeded', {
      provider: 'cartesia',
      component: error.component,
      budget: 'model_credits',
      code: error.code ?? 'quota_exceeded',
      message: 'Cartesia model credits are exhausted',
    })
    if (this.host.requestHandoff({ reason: 'quota_exceeded', error, budget: 'model_credits' })) {
      this.handedOff = true
      return true
    }
    return false
  }

  private async recoverTtsAtStart(error: ProviderError): Promise<boolean> {
    if (error.isQuota && error.provider === 'cartesia' && this.handleQuota(error)) return true
    this.host.reportProviderError(error)
    if (this.tts?.name === 'cartesia' && this.host.gateway.elevenlabs.apiKey) {
      const el = this.createElevenLabsTts()
      try {
        await el.connect()
      } catch (elError) {
        this.host.reportProviderError(toProviderError(elError, 'tts'))
        return false
      }
      this.tts = el
      this.componentFallbackEvent('tts', error, 'connect_failed')
      return true
    }
    return false
  }

  private onSegmentError(utterance: Utterance, segment: Segment, error: ProviderError): void {
    if (this.stopped || this.handedOff) return
    // A dropped socket fails every open segment with the same error: one
    // incident is one breaker failure and one event, not one per segment.
    const firstReport = !this.reportedSegmentErrors.has(error)
    this.reportedSegmentErrors.add(error)
    if (error.isQuota && error.provider === 'cartesia') {
      if (firstReport && this.handleQuota(error)) return
    } else if (firstReport) {
      this.host.reportProviderError(error)
    }
    const current = this.tts
    if (segment.stream.provider === 'cartesia' && current?.name === 'elevenlabs') {
      // Another segment's failure already moved the call to ElevenLabs (one
      // dropped Cartesia socket fails every open context at once).
      utterance.replaceSegment(segment, current)
      return
    }
    if (current?.name === 'cartesia' && this.host.gateway.elevenlabs.apiKey) {
      const el = this.createElevenLabsTts()
      this.tts = el
      this.componentFallbackEvent('tts', error, 'tts_error')
      this.active?.useProvider(el)
      utterance.replaceSegment(segment, el)
      void el.connect().catch((connectError: unknown) => {
        this.host.log.warn('elevenlabs tts connect failed during fallback', { error: String(connectError) })
      })
      return
    }
    if (current?.name === 'cartesia' && !error.isQuota && retryable(error) && (!this.cartesiaTtsRetried || this.retriedTtsError === error)) {
      // No ElevenLabs key: one more try on Cartesia (the socket reconnects itself).
      // Every segment failed by that same incident gets the same retry. A
      // configuration error (unknown voice, bad model) would only fail again.
      this.cartesiaTtsRetried = true
      this.retriedTtsError = error
      utterance.replaceSegment(segment, current)
      return
    }
    utterance.abandon()
    if (this.host.requestHandoff({ reason: 'provider_error', error })) this.handedOff = true
  }

  /** Replaces a failed STT; `live` = the call was already running (replay the ring buffer). */
  private async recoverStt(error: ProviderError, live: boolean): Promise<boolean> {
    if (this.stopped || this.sttSwitching || this.handedOff) return false
    const failed = this.stt
    if (error.isQuota && error.provider === 'cartesia') {
      if (this.handleQuota(error)) return true
    } else {
      this.host.reportProviderError(error)
    }
    this.sttSwitching = true
    if (failed) {
      this.retiredStt.push(failed)
      failed.removeAllListeners()
      void failed.close()
    }
    let replacement: SttStream | null = null
    let fallbackToElevenLabs = false
    if (failed?.provider === 'cartesia' && this.host.gateway.elevenlabs.apiKey) {
      replacement = this.createScribe()
      fallbackToElevenLabs = true
    } else if (failed?.provider === 'cartesia' && !this.cartesiaSttRetried && !error.isQuota && retryable(error)) {
      this.cartesiaSttRetried = true
      replacement = this.createCartesiaStt()
    }
    if (replacement) {
      try {
        await replacement.connect()
        if (this.stopped) {
          void replacement.close()
          return false
        }
        this.attachStt(replacement)
        this.sttSwitching = false
        // Live: the last 2 s the failed STT may have lost. At start: audio no STT has heard yet.
        replacement.sendAudio(this.ring.snapshot())
        if (fallbackToElevenLabs) this.componentFallbackEvent('stt', error, live ? 'stt_error' : 'connect_failed')
        return true
      } catch (replacementError) {
        this.host.reportProviderError(toProviderError(replacementError, 'stt'))
      }
    }
    this.sttSwitching = false
    if (live) {
      this.active?.abandon()
      if (this.host.requestHandoff({ reason: 'provider_error', error })) this.handedOff = true
    }
    return false
  }

  // ─── Speech ─────────────────────────────────────────────────────────────────

  private greet(): void {
    if (this.greeted || this.stopped) return
    this.greeted = true
    if (this.greetingTimer) clearTimeout(this.greetingTimer)
    const greeting = this.host.session.initial_message
    if (!greeting) {
      this.host.noteAgentIdle()
      return
    }
    const utterance = this.newUtterance(null)
    utterance.pushLine(greeting)
    utterance.close()
  }

  private newUtterance(run: TurnRun | null): Utterance {
    if (!this.tts) throw new ProviderError({ provider: 'cartesia', component: 'tts', message: 'TTS not started', code: 'not_started' })
    this.utteranceSeq += 1
    const utterance = new Utterance(
      this.utteranceSeq,
      this.tts,
      this.host.playback,
      this.bps,
      {
        onSegmentError: (u, segment, error) => this.onSegmentError(u, segment, error),
        onFirstAudio: () => {
          if (run) run.firstAudioAt ??= Date.now()
          this.host.noteAgentSpeaking()
        },
        // The browser test call shows each sentence as it starts playing.
        ...(this.host.channel.kind === 'browser'
          ? { onSpeechText: (u: Utterance, text: string) => this.host.channel.notify({ type: 'agent_text', text, turn: u.id }) }
          : {}),
      },
      () => this.host.elapsedSeconds()
    )
    this.active = utterance
    this.host.noteAgentSpeaking()
    void utterance.outcome.then((outcome) => this.onUtteranceOutcome(utterance, run, outcome))
    return utterance
  }

  private onUtteranceOutcome(utterance: Utterance, run: TurnRun | null, outcome: 'played' | 'interrupted' | 'failed'): void {
    if (this.active === utterance) this.active = null
    if (this.stopped || outcome !== 'played') return
    // Sentences whose start-of-playback estimate hadn't fired yet: the whole reply played.
    utterance.flushSpeech()
    const message = utterance.text.trim()
    const toolCalls = run?.toolCalls ?? []
    if (message || toolCalls.length > 0) {
      this.host.addTranscript(
        {
          role: 'agent',
          message,
          time_in_call_secs: utterance.startedAtSeconds ?? this.host.elapsedSeconds(),
          ...(toolCalls.length > 0 ? { tool_calls: [...toolCalls] } : {}),
          ...(run && run.sources.length > 0 ? { sources: [...run.sources] } : {}),
        },
        // Already on screen sentence by sentence.
        { notify: !utterance.speechReported }
      )
    }
    if (!run) {
      // Gateway lines (greeting, prompts) go into history so the model knows they were said.
      if (message) this.pushBlock({ head: null, items: [assistantMessage(message)] })
      if (!this.committed && !this.ending) this.host.noteAgentIdle()
      return
    }
    if (this.committed === run) this.committed = null
    this.afterAgentTurn(run)
  }

  private afterAgentTurn(run: TurnRun): void {
    if (this.stopped) return
    this.logTurn(run, 'played')
    const action = run.pendingAction
    if (action) {
      background(this.executeAction(action), this.host.log, 'tool action')
      return
    }
    if (this.pendingUserTexts.length > 0) {
      const text = this.pendingUserTexts.splice(0).join(' ')
      this.startCommitted(userMessage(text), text)
      return
    }
    this.host.noteAgentIdle()
  }

  private async executeAction(action: ToolAction): Promise<void> {
    if (action.type === 'end_call') {
      this.ending = true
      this.host.endCall('agent_hangup')
      return
    }
    this.ending = true
    if (action.announce) await this.say(action.announce)
    if (this.stopped) return
    const ok = await this.host.transfer(action.to_e164)
    if (ok || this.stopped) return
    this.ending = false
    this.startCommitted(
      developerMessage('The transfer could not be completed. Tell the caller briefly that nobody could be reached right now and offer to take a message.'),
      ''
    )
  }

  // ─── Turns ──────────────────────────────────────────────────────────────────

  private onTurnStart(): void {
    if (this.stopped) return
    this.host.noteCallerActivity()
    this.turnStartedAtSeconds = this.host.elapsedSeconds()
    if (this.voicemailWatch && !this.greeted) {
      if (this.greetingTimer) clearTimeout(this.greetingTimer)
      this.voicemailTurnStartedAt = Date.now()
      if (this.voicemailTimer) clearTimeout(this.voicemailTimer)
      // A greeting machine talks on without pausing; a person says "Hello?".
      this.voicemailTimer = setTimeout(() => this.detectedVoicemail('long_monologue'), this.host.gateway.timings.voicemailSpeechMs + 1_500)
      this.voicemailTimer.unref()
    }
    if (!this.host.session.behavior.allow_interruptions) return
    if (this.isBusy() && !this.ending) this.interrupt()
  }

  private onTurnUpdate(text: string): void {
    if (this.stopped) return
    this.host.channel.notify({ type: 'user_transcript', text, final: false })
    if (this.voicemailWatch && looksLikeVoicemail(text)) this.detectedVoicemail('greeting_phrase')
  }

  private onEagerEnd(text: string): void {
    if (this.stopped || this.ending || !text.trim()) return
    // Speculate only while idle: otherwise the reply would race the one playing.
    if (this.committed || this.active || this.voicemailWatch) return
    this.speculative?.abort()
    const run = new TurnRun(true, text, [...this.flattenHistory(), userMessage(text)])
    this.speculative = run
    this.execute(run)
  }

  private onResume(): void {
    this.speculative?.abort()
    this.speculative = null
  }

  private onTurnEnd(text: string): void {
    if (this.stopped) return
    this.host.noteCallerActivity()
    this.lastTurnEndAt = Date.now()
    const transcript = text.trim()
    const startedAt = this.turnStartedAtSeconds ?? this.host.elapsedSeconds()
    this.turnStartedAtSeconds = null

    if (this.voicemailWatch && transcript) {
      if (this.voicemailTimer) clearTimeout(this.voicemailTimer)
      const monologue = !this.greeted && Date.now() - this.voicemailTurnStartedAt >= this.host.gateway.timings.voicemailSpeechMs
      if (looksLikeVoicemail(transcript) || monologue) {
        this.detectedVoicemail(monologue ? 'long_monologue' : 'greeting_phrase')
        return
      }
      this.voicemailWatch = false
      if (!this.greeted) {
        // A person answered ("Hello?"): the greeting is the reply.
        this.host.addTranscript({ role: 'user', message: transcript, time_in_call_secs: startedAt })
        this.host.channel.notify({ type: 'user_transcript', text: transcript, final: true })
        this.pushBlock({ head: userMessage(transcript), items: [] })
        this.greet()
        return
      }
    }

    if (!transcript) {
      this.speculative?.abort()
      this.speculative = null
      if (this.voicemailWatch && !this.greeted) {
        // Line noise before anyone spoke is not a greeting machine: drop the
        // monologue timer and greet shortly unless real speech starts first.
        if (this.voicemailTimer) clearTimeout(this.voicemailTimer)
        this.voicemailTimer = null
        if (this.greetingTimer) clearTimeout(this.greetingTimer)
        this.greetingTimer = setTimeout(() => this.greet(), NOISE_GREETING_DELAY_MS)
        this.greetingTimer.unref()
        return
      }
      // A cough or a noise barge-in: the agent is idle again, so the silence countdown restarts.
      if (this.greeted && !this.ending && !this.isBusy()) this.host.noteAgentIdle()
      return
    }
    this.host.addTranscript({ role: 'user', message: transcript, time_in_call_secs: startedAt })
    this.host.channel.notify({ type: 'user_transcript', text: transcript, final: true })
    if (this.ending) return

    const speculative = this.speculative
    this.speculative = null
    // Commit only while idle: a gateway line (wrap-up) that started after eager_end
    // must be interrupted or queued through acceptUserTurn, not talked over.
    const idle = !this.committed && !this.active
    if (idle && speculative && !speculative.failed && !speculative.controller.signal.aborted && normalizeTranscript(speculative.eagerText) === normalizeTranscript(transcript)) {
      this.commit(speculative, transcript)
      return
    }
    speculative?.abort()
    this.acceptUserTurn(transcript)
  }

  private acceptUserTurn(text: string): void {
    if (this.committed || this.active) {
      if (!this.host.session.behavior.allow_interruptions) {
        this.pendingUserTexts.push(text)
        return
      }
      this.interrupt()
    }
    this.startCommitted(userMessage(text), text)
  }

  private detectedVoicemail(signal: string): void {
    if (!this.voicemailWatch || this.stopped || this.ending) return
    this.voicemailWatch = false
    this.ending = true
    this.host.log.info('voicemail detected on outbound call', { signal })
    this.active?.interrupt()
    this.host.endCall('voicemail')
  }

  /** Barge-in. */
  private interrupt(): void {
    const run = this.committed
    const utterance = this.active
    this.committed = null
    this.active = null
    if (run && !run.settled) run.abort()
    if (run?.pendingAction) {
      // The caller cut the goodbye/transfer line short: keep the call going.
      run.pendingAction = null
      this.ending = false
      this.pushBlock({ head: developerMessage('The caller interrupted before the call was ended or transferred; the call is still active.'), items: [] })
    }
    if (run) this.logTurn(run, 'interrupted')
    if (!utterance) return
    const heard = utterance.interrupt()
    const toolCalls = run?.toolCalls ?? []
    const streamed = utterance.speechReported
    if (streamed) {
      // The live transcript showed sentences as they started; replace them with what was heard.
      this.host.channel.notify({ type: 'agent_text', text: heard, turn: utterance.id, interrupted: true })
    }
    if (heard || toolCalls.length > 0) {
      this.host.addTranscript(
        {
          role: 'agent',
          message: heard,
          time_in_call_secs: utterance.startedAtSeconds ?? this.host.elapsedSeconds(),
          interrupted: true,
          ...(toolCalls.length > 0 ? { tool_calls: [...toolCalls] } : {}),
          ...(run && run.sources.length > 0 ? { sources: [...run.sources] } : {}),
        },
        { notify: !streamed }
      )
    }
    if (!run) {
      if (heard) this.pushBlock({ head: null, items: [assistantMessage(heard)] })
      return
    }
    run.heardOnInterrupt = heard
    if (run.settled && run.block && run.result) {
      // The reply was fully generated but only partly heard: history keeps what was heard.
      run.block.items = [...run.result.items.slice(0, run.finalHopStart), ...(heard ? [assistantMessage(heard)] : [])]
    }
  }

  private startCommitted(head: ResponseInputItem, text: string): void {
    if (this.stopped) return
    const block: HistoryBlock = { head, items: [] }
    this.pushBlock(block)
    const run = new TurnRun(false, text, this.flattenHistory())
    run.turnEndAt = this.lastTurnEndAt
    run.block = block
    run.commitGate.resolve(true)
    this.committed = run
    this.host.noteAgentSpeaking()
    this.execute(run)
  }

  private commit(run: TurnRun, text: string): void {
    run.speculative = false
    run.turnEndAt = this.lastTurnEndAt
    run.block = { head: userMessage(text), items: [] }
    this.pushBlock(run.block)
    this.committed = run
    this.host.noteAgentSpeaking()
    const held = run.held
    run.held = []
    for (const event of held) this.applyHeld(run, event)
    run.commitGate.resolve(true)
    if (run.settled && run.result) this.finishRun(run, run.result)
  }

  private applyHeld(run: TurnRun, event: HeldEvent): void {
    if (event.kind === 'text') this.speakDelta(run, event.delta, event.hop)
    else if (event.kind === 'tool') this.maybeFiller(run, event.name, event.hop, event.spoken)
    else run.utterance?.endHop()
  }

  private execute(run: TurnRun): void {
    background(this.executeRun(run), this.host.log, 'llm turn')
  }

  private async executeRun(run: TurnRun): Promise<void> {
    let result: LlmTurnResult
    try {
      result = await this.llm.runTurn(
        run.input,
        {
          onText: (delta, hop) => {
            run.firstTextAt ??= Date.now()
            if (run.speculative) run.held.push({ kind: 'text', delta, hop })
            else this.speakDelta(run, delta, hop)
          },
          onToolCallStart: (call, hop, spoken) => {
            if (call.name === 'end_call' && !spoken) run.endCallWithoutText = true
            if (run.speculative) run.held.push({ kind: 'tool', name: call.name, hop, spoken })
            else this.maybeFiller(run, call.name, hop, spoken)
          },
          onHopEnd: (hop) => {
            if (run.speculative) run.held.push({ kind: 'hop_end', hop })
            else run.utterance?.endHop()
          },
          runTool: async (call) => {
            // Side effects wait until the caller really finished the turn.
            if (!(await run.commitGate.promise)) return 'Cancelled: the caller kept talking.'
            return this.runTool(run, call)
          },
          continueAfterTools: () => {
            if (run.pendingAction === null) return true
            // The model hung up without a word: the app's end_call result asks
            // for a short goodbye, so give it one reply (no tools) to say it.
            if (run.pendingAction.type === 'end_call' && run.endCallWithoutText && !run.goodbyeRequested && !run.controller.signal.aborted) {
              run.goodbyeRequested = true
              return 'final_reply'
            }
            return false
          },
        },
        run.controller.signal
      )
    } catch (error) {
      run.settled = true
      this.onRunFailed(run, error)
      return
    }
    run.settled = true
    run.result = result
    run.finalHopStart = result.finalHopStart
    if (!result.aborted) this.host.breakers.success('openai')
    this.host.usage.llm_input_tokens += result.usage.input
    this.host.usage.llm_cached_input_tokens += result.usage.cached
    this.host.usage.llm_output_tokens += result.usage.output
    if (run.speculative) return // held until commit (or dropped)
    this.finishRun(run, result)
  }

  private finishRun(run: TurnRun, result: LlmTurnResult): void {
    if (this.stopped || !run.block) return
    if (result.aborted || run.heardOnInterrupt !== null) {
      // Completed hops (tool calls with their outputs) stay; the unfinished
      // reply is replaced by what the caller actually heard.
      const heard = run.heardOnInterrupt
      run.block.items = [...result.items.slice(0, result.aborted ? result.items.length : result.finalHopStart), ...(heard ? [assistantMessage(heard)] : [])]
      return
    }
    run.block.items = [...result.items]
    const noAnswer = !run.pendingAction && !result.text.trim()
    if (noAnswer && (result.hopLimitReached || run.toolCalls.length === 0)) {
      // Tools kept going without an answer, or the model returned nothing it
      // could say (refusal, empty message): speak the fallback line rather than
      // leave the caller in silence, and let the model know it was said.
      const fallback = this.host.session.fallback_message
      this.ensureRunUtterance(run).pushLine(fallback)
      run.block.items.push(assistantMessage(fallback))
    }
    const utterance = run.utterance
    if (utterance) {
      utterance.close()
      return
    }
    // Nothing spoken (e.g. end_call straight away).
    this.logTurn(run, 'silent')
    if (run.toolCalls.length > 0) {
      this.host.addTranscript({ role: 'agent', message: '', time_in_call_secs: this.host.elapsedSeconds(), tool_calls: [...run.toolCalls] })
    }
    if (this.committed === run) this.committed = null
    this.afterAgentTurn(run)
  }

  private onRunFailed(run: TurnRun, error: unknown): void {
    if (this.stopped) return
    const providerError = isProviderError(error)
      ? error
      : new LlmError(`LLM turn failed: ${error instanceof Error ? error.message : String(error)}`, 'fatal', null, null, error)
    if (run.speculative) {
      // Nobody heard anything yet; turn_end will start a fresh run with its own retry.
      run.failed = true
      return
    }
    this.host.reportProviderError(providerError)
    this.logTurn(run, 'failed')
    const utterance = run.utterance
    if (!utterance || !utterance.hasSpeech) {
      if (this.committed === run) this.committed = null
      utterance?.abandon()
      if (this.host.requestHandoff({ reason: 'llm_error', error: providerError })) this.handedOff = true
      return
    }
    // Part of the reply was already spoken: finish it with the fallback line.
    utterance.pushLine(this.host.session.fallback_message)
    utterance.close()
  }

  private speakDelta(run: TurnRun, delta: string, hop: number): void {
    if (!delta || this.stopped || run.controller.signal.aborted) return
    this.ensureRunUtterance(run).pushDelta(delta, hop)
  }

  private ensureRunUtterance(run: TurnRun): Utterance {
    if (!run.utterance) run.utterance = this.newUtterance(run)
    return run.utterance
  }

  private maybeFiller(run: TurnRun, name: string, hop: number, spokenThisHop: boolean): void {
    if (spokenThisHop || run.fillerHops.has(hop) || run.controller.signal.aborted) return
    const definition = this.host.session.tools.find((t) => t.name === name)
    if (!definition?.pre_tool_speech) return
    run.fillerHops.add(hop)
    const fillers = localizedList(FILLER_PHRASES, this.host.session.language)
    if (fillers.length === 0) return
    this.ensureRunUtterance(run).pushLine(fillers[Math.floor(Math.random() * fillers.length)])
  }

  private async runTool(run: TurnRun, call: LlmToolCall): Promise<string> {
    const { session, app } = this.host
    const definition = session.tools.find((t) => t.name === call.name)
    if (!definition) return JSON.stringify({ error: `Unknown tool ${call.name}. Use only the tools you were given.` })
    let args: Record<string, unknown>
    try {
      const parsed: unknown = call.arguments ? JSON.parse(call.arguments) : {}
      if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) throw new Error('not an object')
      args = parsed as Record<string, unknown>
    } catch {
      return 'The tool arguments were not valid JSON. Call the tool again with valid arguments.'
    }
    const toolStartedAt = Date.now()
    const response = await app.tool({
      session_id: session.session_id,
      call_id: session.call_id,
      tool_call_id: call.callId,
      name: definition.name,
      arguments: args,
    })
    run.toolTimings.push({ name: definition.name, ms: Date.now() - toolStartedAt, ok: response.ok })
    run.toolCalls.push({ name: definition.name, ok: response.ok })
    if (response.sources?.length) run.sources.push(...response.sources.slice(0, Math.max(0, MAX_TURN_SOURCES - run.sources.length)))
    if (response.action && !run.pendingAction) run.pendingAction = response.action
    // end_call must end the call even when the app couldn't be reached.
    if (definition.name === 'end_call' && !run.pendingAction) {
      run.pendingAction = { type: 'end_call', reason: typeof args.reason === 'string' ? args.reason : 'completed' }
    }
    return response.result
  }

  // ─── History & usage ────────────────────────────────────────────────────────

  private pushBlock(block: HistoryBlock): void {
    this.blocks.push(block)
    if (this.blocks.length > MAX_HISTORY_BLOCKS) this.blocks.splice(0, this.blocks.length - HISTORY_TRIM_TO)
  }

  /**
   * One line per agent turn with where the time went, so a slow or silent
   * call can be diagnosed from logs. Times are ms from the caller's turn end
   * (negative = before it, a speculative run); no transcript text.
   */
  private logTurn(run: TurnRun, outcome: 'played' | 'interrupted' | 'silent' | 'failed'): void {
    if (run.logged || this.stopped) return
    run.logged = true
    const base = run.turnEndAt
    const since = (at: number | null) => (at === null || base === null ? null : at - base)
    this.host.log.info('agent turn', {
      outcome,
      speculative: base !== null && run.createdAt < base,
      llm_started_ms: since(run.createdAt),
      llm_first_text_ms: since(run.firstTextAt),
      first_audio_ms: since(run.firstAudioAt),
      tools: run.toolTimings,
      hops: run.result?.hops ?? null,
      goodbye_reply: run.goodbyeRequested,
      input_tokens: run.result?.usage.input ?? null,
      cached_input_tokens: run.result?.usage.cached ?? null,
    })
  }

  private flattenHistory(): ResponseInputItem[] {
    const items: ResponseInputItem[] = [developerMessage(this.host.session.call_context)]
    for (const block of this.blocks) {
      if (block.head) items.push(block.head)
      items.push(...block.items)
    }
    return items
  }

  private syncUsage(): void {
    const usage = this.host.usage
    let cartesiaStt = 0
    let scribe = 0
    for (const stt of [...this.retiredStt, ...(this.stt ? [this.stt] : [])]) {
      if (stt.provider === 'cartesia') cartesiaStt += stt.audioSeconds
      else scribe += stt.audioSeconds
    }
    usage.tts_characters = this.cartesiaTts?.characters ?? 0
    usage.elevenlabs_tts_characters = this.elevenTts?.characters ?? 0
    usage.stt_seconds = round2(cartesiaStt)
    if (cartesiaStt > 0) usage.stt_model = this.host.session.stt.model
    usage.elevenlabs_seconds = round2(usage.elevenlabs_seconds + scribe - this.countedScribe)
    this.countedScribe = scribe
  }

  private countedScribe = 0
}

function round2(value: number): number {
  return Math.round(value * 100) / 100
}

function delayTick(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms).unref())
}

function toProviderError(error: unknown, component: 'tts' | 'stt'): ProviderError {
  if (isProviderError(error)) return error
  return new ProviderError({ provider: 'cartesia', component, message: error instanceof Error ? error.message : String(error), code: 'unknown' })
}
