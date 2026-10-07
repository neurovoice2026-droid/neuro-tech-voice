import { beforeEach, describe, expect, it, vi } from 'vitest'

// Slice D routes: transcript search, owner feedback, re-analysis, recording
// 404 persistence, delete privacy, AI metrics, dashboard insights.

type Op = [string, ...unknown[]]
type Result = { data: unknown; error: unknown; count?: number | null }
let handler: (table: string, ops: Op[]) => Result
let rpcHandler: (fn: string, args: unknown) => Result = () => ({ data: [], error: null })
const calls: Array<{ db: string; table: string; ops: Op[] }> = []
const rpcs: Array<{ fn: string; args: unknown }> = []

function fakeDb(name: string) {
  return {
    from(table: string) {
      const ops: Op[] = []
      calls.push({ db: name, table, ops })
      const builder: unknown = new Proxy({}, {
        get(_t, prop: string) {
          if (prop === 'then') return (res: (v: unknown) => unknown, rej: (e: unknown) => unknown) => Promise.resolve().then(() => handler(table, ops)).then(res, rej)
          return (...args: unknown[]) => { ops.push([prop, ...args]); return builder }
        },
      })
      return builder
    },
    rpc(fn: string, args: unknown) {
      rpcs.push({ fn, args })
      return Promise.resolve(rpcHandler(fn, args))
    },
  }
}

const db = fakeDb('user')
const adminDb = fakeDb('admin')

vi.mock('@/lib/api/auth', () => ({
  requireOrg: vi.fn(async () => ({ supabase: db, user: { id: 'u1', email: 'o@example.test' }, org: { id: 'org1', name: 'X', timezone: 'UTC', plan: 'pro' } })),
}))
vi.mock('@/lib/supabase/admin', () => ({ createAdminClient: () => adminDb }))
const enforce = vi.fn(async () => undefined)
vi.mock('@/lib/security/rate-limit', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/security/rate-limit')>()),
  rateLimit: vi.fn(async () => ({ allowed: true, remaining: 10, resetAt: Date.now() + 1000 })),
  enforceRateLimit: (...a: unknown[]) => enforce(...(a as [])),
}))
vi.mock('@/lib/elevenlabs/client', () => ({ isConfigured: () => true, conversations: { delete: vi.fn(), audio: vi.fn() } }))
vi.mock('@/lib/cartesia/client', () => ({ calls: { delete: vi.fn(), audio: vi.fn() } }))
const api = { sendConversationFeedback: vi.fn(), getConversation: vi.fn(), runConversationAnalysis: vi.fn(), findConversationsByCallId: vi.fn(), liveCount: vi.fn(), agentTopics: vi.fn() }
vi.mock('@/lib/elevenlabs/api/conversations', async (orig) => ({
  ...(await orig<typeof import('@/lib/elevenlabs/api/conversations')>()),
  sendConversationFeedback: (...a: unknown[]) => api.sendConversationFeedback(...a),
  getConversation: (...a: unknown[]) => api.getConversation(...a),
  runConversationAnalysis: (...a: unknown[]) => api.runConversationAnalysis(...a),
  findConversationsByCallId: (...a: unknown[]) => api.findConversationsByCallId(...a),
  liveCount: (...a: unknown[]) => api.liveCount(...a),
  agentTopics: (...a: unknown[]) => api.agentTopics(...a),
}))

import { GET as listGET } from '@/app/api/calls/route'
import { DELETE as delOne } from '@/app/api/calls/[id]/route'
import { GET as audioGET } from '@/app/api/calls/[id]/audio/route'
import { POST as feedbackPOST } from '@/app/api/calls/[id]/feedback/route'
import { POST as reanalyzePOST } from '@/app/api/calls/[id]/reanalyze/route'
import { GET as metricsGET } from '@/app/api/dashboard/metrics/route'
import { GET as topicsGET } from '@/app/api/dashboard/topics/route'
import { GET as liveGET } from '@/app/api/dashboard/live/route'
import { conversations } from '@/lib/elevenlabs/client'
import { clearInsightCaches } from '@/lib/calls/insights'
import { ProviderError } from '@/lib/voice-providers/errors'

