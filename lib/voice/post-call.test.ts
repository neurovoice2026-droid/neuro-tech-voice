import { describe, expect, it, vi } from 'vitest'
import type { FinalizeRequest } from '@/lib/voice/contracts'

// The pure helpers are tested here; database, KV and workflow modules are
// stubbed so importing post-call.ts never touches a network or another stream's code.
vi.mock('@/lib/supabase/admin', () => ({ createAdminClient: () => { throw new Error('no database in unit tests') } }))
vi.mock('@/lib/workflows/executor', () => ({ executeWorkflows: vi.fn() }))
vi.mock('@/lib/kv', () => ({ kvIncr: vi.fn(async () => 1), kvGet: vi.fn(), kvSet: vi.fn(), kvDel: vi.fn() }))

const {
  aggregateKnowledgeSources,
  appendHandoffTranscript,
  buildFinalizeUpdate,
  wasHandedOffByApp,
  buildProviderUsageEvents,
  chooseTranscript,
  FinalizeRequestSchema,
  mapCartesiaTranscript,
  planFinalize,
  reconcileAgentSeconds,
  recordingDecision,
  sanitizeTranscript,
  secondsBetween,
} = await import('./post-call')

const CALL_ID = '6f1c2d3e-4b5a-4c6d-8e7f-9a0b1c2d3e4f'
const ORG_ID = '11111111-2222-4333-8444-555555555555'

function request(overrides: Partial<FinalizeRequest> = {}): FinalizeRequest {
  return {
    session_id: CALL_ID,
    call_id: CALL_ID,
    started_at: '2026-09-17T10:00:00.000Z',
    ended_at: '2026-09-17T10:02:05.400Z',
    end_reason: 'caller_hangup',
    mode: 'cartesia_self',
    fallback_used: false,
    fallback_reason: null,
    transcript: [
      { role: 'agent', message: 'Hello!', time_in_call_secs: 0.2 },
      { role: 'user', message: 'Hi, what time do you open?', time_in_call_secs: 2.04 },
    ],
    usage: {
      tts_characters: 420,
      stt_seconds: 125.4,
      stt_model: 'ink-2',
      agent_seconds: 0,
      elevenlabs_seconds: 0,
      elevenlabs_tts_characters: 0,
      llm_input_tokens: 3000,
      llm_cached_input_tokens: 2048,
      llm_output_tokens: 150,
    },
    cartesia_call_id: null,
    elevenlabs_conversation_id: null,
    ...overrides,
  }
}

function row(overrides: Record<string, unknown> = {}) {
  return {
    id: CALL_ID,
    org_id: ORG_ID,
    agent_id: null,
    is_test: false,
    status: 'in-progress',
    started_at: '2026-09-17T09:59:58.000Z',
    ended_at: null,
    duration_seconds: 0,
    end_reason: null,
    fallback_used: false,
    fallback_reason: null,
    provider_call_id: null,
    summary: null,
    recording_url: null,
    analysis: null,
    tts_characters: null,
    ...overrides,
  }
}

describe('planFinalize (idempotency)', () => {
  it('applies a first finalize', () => {
    expect(planFinalize(row(), request())).toEqual({ kind: 'apply' })
  })

  it('skips a call whose usage and analysis are both stored', () => {
    expect(planFinalize(row({ ended_at: '2026-09-17T10:02:05Z', analysis: { summary: 'x' }, tts_characters: 420 }), request())).toEqual({
      kind: 'skip',
      reason: 'already_finalized',
    })
  })

  it('stores only usage when the ElevenLabs webhook analysed the call first', () => {
    expect(planFinalize(row({ ended_at: '2026-09-17T10:02:05Z', analysis: { summary: 'x' } }), request())).toEqual({ kind: 'usage_only' })
  })

  it('only re-runs the analysis when usage was stored but the analysis is missing', () => {
    expect(planFinalize(row({ ended_at: '2026-09-17T10:02:05Z', tts_characters: 420 }), request())).toEqual({ kind: 'analyze_only' })
    // tts_characters 0 still means "finalize already stored usage".
    expect(planFinalize(row({ tts_characters: 0 }), request())).toEqual({ kind: 'analyze_only' })
  })

  it('does not treat a Twilio status callback (ended_at only) as finalized', () => {
    expect(planFinalize(row({ ended_at: '2026-09-17T10:02:06Z', status: 'completed', duration_seconds: 128 }), request())).toEqual({ kind: 'apply' })
  })

  it('refuses a session that is not this call', () => {
    expect(planFinalize(row(), request({ session_id: '00000000-0000-4000-8000-000000000000' }))).toEqual({
      kind: 'skip',
      reason: 'session_mismatch',
    })
  })
})

