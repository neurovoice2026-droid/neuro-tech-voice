import { beforeEach, describe, expect, it, vi } from 'vitest'
import { memoryDb, type MemoryDb } from '@/tests/helpers/memory-db'

// Lost-webhook recovery: only the org's own agent, only final conversations,
// through the webhook merge path (applyCallEvent, source 'poll').

const state: { db: MemoryDb | null; circuit: string; configured: boolean; watermarks: Map<string, number> } = {
  db: null,
  circuit: 'closed',
  configured: true,
  watermarks: new Map(),
}
vi.mock('@/lib/supabase/admin', () => ({ createAdminClient: () => state.db }))
vi.mock('@/lib/elevenlabs/client', () => ({ isConfigured: () => state.configured }))
vi.mock('./circuit-registry', () => ({ peek: async () => ({ state: state.circuit }) }))
const writeWatermark = vi.fn()
vi.mock('./maintenance-state', () => ({
  readWatermarks: async () => state.watermarks,
  writeWatermark: (...a: unknown[]) => writeWatermark(...a),
}))
const applyCallEvent = vi.fn()
vi.mock('./call-store', () => ({ applyCallEvent: (...a: unknown[]) => applyCallEvent(...a) }))
const api = { getConversation: vi.fn(), listConversations: vi.fn(), findConversationsByCallId: vi.fn() }
vi.mock('@/lib/elevenlabs/api/conversations', async (orig) => ({
  ...(await orig<typeof import('@/lib/elevenlabs/api/conversations')>()),
  getConversation: (...a: unknown[]) => api.getConversation(...a),
  listConversations: (...a: unknown[]) => api.listConversations(...a),
  findConversationsByCallId: (...a: unknown[]) => api.findConversationsByCallId(...a),
}))

import { reconcileElevenLabsConversations } from './conversation-reconcile'
import { ProviderError } from './errors'
import { signCallToken } from '@/lib/telephony/tokens'

const NOW = Date.parse('2026-10-07T12:00:00.000Z')
const ORG = '11111111-1111-4111-8111-111111111111'
const AGENT = 'a1111111-1111-4111-8111-111111111111'
const CALL = 'c0000000-0000-4000-8000-000000000001'
const iso = (minAgo: number) => new Date(NOW - minAgo * 60_000).toISOString()

function call(over: Record<string, unknown> = {}) {
  return {
    id: CALL, org_id: ORG, agent_id: AGENT, provider: 'elevenlabs', status: 'in-progress', lifecycle_rank: 20,
    elevenlabs_conversation_id: null, provider_call_id: null, routing: { twilio_status: 'completed' },
    created_at: iso(30), started_at: iso(30), reconcile_attempts: 0, reconcile_checked_at: null, ...over,
  }
}

function details(over: Record<string, unknown> = {}) {
  return {
    conversation_id: 'conv_1', agent_id: 'agent_el_1', status: 'done', has_audio: true,
    transcript: [{ role: 'agent', message: 'Hi', time_in_call_secs: 0 }],
    metadata: { start_time_unix_secs: Math.floor((NOW - 30 * 60_000) / 1000), call_duration_secs: 70, phone_call: { type: 'twilio', direction: 'inbound', agent_number: '+40312345678', external_number: '+40712345123', call_sid: 'CA1', phone_number_id: 'pn' } },
    analysis: { call_successful: 'success', transcript_summary: 's' },
    conversation_initiation_client_data: { dynamic_variables: { ntv_call_id: CALL, ntv_call_token: signCallToken(CALL, 'transfer', 3600, NOW - 40 * 60_000) } },
    ...over,
  }
}

function seed(calls: Array<Record<string, unknown>>, extra: Record<string, Array<Record<string, unknown>>> = {}) {
  state.db = memoryDb({
    calls,
    agent_provider_resources: [{ org_id: ORG, agent_id: AGENT, provider: 'elevenlabs', external_id: 'agent_el_1' }],
    phone_numbers: [],
    webhook_events: [],
    ...extra,
  })
  return state.db
}

