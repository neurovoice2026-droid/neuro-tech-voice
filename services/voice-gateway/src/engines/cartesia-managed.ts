import type WebSocket from 'ws'
import { bytesForMs, channelFormat, Framer } from '../audio/codec'
import { truncateUtf8 } from '../app-client'
import { wsBase } from '../config'
import type { VoiceToolName } from '../contracts'
import { mentionsQuota, ProviderError } from '../providers/errors'
import { closeSocket, connectWebSocket, parseJsonObject, rawDataToString, safeSend } from '../providers/ws'
import { looksLikeVoicemail } from '../text/voicemail'
import { deferred, delay } from '../util/emitter'
import type { Engine, EngineHost } from './types'

// cartesia_managed: bridge to a Cartesia Managed Agent over
// wss://api.cartesia.ai/v1/agents/websocket/{agent_id} (API 2026-08-14,
// reference refetched 2026-09-17, scratchpad/s2/agent-websocket.md).
//   → session_create {audio:{input_format, output_delivery:'speaking_pace'},
//     dynamic_variables} first, within 10 s; audio sent before session_ready
//     is dropped by Cartesia, so we hold it back
//   ← session_ready {call_id}; audio_output → channel; audio_output_clear →
//     channel clear; client_tool_call → app /tools (prefix 'ntv_' stripped) →
//     client_tool_result (≤ 4 KiB); turn_* → transcript; error {code, fatal}
// Cartesia closes after 120 s without a valid client event: the session feeds
// continuous audio (silence frames when the channel is quiet).
// When the agent hangs up, the socket closes normally without a final
// turn_ended, so open turns are flushed on close.

const TOOL_PREFIX = 'ntv_'
const SEND_FRAME_MS = 40
const DYNAMIC_VARIABLE_ERRORS = new Set(['invalid_dynamic_variables', 'dynamic_variables_not_allowed', 'missing_dynamic_variables'])
const VOICEMAIL_WINDOW_S = 20
/** Longest wait for the agent's last words to play before hanging up. */
const GOODBYE_PLAYBACK_WAIT_MS = 5_000
/** The app's /tools route accepts tool_call_id up to 200 characters. */
const MAX_TOOL_CALL_ID = 200

interface OpenTurn {
  role: 'user' | 'assistant'
  text: string
  startTime: number
}

export class CartesiaManagedEngine implements Engine {
  readonly mode = 'cartesia_managed' as const
  private ws: WebSocket | null = null
  private ready = false
  private stopped = false
  private readyAt = 0
  private sessionOffsetSeconds = 0
  private readonly framer: Framer
  private readonly openTurns = new Map<number, OpenTurn>()
  private readonly toolResults = new Map<string, { name: VoiceToolName; ok: boolean }>()
  private turnToolCalls: { name: VoiceToolName; ok: boolean }[] = []
  private agentSpeakingTimer: NodeJS.Timeout | null = null
  private pendingActions: Promise<void> = Promise.resolve()
  private withVariables = true

  constructor(private readonly host: EngineHost) {
    this.framer = new Framer(bytesForMs(channelFormat(host.channel.format), SEND_FRAME_MS))
  }

  async start(): Promise<void> {
    const { gateway, session } = this.host
    if (!gateway.cartesia.apiKey) {
      throw new ProviderError({ provider: 'cartesia', component: 'agent', message: 'Cartesia is not configured on the gateway', code: 'not_configured', status: 503 })
    }
    if (!session.cartesia_agent_id) {
      throw new ProviderError({ provider: 'cartesia', component: 'agent', message: 'This agent has no Cartesia Managed Agent', code: 'agent_not_found', status: 404 })
    }
    try {
      await this.open()
    } catch (error) {
      // Variables rejected (e.g. an agent without placeholders on an older config): retry once without them.
      if (error instanceof ProviderError && error.code && DYNAMIC_VARIABLE_ERRORS.has(error.code) && this.withVariables && !this.stopped) {
        this.host.log.warn('managed agent rejected dynamic variables; retrying without them', { code: error.code })
        this.withVariables = false
        await this.open()
        return
      }
      throw error
    }
  }