const ID = '11111111-1111-4111-8111-111111111111'
const ROW = {
  id: ID, org_id: 'org1', agent_id: 'a1111111-1111-4111-8111-111111111111', phone_number_id: null, twilio_call_sid: 'CA1', elevenlabs_conversation_id: 'conv_123456',
  caller_number: '+40712345678', direction: 'inbound', duration_seconds: 65, status: 'completed', sentiment: null, summary: 's', started_at: '2026-10-05T08:00:00Z',
  ended_at: null, created_at: '2026-10-05T08:00:00Z', provider: 'elevenlabs', primary_provider: 'elevenlabs', routing_reason: 'primary', failover_reason: null,
  provider_call_id: 'conv_123456', cartesia_call_id: null, from_number: null, to_number: null, outcome: 'booked', call_successful: 'success', summary_title: 'T',
  termination_reason: null, has_recording: true, recording_status: 'available', transcript: [], analysis: {}, call_metadata: {}, retention_applied_at: null, is_test: false,
}
const params = (id: string) => ({ params: Promise.resolve({ id }) })
const req = (url: string, init?: RequestInit) => new Request(`https://app.test${url}`, init)
const post = (url: string, body?: unknown) => req(url, { method: 'POST', headers: { origin: 'https://app.test', host: 'app.test', 'content-type': 'application/json' }, body: body === undefined ? undefined : JSON.stringify(body) })
const writes = (table: string) => calls.filter((c) => c.db === 'admin' && c.table === table && c.ops.some((o) => o[0] === 'update' || o[0] === 'delete' || o[0] === 'insert'))

beforeEach(() => {
  calls.length = 0
  rpcs.length = 0
  rpcHandler = () => ({ data: [], error: null })
  enforce.mockReset().mockResolvedValue(undefined)
  for (const f of Object.values(api)) f.mockReset()
  vi.mocked(conversations.delete).mockReset()
  vi.mocked(conversations.audio).mockReset()
  clearInsightCaches()
  vi.spyOn(console, 'log').mockImplementation(() => {})
  vi.spyOn(console, 'warn').mockImplementation(() => {})
  vi.spyOn(console, 'error').mockImplementation(() => {})
})

describe('calls search', () => {
  it('a text search also matches transcripts through the org-scoped full-text RPC (rate limited)', async () => {
    rpcHandler = () => ({ data: [{ call_id: ID }], error: null })
    handler = () => ({ data: [ROW], error: null, count: 1 })
    const res = await listGET(req('/api/calls?search=programare%20mâine'))
    expect(res.status).toBe(200)
    expect(rpcs).toEqual([{ fn: 'search_org_calls', args: { p_org_id: 'org1', p_tsquery: 'programare:* & mâine:*', p_limit: 200 } }])
    expect(enforce).toHaveBeenCalledTimes(1)
    const or = calls[0].ops.find((o) => o[0] === 'or')
    expect(String(or?.[1])).toContain(`id.in.(${ID})`)
  })

  it('phone-number searches do not touch the full-text index', async () => {
    handler = () => ({ data: [], error: null, count: 0 })
    await listGET(req('/api/calls?search=0712'))
    expect(rpcs).toEqual([])
    expect(enforce).not.toHaveBeenCalled()
  })

  it('filters by outcome and AI outcome', async () => {
    handler = () => ({ data: [], error: null, count: 0 })
    await listGET(req('/api/calls?outcome=voicemail&aiOutcome=failure'))
    expect(calls[0].ops).toEqual(expect.arrayContaining([['eq', 'outcome', 'voicemail'], ['eq', 'call_successful', 'failure']]))
  })
})

describe('owner feedback', () => {
  it('stores it on the org row and forwards it to the call\'s own conversation', async () => {
    handler = (table) => (table === 'calls' ? { data: ROW, error: null } : { data: null, error: null })
    api.sendConversationFeedback.mockResolvedValue({})
    const res = await feedbackPOST(post('/x', { feedback: 'dislike' }), params(ID))
    expect(await res.json()).toEqual({ feedback: 'dislike', forwarded: true })
    const update = writes('calls')[0]
    expect(update.ops).toEqual(expect.arrayContaining([['eq', 'id', ID], ['eq', 'org_id', 'org1']]))
    expect((update.ops.find((o) => o[0] === 'update')?.[1] as Record<string, unknown>).owner_feedback).toBe('dislike')
    expect(api.sendConversationFeedback).toHaveBeenCalledWith('conv_123456', 'dislike', { orgId: 'org1', callId: ID })
  })

  it('a provider failure keeps the local value; bad input, cross-site and rate limits are refused', async () => {
    handler = (table) => (table === 'calls' ? { data: ROW, error: null } : { data: null, error: null })
    api.sendConversationFeedback.mockRejectedValue(new ProviderError({ system: 'elevenlabs', code: 'upstream', operation: 'conversations.feedback', status: 500 }))
    expect(await (await feedbackPOST(post('/x', { feedback: 'like' }), params(ID))).json()).toEqual({ feedback: 'like', forwarded: false })
    expect((await feedbackPOST(post('/x', { feedback: 'love' }), params(ID))).status).toBe(400)
    expect((await feedbackPOST(req('/x', { method: 'POST', headers: { origin: 'https://evil.test', host: 'app.test', 'content-type': 'application/json' }, body: '{"feedback":null}' }), params(ID))).status).toBe(403)
    const { RequestError } = await import('@/lib/api/http')
    enforce.mockRejectedValueOnce(new RequestError('rate_limited', 'slow down', 429))
    expect((await feedbackPOST(post('/x', { feedback: null }), params(ID))).status).toBe(429)
  })
})

