import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { FILLER_PHRASES, GOODBYE_SILENCE, STILL_THERE } from '../src/text/phrases'
import { TwilioClient } from './helpers/clients'
import { CALL_ID, makeSessionConfig, startHarness, type Harness } from './helpers/harness'
import { textResponse, toolCallResponse } from './helpers/mock-openai'
import { sleep, waitFor } from './helpers/net'

// End-to-end cartesia_self calls over a simulated Twilio stream.

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

function sttTurns() {
  return waitFor(() => h.cartesia.sttConnections.find((c) => c.url.pathname === '/stt/turns/websocket'), 3_000, 'stt connection')
}

async function greetingPlayed() {
  await waitFor(() => h.cartesia.spokenText().includes('thanks for calling'), 3_000, 'greeting sent to TTS')
  await waitFor(() => twilio!.playedOut(), 5_000, 'greeting played')
}

describe('cartesia_self over Twilio', () => {
  it('runs a turn with a tool call, then ends the call after the goodbye plays', async () => {
    h.app.sessionConfig = () => makeSessionConfig()
    h.app.toolHandler = (req) =>
      req.name === 'check_availability'
        ? { ok: true, result: '{"slots":["2026-09-18T10:00:00+03:00"]}', action: null }
        : { ok: true, result: 'Ending the call.', action: { type: 'end_call', reason: 'booked' } }
    h.openai.queue.push(
      toolCallResponse('check_availability', { date_from: '2026-09-18', date_to: null, service: null, time_of_day: 'any' }, 'call_avail'),
      toolCallResponse('end_call', { reason: 'booked' }, 'call_end', { text: 'Tomorrow at ten works. Goodbye!' })
    )

    twilio = await TwilioClient.connect(h.url, h.token(), { playbackRate: 4 })
    const stt = await sttTurns()
    await greetingPlayed()

    // Keyterms and turn thresholds go on the STT URL.
    expect(stt.url.searchParams.get('model')).toBe('ink-2')
    expect(stt.url.searchParams.get('encoding')).toBe('pcm_mulaw')
    expect(stt.url.searchParams.get('sample_rate')).toBe('8000')
    expect(stt.url.searchParams.getAll('keyterm')).toEqual(['Acme Dental'])
    // Multi-word keyterms use %20, as Cartesia documents (URLSearchParams would write '+').
    expect(stt.url.search).toContain('keyterm=Acme%20Dental')
    expect(stt.url.search).not.toContain('Acme+Dental')
    expect(stt.url.searchParams.get('turn_end_timeout_ms')).toBe('5600')

    await twilio.sendAudio(Buffer.alloc(1600, 0xff))
    stt.send({ type: 'turn.start', request_id: 'r', turn_id: '1' })
    stt.send({ type: 'turn.update', request_id: 'r', transcript: 'Can I book', turn_id: '1' })
    stt.send({ type: 'turn.end', request_id: 'r', transcript: 'Can I book an appointment tomorrow?', turn_id: '1' })

    const hangup = await waitFor(() => h.app.callControls.find((c) => c.action === 'hangup'), 8_000, 'hangup')
    expect(hangup.call_id).toBe(CALL_ID)
    // The goodbye was spoken and fully played before the hang-up request.
    expect(h.cartesia.spokenText()).toContain('Tomorrow at ten works. Goodbye!')
    const fillers = FILLER_PHRASES.en
    expect(fillers.some((f) => h.cartesia.spokenText().includes(f))).toBe(true)
    expect(twilio.marksPending).toBe(0)
    twilio.stop()

    const finalize = await waitFor(() => h.app.finalizes[0], 5_000, 'finalize')

    // OpenAI request settings (openai-docs.md §2).
    const first = h.openai.requests[0].body
    expect(first.store).toBe(false)
    expect(first.stream).toBe(true)
    expect(first.reasoning).toEqual({ effort: 'none' })
    expect(first.text).toEqual({ verbosity: 'low' })
    expect(first.parallel_tool_calls).toBe(false)
    expect(first.stream_options).toEqual({ include_obfuscation: false })
    expect(first.safety_identifier).toBe('a1b2c3d4e5f60718293a4b5c6d7e8f90')
    expect(first.instructions).toBe('You are Ana, the AI receptionist for Acme Dental.')
    const tools = first.tools as { name: string; strict: boolean }[]
    expect(tools.map((t) => t.name)).toEqual(['check_availability', 'end_call'])
    expect(tools.every((t) => t.strict)).toBe(true)
    const input = first.input as Record<string, unknown>[]
    expect(input[0]).toEqual({ role: 'developer', content: makeSessionConfig().call_context })
    expect(input).toContainEqual({ role: 'assistant', content: 'Hello, thanks for calling Acme Dental.' })
    expect(input.at(-1)).toEqual({ role: 'user', content: 'Can I book an appointment tomorrow?' })

    // Second hop replays the function call and its output.
    const second = h.openai.requests[1].body.input as Record<string, unknown>[]
    expect(second).toContainEqual(expect.objectContaining({ type: 'function_call', call_id: 'call_avail', name: 'check_availability' }))
    expect(second).toContainEqual({ type: 'function_call_output', call_id: 'call_avail', output: '{"slots":["2026-09-18T10:00:00+03:00"]}' })
    // end_call's action stops the loop: no third model request.
    expect(h.openai.requests).toHaveLength(2)

    // Tool calls went to the app, signed.
    expect(h.app.badSignatures).toBe(0)
    expect(h.app.tools.map((t) => t.name)).toEqual(['check_availability', 'end_call'])
    expect(h.app.tools[0].arguments).toEqual({ date_from: '2026-09-18', date_to: null, service: null, time_of_day: 'any' })
    expect(h.app.tools[0].tool_call_id).toBe('call_avail')

    // Finalize payload.
    expect(finalize.session_id).toBe(CALL_ID)
    expect(finalize.end_reason).toBe('agent_hangup')
    expect(finalize.mode).toBe('cartesia_self')
    expect(finalize.fallback_used).toBe(false)
    expect(finalize.fallback_reason).toBeNull()
    expect(new Date(finalize.ended_at).getTime()).toBeGreaterThanOrEqual(new Date(finalize.started_at).getTime())
    expect(finalize.transcript.map((t) => t.role)).toEqual(['agent', 'user', 'agent'])
    expect(finalize.transcript[0].message).toBe('Hello, thanks for calling Acme Dental.')
    expect(finalize.transcript[1].message).toBe('Can I book an appointment tomorrow?')
    const reply = finalize.transcript[2]
    expect(reply.message).toContain('Tomorrow at ten works. Goodbye!')
    expect(reply.tool_calls).toEqual([
      { name: 'check_availability', ok: true },
      { name: 'end_call', ok: true },
    ])
    expect(finalize.usage.tts_characters).toBeGreaterThan(40)
    expect(finalize.usage.stt_seconds).toBeGreaterThan(0)
    expect(finalize.usage.stt_model).toBe('ink-2')
    expect(finalize.usage.llm_input_tokens).toBe(240)
    expect(finalize.usage.llm_cached_input_tokens).toBe(80)
    expect(finalize.usage.llm_output_tokens).toBe(50)
    expect(finalize.usage.agent_seconds).toBe(0)
    expect(finalize.cartesia_call_id).toBeNull()

    const types = h.app.events.map((e) => e.type)
    expect(types[0]).toBe('stream_started')
    expect(h.app.events[0].data.stream_sid).toBe(twilio.streamSid)
    expect(h.app.sessions[0]).toEqual({ session_token: expect.any(String), call_sid: 'CAtest', stream_sid: twilio.streamSid })

    // Every TTS message repeats the full generation settings.
    const ttsMessage = h.cartesia.ttsMessages.find((m) => typeof m.transcript === 'string' && m.transcript)!
    expect(ttsMessage).toMatchObject({
      model_id: 'sonic-3.6-2026-08-27',
      voice: 'db6b0ed5-d5d3-463d-ae85-518a07d3c2b4',
      language: 'en',
      output_format: { container: 'raw', encoding: 'pcm_mulaw', sample_rate: 8000 },
      max_buffer_delay_ms: 0,
      add_timestamps: true,
      continue: true,
    })
    expect(String(ttsMessage.context_id)).toMatch(new RegExp(`^${CALL_ID}-\\d+$`))
    const contextIds = [...h.cartesia.ttsContexts.keys()]
    expect(new Set(contextIds).size).toBe(contextIds.length)
  })

  it('opens the Cartesia TTS socket while the session config loads and reuses it for the greeting (PERF-06)', async () => {
    let release: () => void = () => {}
    h.app.sessionConfig = () => new Promise((resolve) => (release = () => resolve(makeSessionConfig())))
    twilio = await TwilioClient.connect(h.url, h.token(), { playbackRate: 8 })
    await waitFor(() => h.app.sessions.length === 1, 3_000, 'session requested')
    await waitFor(() => h.cartesia.ttsConnections === 1, 3_000, 'warm tts socket')
    expect(h.cartesia.sttConnections).toHaveLength(0)
    release()
    await greetingPlayed()
    // The greeting went out on the socket opened ahead of time: no second handshake.
    expect(h.cartesia.ttsConnections).toBe(1)
    twilio.stop()
    await waitFor(() => h.app.finalizes[0], 5_000, 'finalize')
  })

  it('gives the model one reply without tools to say goodbye when it ends the call silently', async () => {
    h.app.sessionConfig = () => makeSessionConfig({ initial_message: null })
    h.app.toolHandler = () => ({
      ok: true,
      result: "The call will end right after your next reply is spoken. If you haven't said goodbye yet, say a short, warm goodbye now and nothing else.",
      action: { type: 'end_call', reason: 'completed' },
    })
    h.openai.queue.push(toolCallResponse('end_call', { reason: 'completed' }, 'call_end'), textResponse('Thanks for calling, goodbye!'))

    twilio = await TwilioClient.connect(h.url, h.token(), { playbackRate: 8 })
    const stt = await sttTurns()
    stt.send({ type: 'turn.start', request_id: 'r', turn_id: '1' })
    stt.send({ type: 'turn.end', request_id: 'r', transcript: "That's all, bye.", turn_id: '1' })

    const hangup = await waitFor(() => h.app.callControls.find((c) => c.action === 'hangup'), 8_000, 'hangup')
    expect(hangup).toBeDefined()
    expect(h.openai.requests).toHaveLength(2)
    expect(h.openai.requests[0].body.tool_choice).toBe('auto')
    // The goodbye request can't call tools again, and it sees end_call's result.
    expect(h.openai.requests[1].body.tool_choice).toBe('none')
    expect(h.openai.requests[1].body.input).toContainEqual(expect.objectContaining({ type: 'function_call_output', call_id: 'call_end' }))
    expect(h.cartesia.spokenText()).toContain('Thanks for calling, goodbye!')
    expect(twilio.marksPending).toBe(0)
    twilio.stop()
    const finalize = await waitFor(() => h.app.finalizes[0], 5_000, 'finalize')
    expect(finalize.end_reason).toBe('agent_hangup')
    expect(finalize.transcript.at(-1)).toMatchObject({ role: 'agent', message: 'Thanks for calling, goodbye!', tool_calls: [{ name: 'end_call', ok: true }] })
  })

  it('barge-in cancels TTS, clears Twilio, aborts the LLM and keeps only what was heard', async () => {
    h.app.sessionConfig = () => makeSessionConfig({ initial_message: null })
    const long = 'Our clinic offers cleanings, whitening, fillings, crowns and orthodontic care. We are open six days a week. Parking is free for patients. We also accept most insurance plans. '
    h.openai.queue.push(textResponse(long, { delayMs: 60 }), textResponse('Sure, go ahead.'))
    h.cartesia.ttsChunkDelayMs = 20

    twilio = await TwilioClient.connect(h.url, h.token(), { playbackRate: 1 })
    const stt = await sttTurns()
    stt.send({ type: 'turn.start', request_id: 'r', turn_id: '1' })
    stt.send({ type: 'turn.end', request_id: 'r', transcript: 'What do you offer?', turn_id: '1' })

    await waitFor(() => twilio!.mediaBytes > 1600, 5_000, 'reply audio playing')
    stt.send({ type: 'turn.start', request_id: 'r', turn_id: '2' })

    await waitFor(() => twilio!.clears > 0, 3_000, 'twilio clear')
    await waitFor(() => h.cartesia.ttsMessages.some((m) => m.cancel === true), 3_000, 'tts cancel')
    await waitFor(() => h.openai.requests[0].aborted, 3_000, 'llm aborted')

    stt.send({ type: 'turn.end', request_id: 'r', transcript: 'Actually, wait.', turn_id: '2' })
    await waitFor(() => h.openai.requests.length === 2, 3_000, 'second request')
    const input = h.openai.requests[1].body.input as Record<string, unknown>[]
    const heard = input.find((i) => i.role === 'assistant') as { content: string } | undefined
    expect(heard).toBeDefined()
    expect(long.startsWith(heard!.content.split(' ').slice(0, 3).join(' '))).toBe(true)
    expect(heard!.content.length).toBeLessThan(long.trim().length)
    expect(input.at(-1)).toEqual({ role: 'user', content: 'Actually, wait.' })

    twilio.stop()
    const finalize = await waitFor(() => h.app.finalizes[0], 5_000, 'finalize')
    expect(finalize.end_reason).toBe('caller_hangup')
    const interrupted = finalize.transcript.find((t) => t.role === 'agent' && t.interrupted)
    expect(interrupted).toBeDefined()
    expect(interrupted!.message.length).toBeLessThan(long.trim().length)
  })

  it('commits a speculative eager_end run when the final transcript matches, and aborts it on resume', async () => {
    h.app.sessionConfig = () => makeSessionConfig({ initial_message: null })
    h.openai.queue.push(textResponse("We're open from nine to five."))
    twilio = await TwilioClient.connect(h.url, h.token(), { playbackRate: 8 })
    const stt = await sttTurns()

    stt.send({ type: 'turn.start', request_id: 'r', turn_id: '1' })
    stt.send({ type: 'turn.eager_end', request_id: 'r', transcript: 'What are your hours?', turn_id: '1' })
    await waitFor(() => h.openai.requests[0]?.completed, 3_000, 'speculative run completed')
    await sleep(150)
    // Held: nothing reaches TTS before the turn really ends.
    expect(h.cartesia.spokenText()).not.toContain('nine to five')
    stt.send({ type: 'turn.end', request_id: 'r', transcript: 'What are your hours?', turn_id: '1' })
    await waitFor(() => h.cartesia.spokenText().includes("We're open from nine to five."), 3_000, 'committed speech')
    expect(h.openai.requests).toHaveLength(1)
    await waitFor(() => twilio!.playedOut(), 5_000, 'reply played')

    // Resume: the speculative request is aborted and a fresh one uses the final text.
    h.openai.queue.push(textResponse('This should never be spoken. Nope.', { delayMs: 150 }), textResponse('Transferring you to billing now.'))
    stt.send({ type: 'turn.start', request_id: 'r', turn_id: '2' })
    stt.send({ type: 'turn.eager_end', request_id: 'r', transcript: 'Can you', turn_id: '2' })
    await waitFor(() => h.openai.requests.length === 2, 3_000, 'second speculative request')
    stt.send({ type: 'turn.resume', request_id: 'r', turn_id: '2' })
    await waitFor(() => h.openai.requests[1].aborted, 3_000, 'speculative aborted')
    stt.send({ type: 'turn.end', request_id: 'r', transcript: 'Can you transfer me to billing?', turn_id: '2' })
    await waitFor(() => h.cartesia.spokenText().includes('Transferring you to billing now.'), 3_000, 'fresh reply')
    const third = h.openai.requests[2].body.input as Record<string, unknown>[]
    expect(third.at(-1)).toEqual({ role: 'user', content: 'Can you transfer me to billing?' })
    expect(h.cartesia.spokenText()).not.toContain('never be spoken')
  })

  it('asks "are you still there?" once, then says goodbye and hangs up on continued silence', async () => {
    h.app.sessionConfig = () =>
      makeSessionConfig({
        initial_message: 'Hi there.',
        behavior: { allow_interruptions: true, silence_timeout_seconds: 0.4, max_duration_seconds: 600, record: false, voicemail_detection: false },
      })
    twilio = await TwilioClient.connect(h.url, h.token(), { playbackRate: 8 })
    const stt = await sttTurns()

    await waitFor(() => h.cartesia.spokenText().includes(STILL_THERE.en), 5_000, 'still there prompt')
    await waitFor(() => h.cartesia.spokenText().includes(GOODBYE_SILENCE.en), 5_000, 'goodbye')
    await waitFor(() => h.app.callControls.find((c) => c.action === 'hangup'), 5_000, 'hangup')
    // Twilio sent no media at all: the gateway kept STT fed with silence frames.
    expect(stt.frames.length).toBeGreaterThan(0)
    expect(stt.frames.every((f) => f.length === 800)).toBe(true)
    twilio.stop()
    const finalize = await waitFor(() => h.app.finalizes[0], 5_000, 'finalize')
    expect(finalize.end_reason).toBe('silence_timeout')
    expect(finalize.transcript.map((t) => t.message)).toEqual(['Hi there.', STILL_THERE.en, GOODBYE_SILENCE.en])
  })

  it('restarts the silence countdown after a noise-only turn cut the greeting short', async () => {
    h.app.sessionConfig = () =>
      makeSessionConfig({
        initial_message: 'Hello and welcome to Acme Dental, the friendliest dental clinic in town. How can we help you today?',
        behavior: { allow_interruptions: true, silence_timeout_seconds: 0.4, max_duration_seconds: 600, record: false, voicemail_detection: false },
      })
    twilio = await TwilioClient.connect(h.url, h.token(), { playbackRate: 1 })
    const stt = await sttTurns()
    await waitFor(() => twilio!.mediaBytes > 800, 3_000, 'greeting audio playing')

    // A cough: barge-in, then a turn with no words.
    stt.send({ type: 'turn.start', request_id: 'r', turn_id: '1' })
    await waitFor(() => twilio!.clears > 0, 3_000, 'greeting cleared')
    await sleep(700)
    expect(h.cartesia.spokenText()).not.toContain(STILL_THERE.en)
    stt.send({ type: 'turn.end', request_id: 'r', transcript: '', turn_id: '1' })

    await waitFor(() => h.cartesia.spokenText().includes(STILL_THERE.en), 3_000, 'still there prompt after the noise')
    expect(h.openai.requests).toHaveLength(0)
  })

  it('speaks the fallback line when the model returns no text and no tool call', async () => {
    h.app.sessionConfig = () => makeSessionConfig({ initial_message: null })
    h.openai.queue.push(textResponse(''), textResponse('Sure, we open at nine.'))
    twilio = await TwilioClient.connect(h.url, h.token(), { playbackRate: 8 })
    const stt = await sttTurns()
    stt.send({ type: 'turn.start', request_id: 'r', turn_id: '1' })
    stt.send({ type: 'turn.end', request_id: 'r', transcript: 'Hmm.', turn_id: '1' })

    const fallback = makeSessionConfig().fallback_message
    await waitFor(() => h.cartesia.spokenText().includes(fallback), 3_000, 'fallback line spoken')
    await waitFor(() => twilio!.playedOut(), 5_000, 'fallback played')

    // The model's history knows the fallback was said.
    stt.send({ type: 'turn.start', request_id: 'r', turn_id: '2' })
    stt.send({ type: 'turn.end', request_id: 'r', transcript: 'When do you open?', turn_id: '2' })
    await waitFor(() => h.openai.requests[1], 3_000, 'second request')
    expect(h.openai.requests[1].body.input as Record<string, unknown>[]).toContainEqual({ role: 'assistant', content: fallback })

    twilio.stop()
    const finalize = await waitFor(() => h.app.finalizes[0], 5_000, 'finalize')
    expect(finalize.transcript.map((t) => t.message)).toContain(fallback)
  })

  it('greets an outbound callee after a noise-only first turn instead of treating it as voicemail', async () => {
    h.app.sessionConfig = () =>
      makeSessionConfig({
        direction: 'outbound',
        behavior: { allow_interruptions: true, silence_timeout_seconds: null, max_duration_seconds: 600, record: false, voicemail_detection: true },
      })
    twilio = await TwilioClient.connect(h.url, h.token(), { playbackRate: 8 })
    const stt = await sttTurns()
    // Before the 2.5 s outbound wait: a click on the line, no words.
    stt.send({ type: 'turn.start', request_id: 'r', turn_id: '1' })
    stt.send({ type: 'turn.end', request_id: 'r', transcript: '', turn_id: '1' })

    await waitFor(() => h.cartesia.spokenText().includes('thanks for calling'), 2_500, 'greeting after the noise')
    // Past the 6.5 s monologue window: still no voicemail hang-up.
    await sleep(6_000)
    expect(h.app.callControls.find((c) => c.action === 'hangup')).toBeUndefined()
    twilio.stop()
    const finalize = await waitFor(() => h.app.finalizes[0], 5_000, 'finalize')
    expect(finalize.end_reason).toBe('caller_hangup')
  }, 20_000)

  it('turns DTMF digits into a caller turn', async () => {
    h.app.sessionConfig = () => makeSessionConfig({ initial_message: null })
    h.openai.queue.push(textResponse('Got it, option two.'))
    twilio = await TwilioClient.connect(h.url, h.token(), { playbackRate: 8 })
    await sttTurns()
    await sleep(100)
    twilio.sendDtmf('2')
    await waitFor(() => h.openai.requests[0], 3_000, 'llm request')
    expect((h.openai.requests[0].body.input as Record<string, unknown>[]).at(-1)).toEqual({ role: 'user', content: '[caller pressed 2]' })
  })

  it('rejects a stream whose session token is invalid without calling the app', async () => {
    h.app.sessionConfig = () => makeSessionConfig()
    twilio = await TwilioClient.connect(h.url, 'not-a-token')
    await waitFor(() => twilio!.closed, 3_000, 'socket closed')
    expect(twilio.closeCode).toBe(1008)
    expect(h.app.sessions).toHaveLength(0)
  })
})