describe('app hand-over to ElevenLabs', () => {
  const handedOff = { pipeline_mode: 'elevenlabs', voice_provider: 'elevenlabs', fallback_used: true, fallback_reason: 'stream_ended' }

  it('keeps the live call open on ElevenLabs instead of describing the failed gateway leg', () => {
    const update = buildFinalizeUpdate({
      row: row(handedOff),
      req: request({ end_reason: 'error', mode: 'cartesia_self' }),
      transcript: sanitizeTranscript(request().transcript),
      providerSummary: null,
      providerDurationSeconds: 0,
      recordingAvailable: false,
    })
    for (const key of ['status', 'ended_at', 'end_reason', 'voice_provider', 'pipeline_mode', 'provider_call_id']) {
      expect(update, key).not.toHaveProperty(key)
    }
    expect(update).toMatchObject({ tts_characters: 420, fallback_used: true })
    expect(wasHandedOffByApp(row(handedOff), request({ mode: 'elevenlabs' }))).toBe(false)
  })

  it('appends the ElevenLabs leg after the gateway leg', () => {
    const merged = appendHandoffTranscript(
      [
        { role: 'agent', message: 'Hello!', time_in_call_secs: 0.2 },
        { role: 'user', message: 'Book me in', time_in_call_secs: 10.5 },
      ],
      [{ role: 'agent', message: 'Sorry about that, I am back.', time_in_call_secs: 0.4 }]
    )
    expect(merged.map((t) => t.time_in_call_secs)).toEqual([0.2, 10.5, 11.9])
    expect(appendHandoffTranscript([], [{ role: 'agent', message: 'Hi', time_in_call_secs: 1 }])).toHaveLength(1)
  })
})

