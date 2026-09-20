import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { RESUME_AFTER_HANDOFF } from '../src/text/phrases'
import { TwilioClient } from './helpers/clients'
import { CALL_ID, ORG_ID, makeSessionConfig, startHarness, type Harness } from './helpers/harness'
import { textResponse, toolCallResponse } from './helpers/mock-openai'
import { sleep, waitFor } from './helpers/net'

// Per-call failover inside cartesia_self (contract §1.4).

let h: Harness
let twilio: TwilioClient | null = null

beforeEach(async () => {
  h = await startHarness()
})

afterEach(async () => {
  twilio?.dispose()
  twilio = null
  await h.close()
})

describe('component and agent failover', () => {
  it('switches to ElevenLabs TTS for the rest of the call when Cartesia TTS errors', async () => {
    h.app.sessionConfig = () => makeSessionConfig()
    h.cartesia.ttsOverride = (msg, ctx, send) => {
      if (typeof msg.transcript !== 'string' || !msg.transcript) return false
      send({ type: 'error', context_id: ctx.id, done: true, status_code: 500, error_code: null, title: 'Internal error', message: 'boom', request_id: 'r' })
      return true
    }
    h.openai.queue.push(textResponse('Of course, I can help with that.'))

    twilio = await TwilioClient.connect(h.url, h.token(), { playbackRate: 8 })
    await waitFor(() => h.elevenlabs.ttsText().includes('Hello, thanks for calling Acme Dental.'), 5_000, 'greeting on elevenlabs')
    await waitFor(() => twilio!.mediaBytes > 0, 3_000, 'fallback audio reached twilio')
    const tts = h.elevenlabs.ttsConnections[0]
    expect(tts.url.pathname).toBe('/v1/text-to-speech/EXAVITQu4vr4xnSDxMaL/multi-stream-input')
    expect(tts.url.searchParams.get('model_id')).toBe('eleven_flash_v2_5')
    expect(tts.url.searchParams.get('output_format')).toBe('ulaw_8000')
    expect(tts.url.searchParams.get('language_code')).toBe('en')
    expect(tts.apiKeyHeader).toBe('xi-test-key')

    const fallback = await waitFor(() => h.app.events.find((e) => e.type === 'component_fallback'), 3_000, 'component_fallback event')
    expect(fallback.data).toMatchObject({ provider: 'elevenlabs', component: 'tts' })
    const providerError = h.app.events.find((e) => e.type === 'provider_error')
    expect(providerError?.data).toMatchObject({ provider: 'cartesia', component: 'tts' })

    // Sticky: the next reply goes straight to ElevenLabs.
    await waitFor(() => twilio!.playedOut(), 5_000, 'greeting played')
    const stt = await waitFor(() => h.cartesia.sttConnections[0], 3_000, 'stt')
    const cartesiaContextsBefore = h.cartesia.ttsContexts.size
    stt.send({ type: 'turn.start', request_id: 'r', turn_id: '1' })
    stt.send({ type: 'turn.end', request_id: 'r', transcript: 'I need a cleaning.', turn_id: '1' })
    await waitFor(() => h.elevenlabs.ttsText().includes('Of course, I can help with that.'), 5_000, 'reply on elevenlabs')
    expect(h.cartesia.ttsContexts.size).toBe(cartesiaContextsBefore)
    const before = twilio.mediaBytes
    await waitFor(() => twilio!.mediaBytes > before && twilio!.playedOut(), 5_000, 'reply played')

    twilio.stop()
    const finalize = await waitFor(() => h.app.finalizes[0], 5_000, 'finalize')
    expect(finalize.mode).toBe('cartesia_self')
    expect(finalize.fallback_used).toBe(true)
    expect(finalize.usage.elevenlabs_tts_characters).toBeGreaterThan(30)
    expect(finalize.transcript.map((t) => t.message)).toEqual(['Hello, thanks for calling Acme Dental.', 'I need a cleaning.', 'Of course, I can help with that.'])
  })

  it('counts one dropped TTS socket as one provider failure even with several segments open', async () => {
    h.app.sessionConfig = () => makeSessionConfig({ initial_message: null })
    h.app.toolHandler = () => ({ ok: true, result: '{"slots":[]}', action: null })
    // Slow generation keeps the filler's context open while the reply's context starts.
    h.cartesia.ttsBytesPerChar = 200
    h.cartesia.ttsChunkDelayMs = 100
    let dropped = false
    h.cartesia.ttsOverride = (msg, _ctx, _send, ws) => {
      if (dropped || typeof msg.transcript !== 'string' || !msg.transcript || h.cartesia.ttsContexts.size < 2) return false
      dropped = true
      ws.terminate()
      return true
    }
    h.openai.queue.push(
      toolCallResponse('check_availability', { date_from: '2026-09-18', date_to: null, service: null, time_of_day: 'any' }, 'call_slots'),
      textResponse('Nothing is free tomorrow, sorry.')
    )

    twilio = await TwilioClient.connect(h.url, h.token(), { playbackRate: 8 })
    const stt = await waitFor(() => h.cartesia.sttConnections[0], 3_000, 'stt')
    stt.send({ type: 'turn.start', request_id: 'r', turn_id: '1' })
    stt.send({ type: 'turn.end', request_id: 'r', transcript: 'Anything tomorrow?', turn_id: '1' })

    await waitFor(() => h.elevenlabs.ttsText().includes('Nothing is free tomorrow, sorry.'), 6_000, 'reply re-synthesised on elevenlabs')
    expect(dropped).toBe(true)
    await sleep(200)
    expect(h.app.events.filter((e) => e.type === 'provider_error' && e.data.component === 'tts')).toHaveLength(1)
    expect(h.app.events.filter((e) => e.type === 'component_fallback')).toHaveLength(1)
    expect(h.gateway.breakers.snapshot().cartesia_tts).toBe('closed')
  })

  it('on Cartesia quota_exceeded reports the budget and hands the call to the ElevenLabs agent with the transcript', async () => {
    h.app.sessionConfig = () => makeSessionConfig()
    let quota = false
    h.cartesia.ttsOverride = (msg, ctx, send) => {
      if (!quota || typeof msg.transcript !== 'string' || !msg.transcript) return false
      send({ type: 'error', context_id: ctx.id, done: true, status_code: 402, error_code: 'quota_exceeded', title: 'Quota exceeded', message: 'Out of credits', request_id: 'r' })
      return true
    }
    h.openai.queue.push(textResponse('Let me look at the schedule.'))
    h.elevenlabs.onAgentConnect = (conn) => {
      conn.ws.on('message', () => {
        if (conn.received.length !== 1) return
        conn.send({
          type: 'conversation_initiation_metadata',
          conversation_initiation_metadata_event: { conversation_id: 'conv_test_1', agent_output_audio_format: 'ulaw_8000', user_input_audio_format: 'ulaw_8000' },
        })
        conn.send({ type: 'audio', audio_event: { audio_base_64: Buffer.alloc(800, 0x44).toString('base64'), event_id: 1 } })
        conn.send({ type: 'agent_response', agent_response_event: { agent_response: RESUME_AFTER_HANDOFF.en } })
        conn.send({ type: 'ping', ping_event: { event_id: 7, ping_ms: 20 } })
      })
    }

    twilio = await TwilioClient.connect(h.url, h.token(), { playbackRate: 8 })
    const stt = await waitFor(() => h.cartesia.sttConnections[0], 3_000, 'stt')
    await waitFor(() => twilio!.playedOut(), 5_000, 'greeting played')
    quota = true
    stt.send({ type: 'turn.start', request_id: 'r', turn_id: '1' })
    stt.send({ type: 'turn.end', request_id: 'r', transcript: 'I need to reschedule my appointment.', turn_id: '1' })

    const quotaEvent = await waitFor(() => h.app.events.find((e) => e.type === 'quota_exceeded'), 5_000, 'quota event')
    expect(quotaEvent.data).toMatchObject({ provider: 'cartesia', component: 'tts', budget: 'model_credits', code: 'quota_exceeded' })
    const switched = await waitFor(() => h.app.events.find((e) => e.type === 'mode_switched'), 5_000, 'mode_switched')
    expect(switched.data).toMatchObject({ from_mode: 'cartesia_self', to_mode: 'elevenlabs' })

    const agent = await waitFor(() => h.elevenlabs.agentConnections[0], 5_000, 'elevenlabs agent socket')
    expect(h.elevenlabs.signedUrlRequests[0]).toEqual({ agentId: 'el_agent_test', apiKey: 'xi-test-key' })
    const init = await waitFor(() => agent.received[0], 3_000, 'initiation message')
    expect(init.type).toBe('conversation_initiation_client_data')
    const override = init.conversation_config_override as { agent: { prompt: { prompt: string }; first_message: string; language: string }; tts: { voice_id: string } }
    expect(override.agent.prompt.prompt).toContain('Conversation so far:')
    expect(override.agent.prompt.prompt).toContain('Caller: I need to reschedule my appointment.')
    expect(override.agent.prompt.prompt).toContain('Agent: Hello, thanks for calling Acme Dental.')
    // Customer {{…}} text can't be read as ElevenLabs dynamic variables.
    expect(override.agent.prompt.prompt).toContain('{ {caller_name} }')
    expect(override.agent.prompt.prompt).not.toContain('{{')
    expect(override.agent.first_message).toBe(RESUME_AFTER_HANDOFF.en)
    expect(override.agent.language).toBe('en')
    expect(override.tts.voice_id).toBe('EXAVITQu4vr4xnSDxMaL')
    expect(init.dynamic_variables).toMatchObject({ call_id: CALL_ID, org_id: ORG_ID, twilio_call_sid: 'CAtest', failover_reason: 'quota_exceeded' })

    // Audio passes through; ping gets a pong; caller audio goes to the agent.
    const bytesBefore = twilio.mediaBytes
    await waitFor(() => twilio!.mediaBytes >= bytesBefore + 800 || twilio!.mediaBytes >= 800, 3_000, 'agent audio')
    await waitFor(() => agent.received.find((m) => m.type === 'pong'), 3_000, 'pong')
    expect(agent.received.find((m) => m.type === 'pong')).toEqual({ type: 'pong', event_id: 7 })
    await twilio.sendAudio(Buffer.alloc(800, 0xfe))
    await waitFor(() => agent.received.find((m) => typeof m.user_audio_chunk === 'string'), 3_000, 'user audio chunk')

    twilio.stop()
    const finalize = await waitFor(() => h.app.finalizes[0], 5_000, 'finalize')
    expect(finalize.mode).toBe('elevenlabs')
    expect(finalize.fallback_used).toBe(true)
    expect(finalize.fallback_reason).toBe('quota_exceeded')
    expect(finalize.elevenlabs_conversation_id).toBe('conv_test_1')
    expect(finalize.end_reason).toBe('caller_hangup')
    expect(finalize.usage.elevenlabs_seconds).toBeGreaterThan(0)
    expect(finalize.transcript.map((t) => t.message)).toContain(RESUME_AFTER_HANDOFF.en)
  })

  it('hands off to the ElevenLabs agent when OpenAI fails twice before anything was spoken', async () => {
    h.app.sessionConfig = () => makeSessionConfig({ initial_message: null })
    h.openai.queue.push({ status: 503, errorBody: { error: { message: 'overloaded', type: 'server_error', code: 'server_is_overloaded' } } })
    h.openai.queue.push({ status: 503, errorBody: { error: { message: 'overloaded', type: 'server_error', code: 'server_is_overloaded' } } })
    h.elevenlabs.onAgentConnect = (conn) => {
      conn.ws.once('message', () => {
        conn.send({ type: 'conversation_initiation_metadata', conversation_initiation_metadata_event: { conversation_id: 'conv_llm', agent_output_audio_format: 'ulaw_8000', user_input_audio_format: 'ulaw_8000' } })
      })
    }
    twilio = await TwilioClient.connect(h.url, h.token(), { playbackRate: 8 })
    const stt = await waitFor(() => h.cartesia.sttConnections[0], 3_000, 'stt')
    stt.send({ type: 'turn.start', request_id: 'r', turn_id: '1' })
    stt.send({ type: 'turn.end', request_id: 'r', transcript: 'Hello?', turn_id: '1' })
    const switched = await waitFor(() => h.app.events.find((e) => e.type === 'mode_switched'), 5_000, 'mode_switched')
    expect(switched.data).toMatchObject({ from_mode: 'cartesia_self', to_mode: 'elevenlabs', provider: 'openai', component: 'llm' })
    // One retry, only because nothing had been spoken.
    expect(h.openai.requests).toHaveLength(2)
    await waitFor(() => h.elevenlabs.agentConnections[0], 3_000, 'agent connected')
    twilio.stop()
    const finalize = await waitFor(() => h.app.finalizes[0], 5_000, 'finalize')
    expect(finalize.fallback_reason).toBe('llm_error')
  })

  it('moves STT to ElevenLabs Scribe on a Cartesia STT error and replays the last 2 s of caller audio', async () => {
    h.app.sessionConfig = () => makeSessionConfig({ initial_message: null })
    h.openai.queue.push(textResponse('Yes, we are open on Saturday.'))
    twilio = await TwilioClient.connect(h.url, h.token(), { playbackRate: 8 })
    const stt = await waitFor(() => h.cartesia.sttConnections[0], 3_000, 'cartesia stt')
    await twilio.sendAudio(Buffer.alloc(8000, 0x7e))
    stt.send({ type: 'error', error_code: null, status_code: 500, title: 'Internal error', message: 'boom', request_id: 'r' })

    const scribe = await waitFor(() => h.elevenlabs.sttConnections[0], 3_000, 'scribe connected')
    expect(Object.fromEntries(scribe.url.searchParams)).toMatchObject({
      model_id: 'scribe_v2_realtime',
      audio_format: 'ulaw_8000',
      language_code: 'en',
      commit_strategy: 'vad',
    })
    // Replay: ~2 s of μ-law arrives (paced) even though the caller sent nothing new.
    await waitFor(() => scribe.chunks.filter((c) => c.message_type === 'input_audio_chunk').length >= 15, 4_000, 'replayed audio')
    const first = scribe.chunks.find((c) => c.message_type === 'input_audio_chunk')!
    expect(first).toMatchObject({ commit: false, sample_rate: 8000 })
    expect(Buffer.from(String(first.audio_base_64), 'base64')[0]).toBe(0x7e)

    const fallback = await waitFor(() => h.app.events.find((e) => e.type === 'component_fallback'), 3_000, 'component_fallback')
    expect(fallback.data).toMatchObject({ provider: 'elevenlabs', component: 'stt' })

    scribe.send({ message_type: 'partial_transcript', text: 'Are you open' })
    scribe.send({ message_type: 'committed_transcript', text: 'Are you open on Saturday?' })
    await waitFor(() => h.openai.requests[0], 3_000, 'llm request')
    expect((h.openai.requests[0].body.input as Record<string, unknown>[]).at(-1)).toEqual({ role: 'user', content: 'Are you open on Saturday?' })
    twilio.stop()
    const finalize = await waitFor(() => h.app.finalizes[0], 5_000, 'finalize')
    expect(finalize.fallback_used).toBe(true)
    expect(finalize.usage.elevenlabs_seconds).toBeGreaterThan(1)
  })

  it('hangs up an outbound call that reaches voicemail without greeting the machine', async () => {
    h.app.sessionConfig = () =>
      makeSessionConfig({
        direction: 'outbound',
        behavior: { allow_interruptions: true, silence_timeout_seconds: null, max_duration_seconds: 600, record: false, voicemail_detection: true },
      })
    twilio = await TwilioClient.connect(h.url, h.token(), { playbackRate: 8 })
    const stt = await waitFor(() => h.cartesia.sttConnections[0], 3_000, 'stt')
    stt.send({ type: 'turn.start', request_id: 'r', turn_id: '1' })
    stt.send({ type: 'turn.update', request_id: 'r', transcript: "Hi, you've reached Maria. Please leave a message after the tone.", turn_id: '1' })
    const hangup = await waitFor(() => h.app.callControls.find((c) => c.action === 'hangup'), 5_000, 'hangup')
    expect(hangup).toBeDefined()
    twilio.stop()
    const finalize = await waitFor(() => h.app.finalizes[0], 5_000, 'finalize')
    expect(finalize.end_reason).toBe('voicemail')
    expect(h.cartesia.spokenText()).not.toContain('thanks for calling')
    expect(h.openai.requests).toHaveLength(0)
  })

  it('closes the Twilio stream (app fallback answers) when no provider can serve the call', async () => {
    await h.close()
    h = await startHarness({ providers: { cartesia: false, openai: false, elevenlabs: false } })
    h.app.sessionConfig = () => makeSessionConfig()
    twilio = await TwilioClient.connect(h.url, h.token())
    await waitFor(() => twilio!.closed, 5_000, 'stream closed')
    // No hang-up: the call must stay up for the app's <Connect action> fallback.
    expect(h.app.callControls).toHaveLength(0)
    const finalize = await waitFor(() => h.app.finalizes[0], 5_000, 'finalize')
    expect(finalize.end_reason).toBe('error')
  })

  it('ends the call on a rejected voice without metering characters Cartesia never billed (live run S6)', async () => {
    await h.close()
    h = await startHarness({ providers: { elevenlabs: false } })
    h.app.sessionConfig = () => makeSessionConfig({ voice: { ...makeSessionConfig().voice, voice_id: '00000000-0000-4000-8000-000000000000' } })
    // What the real API answered for an unknown voice id: a per-context error, no audio, socket stays open.
    h.cartesia.ttsOverride = (msg, ctx, send) => {
      if (typeof msg.transcript !== 'string' || !msg.transcript) return true
      send({ type: 'error', context_id: ctx.id, done: true, status_code: 404, error_code: 'voice_not_found', title: 'Voice not found', message: 'Voice not found', request_id: 'r' })
      return true
    }
    twilio = await TwilioClient.connect(h.url, h.token())
    await waitFor(() => twilio!.closed, 5_000, 'stream closed')
    expect(h.app.callControls).toHaveLength(0)
    const finalize = await waitFor(() => h.app.finalizes[0], 5_000, 'finalize')
    expect(finalize.end_reason).toBe('error')
    expect(finalize.fallback_reason).toBe('provider_error')
    // A configuration error isn't retried: one provider_error, one rejected context (live S6 sent two).
    expect(h.app.events.filter((e) => e.type === 'provider_error').map((e) => e.data.code)).toEqual(['voice_not_found'])
    expect(h.cartesia.ttsMessages.filter((m) => typeof m.transcript === 'string' && m.transcript)).toHaveLength(1)
    // "Errors will not consume credits": failed contexts are not usage.
    expect(finalize.usage.tts_characters).toBe(0)
    expect(twilio.mediaBytes).toBe(0)
  })
})
