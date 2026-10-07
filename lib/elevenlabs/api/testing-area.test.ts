// Slice G wrappers: the WebRTC conversation token (never retried, nothing
// optional sent), agent testing (create/run never retried, list narrowed by
// type), and the workspace subscription. Every call is a mocked fetch.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { conversationToken } from './conversation-token'
import { createAgentTest, getTestInvocation, listAgentTests, runAgentTests, updateAgentTest } from './agent-testing'
import { getSubscription } from './subscription'
import { setCircuitStore } from '@/lib/voice-providers/circuit-registry'
import { MemoryCircuitStore } from '@/lib/voice-providers/circuit-breaker'
import { setProviderEventSink, type ProviderEvent } from '@/lib/observability/telemetry'
import { callAt, installFetch, jsonResponse, type FetchMock } from '@/tests/helpers/fetch'

let fetchMock: FetchMock
let restoreSink: () => void
let events: ProviderEvent[]

beforeEach(() => {
  vi.stubEnv('ELEVENLABS_API_KEY', 'sk_0123456789abcdef0123456789abcdef0123')
  vi.stubEnv('ELEVENLABS_API_BASE_URL', '')
  setCircuitStore(new MemoryCircuitStore())
  events = []
  restoreSink = setProviderEventSink((e) => events.push(e))
  vi.spyOn(Math, 'random').mockReturnValue(0)
  vi.spyOn(console, 'error').mockImplementation(() => {})
  vi.spyOn(console, 'warn').mockImplementation(() => {})
  vi.spyOn(console, 'info').mockImplementation(() => {})
  fetchMock = installFetch()
})
afterEach(() => {
  restoreSink()
  setCircuitStore(null)
})

describe('GET /v1/convai/conversation/token', () => {
  it('sends agent_id and the opaque participant name only (never debug events)', async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse({ token: 'tok_secret', conversation_id: 'conv_1' }))
    const res = await conversationToken('agent_abc', { participantName: 'ntv-web-0123456789abcdef0123', ctx: { orgId: 'o1' } })
    expect(res).toEqual({ token: 'tok_secret', conversation_id: 'conv_1' })
    const c = callAt(fetchMock)
    expect([c.method, c.url.pathname]).toEqual(['GET', '/v1/convai/conversation/token'])
    expect(Object.fromEntries(c.url.searchParams)).toEqual({ agent_id: 'agent_abc', participant_name: 'ntv-web-0123456789abcdef0123' })
    expect(c.headers.get('xi-api-key')).toBeTruthy()
    // The token never reaches telemetry.
    expect(JSON.stringify(events)).not.toContain('tok_secret')
  })

  it('is never retried, even on a retryable status (each attempt is a new conversation)', async () => {
    fetchMock.mockResolvedValue(jsonResponse({ detail: { status: 'busy' } }, 503))
    await expect(conversationToken('agent_abc')).rejects.toMatchObject({ code: 'upstream' })
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })

  it('rejects a malformed agent id before any request, drops an unsafe participant name, and requires a token', async () => {
    await expect(conversationToken('agent_abc&debug_events_request=true')).rejects.toMatchObject({ code: 'validation' })
    expect(fetchMock).not.toHaveBeenCalled()
    fetchMock.mockResolvedValueOnce(jsonResponse({ token: 't', conversation_id: 'conv_1' }))
    await conversationToken('agent_abc', { participantName: 'owner@example.com' })
    expect(callAt(fetchMock).url.searchParams.has('participant_name')).toBe(false)
    fetchMock.mockResolvedValueOnce(jsonResponse({ conversation_id: 'conv_2' }))
    await expect(conversationToken('agent_abc')).rejects.toMatchObject({ code: 'bad_response' })
  })

  it('tolerates a missing or malformed conversation id (matched later by the webhook classification)', async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse({ token: 't', conversation_id: 'bad id/../x' }))
    expect(await conversationToken('agent_abc')).toEqual({ token: 't', conversation_id: '' })
  })
})

describe('agent testing', () => {
  const body = {
    type: 'llm' as const,
    name: 'ntv-platform test ai_disclosure',
    chat_history: [{ role: 'user' as const, message: 'Hi', time_in_call_secs: 0 }],
    success_condition: 'ok',
    success_examples: [{ response: 'a', type: 'success' as const }],
    failure_examples: [{ response: 'b', type: 'failure' as const }],
  }

  it('create is a single POST to /agent-testing/create (no retry)', async () => {
    fetchMock.mockResolvedValue(jsonResponse({ detail: 'x' }, 500))
    await expect(createAgentTest(body)).rejects.toMatchObject({ code: 'upstream' })
    expect(fetchMock).toHaveBeenCalledTimes(1)
    const c = callAt(fetchMock)
    expect([c.method, c.url.pathname]).toEqual(['POST', '/v1/convai/agent-testing/create'])
    expect(c.json).toEqual(body)
  })

  it('update is a PUT of the full definition; the list is narrowed by name and type, never include_folders', async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse({ id: 'test_1' })).mockResolvedValueOnce(jsonResponse({ tests: [], has_more: false }))
    await updateAgentTest('test_1', body)
    expect([callAt(fetchMock).method, callAt(fetchMock).url.pathname]).toEqual(['PUT', '/v1/convai/agent-testing/test_1'])
    await listAgentTests({ search: body.name, types: ['llm', 'tool'], pageSize: 500 })
    const q = callAt(fetchMock, 1).url.searchParams
    expect(q.getAll('types')).toEqual(['llm', 'tool'])
    expect(q.get('page_size')).toBe('100')
    expect(q.has('include_folders')).toBe(false)
  })

  it('run-tests posts {tests:[{test_id}]} once, with the override only when given', async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse({ id: 'inv_1', test_runs: [] }))
    await runAgentTests('agent_abc', { testIds: ['t1', 't2'] })
    const c = callAt(fetchMock)
    expect([c.method, c.url.pathname]).toEqual(['POST', '/v1/convai/agents/agent_abc/run-tests'])
    expect(c.json).toEqual({ tests: [{ test_id: 't1' }, { test_id: 't2' }] })

    fetchMock.mockResolvedValueOnce(jsonResponse({ detail: 'x' }, 502))
    await expect(runAgentTests('agent_abc', { testIds: ['t1'], repeatCount: 3, agentConfigOverride: { conversation_config: { a: 1 }, platform_settings: { b: 2 } } })).rejects.toBeTruthy()
    expect(fetchMock).toHaveBeenCalledTimes(2)
    expect(callAt(fetchMock, 1).json).toEqual({ tests: [{ test_id: 't1' }], repeat_count: 3, agent_config_override: { conversation_config: { a: 1 }, platform_settings: { b: 2 } } })
  })

  it('reads an invocation', async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse({ id: 'inv_1', test_runs: [{ test_run_id: 'r', test_id: 't1', status: 'passed' }] }))
    const inv = await getTestInvocation('inv_1')
    expect(inv.test_runs[0].status).toBe('passed')
    expect(callAt(fetchMock).url.pathname).toBe('/v1/convai/test-invocations/inv_1')
  })
})

describe('GET /v1/user/subscription', () => {
  it('returns the extended subscription body', async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse({ tier: 'business', status: 'active', character_count: 10, character_limit: 100, voice_slots_used: 1, voice_limit: 660, has_open_invoices: false, open_invoices: [] }))
    const sub = await getSubscription()
    expect(sub).toMatchObject({ tier: 'business', character_limit: 100, voice_limit: 660 })
    expect(callAt(fetchMock).url.pathname).toBe('/v1/user/subscription')
  })
})
