import type WebSocket from 'ws'
import { AudioConverter, bytesForMs, channelFormat, Framer, MULAW_8000, type AudioFormat } from '../audio/codec'
import type { TranscriptTurn } from '../contracts'
import { ProviderError } from '../providers/errors'
import { closeSocket, connectWebSocket, parseJsonObject, rawDataToString, safeSend } from '../providers/ws'
import { localized, RESUME_AFTER_HANDOFF } from '../text/phrases'
import { looksLikeVoicemail } from '../text/voicemail'
import { deferred, delay } from '../util/emitter'
import type { Engine, EngineHost } from './types'

// elevenlabs: bridge to the org's ElevenLabs agent (elevenlabs-fallback.md §2.2, §5.3–5.4).
//   GET /v1/convai/conversation/get-signed-url?agent_id=… (xi-api-key) → wss URL
//   → conversation_initiation_client_data with conversation_config_override
//     {agent:{prompt:{prompt}, first_message, language}, tts:{voice_id}} and
//     dynamic_variables (same names the app's register-call fallback uses)
//   → {user_audio_chunk}; ← audio, interruption (→ channel clear), ping (→ pong),
//     user_transcript / agent_response (→ transcript)
// The agent is configured for μ-law 8 kHz (S4 sync), so Twilio audio passes
// straight through and the browser channel transcodes PCM16 16 kHz ⇄ μ-law 8 kHz;
// conversation_initiation_metadata tells us the real formats and we adapt.
// A mid-call handoff sends the conversation so far in the prompt and a short
// "sorry, I'm back" first message.

const SIGNED_URL_TIMEOUT_MS = 4_000
const INIT_METADATA_TIMEOUT_MS = 5_000
const SEND_FRAME_MS = 50
const HISTORY_TURNS = 20
const MAX_PRIOR_TRANSCRIPT_CHARS = 6_000
const VOICEMAIL_WINDOW_S = 20
/** Longest wait for the agent's last words to play before hanging up. */
const GOODBYE_PLAYBACK_WAIT_MS = 5_000

export interface ElevenLabsHandoff {
  reason: string
  transcript: readonly TranscriptTurn[]
}

/** ElevenLabs parses {{name}} as a dynamic variable; customer text must not trigger that. */
export function escapeDynamicVariableSyntax(text: string): string {
  return text.replace(/\{\{/g, '{ {').replace(/\}\}/g, '} }')
}

function parseFormat(value: unknown): AudioFormat | null {
  if (typeof value !== 'string') return null
  const match = /^(ulaw|pcm)_(\d{4,5})$/.exec(value)
  if (!match) return null
  return { encoding: match[1] === 'ulaw' ? 'mulaw' : 'pcm16', sampleRate: Number(match[2]) }
}

export function conversationSoFar(transcript: readonly TranscriptTurn[]): string {
  const lines = transcript
    .filter((t) => t.message.trim())
    .slice(-HISTORY_TURNS)
    .map((t) => `${t.role === 'agent' ? 'Agent' : 'Caller'}: ${t.message.trim()}${t.interrupted ? ' (interrupted)' : ''}`)
  let text = lines.join('\n')
  if (text.length > MAX_PRIOR_TRANSCRIPT_CHARS) text = `…${text.slice(text.length - MAX_PRIOR_TRANSCRIPT_CHARS)}`
  return text
}

export class ElevenLabsAgentEngine implements Engine {
  readonly mode = 'elevenlabs' as const
  private ws: WebSocket | null = null
  private stopped = false
  private started = false
  private startedAt = 0
  private conversationStartSeconds = 0
  private inputConverter: AudioConverter
  private outputConverter: AudioConverter
  private framer: Framer
  private agentSpeakingTimer: NodeJS.Timeout | null = null
  private lastAgentTurn: TranscriptTurn | null = null

  constructor(
    private readonly host: EngineHost,
    private readonly handoff: ElevenLabsHandoff | null
  ) {
    const channelFmt = channelFormat(host.channel.format)
    // Until the metadata says otherwise, assume the configured μ-law 8 kHz agent.
    this.inputConverter = new AudioConverter(channelFmt, MULAW_8000)
    this.outputConverter = new AudioConverter(MULAW_8000, channelFmt)
    this.framer = new Framer(bytesForMs(channelFmt, SEND_FRAME_MS))
  }

