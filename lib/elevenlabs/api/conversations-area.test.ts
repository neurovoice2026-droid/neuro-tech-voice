import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import * as conv from './conversations'
import * as ws from './workspace'
import { setCircuitStore } from '@/lib/voice-providers/circuit-registry'
import { MemoryCircuitStore } from '@/lib/voice-providers/circuit-breaker'
import { setProviderEventSink } from '@/lib/observability/telemetry'
import { callAt, installFetch, jsonResponse, type FetchMock } from '@/tests/helpers/fetch'

// Request shapes of the slice-D wrappers (paths, methods, query, bodies as in
// the OpenAPI spec). Every call is a mocked fetch.

let fetchMock: FetchMock
let restoreSink: () => void
const CALL = 'c0000000-0000-4000-8000-000000000001'

beforeEach(() => {
  vi.stubEnv('ELEVENLABS_API_KEY', 'sk_0123456789abcdef0123456789abcdef0123')
  vi.stubEnv('ELEVENLABS_API_BASE_URL', '')
  setCircuitStore(new MemoryCircuitStore())
  restoreSink = setProviderEventSink(() => {})
  vi.spyOn(Math, 'random').mockReturnValue(0)
  vi.spyOn(console, 'error').mockImplementation(() => {})
  vi.spyOn(console, 'warn').mockImplementation(() => {})
  fetchMock = installFetch()
})
afterEach(() => {
  restoreSink()
  setCircuitStore(null)
})

describe('conversations area', () => {
  it('listConversations: always scoped to an agent; repeated filters; summaries excluded', async () => {
    fetchMock.mockImplementation(async () => jsonResponse({ conversations: [], has_more: false }))
    await conv.listConversations({
      agentId: 'agent_1',
      dynamicVariableParams: [`ntv_call_id:eq:${CALL}`],
      excludeStatuses: ['initiated', 'in-progress'],
      callStartAfterUnix: 100,
      callStartBeforeUnix: 200,
      pageSize: 500,
      sortDirection: 'asc',
      cursor: 'cur',
    })
    const c = callAt(fetchMock)
    expect([c.method, c.url.pathname]).toEqual(['GET', '/v1/convai/conversations'])
    const q = c.url.searchParams
    expect(q.get('agent_id')).toBe('agent_1')
    expect(q.getAll('dynamic_variable_params')).toEqual([`ntv_call_id:eq:${CALL}`])
    expect(q.getAll('exclude_statuses')).toEqual(['initiated', 'in-progress'])
    expect([q.get('call_start_after_unix'), q.get('call_start_before_unix'), q.get('page_size'), q.get('sort_direction'), q.get('cursor'), q.get('summary_mode')]).toEqual(['100', '200', '100', 'asc', 'cur', 'exclude'])
    expect(() => conv.listConversations({ agentId: '' })).toThrow()
  })

  it('findConversationsByCallId: lists on the org agent, then keeps only GET-confirmed matches', async () => {
    fetchMock
      .mockResolvedValueOnce(jsonResponse({ has_more: false, conversations: [
        { conversation_id: 'conv_a', agent_id: 'agent_1', status: 'done', start_time_unix_secs: 10, call_duration_secs: 5 },
        { conversation_id: 'conv_b', agent_id: 'agent_1', status: 'done', start_time_unix_secs: 20, call_duration_secs: 5 },
        { conversation_id: 'conv_c', agent_id: 'agent_2', status: 'done', start_time_unix_secs: 30, call_duration_secs: 5 },
      ] }))
      // Newest first: conv_b (echo matches), then conv_a (echo of another call).
      .mockResolvedValueOnce(jsonResponse({ conversation_id: 'conv_b', agent_id: 'agent_1', status: 'done', conversation_initiation_client_data: { dynamic_variables: { ntv_call_id: CALL } } }))
      .mockResolvedValueOnce(jsonResponse({ conversation_id: 'conv_a', agent_id: 'agent_1', status: 'done', conversation_initiation_client_data: { dynamic_variables: { ntv_call_id: 'c0000000-0000-4000-8000-000000000099' } } }))
    const found = await conv.findConversationsByCallId('agent_1', CALL)
    expect(found.map((f) => f.conversation_id)).toEqual(['conv_b'])
    expect(callAt(fetchMock, 0).url.searchParams.get('page_size')).toBe('5')
    expect(callAt(fetchMock, 1).url.pathname).toBe('/v1/convai/conversations/conv_b')
    expect(fetchMock).toHaveBeenCalledTimes(3)
    await expect(conv.findConversationsByCallId('agent_1', 'not-a-uuid')).rejects.toThrow()
  })

  it('getConversation and the feedback body (UserFeedbackScore or null)', async () => {
    fetchMock.mockImplementation(async () => jsonResponse({}))
    await conv.getConversation('conv/1')
    expect(callAt(fetchMock, 0).url.pathname).toBe('/v1/convai/conversations/conv%2F1')
    await conv.sendConversationFeedback('conv_1', 'dislike')
    await conv.sendConversationFeedback('conv_1', null)
    const c = callAt(fetchMock, 1)
    expect([c.method, c.url.pathname, c.json]).toEqual(['POST', '/v1/convai/conversations/conv_1/feedback', { feedback: 'dislike' }])
    expect(callAt(fetchMock, 2).json).toEqual({ feedback: null })
  })

  it('runConversationAnalysis is billed: one attempt even on a 503', async () => {
    fetchMock.mockResolvedValue(new Response('busy', { status: 503 }))
    await expect(conv.runConversationAnalysis('conv_1')).rejects.toThrow()
    expect(fetchMock).toHaveBeenCalledTimes(1)
    expect([callAt(fetchMock).method, callAt(fetchMock).url.pathname]).toEqual(['POST', '/v1/convai/conversations/conv_1/analysis/run'])
  })

  it('liveCount: per agent for tenants, workspace-wide without an agent; topics on one agent', async () => {
    fetchMock.mockImplementation(async () => jsonResponse({ count: 2 }))
    expect(await conv.liveCount({ agentId: 'agent_1' })).toEqual({ count: 2 })
    expect(callAt(fetchMock, 0).url.searchParams.get('agent_id')).toBe('agent_1')
    await conv.liveCount()
    expect(callAt(fetchMock, 1).url.searchParams.has('agent_id')).toBe(false)
    fetchMock.mockImplementation(async () => jsonResponse({ topics: [], window_start_unix_secs: 1, window_end_unix_secs: 2 }))
    await conv.agentTopics('agent_1', { pageSize: 8, fromUnixSecs: 1, toUnixSecs: 2 })
    const t = callAt(fetchMock, 2)
    expect(t.url.pathname).toBe('/v1/convai/agents/agent_1/topics')
    expect([t.url.searchParams.get('include_evaluation_criteria'), t.url.searchParams.get('sort_by'), t.url.searchParams.get('page_size')]).toEqual(['false', 'conversations', '8'])
  })
})

