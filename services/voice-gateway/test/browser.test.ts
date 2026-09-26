import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { BrowserClient } from './helpers/clients'
import { makeSessionConfig, startHarness, type Harness } from './helpers/harness'
import { textResponse } from './helpers/mock-openai'
import { pcm16Tone, sleep, waitFor } from './helpers/net'

// Dashboard test call: PCM16 16 kHz both ways, JSON control messages.

let h: Harness
let browser: BrowserClient | null = null

beforeEach(async () => {
  h = await startHarness()
})

afterEach(async () => {
  browser?.dispose()
  browser = null
  await h.close()
})

describe('browser channel', () => {
  it('round-trips PCM16 audio through cartesia_self and ends on hangup', async () => {
    h.app.sessionConfig = () => makeSessionConfig({ channel: 'browser', is_test: true, from_number: null, to_number: null, twilio_call_sid: null })
    h.openai.queue.push(textResponse('Hi! This is your test call.'))

    browser = await BrowserClient.connect(h.url, h.token({ ch: 'browser' }))
    await waitFor(() => browser!.messages.find((m) => m.type === 'ready'), 3_000, 'ready')
    expect(browser.messages.find((m) => m.type === 'ready')).toEqual({ type: 'ready', mode: 'cartesia_self' })
    expect(h.app.sessions[0]).toMatchObject({ call_sid: null, stream_sid: null })

    // Greeting synthesised as PCM16 16 kHz and streamed as binary frames.
    await waitFor(() => browser!.audioBytes > 0, 3_000, 'greeting audio')
    const ttsMessage = h.cartesia.ttsMessages.find((m) => typeof m.transcript === 'string' && m.transcript)!
    expect(ttsMessage.output_format).toEqual({ container: 'raw', encoding: 'pcm_s16le', sample_rate: 16000 })
    expect(browser.audioBytes % 2).toBe(0)

    const stt = await waitFor(() => h.cartesia.sttConnections[0], 3_000, 'stt')
    expect(stt.url.searchParams.get('encoding')).toBe('pcm_s16le')
    expect(stt.url.searchParams.get('sample_rate')).toBe('16000')
    await browser.sendPcm(pcm16Tone(400))
    await waitFor(() => stt.frames.some((f) => f.length === 3200 && f.some((b) => b !== 0)), 3_000, 'caller audio reached STT in 100 ms frames')

    stt.send({ type: 'turn.start', request_id: 'r', turn_id: '1' })
    stt.send({ type: 'turn.update', request_id: 'r', transcript: 'Hello', turn_id: '1' })
    stt.send({ type: 'turn.end', request_id: 'r', transcript: 'Hello there', turn_id: '1' })
    await waitFor(() => browser!.messages.find((m) => m.type === 'user_transcript' && m.final === true), 3_000, 'final transcript')
    expect(browser.messages).toContainEqual({ type: 'user_transcript', text: 'Hello', final: false })
    // Sentence by sentence as each starts playing, all under the turn's id, and never repeated whole.
    const turnText = (turn: unknown) =>
      browser!.messages.filter((m) => m.type === 'agent_text' && m.turn === turn && !m.interrupted).map((m) => String(m.text)).join(' ')
    await waitFor(() => browser!.messages.some((m) => m.type === 'agent_text' && m.text === 'This is your test call.'), 5_000, 'agent text')
    const reply = browser.messages.filter((m) => m.type === 'agent_text' && typeof m.turn === 'number').at(-1)!
    expect(turnText(reply.turn)).toBe('Hi! This is your test call.')
    const greeting = browser.messages.find((m) => m.type === 'agent_text')!
    expect(greeting).toEqual({ type: 'agent_text', text: 'Hello, thanks for calling Acme Dental.', turn: expect.any(Number) })
    expect(greeting.turn).not.toBe(reply.turn)
    await sleep(200)
    expect(browser.messages.filter((m) => m.type === 'agent_text' && m.text === 'Hi! This is your test call.')).toHaveLength(0)

    browser.hangup()
    await waitFor(() => browser!.messages.find((m) => m.type === 'ended'), 3_000, 'ended')
    expect(browser.messages.find((m) => m.type === 'ended')).toEqual({ type: 'ended', reason: 'test_ended' })
    const finalize = await waitFor(() => h.app.finalizes[0], 5_000, 'finalize')
    expect(finalize.end_reason).toBe('test_ended')
    // Browser calls never ask the app to hang up a phone line.
    expect(h.app.callControls).toHaveLength(0)
  })

  it('replaces the streamed sentences with what was heard when the caller barges in', async () => {
    h.app.sessionConfig = () => makeSessionConfig({ channel: 'browser', is_test: true, initial_message: null, twilio_call_sid: null })
    const long = 'Our clinic offers cleanings and whitening. We also do fillings and crowns. We are open six days a week. Parking is free for patients. We accept most insurance plans. '
    h.openai.queue.push(textResponse(long, { delayMs: 30 }), textResponse('Sure.'))
    h.cartesia.ttsChunkDelayMs = 5
    // About a second of audio per sentence, so the reply is still playing when the caller cuts in.
    h.cartesia.ttsBytesPerChar = 800

    browser = await BrowserClient.connect(h.url, h.token({ ch: 'browser' }))
    const stt = await waitFor(() => h.cartesia.sttConnections[0], 3_000, 'stt')
    stt.send({ type: 'turn.start', request_id: 'r', turn_id: '1' })
    stt.send({ type: 'turn.end', request_id: 'r', transcript: 'What do you offer?', turn_id: '1' })
    const first = await waitFor(() => browser!.messages.find((m) => m.type === 'agent_text'), 5_000, 'first sentence')
    expect(first).toEqual({ type: 'agent_text', text: 'Our clinic offers cleanings and whitening.', turn: expect.any(Number) })
    // Streamed at playback pace: the last sentence isn't on screen while the first is still playing.
    expect(browser.messages.some((m) => m.type === 'agent_text' && String(m.text).includes('insurance'))).toBe(false)

    await sleep(1_200)
    stt.send({ type: 'turn.start', request_id: 'r', turn_id: '2' })
    const heard = await waitFor(() => browser!.messages.find((m) => m.type === 'agent_text' && m.interrupted === true), 3_000, 'heard text')
    const clearIndex = browser.messages.findIndex((m) => m.type === 'clear')
    expect(clearIndex).toBeGreaterThan(-1)
    expect(clearIndex).toBeLessThan(browser.messages.indexOf(heard))
    expect(heard.turn).toBe(first.turn)
    expect(String(heard.text).length).toBeGreaterThan(0)
    expect(long.startsWith(String(heard.text).split(' ').slice(0, 3).join(' '))).toBe(true)
    expect(String(heard.text).length).toBeLessThan(long.trim().length)
    // No sentence of the interrupted turn arrives after the barge-in.
    await sleep(300)
    const afterHeard = browser.messages.slice(browser.messages.indexOf(heard) + 1)
    expect(afterHeard.some((m) => m.type === 'agent_text' && m.turn === first.turn)).toBe(false)

    browser.hangup()
    const finalize = await waitFor(() => h.app.finalizes[0], 5_000, 'finalize')
    const interrupted = finalize.transcript.find((t) => t.role === 'agent' && t.interrupted)
    expect(interrupted?.message).toBe(heard.text)
  })

  it('transcodes PCM16 16 kHz ⇄ μ-law 8 kHz for the ElevenLabs agent bridge', async () => {
    h.app.sessionConfig = () => makeSessionConfig({ mode: 'elevenlabs', channel: 'browser', is_test: true, twilio_call_sid: null })
    h.elevenlabs.onAgentConnect = (conn) => {
      conn.ws.once('message', () => {
        conn.send({ type: 'conversation_initiation_metadata', conversation_initiation_metadata_event: { conversation_id: 'conv_b', agent_output_audio_format: 'ulaw_8000', user_input_audio_format: 'ulaw_8000' } })
        conn.send({ type: 'audio', audio_event: { audio_base_64: Buffer.alloc(800, 0x80).toString('base64'), event_id: 1 } })
      })
    }
    browser = await BrowserClient.connect(h.url, h.token({ ch: 'browser', mode: 'elevenlabs' }))
    const agent = await waitFor(() => h.elevenlabs.agentConnections[0], 3_000, 'agent')
    // 800 μ-law bytes (100 ms) → 3200 PCM16 bytes at 16 kHz.
    await waitFor(() => browser!.audioBytes >= 3000, 3_000, 'transcoded agent audio')
    expect(Math.abs(browser.audioBytes - 3200)).toBeLessThanOrEqual(8)
    await browser.sendPcm(pcm16Tone(300))
    const chunk = await waitFor(() => agent.received.find((m) => typeof m.user_audio_chunk === 'string'), 3_000, 'user audio')
    // 50 ms frames of PCM16 16 kHz (1600 bytes) become 400 μ-law bytes.
    expect(Buffer.from(String(chunk.user_audio_chunk), 'base64').length).toBe(400)
    browser.hangup()
    const finalize = await waitFor(() => h.app.finalizes[0], 5_000, 'finalize')
    expect(finalize.mode).toBe('elevenlabs')
    expect(finalize.elevenlabs_conversation_id).toBe('conv_b')
  })

  it('refuses the upgrade for an expired or wrong-channel token', async () => {
    await expect(BrowserClient.connect(h.url, h.token({ ch: 'browser', expInSeconds: -5 }))).rejects.toThrow('401')
    await expect(BrowserClient.connect(h.url, h.token({ ch: 'twilio' }))).rejects.toThrow('401')
  })
})