  async start(): Promise<void> {
    const { gateway, session, log } = this.host
    if (!gateway.elevenlabs.apiKey) {
      throw new ProviderError({ provider: 'elevenlabs', component: 'agent', message: 'ElevenLabs is not configured on the gateway', code: 'not_configured', status: 503 })
    }
    if (!session.elevenlabs.agent_id) {
      throw new ProviderError({ provider: 'elevenlabs', component: 'agent', message: 'This agent has no ElevenLabs fallback agent', code: 'agent_not_found', status: 404 })
    }
    const signedUrl = await this.fetchSignedUrl(gateway.elevenlabs.apiKey, session.elevenlabs.agent_id)
    if (this.stopped) return
    const ws = await connectWebSocket(signedUrl, {
      provider: 'elevenlabs',
      component: 'agent',
      timeoutMs: gateway.timings.agentConnectTimeoutMs,
      maxPayload: 4 * 1024 * 1024,
    })
    if (this.stopped) {
      closeSocket(ws)
      return
    }
    this.ws = ws
    const metadata = deferred<ProviderError | null>()

    ws.on('message', (data, isBinary) => {
      // After a stop, late audio from this socket must not reach the caller.
      if (isBinary || this.stopped) return
      const msg = parseJsonObject(rawDataToString(data))
      if (!msg) return
      if (msg.type === 'conversation_initiation_metadata') {
        this.onMetadata(msg)
        metadata.resolve(null)
        return
      }
      this.handle(msg)
    })
    ws.on('error', (err) => log.warn('elevenlabs agent socket error', { error: err.message }))
    ws.on('close', (code, reason) => {
      // Settles the setup wait even when stop() already detached this socket.
      metadata.resolve(
        new ProviderError({
          provider: 'elevenlabs',
          component: 'agent',
          message: `ElevenLabs agent closed during setup (${code})`,
          code: `ws_close_${code}`,
          status: code === 1008 ? 401 : 503,
        })
      )
      if (this.ws !== ws) return
      this.ws = null
      if (!this.stopped && this.started) this.onClosed(code, reason.toString())
    })

    safeSend(ws, JSON.stringify(this.initiationMessage()))
    const timer = setTimeout(
      () => metadata.resolve(new ProviderError({ provider: 'elevenlabs', component: 'agent', message: 'ElevenLabs agent did not start in time', code: 'ready_timeout' })),
      INIT_METADATA_TIMEOUT_MS
    )
    timer.unref()
    const failure = await metadata.promise
    clearTimeout(timer)
    if (failure) {
      this.ws = null
      ws.removeAllListeners('close')
      ws.on('close', () => {})
      closeSocket(ws)
      throw failure
    }
    this.started = true
    this.startedAt = Date.now()
    this.conversationStartSeconds = this.host.elapsedSeconds()
    this.host.breakers.success('elevenlabs_agent')
    // Anything the previous engine left in the playback buffer goes before the new voice starts.
    if (this.handoff) this.host.playback.clear()
    log.info('elevenlabs agent bridge started', { handoff: this.handoff?.reason ?? null })
  }

  onCallerAudio(chunk: Buffer): void {
    if (!this.started || this.stopped) return
    for (const frame of this.framer.push(chunk)) {
      const converted = this.inputConverter.convert(frame)
      if (converted.length > 0) safeSend(this.ws, JSON.stringify({ user_audio_chunk: converted.toString('base64') }))
    }
  }

  onDtmf(digit: string): void {
    if (!this.started) return
    // No DTMF input on the conversation socket; a non-interrupting note carries it.
    safeSend(this.ws, JSON.stringify({ type: 'contextual_update', text: `The caller pressed ${digit} on the keypad.` }))
  }

  async say(_text: string): Promise<boolean> {
    return false
  }

  isBusy(): boolean {
    return this.agentSpeakingTimer !== null || !this.host.playback.isIdle()
  }

  async stop(): Promise<void> {
    if (this.stopped) return
    this.stopped = true
    if (this.agentSpeakingTimer) clearTimeout(this.agentSpeakingTimer)
    this.meter()
    const ws = this.ws
    this.ws = null
    closeSocket(ws, 1000, 'call ended')
  }