  onCallerAudio(chunk: Buffer): void {
    if (this.stopped || !this.ready) return
    for (const frame of this.framer.push(chunk)) {
      safeSend(this.ws, JSON.stringify({ type: 'audio_input', audio: frame.toString('base64') }))
    }
  }

  onDtmf(digit: string): void {
    if (!this.ready) return
    this.host.noteCallerActivity()
    safeSend(this.ws, JSON.stringify({ type: 'dtmf_input', digit }))
  }

  async say(_text: string): Promise<boolean> {
    // The managed agent owns its voice; the gateway can't inject lines.
    return false
  }

  isBusy(): boolean {
    return this.agentSpeakingTimer !== null || !this.host.playback.isIdle()
  }

  async stop(): Promise<void> {
    if (this.stopped) return
    this.stopped = true
    if (this.agentSpeakingTimer) clearTimeout(this.agentSpeakingTimer)
    this.flushOpenTurns(true)
    this.meter()
    const ws = this.ws
    this.ws = null
    closeSocket(ws, 1000, 'call ended')
  }

  private async open(): Promise<void> {
    const { gateway, session, channel, log } = this.host
    const url = `${wsBase(gateway.cartesia.apiBase)}/v1/agents/websocket/${encodeURIComponent(session.cartesia_agent_id!)}?cartesia_version=${encodeURIComponent(gateway.cartesia.version)}`
    const ws = await connectWebSocket(url, {
      provider: 'cartesia',
      component: 'agent',
      headers: { 'X-API-Key': gateway.cartesia.apiKey! },
      timeoutMs: gateway.timings.agentConnectTimeoutMs,
      maxPayload: 1024 * 1024,
    })
    if (this.stopped) {
      closeSocket(ws)
      return
    }
    this.ws = ws
    const readyDeferred = deferred<ProviderError | null>()

    ws.on('message', (data, isBinary) => {
      // After a stop or failure, late audio and tool calls from this socket are ignored.
      if (isBinary || this.stopped) return
      const msg = parseJsonObject(rawDataToString(data))
      if (!msg) return
      if (msg.type === 'session_ready') {
        this.ready = true
        this.readyAt = Date.now()
        this.sessionOffsetSeconds = this.host.elapsedSeconds()
        if (typeof msg.call_id === 'string') this.host.setCartesiaCallId(msg.call_id)
        readyDeferred.resolve(null)
        return
      }
      if (msg.type === 'error' && !this.ready) {
        readyDeferred.resolve(this.errorFrom(msg))
        return
      }
      this.handle(msg)
    })
    ws.on('error', (err) => log.warn('managed agent socket error', { error: err.message }))
    ws.on('close', (code, reason) => {
      // Settles the session_ready wait even when stop() already detached this socket.
      readyDeferred.resolve(
        new ProviderError({ provider: 'cartesia', component: 'agent', message: `Managed agent closed before session_ready (${code})`, code: `ws_close_${code}`, status: code === 1008 ? 400 : 503 })
      )
      if (this.ws !== ws) return
      this.ws = null
      if (this.stopped || !this.ready) return
      this.onClosed(code, reason.toString())
    })

    const create: Record<string, unknown> = {
      type: 'session_create',
      audio: { input_format: channel.format === 'mulaw_8000' ? 'mulaw_8000' : 'pcm_16000', output_delivery: 'speaking_pace' },
    }
    if (this.withVariables) create.dynamic_variables = this.dynamicVariables()
    safeSend(ws, JSON.stringify(create))

    const timer = setTimeout(
      () =>
        readyDeferred.resolve(
          new ProviderError({ provider: 'cartesia', component: 'agent', message: 'Managed agent did not send session_ready in time', code: 'ready_timeout' })
        ),
      gateway.timings.managedReadyTimeoutMs
    )
    timer.unref()
    const failure = await readyDeferred.promise
    clearTimeout(timer)
    if (failure) {
      this.ready = false
      this.ws = null
      ws.removeAllListeners('close')
      ws.on('close', () => {})
      closeSocket(ws)
      throw failure
    }
    this.host.breakers.success('cartesia_managed')
    log.info('managed agent session ready')
  }