describe('buildFinalizeUpdate', () => {
  it('keeps the larger duration and the carrier timestamps', () => {
    const update = buildFinalizeUpdate({
      row: row({ duration_seconds: 131, ended_at: '2026-09-17T10:02:09Z', status: 'completed' }),
      req: request(),
      transcript: sanitizeTranscript(request().transcript),
      providerSummary: null,
      providerDurationSeconds: 0,
      recordingAvailable: false,
    })
    expect(update.duration_seconds).toBe(131)
    expect(update.ended_at).toBe('2026-09-17T10:02:09Z')
    expect(update.started_at).toBe('2026-09-17T09:59:58.000Z')
    expect(update.status).toBe('completed')
  })

  it('computes the duration from the gateway times when it is larger', () => {
    const update = buildFinalizeUpdate({
      row: row({ duration_seconds: 60 }),
      req: request(),
      transcript: [],
      providerSummary: null,
      providerDurationSeconds: 0,
      recordingAvailable: false,
    })
    expect(update.duration_seconds).toBe(125)
    expect(update.status).toBe('completed')
    expect(update.end_reason).toBe('caller_hangup')
  })

  it('keeps a terminal status and an end reason set by call control', () => {
    const update = buildFinalizeUpdate({
      row: row({ status: 'failed', end_reason: 'transferred' }),
      req: request({ end_reason: 'agent_hangup' }),
      transcript: [],
      providerSummary: null,
      providerDurationSeconds: 0,
      recordingAvailable: false,
    })
    expect(update.status).toBe('failed')
    expect(update.end_reason).toBe('transferred')
  })

  it('stores usage columns and Cartesia credits', () => {
    const update = buildFinalizeUpdate({ row: row(), req: request(), transcript: [], providerSummary: null, providerDurationSeconds: 0, recordingAvailable: false })
    expect(update).toMatchObject({
      voice_provider: 'cartesia',
      pipeline_mode: 'cartesia_self',
      provider_call_id: null,
      tts_characters: 420,
      stt_seconds: 125.4,
      stt_model: 'ink-2',
      agent_seconds: 0,
      llm_input_tokens: 3000,
      llm_cached_input_tokens: 2048,
      llm_output_tokens: 150,
      // 420 TTS characters + 125.4 s of ink-2 at 3 credits/s
      cartesia_credits: 796.2,
    })
    expect(update).not.toHaveProperty('recording_url')
    expect(update).not.toHaveProperty('summary')
  })

  it('links the managed call id, provider summary and recording', () => {
    const update = buildFinalizeUpdate({
      row: row(),
      req: request({ mode: 'cartesia_managed', cartesia_call_id: 'ac_123' }),
      transcript: [],
      providerSummary: 'Caller asked for opening hours.',
      providerDurationSeconds: 140,
      recordingAvailable: true,
    })
    expect(update.provider_call_id).toBe('ac_123')
    expect(update.summary).toBe('Caller asked for opening hours.')
    expect(update.recording_url).toBe(`/api/calls/${CALL_ID}/audio`)
    expect(update.duration_seconds).toBe(140)
  })

  it('uses the ElevenLabs conversation id when the call ended on the fallback', () => {
    const update = buildFinalizeUpdate({
      row: row({ fallback_reason: 'self_breaker_open' }),
      req: request({ mode: 'elevenlabs', cartesia_call_id: 'ac_old', elevenlabs_conversation_id: 'conv_9', fallback_used: true, fallback_reason: 'stt_error' }),
      transcript: [],
      providerSummary: null,
      providerDurationSeconds: 0,
      recordingAvailable: false,
    })
    expect(update).toMatchObject({
      voice_provider: 'elevenlabs',
      provider_call_id: 'conv_9',
      elevenlabs_conversation_id: 'conv_9',
      fallback_used: true,
      fallback_reason: 'self_breaker_open',
    })
  })

  it('never overwrites an existing summary or recording', () => {
    const update = buildFinalizeUpdate({
      row: row({ summary: 'kept', recording_url: '/api/calls/x/audio' }),
      req: request(),
      transcript: [],
      providerSummary: 'new',
      providerDurationSeconds: 0,
      recordingAvailable: true,
    })
    expect(update).not.toHaveProperty('summary')
    expect(update).not.toHaveProperty('recording_url')
  })
})

describe('sanitizeTranscript', () => {
  it('trims, drops empty turns, filters tool names and keeps sources only on agent turns', () => {
    const source = { document_id: 'd1', document_name: 'Prices.pdf', chunk_id: 'c1', excerpt: 'x', similarity: 0.8 }
    const out = sanitizeTranscript([
      { role: 'agent', message: '  Our prices start at 50.  ', time_in_call_secs: 3.456, sources: [source], tool_calls: [{ name: 'search_knowledge', ok: true }, { name: 'hack', ok: true }] as never },
      { role: 'user', message: '   ', time_in_call_secs: 4 },
      { role: 'user', message: 'Thanks', time_in_call_secs: 5, sources: [source], interrupted: true },
      { role: 'agent', message: '', time_in_call_secs: 6, tool_calls: [{ name: 'end_call', ok: true }] },
    ])
    expect(out).toEqual([
      { role: 'agent', message: 'Our prices start at 50.', time_in_call_secs: 3.5, sources: [source], tool_calls: [{ name: 'search_knowledge', ok: true }] },
      { role: 'user', message: 'Thanks', time_in_call_secs: 5, interrupted: true },
      { role: 'agent', message: '', time_in_call_secs: 6, tool_calls: [{ name: 'end_call', ok: true }] },
    ])
  })
})