describe('re-analysis', () => {
  it('runs only on the org\'s own agent conversation, then refreshes the row', async () => {
    handler = (table) => {
      if (table === 'calls') return { data: ROW, error: null }
      if (table === 'agent_provider_resources') return { data: { org_id: 'org1' }, error: null }
      return { data: null, error: null }
    }
    api.getConversation.mockResolvedValue({ conversation_id: 'conv_123456', agent_id: 'agent_el_1', status: 'done' })
    api.runConversationAnalysis.mockResolvedValue({ conversation_id: 'conv_123456', agent_id: 'agent_el_1', status: 'done', analysis: { call_successful: 'failure', transcript_summary: 'new', data_collection_results: { outcome: { value: 'message_taken' } } }, metadata: {}, transcript: [] })
    const res = await reanalyzePOST(post('/x'), params(ID))
    expect(res.status).toBe(200)
    expect(enforce).toHaveBeenCalledTimes(1)
    const patch = writes('calls')[0].ops.find((o) => o[0] === 'update')?.[1] as Record<string, unknown>
    expect(patch).toMatchObject({ call_successful: 'failure', summary: 'new', outcome: 'message_taken' })
  })

  it('refuses a conversation that belongs to another org\'s agent before spending anything', async () => {
    handler = (table) => {
      if (table === 'calls') return { data: ROW, error: null }
      if (table === 'agent_provider_resources') return { data: { org_id: 'someone-else' }, error: null }
      return { data: null, error: null }
    }
    api.getConversation.mockResolvedValue({ conversation_id: 'conv_123456', agent_id: 'agent_x', status: 'done' })
    const res = await reanalyzePOST(post('/x'), params(ID))
    expect(res.status).toBe(404)
    expect(api.runConversationAnalysis).not.toHaveBeenCalled()
  })

  it('refuses calls purged by retention and calls not served by ElevenLabs', async () => {
    handler = () => ({ data: { ...ROW, retention_applied_at: '2026-10-06T00:00:00Z' }, error: null })
    expect((await reanalyzePOST(post('/x'), params(ID))).status).toBe(409)
    handler = () => ({ data: { ...ROW, provider: 'cartesia', elevenlabs_conversation_id: null, provider_call_id: 'ca_1' }, error: null })
    expect((await reanalyzePOST(post('/x'), params(ID))).status).toBe(409)
    expect(api.getConversation).not.toHaveBeenCalled()
  })
})

describe('recording gone at the provider', () => {
  it('is remembered on the org row so the player is not offered again', async () => {
    handler = () => ({ data: ROW, error: null })
    vi.mocked(conversations.audio).mockRejectedValue(new ProviderError({ system: 'elevenlabs', code: 'not_found', operation: 'conversations.audio', status: 404 }))
    const res = await audioGET(req('/a'), params(ID))
    expect(res.status).toBe(404)
    const update = writes('calls')[0]
    expect(update.ops.find((o) => o[0] === 'update')?.[1]).toEqual({ has_recording: false, recording_status: 'unavailable' })
    expect(update.ops).toEqual(expect.arrayContaining([['eq', 'id', ID], ['eq', 'org_id', 'org1']]))
  })
})

