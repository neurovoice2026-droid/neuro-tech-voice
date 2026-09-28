import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { TwilioClient } from './helpers/clients'
import { CALL_ID, CHECK_AVAILABILITY, makeSessionConfig, startHarness, type Harness } from './helpers/harness'
import { waitFor } from './helpers/net'

// cartesia_managed: Twilio ⇄ Cartesia Agents WebSocket bridge with client tools.

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

describe('cartesia_managed bridge', () => {
  it('creates the session, bridges audio, runs a client tool through the app and ends when the agent hangs up', async () => {
    h.app.sessionConfig = () => makeSessionConfig({ mode: 'cartesia_managed', cartesia_agent_id: 'agent_Fo7pKNBUwLZxrTd6jvhpaE', tools: [CHECK_AVAILABILITY] })
    h.app.toolHandler = () => ({ ok: true, result: '{"slots":["10:00","11:30"]}', action: null })
    h.cartesia.onAgentConnect = (conn) => {
      conn.ws.on('message', () => {
        const msg = conn.received.at(-1)!
        if (msg.type === 'session_create') {
          conn.send({ type: 'session_ready', call_id: 'ac_gqkgRWUz2u64qFUjA1mZyr', agent_id: 'agent_Fo7pKNBUwLZxrTd6jvhpaE', agent_version_id: 'av_1', audio: msg.audio })
          conn.send({ type: 'turn_started', turn: 1, role: 'assistant', start_time: 0.1 })
          conn.send({ type: 'audio_output', audio: Buffer.alloc(1600, 0x42).toString('base64') })
          conn.send({ type: 'turn_output_text_delta', turn: 1, role: 'assistant', text: 'Hello, Acme Dental' })
          conn.send({ type: 'turn_output_text_delta', turn: 1, role: 'assistant', text: ', how can I help?' })
          conn.send({ type: 'turn_ended', turn: 1, role: 'assistant', text: 'Hello, Acme Dental, how can I help?', interrupted: false, start_time: 0.1, end_time: 1.9, tool_calls: [] })
        }
        if (msg.type === 'client_tool_result') {
          conn.send({ type: 'audio_output_clear' })
          conn.send({ type: 'turn_ended', turn: 3, role: 'assistant', text: 'We have ten or half past eleven.', interrupted: false, start_time: 4, end_time: 6, tool_calls: [{ name: 'ntv_check_availability', arguments: {}, id: 'call_2b7e4f9a1c0d', result: 'ok' }] })
          setTimeout(() => conn.ws.close(1000), 50)
        }
      })
    }

    twilio = await TwilioClient.connect(h.url, h.token({ mode: 'cartesia_managed' }), { playbackRate: 8 })
    const agent = await waitFor(() => h.cartesia.agentConnections[0], 3_000, 'agent socket')
    expect(agent.url.pathname).toBe('/v1/agents/websocket/agent_Fo7pKNBUwLZxrTd6jvhpaE')
    expect(agent.url.searchParams.get('cartesia_version')).toBe('2026-08-14')
    expect(agent.apiKeyHeader).toBe('sk_car_test')

    const create = await waitFor(() => agent.received[0], 3_000, 'session_create')
    expect(create.type).toBe('session_create')
    expect(create.audio).toEqual({ input_format: 'mulaw_8000', output_delivery: 'speaking_pace' })
    expect(create.dynamic_variables).toMatchObject({ ntv_call_id: CALL_ID, caller_number: '+40712345678', call_direction: 'inbound', business_timezone: 'Europe/Bucharest', is_test_call: false })

    await waitFor(() => twilio!.mediaBytes >= 1600, 3_000, 'agent audio to twilio')
    await twilio.sendAudio(Buffer.alloc(1600, 0xfe))
    await waitFor(() => agent.received.some((m) => m.type === 'audio_input'), 3_000, 'audio_input')
    const audioInput = agent.received.find((m) => m.type === 'audio_input')!
    expect(Buffer.from(String(audioInput.audio), 'base64').length).toBe(320)

    agent.send({ type: 'turn_started', turn: 2, role: 'user', start_time: 2.5 })
    agent.send({ type: 'turn_ended', turn: 2, role: 'user', text: 'Do you have anything tomorrow morning?', interrupted: false, start_time: 2.5, end_time: 3.9, tool_calls: [] })
    agent.send({ type: 'client_tool_call', tool_call_id: 'call_2b7e4f9a1c0d', tool_name: 'ntv_check_availability', parameters: { date_from: '2026-09-18', time_of_day: 'morning' }, expects_response: true })

    const result = await waitFor(() => agent.received.find((m) => m.type === 'client_tool_result'), 3_000, 'client_tool_result')
    expect(result).toEqual({ type: 'client_tool_result', tool_call_id: 'call_2b7e4f9a1c0d', result: '{"slots":["10:00","11:30"]}', is_error: false })
    expect(h.app.tools[0]).toMatchObject({ name: 'check_availability', tool_call_id: 'call_2b7e4f9a1c0d', arguments: { date_from: '2026-09-18', time_of_day: 'morning' } })

    await waitFor(() => twilio!.clears > 0, 3_000, 'audio_output_clear → twilio clear')
    const hangup = await waitFor(() => h.app.callControls.find((c) => c.action === 'hangup'), 5_000, 'hangup after agent closed')
    expect(hangup.call_id).toBe(CALL_ID)
    twilio.stop()

    const finalize = await waitFor(() => h.app.finalizes[0], 5_000, 'finalize')
    expect(finalize.mode).toBe('cartesia_managed')
    expect(finalize.end_reason).toBe('agent_hangup')
    expect(finalize.cartesia_call_id).toBe('ac_gqkgRWUz2u64qFUjA1mZyr')
    expect(finalize.usage.agent_seconds).toBeGreaterThan(0)
    expect(finalize.usage.tts_characters).toBe(0)
    expect(finalize.transcript.map((t) => [t.role, t.message])).toEqual([
      ['agent', 'Hello, Acme Dental, how can I help?'],
      ['user', 'Do you have anything tomorrow morning?'],
      ['agent', 'We have ten or half past eleven.'],
    ])
    expect(finalize.transcript[2].tool_calls).toEqual([{ name: 'check_availability', ok: true }])
  })

  it('falls back to the ElevenLabs agent when the managed agent fails', async () => {
    h.app.sessionConfig = () => makeSessionConfig({ mode: 'cartesia_managed', cartesia_agent_id: 'agent_x', tools: [CHECK_AVAILABILITY] })
    h.cartesia.onAgentConnect = (conn) => {
      conn.ws.once('message', () => {
        conn.send({ type: 'session_ready', call_id: 'ac_fail', agent_id: 'agent_x', agent_version_id: 'av', audio: {} })
        setTimeout(() => {
          conn.send({ type: 'error', code: 'agent_failed', message: 'The agent failed', fatal: true })
          conn.ws.close(1011)
        }, 50)
      })
    }
    h.elevenlabs.onAgentConnect = (conn) => {
      conn.ws.once('message', () => {
        conn.send({ type: 'conversation_initiation_metadata', conversation_initiation_metadata_event: { conversation_id: 'conv_m', agent_output_audio_format: 'ulaw_8000', user_input_audio_format: 'ulaw_8000' } })
      })
    }
    twilio = await TwilioClient.connect(h.url, h.token({ mode: 'cartesia_managed' }), { playbackRate: 8 })
    const switched = await waitFor(() => h.app.events.find((e) => e.type === 'mode_switched'), 5_000, 'mode_switched')
    expect(switched.data).toMatchObject({ from_mode: 'cartesia_managed', to_mode: 'elevenlabs', provider: 'cartesia', component: 'agent', code: 'agent_failed' })
    await waitFor(() => h.elevenlabs.agentConnections[0], 3_000, 'elevenlabs agent')
    twilio.stop()
    const finalize = await waitFor(() => h.app.finalizes[0], 5_000, 'finalize')
    expect(finalize.mode).toBe('elevenlabs')
    expect(finalize.cartesia_call_id).toBe('ac_fail')
    expect(finalize.fallback_reason).toBe('agent_failed')
  })

  it('reports agent_dollars quota when the managed agent refuses the connection for balance', async () => {
    await h.close()
    h = await startHarness()
    h.app.sessionConfig = () => makeSessionConfig({ mode: 'cartesia_managed', cartesia_agent_id: 'agent_quota' })
    h.cartesia.onAgentConnect = (conn) => {
      conn.ws.once('message', () => {
        conn.send({ type: 'error', code: 'agent_failed', message: 'Insufficient credits: voice agent balance exhausted', fatal: true })
        conn.ws.close(1008)
      })
    }
    h.elevenlabs.onAgentConnect = (conn) => {
      conn.ws.once('message', () => conn.send({ type: 'conversation_initiation_metadata', conversation_initiation_metadata_event: { conversation_id: 'conv_q' } }))
    }
    twilio = await TwilioClient.connect(h.url, h.token({ mode: 'cartesia_managed' }), { playbackRate: 8 })
    const quota = await waitFor(() => h.app.events.find((e) => e.type === 'quota_exceeded'), 5_000, 'quota event')
    expect(quota.data).toMatchObject({ provider: 'cartesia', budget: 'agent_dollars' })
    await waitFor(() => h.elevenlabs.agentConnections[0], 3_000, 'elevenlabs agent')
  })
})