  /** Per-call facts the agent's instructions can reference as {{name}} (docs: agents/dynamic-variables). */
  private dynamicVariables(): Record<string, string | boolean> {
    const { session } = this.host
    const other = session.direction === 'inbound' ? session.from_number : session.to_number
    const now = new Date()
    let localDateTime = now.toISOString()
    try {
      localDateTime = new Intl.DateTimeFormat('en-GB', {
        timeZone: session.timezone,
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        hour12: false,
      }).format(now)
    } catch {
      // Unknown zone: fall back to UTC ISO.
    }
    return {
      ntv_call_id: session.call_id,
      caller_number: other ?? '',
      call_direction: session.direction,
      local_datetime: localDateTime,
      business_timezone: session.timezone,
      is_test_call: session.is_test,
    }
  }

  private handle(msg: Record<string, unknown>): void {
    const { playback } = this.host
    switch (msg.type) {
      case 'audio_output': {
        if (typeof msg.audio !== 'string' || !msg.audio) return
        playback.write(Buffer.from(msg.audio, 'base64'))
        this.markAgentSpeaking()
        return
      }
      case 'audio_output_clear':
        playback.clear()
        this.host.noteCallerActivity()
        return
      case 'dtmf_output':
        // Media Streams can't carry outbound DTMF; the agent's digit is logged only.
        this.host.log.info('managed agent sent a dtmf digit that the phone channel cannot play')
        return
      case 'client_tool_call':
        this.pendingActions = this.pendingActions.then(() => this.runClientTool(msg)).catch((error: unknown) => {
          this.host.log.error('client tool handling failed', { error: error instanceof Error ? error.message : String(error) })
        })
        return
      case 'turn_started': {
        const turn = Number(msg.turn)
        const role = msg.role === 'user' ? 'user' : 'assistant'
        if (!Number.isFinite(turn)) return
        this.openTurns.set(turn, { role, text: '', startTime: Number(msg.start_time) || 0 })
        if (role === 'user') this.host.noteCallerActivity()
        return
      }
      case 'turn_output_text_delta': {
        const open = this.openTurns.get(Number(msg.turn))
        if (open && typeof msg.text === 'string') open.text += msg.text
        return
      }
      case 'turn_ended':
        this.onTurnEnded(msg)
        return
      case 'error': {
        const error = this.errorFrom(msg)
        if (msg.fatal === true) {
          this.fail(error)
        } else {
          this.host.log.warn('managed agent rejected an event', { code: error.code })
        }
        return
      }
      default:
        return
    }
  }

  private onTurnEnded(msg: Record<string, unknown>): void {
    const turn = Number(msg.turn)
    const open = this.openTurns.get(turn)
    this.openTurns.delete(turn)
    const role = msg.role === 'user' ? 'user' : 'assistant'
    const text = typeof msg.text === 'string' ? msg.text.trim() : (open?.text ?? '').trim()
    const startTime = Number(msg.start_time ?? open?.startTime) || 0
    const time = Math.max(0, Math.round((this.sessionOffsetSeconds + startTime) * 100) / 100)
    if (role === 'user') {
      this.host.noteCallerActivity()
      if (!text) return
      this.host.addTranscript({ role: 'user', message: text, time_in_call_secs: time, ...(msg.interrupted === true ? { interrupted: true } : {}) })
      this.host.channel.notify({ type: 'user_transcript', text, final: true })
      if (this.host.session.direction === 'outbound' && this.host.session.behavior.voicemail_detection && time < VOICEMAIL_WINDOW_S && looksLikeVoicemail(text)) {
        this.host.log.info('voicemail detected on outbound managed call')
        this.host.endCall('voicemail')
      }
      return
    }
    const toolCalls = this.collectToolCalls(msg.tool_calls)
    if (!text && toolCalls.length === 0) return
    this.host.addTranscript({
      role: 'agent',
      message: text,
      time_in_call_secs: time,
      ...(msg.interrupted === true ? { interrupted: true } : {}),
      ...(toolCalls.length > 0 ? { tool_calls: toolCalls } : {}),
    })
  }