beforeEach(() => {
  state.circuit = 'closed'
  state.configured = true
  state.watermarks = new Map()
  writeWatermark.mockReset()
  applyCallEvent.mockReset().mockResolvedValue({ callId: CALL, outcome: 'updated' })
  for (const f of Object.values(api)) f.mockReset()
  for (const k of ['ELEVENLABS_RECONCILE_BATCH', 'ELEVENLABS_RECONCILE_SWEEP_AGENTS', 'ELEVENLABS_RECONCILE_MAX_FETCHES']) vi.stubEnv(k, '')
  vi.stubEnv('VOICE_TOKEN_SECRET', 'test-secret-0123456789-abcdefghijklmnop')
})

describe('conversation reconciliation — rows', () => {
  it('finds an app-routed call by ntv_call_id on the org\'s own agent and applies it as a trusted poll', async () => {
    seed([call()])
    api.findConversationsByCallId.mockResolvedValue([details()])
    const report = await reconcileElevenLabsConversations({ now: NOW, sweep: false })
    expect(report).toMatchObject({ scanned: 1, applied: 1, errors: 0 })
    expect(api.findConversationsByCallId).toHaveBeenCalledWith('agent_el_1', CALL, expect.objectContaining({ ctx: { orgId: ORG, callId: CALL } }))
    const [event, , opts] = applyCallEvent.mock.calls[0]
    expect(opts).toEqual({ source: 'poll' })
    expect(event).toMatchObject({ kind: 'call.completed', providerCallId: 'conv_1', localCallId: CALL, localCallIdTrusted: true, durationSeconds: 70 })
  })

  it('never trusts a listed conversation by its bare ntv_call_id: the signed call token must verify to the row, on a phone conversation', async () => {
    const OTHER = 'c0000000-0000-4000-8000-000000000002'
    const cases: Array<[string, Record<string, unknown>]> = [
      ['no token (a widget/SDK session can send any ntv_call_id)', { conversation_initiation_client_data: { dynamic_variables: { ntv_call_id: CALL } } }],
      ['a forged token', { conversation_initiation_client_data: { dynamic_variables: { ntv_call_id: CALL, ntv_call_token: 'eyJjIjoiYyJ9.Zm9yZ2Vk' } } }],
      ['a valid token of another call', { conversation_initiation_client_data: { dynamic_variables: { ntv_call_id: CALL, ntv_call_token: signCallToken(OTHER, 'transfer', 3600) } } }],
      ['a token of another purpose', { conversation_initiation_client_data: { dynamic_variables: { ntv_call_id: CALL, ntv_call_token: signCallToken(CALL, 'tool', 3600) } } }],
      ['a browser session with a valid token', { metadata: { start_time_unix_secs: Math.floor(NOW / 1000) - 1800, call_duration_secs: 70, conversation_initiation_source: 'react_sdk' } }],
    ]
    for (const [label, over] of cases) {
      const db = seed([call()])
      api.findConversationsByCallId.mockResolvedValue([details(over)])
      const report = await reconcileElevenLabsConversations({ now: NOW, sweep: false })
      expect(report, label).toMatchObject({ scanned: 1, applied: 0, notFound: 1 })
      expect(db.tables.calls[0], label).toMatchObject({ status: 'in-progress', reconcile_attempts: 1 })
    }
    expect(applyCallEvent).not.toHaveBeenCalled()
  })

  it('never prefers a final unverified listing over the verified conversation that is still running', async () => {
    seed([call()])
    api.findConversationsByCallId.mockResolvedValue([
      details({ conversation_id: 'conv_fake', conversation_initiation_client_data: { dynamic_variables: { ntv_call_id: CALL } } }),
      details({ conversation_id: 'conv_real', status: 'processing' }),
    ])
    const report = await reconcileElevenLabsConversations({ now: NOW, sweep: false })
    expect(report).toMatchObject({ applied: 0, pending: 1 })
    expect(applyCallEvent).not.toHaveBeenCalled()
  })

  it('GETs a stored conversation id directly (native outbound) and never applies one that is still running', async () => {
    const db = seed([call({ status: 'ringing', routing: {}, elevenlabs_conversation_id: 'conv_9', lifecycle_rank: 10 })])
    api.getConversation.mockResolvedValue(details({ conversation_id: 'conv_9', status: 'processing' }))
    const report = await reconcileElevenLabsConversations({ now: NOW, sweep: false })
    expect(report).toMatchObject({ pending: 1, applied: 0 })
    expect(applyCallEvent).not.toHaveBeenCalled()
    expect(db.tables.calls[0]).toMatchObject({ reconcile_attempts: 1 })
    expect(db.tables.calls[0].reconcile_checked_at).toBeTruthy()
  })

  it('refuses a conversation of another agent (shared workspace)', async () => {
    seed([call({ elevenlabs_conversation_id: 'conv_x' })])
    api.getConversation.mockResolvedValue(details({ agent_id: 'agent_of_someone_else' }))
    const report = await reconcileElevenLabsConversations({ now: NOW, sweep: false })
    expect(report.applied).toBe(0)
    expect(applyCallEvent).not.toHaveBeenCalled()
  })

  it('without a local agent link, applies a stored conversation only when its agent belongs to the row\'s org', async () => {
    seed([call({ agent_id: null, elevenlabs_conversation_id: 'conv_x' })], {
      agent_provider_resources: [
        { org_id: ORG, agent_id: AGENT, provider: 'elevenlabs', external_id: 'agent_el_1' },
        { org_id: 'other-org', agent_id: 'a2', provider: 'elevenlabs', external_id: 'agent_el_2' },
      ],
    })
    api.getConversation.mockResolvedValue(details({ conversation_id: 'conv_x', agent_id: 'agent_el_2' }))
    expect((await reconcileElevenLabsConversations({ now: NOW, sweep: false })).applied).toBe(0)
    expect(applyCallEvent).not.toHaveBeenCalled()

    seed([call({ agent_id: null, elevenlabs_conversation_id: 'conv_x' })])
    api.getConversation.mockResolvedValue(details({ conversation_id: 'conv_x', agent_id: 'agent_el_1' }))
    expect((await reconcileElevenLabsConversations({ now: NOW, sweep: false })).applied).toBe(1)
  })

  it('settles a native outbound call stuck in ringing when the provider has no conversation', async () => {
    const db = seed([call({ status: 'ringing', routing: {}, elevenlabs_conversation_id: 'conv_gone', lifecycle_rank: 10, created_at: iso(180), started_at: iso(180) })])
    api.getConversation.mockRejectedValue(new ProviderError({ system: 'elevenlabs', code: 'not_found', operation: 'conversations.get', status: 404 }))
    const report = await reconcileElevenLabsConversations({ now: NOW, sweep: false })
    expect(report.settled).toBe(1)
    expect(db.tables.calls[0]).toMatchObject({ status: 'failed', lifecycle_rank: 30 })
  })

  it('leaves an app-routed call without conversation to the Twilio-duration billing (marked checked)', async () => {
    const db = seed([call()])
    api.findConversationsByCallId.mockResolvedValue([])
    const report = await reconcileElevenLabsConversations({ now: NOW, sweep: false })
    expect(report.notFound).toBe(1)
    expect(db.tables.calls[0]).toMatchObject({ status: 'in-progress', reconcile_attempts: 1 })
  })

  it('skips calls that have not ended yet and rows of other providers or already final', async () => {
    seed([
      call({ id: 'c-live', routing: {}, created_at: iso(5), started_at: iso(5) }),
      call({ id: 'c-cartesia', provider: 'cartesia' }),
      call({ id: 'c-final', lifecycle_rank: 50 }),
    ])
    const report = await reconcileElevenLabsConversations({ now: NOW, sweep: false })
    expect(report.scanned).toBe(0)
    expect(api.findConversationsByCallId).not.toHaveBeenCalled()
  })

  it('stops at the deadline the maintenance run gives it (rows and sweep), and says so', async () => {
    seed([call()], { phone_numbers: [{ id: 'n1', org_id: ORG, agent_id: AGENT, routing_mode: 'native_elevenlabs', is_active: true }] })
    const report = await reconcileElevenLabsConversations({ now: NOW, deadline: Date.now() - 1 })
    expect(report).toMatchObject({ scanned: 0, deadlineReached: true, swept: { agents: 0 } })
    expect(api.findConversationsByCallId).not.toHaveBeenCalled()
    expect(api.listConversations).not.toHaveBeenCalled()
  })

  it('does nothing while the ElevenLabs circuit is not closed, or without a key', async () => {
    seed([call()])
    state.circuit = 'open'
    expect((await reconcileElevenLabsConversations({ now: NOW })).skipped).toBe('circuit_open')
    state.circuit = 'closed'
    state.configured = false
    expect((await reconcileElevenLabsConversations({ now: NOW })).skipped).toBe('not_configured')
    expect(api.findConversationsByCallId).not.toHaveBeenCalled()
  })
})