  private async fetchSignedUrl(apiKey: string, agentId: string): Promise<string> {
    const { gateway } = this.host
    const url = `${gateway.elevenlabs.apiBase}/v1/convai/conversation/get-signed-url?agent_id=${encodeURIComponent(agentId)}`
    let res: Response
    try {
      res = await fetch(url, { headers: { 'xi-api-key': apiKey }, signal: AbortSignal.timeout(SIGNED_URL_TIMEOUT_MS) })
    } catch (error) {
      const timedOut = error instanceof Error && (error.name === 'TimeoutError' || error.name === 'AbortError')
      throw new ProviderError({
        provider: 'elevenlabs',
        component: 'agent',
        message: timedOut ? 'ElevenLabs signed URL request timed out' : 'ElevenLabs signed URL request failed',
        code: timedOut ? 'connect_timeout' : 'network_error',
        cause: error,
      })
    }
    let body: Record<string, unknown> | null = null
    try {
      body = (await res.json()) as Record<string, unknown>
    } catch {
      body = null
    }
    if (!res.ok) {
      const detail = body?.detail && typeof body.detail === 'object' ? (body.detail as Record<string, unknown>) : null
      const code = typeof detail?.status === 'string' ? detail.status : typeof detail?.code === 'string' ? detail.code : null
      throw new ProviderError({ provider: 'elevenlabs', component: 'agent', message: `ElevenLabs signed URL refused (${res.status})`, status: res.status, code })
    }
    const signed = typeof body?.signed_url === 'string' ? body.signed_url : null
    const allowInsecure = gateway.elevenlabs.apiBase.startsWith('http://')
    if (!signed || !(signed.startsWith('wss://') || (allowInsecure && signed.startsWith('ws://')))) {
      throw new ProviderError({ provider: 'elevenlabs', component: 'agent', message: 'ElevenLabs returned no usable signed URL', code: 'invalid_response', status: 502 })
    }
    return signed
  }

  private initiationMessage(): Record<string, unknown> {
    const { session } = this.host
    const fallback = session.elevenlabs
    let prompt = fallback.prompt
    if (this.handoff && this.handoff.transcript.length > 0) {
      const history = conversationSoFar(this.handoff.transcript)
      if (history) prompt = `${prompt}\n\nConversation so far:\n${history}\n\nContinue the conversation from here without greeting the caller again.`
    }
    const firstMessage = this.handoff ? localized(RESUME_AFTER_HANDOFF, fallback.language || session.language) : fallback.first_message
    const agent: Record<string, unknown> = {
      prompt: { prompt: escapeDynamicVariableSyntax(prompt) },
      language: fallback.language || session.language,
    }
    if (firstMessage) agent.first_message = escapeDynamicVariableSyntax(firstMessage)
    const override: Record<string, unknown> = { agent }
    if (fallback.voice_id) override.tts = { voice_id: fallback.voice_id }
    return {
      type: 'conversation_initiation_client_data',
      conversation_config_override: override,
      dynamic_variables: {
        call_id: session.call_id,
        org_id: session.org_id,
        twilio_call_sid: session.twilio_call_sid ?? '',
        failover_reason: this.handoff?.reason ?? 'routed',
        prior_transcript: this.handoff ? conversationSoFar(this.handoff.transcript).slice(-2_000) : '',
      },
    }
  }

  private onMetadata(msg: Record<string, unknown>): void {
    const event = (msg.conversation_initiation_metadata_event ?? {}) as Record<string, unknown>
    if (typeof event.conversation_id === 'string') this.host.setElevenLabsConversationId(event.conversation_id)
    const channelFmt = channelFormat(this.host.channel.format)
    const input = parseFormat(event.user_input_audio_format)
    const output = parseFormat(event.agent_output_audio_format)
    if (input) this.inputConverter = new AudioConverter(channelFmt, input)
    if (output) this.outputConverter = new AudioConverter(output, channelFmt)
    if ((input && input.encoding !== 'mulaw') || (output && output.encoding !== 'mulaw')) {
      this.host.log.warn('elevenlabs agent is not configured for μ-law 8 kHz; transcoding', {
        input: event.user_input_audio_format ?? null,
        output: event.agent_output_audio_format ?? null,
      })
    }
  }