  private collectToolCalls(raw: unknown): { name: VoiceToolName; ok: boolean }[] {
    const calls: { name: VoiceToolName; ok: boolean }[] = []
    if (Array.isArray(raw)) {
      for (const entry of raw) {
        if (!entry || typeof entry !== 'object') continue
        const record = entry as Record<string, unknown>
        const id = typeof record.id === 'string' ? record.id : null
        const known = id ? this.toolResults.get(id) : undefined
        if (known) {
          calls.push(known)
          if (id) this.toolResults.delete(id)
          continue
        }
        const name = typeof record.name === 'string' ? stripPrefix(record.name) : null
        if (name && this.isAllowedTool(name)) calls.push({ name, ok: true })
      }
    }
    // Client tools we ran that Cartesia didn't list on this turn.
    if (calls.length === 0 && this.turnToolCalls.length > 0) calls.push(...this.turnToolCalls)
    this.turnToolCalls = []
    return calls
  }

  private isAllowedTool(name: string): name is VoiceToolName {
    return this.host.session.tools.some((t) => t.name === name) || name === 'get_call_context'
  }

  private async runClientTool(msg: Record<string, unknown>): Promise<void> {
    const { session, app } = this.host
    const toolCallId = typeof msg.tool_call_id === 'string' && msg.tool_call_id.length > 0 ? msg.tool_call_id : null
    const rawName = typeof msg.tool_name === 'string' ? msg.tool_name : ''
    const expectsResponse = msg.expects_response !== false
    if (!toolCallId) return
    const name = stripPrefix(rawName)
    if (!name || !this.isAllowedTool(name)) {
      this.host.log.warn('managed agent called an unknown client tool', { tool: rawName.slice(0, 64) })
      if (expectsResponse) this.sendToolResult(toolCallId, 'This tool is not available for this business.', true)
      return
    }
    const args = msg.parameters && typeof msg.parameters === 'object' && !Array.isArray(msg.parameters) ? (msg.parameters as Record<string, unknown>) : {}
    // Cartesia matches the result on the exact id; the app only logs it (capped length).
    const response = await app.tool({ session_id: session.session_id, call_id: session.call_id, tool_call_id: toolCallId.slice(0, MAX_TOOL_CALL_ID), name, arguments: args })
    const record = { name, ok: response.ok }
    this.toolResults.set(toolCallId, record)
    this.turnToolCalls.push(record)
    if (expectsResponse && !this.stopped) this.sendToolResult(toolCallId, response.result, !response.ok)

    const action = response.action
    if (!action || this.stopped) return
    // Let the agent say its line ("I'm transferring you now") before acting.
    await this.waitForAgentToFinish()
    if (this.stopped) return
    if (action.type === 'end_call') {
      this.host.endCall('agent_hangup')
      return
    }
    const ok = await this.host.transfer(action.to_e164)
    if (!ok) this.host.log.warn('transfer requested by the managed agent did not go through')
  }