describe('conversation reconciliation — native inbound sweep', () => {
  it('lists the agent\'s conversations oldest first, skips known/test/running ones, applies the rest and moves the watermark', async () => {
    seed([{ id: 'known', org_id: ORG, provider: 'elevenlabs', lifecycle_rank: 50, elevenlabs_conversation_id: 'conv_known', created_at: iso(60) }], {
      phone_numbers: [{ id: 'n1', org_id: ORG, agent_id: AGENT, routing_mode: 'native_elevenlabs', is_active: true }],
      webhook_events: [{ id: 'w1', provider: 'elevenlabs', event_type: 'post_call_transcription', external_id: 'conv_ignored', status: 'ignored' }],
    })
    const start = (min: number) => Math.floor((NOW - min * 60_000) / 1000)
    api.listConversations.mockResolvedValue({
      has_more: false,
      conversations: [
        { conversation_id: 'conv_known', agent_id: 'agent_el_1', status: 'done', start_time_unix_secs: start(60), call_duration_secs: 10 },
        { conversation_id: 'conv_ignored', agent_id: 'agent_el_1', status: 'done', start_time_unix_secs: start(55), call_duration_secs: 10 },
        { conversation_id: 'conv_web', agent_id: 'agent_el_1', status: 'done', start_time_unix_secs: start(50), call_duration_secs: 10, conversation_initiation_source: 'react_sdk' },
        { conversation_id: 'conv_lost', agent_id: 'agent_el_1', status: 'done', start_time_unix_secs: start(40), call_duration_secs: 10, conversation_initiation_source: 'twilio' },
        { conversation_id: 'conv_foreign', agent_id: 'agent_other', status: 'done', start_time_unix_secs: start(30), call_duration_secs: 10 },
      ],
    })
    api.getConversation.mockResolvedValue(details({ conversation_id: 'conv_lost', conversation_initiation_client_data: { dynamic_variables: { ntv_call_id: 'unknown' } } }))
    applyCallEvent.mockResolvedValue({ callId: 'new', outcome: 'created' })

    const report = await reconcileElevenLabsConversations({ now: NOW, limit: 0 })
    expect(api.listConversations).toHaveBeenCalledWith(expect.objectContaining({ agentId: 'agent_el_1', sortDirection: 'asc', pageSize: 100 }), expect.anything())
    expect(api.getConversation).toHaveBeenCalledTimes(1)
    expect(api.getConversation).toHaveBeenCalledWith('conv_lost', expect.anything())
    expect(report.swept).toMatchObject({ agents: 1, listed: 4, applied: 1 })
    const [event, , opts] = applyCallEvent.mock.calls[0]
    expect(opts).toEqual({ source: 'poll' })
    // Native inbound: no trusted local id (placeholders only).
    expect(event.localCallIdTrusted).toBeUndefined()
    expect(writeWatermark).toHaveBeenCalledWith(`conversation_sweep:${AGENT}`, NOW - 5 * 60_000, expect.anything(), expect.anything())
  })

  it('holds the watermark before a conversation that is still running', async () => {
    seed([], { phone_numbers: [{ id: 'n1', org_id: ORG, agent_id: AGENT, routing_mode: 'native_elevenlabs', is_active: true }] })
    const startS = Math.floor((NOW - 20 * 60_000) / 1000)
    api.listConversations.mockResolvedValue({ has_more: false, conversations: [{ conversation_id: 'conv_run', agent_id: 'agent_el_1', status: 'in-progress', start_time_unix_secs: startS, call_duration_secs: 0 }] })
    await reconcileElevenLabsConversations({ now: NOW, limit: 0 })
    expect(api.getConversation).not.toHaveBeenCalled()
    expect(writeWatermark).toHaveBeenCalledWith(`conversation_sweep:${AGENT}`, startS * 1000 - 1000, expect.anything(), expect.anything())
  })
})