describe('delete privacy', () => {
  const del = () => delOne(req('/x', { method: 'DELETE', headers: { origin: 'https://app.test', host: 'app.test' } }), params(ID))
  const noIdRow = { ...ROW, elevenlabs_conversation_id: null, provider_call_id: null }

  it('finds the conversation of a call without a stored id (org agent, ntv_call_id) and deletes it', async () => {
    handler = (table, ops) => {
      if (table === 'calls' && !ops.some((o) => o[0] === 'delete')) return { data: noIdRow, error: null }
      if (table === 'agent_provider_resources') return { data: { external_id: 'agent_el_1' }, error: null }
      return { data: null, error: null }
    }
    api.findConversationsByCallId.mockResolvedValue([{ conversation_id: 'conv_found' }])
    vi.mocked(conversations.delete).mockResolvedValue(undefined)
    const res = await del()
    expect(res.status).toBe(200)
    expect(api.findConversationsByCallId).toHaveBeenCalledWith('agent_el_1', ID, expect.objectContaining({ ctx: { orgId: 'org1', callId: ID } }))
    expect(conversations.delete).toHaveBeenCalledWith('conv_found', expect.anything())
    const agentLookup = calls.find((c) => c.table === 'agent_provider_resources')
    expect(agentLookup?.ops).toEqual(expect.arrayContaining([['eq', 'org_id', 'org1']]))
    const audit = calls.find((c) => c.table === 'audit_log')?.ops[0][1] as { details: { provider_call_ids: string[] } }
    expect(audit.details.provider_call_ids).toEqual(['conv_found'])
  })

  it('keeps the row when the lookup fails', async () => {
    handler = (table) => (table === 'agent_provider_resources' ? { data: { external_id: 'agent_el_1' }, error: null } : { data: noIdRow, error: null })
    api.findConversationsByCallId.mockRejectedValue(new ProviderError({ system: 'elevenlabs', code: 'timeout', operation: 'conversations.list' }))
    expect((await del()).status).toBe(502)
    expect(calls.some((c) => c.ops.some((o) => o[0] === 'delete'))).toBe(false)
  })
})

describe('dashboard', () => {
  it('AI resolution rate and outcome breakdown; test sessions excluded', async () => {
    const now = new Date().toISOString()
    handler = (table, ops) => {
      if (table === 'organizations') return { data: { minutes_used: 1, minutes_limit: 10 }, error: null }
      const range = ops.find((o) => o[0] === 'range')
      if (range && range[1] !== 0) return { data: [], error: null }
      return { data: [
        { status: 'completed', sentiment: null, duration_seconds: 60, started_at: now, created_at: now, call_successful: 'success', outcome: 'booked' },
        { status: 'completed', sentiment: null, duration_seconds: 60, started_at: now, created_at: now, call_successful: 'success', outcome: 'booked' },
        { status: 'completed', sentiment: null, duration_seconds: 60, started_at: now, created_at: now, call_successful: 'failure', outcome: 'message_taken' },
        { status: 'completed', sentiment: null, duration_seconds: 60, started_at: now, created_at: now, call_successful: 'unknown', outcome: 'nonsense' },
      ], error: null, count: 4 }
    }
    const body = await (await metricsGET(req('/api/dashboard/metrics'))).json()
    expect(body).toMatchObject({ ai_success_rate: 67, ai_outcome_breakdown: { success: 2, failure: 1, unknown: 1 }, outcome_breakdown: { booked: 2, message_taken: 1 }, success_rate: 100 })
    expect(calls.find((c) => c.table === 'calls')?.ops).toEqual(expect.arrayContaining([['eq', 'is_test', false]]))
  })

  it('topics and live count use the org\'s own agent only, and hide when unavailable', async () => {
    handler = (table) => (table === 'agent_provider_resources' ? { data: { external_id: 'agent_el_1' }, error: null } : { data: null, error: null })
    api.liveCount.mockResolvedValue({ count: 3 })
    expect(await (await liveGET(req('/api/dashboard/live'))).json()).toEqual({ available: true, count: 3 })
    expect(api.liveCount).toHaveBeenCalledWith({ agentId: 'agent_el_1' }, { orgId: 'org1' })
    api.agentTopics.mockResolvedValue({ window_start_unix_secs: 1, window_end_unix_secs: 2, topics: [
      { topic_id: 't1', label: 'Booking', description: 'Wants a slot', conversation_count: 12, success_rate: 0.75 },
      { topic_id: 't2', label: 'Sub', description: '', conversation_count: 30, parent_topic_id: 't1' },
    ] })
    const topics = await (await topicsGET(req('/api/dashboard/topics'))).json()
    expect(topics).toMatchObject({ available: true, topics: [{ label: 'Booking', conversations: 12, success_rate: 75 }] })
    expect(api.agentTopics).toHaveBeenCalledWith('agent_el_1', expect.anything(), { orgId: 'org1' })
    clearInsightCaches()
    api.agentTopics.mockRejectedValue(new ProviderError({ system: 'elevenlabs', code: 'not_found', operation: 'agents.topics', status: 404 }))
    expect(await (await topicsGET(req('/api/dashboard/topics'))).json()).toEqual({ available: false, topics: [], window: null })
  })
})