describe('aggregateKnowledgeSources', () => {
  it('dedupes by chunk, keeps the best match and sorts by similarity', () => {
    const a = { document_id: 'd1', document_name: 'A', chunk_id: 'c1', excerpt: '', similarity: 0.5 }
    const b = { document_id: 'd2', document_name: 'B', chunk_id: 'c2', excerpt: '', similarity: 0.9 }
    const aBetter = { ...a, similarity: 0.7 }
    expect(aggregateKnowledgeSources([{ sources: [a, b] }, { sources: [aBetter] }, {}])).toEqual([b, aBetter])
  })
})

describe('buildProviderUsageEvents', () => {
  it('meters Cartesia credits by model and OpenAI tokens', () => {
    const events = buildProviderUsageEvents({
      orgId: ORG_ID,
      callId: CALL_ID,
      usage: request().usage,
      cartesiaCallId: null,
      elevenLabsConversationId: null,
      ttsModel: 'sonic-3.6-2026-08-27',
      llmModel: 'gpt-5.6-luna',
    })
    expect(events).toEqual([
      expect.objectContaining({ provider: 'cartesia', kind: 'tts_characters', quantity: 420, credits: 420, org_id: ORG_ID, call_id: CALL_ID }),
      expect.objectContaining({ provider: 'cartesia', kind: 'stt_seconds', quantity: 125.4, credits: 376.2, meta: { model: 'ink-2', source: 'call' } }),
      expect.objectContaining({ provider: 'openai', kind: 'llm_tokens', quantity: 3150 }),
    ])
  })

  it('records Managed Agent time as agent_seconds with no model credits', () => {
    const events = buildProviderUsageEvents({
      orgId: ORG_ID,
      callId: CALL_ID,
      usage: { ...request().usage, tts_characters: 0, stt_seconds: 0, llm_input_tokens: 0, llm_output_tokens: 0, agent_seconds: 90 },
      cartesiaCallId: 'ac_1',
      elevenLabsConversationId: null,
      ttsModel: 'm',
      llmModel: 'l',
    })
    expect(events).toEqual([
      { org_id: ORG_ID, call_id: CALL_ID, provider: 'cartesia', kind: 'agent_seconds', quantity: 90, credits: 0, cost_cents: 9, meta: { cartesia_call_id: 'ac_1' } },
    ])
  })

  it('records ElevenLabs fallback seconds and characters', () => {
    const events = buildProviderUsageEvents({
      orgId: ORG_ID,
      callId: CALL_ID,
      usage: { ...request().usage, tts_characters: 0, stt_seconds: 0, llm_input_tokens: 0, llm_output_tokens: 0, elevenlabs_seconds: 40, elevenlabs_tts_characters: 200 },
      cartesiaCallId: null,
      elevenLabsConversationId: 'conv_1',
      ttsModel: 'm',
      llmModel: 'l',
    })
    expect(events.map((e) => [e.provider, e.kind, e.quantity])).toEqual([
      ['elevenlabs', 'agent_seconds', 40],
      ['elevenlabs', 'tts_characters', 200],
    ])
  })
})

describe('reconcileAgentSeconds (e2e F1)', () => {
  it('meters a managed leg by the longer of the gateway count and Cartesia’s call record', () => {
    // Live S4: gateway 16.43 s, Cartesia record 21.23 s.
    expect(reconcileAgentSeconds(16.43, 21.23)).toBe(21.23)
    expect(buildProviderUsageEvents({
      orgId: ORG_ID, callId: CALL_ID, cartesiaCallId: 'ac_1', elevenLabsConversationId: null, ttsModel: 'sonic', llmModel: 'luna',
      usage: { ...request().usage, agent_seconds: reconcileAgentSeconds(16.43, 21.23) },
    }).find((e) => e.kind === 'agent_seconds')?.quantity).toBe(21.23)
    expect(reconcileAgentSeconds(25, 20)).toBe(25)
  })

  it('ignores a record that is missing, belongs to no managed leg, or is implausibly long', () => {
    expect(reconcileAgentSeconds(16.43, 0)).toBe(16.43)
    expect(reconcileAgentSeconds(0, 21.23)).toBe(0)
    expect(reconcileAgentSeconds(10, 4000)).toBe(70)
  })
})