  private handle(msg: Record<string, unknown>): void {
    const { playback, log } = this.host
    switch (msg.type) {
      case 'audio': {
        const event = (msg.audio_event ?? {}) as Record<string, unknown>
        if (typeof event.audio_base_64 !== 'string' || !event.audio_base_64) return
        const audio = this.outputConverter.convert(Buffer.from(event.audio_base_64, 'base64'))
        if (audio.length > 0) playback.write(audio)
        this.markAgentSpeaking()
        return
      }
      case 'interruption':
        playback.clear()
        this.host.noteCallerActivity()
        if (this.lastAgentTurn) this.lastAgentTurn.interrupted = true
        return
      case 'ping': {
        const event = (msg.ping_event ?? {}) as Record<string, unknown>
        safeSend(this.ws, JSON.stringify({ type: 'pong', event_id: event.event_id }))
        return
      }
      case 'user_transcript': {
        const event = (msg.user_transcription_event ?? {}) as Record<string, unknown>
        const text = typeof event.user_transcript === 'string' ? event.user_transcript.trim() : ''
        this.host.noteCallerActivity()
        if (!text) return
        const time = this.host.elapsedSeconds()
        this.host.addTranscript({ role: 'user', message: text, time_in_call_secs: time })
        this.host.channel.notify({ type: 'user_transcript', text, final: true })
        const { session } = this.host
        if (!this.handoff && session.direction === 'outbound' && session.behavior.voicemail_detection && time - this.conversationStartSeconds < VOICEMAIL_WINDOW_S && looksLikeVoicemail(text)) {
          log.info('voicemail detected on outbound elevenlabs call')
          this.host.endCall('voicemail')
        }
        return
      }
      case 'agent_response': {
        const event = (msg.agent_response_event ?? {}) as Record<string, unknown>
        const text = typeof event.agent_response === 'string' ? event.agent_response.trim() : ''
        if (!text) return
        const turn: TranscriptTurn = { role: 'agent', message: text, time_in_call_secs: this.host.elapsedSeconds() }
        this.lastAgentTurn = turn
        this.host.addTranscript(turn)
        return
      }
      case 'agent_response_correction': {
        const event = (msg.agent_response_correction_event ?? {}) as Record<string, unknown>
        const corrected = typeof event.corrected_agent_response === 'string' ? event.corrected_agent_response.trim() : null
        if (this.lastAgentTurn && corrected !== null) {
          // Truncated after an interruption: keep what was actually said.
          this.lastAgentTurn.message = corrected
          this.lastAgentTurn.interrupted = true
        }
        return
      }
      default:
        return
    }
  }

  private markAgentSpeaking(): void {
    this.host.noteAgentSpeaking()
    if (this.agentSpeakingTimer) clearTimeout(this.agentSpeakingTimer)
    this.agentSpeakingTimer = setTimeout(() => {
      this.agentSpeakingTimer = null
      void this.host.playback.markEnd().then((outcome) => {
        if (outcome === 'played' && !this.agentSpeakingTimer && !this.stopped) this.host.noteAgentIdle()
      })
    }, 700)
    this.agentSpeakingTimer.unref()
  }

  private onClosed(code: number, reason: string): void {
    this.meter()
    this.stopped = true
    if (code === 1000) {
      // The agent ended the conversation; let its last words finish playing first.
      this.host.log.info('elevenlabs agent ended the conversation')
      if (this.agentSpeakingTimer) clearTimeout(this.agentSpeakingTimer)
      this.agentSpeakingTimer = null
      void Promise.race([this.host.playback.markEnd(), delay(GOODBYE_PLAYBACK_WAIT_MS)]).then(() => this.host.endCall('agent_hangup'))
      return
    }
    const error = new ProviderError({
      provider: 'elevenlabs',
      component: 'agent',
      message: `ElevenLabs agent connection closed unexpectedly (${code}${reason ? ` ${reason.slice(0, 80)}` : ''})`,
      code: `ws_close_${code}`,
      status: code === 1008 ? 401 : 503,
    })
    this.host.reportProviderError(error)
    // Nothing further to fall back to inside the gateway.
    this.host.requestHandoff({ reason: 'agent_failed', error })
  }

  private meter(): void {
    if (!this.startedAt) return
    const seconds = (Date.now() - this.startedAt) / 1000
    this.startedAt = Date.now()
    this.host.usage.elevenlabs_seconds = Math.round((this.host.usage.elevenlabs_seconds + seconds) * 100) / 100
  }
}