  private sendToolResult(toolCallId: string, result: string, isError: boolean): void {
    safeSend(
      this.ws,
      JSON.stringify({ type: 'client_tool_result', tool_call_id: toolCallId, result: truncateUtf8(result, 4 * 1024), is_error: isError })
    )
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

  private async waitForAgentToFinish(): Promise<void> {
    // The reply to a tool result starts after a short model delay; give it a moment to begin.
    const deadline = Date.now() + 15_000
    await new Promise((resolve) => setTimeout(resolve, 1_200).unref())
    while (!this.stopped && Date.now() < deadline && this.agentSpeakingTimer) {
      await new Promise((resolve) => setTimeout(resolve, 200).unref())
    }
    if (!this.stopped) await this.host.playback.markEnd()
  }

  private flushOpenTurns(interrupted: boolean): void {
    for (const [turn, open] of this.openTurns) {
      this.openTurns.delete(turn)
      const text = open.text.trim()
      if (open.role !== 'assistant' || !text) continue
      this.host.addTranscript({
        role: 'agent',
        message: text,
        time_in_call_secs: Math.round((this.sessionOffsetSeconds + open.startTime) * 100) / 100,
        ...(interrupted ? { interrupted: true } : {}),
      })
    }
  }

  private onClosed(code: number, reason: string): void {
    this.flushOpenTurns(false)
    this.meter()
    if (code === 1000) {
      // Normal close from Cartesia: the agent ended the call (end_call system tool).
      // Its goodbye may still be in the phone's playback buffer: hang up once it played.
      this.host.log.info('managed agent ended the call')
      this.stopped = true
      if (this.agentSpeakingTimer) clearTimeout(this.agentSpeakingTimer)
      this.agentSpeakingTimer = null
      void Promise.race([this.host.playback.markEnd(), delay(GOODBYE_PLAYBACK_WAIT_MS)]).then(() => this.host.endCall('agent_hangup'))
      return
    }
    this.fail(
      new ProviderError({
        provider: 'cartesia',
        component: 'agent',
        message: `Managed agent connection closed unexpectedly (${code}${reason ? ` ${reason.slice(0, 80)}` : ''})`,
        code: `ws_close_${code}`,
        status: code === 1008 ? 400 : 503,
      })
    )
  }

  private fail(error: ProviderError): void {
    if (this.stopped) return
    this.stopped = true
    this.flushOpenTurns(true)
    this.meter()
    const ws = this.ws
    this.ws = null
    closeSocket(ws)
    if (error.isQuota) {
      this.host.emitEvent('quota_exceeded', {
        provider: 'cartesia',
        component: 'agent',
        budget: 'agent_dollars',
        code: error.code ?? 'quota_exceeded',
        message: 'Cartesia voice-agent balance is exhausted',
      })
      this.host.requestHandoff({ reason: 'quota_exceeded', error, budget: 'agent_dollars' })
      return
    }
    this.host.reportProviderError(error)
    this.host.requestHandoff({ reason: 'agent_failed', error })
  }

  private errorFrom(msg: Record<string, unknown>): ProviderError {
    const code = typeof msg.code === 'string' ? msg.code : null
    const message = typeof msg.message === 'string' ? msg.message : ''
    const quota = mentionsQuota(message)
    return new ProviderError({
      provider: 'cartesia',
      component: 'agent',
      code: quota ? 'quota_exceeded' : code,
      status: quota ? 402 : code === 'invalid_event' || (code && DYNAMIC_VARIABLE_ERRORS.has(code)) ? 400 : code === 'agent_failed' ? 500 : null,
      message: `Cartesia managed agent error${code ? ` (${code})` : ''}`,
      fatal: msg.fatal === true,
    })
  }

  private meter(): void {
    if (!this.readyAt) return
    const seconds = (Date.now() - this.readyAt) / 1000
    this.readyAt = Date.now()
    this.host.usage.agent_seconds = Math.round((this.host.usage.agent_seconds + seconds) * 100) / 100
  }
}

function stripPrefix(name: string): VoiceToolName | null {
  const trimmed = name.startsWith(TOOL_PREFIX) ? name.slice(TOOL_PREFIX.length) : name
  return /^[a-z_]{3,40}$/.test(trimmed) ? (trimmed as VoiceToolName) : null
}