describe('mapCartesiaTranscript', () => {
  it('maps assistant turns to the agent, drops system turns and strips tool prefixes', () => {
    expect(
      mapCartesiaTranscript([
        { role: 'system', text: 'config', start_timestamp: 0, end_timestamp: 0 },
        { role: 'assistant', text: 'Hi there', start_timestamp: 0.41, end_timestamp: 3.2 },
        { role: 'user', text: 'Book me in', start_timestamp: 3.5, end_timestamp: 5.8, tool_calls: [{ name: 'ntv_book_appointment', arguments: {}, result: 'Booked for 10:00' }] },
        { role: 'assistant', text: null, start_timestamp: 6, end_timestamp: 6, tool_calls: [{ name: 'ntv_send_sms', arguments: {}, result: 'Error: opted out' }] },
      ])
    ).toEqual([
      { role: 'agent', message: 'Hi there', time_in_call_secs: 0.4 },
      { role: 'user', message: 'Book me in', time_in_call_secs: 3.5, tool_calls: [{ name: 'book_appointment', ok: true }] },
      { role: 'agent', message: '', time_in_call_secs: 6, tool_calls: [{ name: 'send_sms', ok: false }] },
    ])
  })
})

describe('FinalizeRequestSchema', () => {
  it('accepts a gateway body and tolerates unknown enum values without losing the call', () => {
    const body = { ...request(), end_reason: 'something_new', usage: { ...request().usage, stt_model: 'ink-9', tts_characters: -5 } }
    const parsed = FinalizeRequestSchema.parse(body)
    expect(parsed.end_reason).toBe('error')
    expect(parsed.usage.stt_model).toBeNull()
    expect(parsed.usage.tts_characters).toBe(0)
  })

  it('rejects bad ids', () => {
    expect(FinalizeRequestSchema.safeParse({ ...request(), call_id: 'not-a-uuid' }).success).toBe(false)
    expect(FinalizeRequestSchema.safeParse({ ...request(), cartesia_call_id: 'ac/../../x' }).data?.cartesia_call_id ?? null).toBeNull()
  })
})

describe('recordingDecision', () => {
  const recordOff = { behavior_settings: { record_calls: false } }

  it('records only when the switch is on and the plan includes recordings', () => {
    expect(recordingDecision({}, 'pro', false)).toBe('record')
    expect(recordingDecision(null, 'business', false)).toBe('record')
    expect(recordingDecision(recordOff, 'pro', false)).toBe('discard')
    expect(recordingDecision({}, 'starter', false)).toBe('discard')
    expect(recordingDecision({}, 'trial', true)).toBe('discard')
  })

  it('is unknown when the agent or the plan could not be read, so nothing is deleted by mistake', () => {
    expect(recordingDecision(undefined, 'pro', false)).toBe('unknown')
    expect(recordingDecision(recordOff, null, false)).toBe('unknown')
    expect(recordingDecision(recordOff, undefined, false)).toBe('unknown')
  })
})

describe('chooseTranscript', () => {
  const turn = (message: string) => ({ role: 'user' as const, message, time_in_call_secs: 1 })

  it('keeps a fuller stored transcript and prefers the gateway on a tie', () => {
    const stored = [turn('a'), turn('b')]
    const gateway = [turn('x')]
    expect(chooseTranscript(gateway, stored)).toBe(stored)
    expect(chooseTranscript([], stored)).toBe(stored)
    const same = [turn('y'), turn('z')]
    expect(chooseTranscript(same, stored)).toBe(same)
  })
})

describe('secondsBetween', () => {
  it('rounds, clamps and ignores bad input', () => {
    expect(secondsBetween('2026-09-17T10:00:00Z', '2026-09-17T10:00:01.6Z')).toBe(2)
    expect(secondsBetween('2026-09-17T10:00:05Z', '2026-09-17T10:00:00Z')).toBe(0)
    expect(secondsBetween('nope', '2026-09-17T10:00:00Z')).toBe(0)
    expect(secondsBetween('2026-09-17T00:00:00Z', '2026-09-18T00:00:00Z')).toBe(6 * 60 * 60)
  })
})