describe('workspace area', () => {
  it('lists webhooks with usages and patches only name, is_disabled and retry_enabled (never events)', async () => {
    fetchMock.mockImplementation(async () => jsonResponse({ webhooks: [] }))
    await ws.listWorkspaceWebhooks({ includeUsages: true })
    expect(callAt(fetchMock, 0).url.searchParams.get('include_usages')).toBe('true')
    fetchMock.mockImplementation(async () => jsonResponse({ status: 'ok' }))
    await ws.updateWorkspaceWebhook('wh_1', { name: 'post-call', is_disabled: false, retry_enabled: true })
    const c = callAt(fetchMock, 1)
    expect([c.method, c.url.pathname, c.json]).toEqual(['PATCH', '/v1/workspace/webhooks/wh_1', { name: 'post-call', is_disabled: false, retry_enabled: true }])
  })

  it('reads and writes /v1/convai/settings', async () => {
    fetchMock.mockImplementation(async () => jsonResponse({ conversation_embedding_retention_days: null }))
    await ws.getConvaiSettings()
    await ws.updateConvaiSettings({ conversation_embedding_retention_days: 30 })
    expect([callAt(fetchMock, 0).method, callAt(fetchMock, 0).url.pathname]).toEqual(['GET', '/v1/convai/settings'])
    expect([callAt(fetchMock, 1).method, callAt(fetchMock, 1).json]).toEqual(['PATCH', { conversation_embedding_retention_days: 30 }])
  })
})
