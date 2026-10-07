import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import * as tools from './tools'
import * as secrets from './secrets'
import { setCircuitStore } from '@/lib/voice-providers/circuit-registry'
import { MemoryCircuitStore } from '@/lib/voice-providers/circuit-breaker'
import { setProviderEventSink } from '@/lib/observability/telemetry'
import { callAt, installFetch, jsonResponse, type FetchMock } from '@/tests/helpers/fetch'

// Request shapes of the slice-B1 wrappers (paths, methods, query and bodies as
// in the OpenAPI spec), and the retry policy of resource-creating POSTs.
// Every call is a mocked fetch.

let fetchMock: FetchMock
let restoreSink: () => void

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

describe('tools API', () => {
  it('createTool: POST /v1/convai/tools {tool_config}, never retried (a retry could duplicate the tool)', async () => {
    fetchMock.mockResolvedValue(jsonResponse({ detail: { message: 'boom' } }, 503))
    await expect(tools.createTool({ type: 'webhook', name: 'x' })).rejects.toMatchObject({ code: 'upstream', operation: 'tools.create' })
    expect(fetchMock).toHaveBeenCalledTimes(1)
    const c = callAt(fetchMock)
    expect([c.method, c.url.pathname]).toEqual(['POST', '/v1/convai/tools'])
    expect(c.json).toEqual({ tool_config: { type: 'webhook', name: 'x' } })
  })

  it('updateTool: PATCH with the full config (idempotent, so retried on 5xx)', async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse({}, 502)).mockResolvedValueOnce(jsonResponse({ id: 't1', tool_config: {} }))
    await tools.updateTool('t/1', { type: 'webhook' })
    expect(fetchMock).toHaveBeenCalledTimes(2)
    const c = callAt(fetchMock, 1)
    expect([c.method, c.url.pathname]).toEqual(['PATCH', '/v1/convai/tools/t%2F1'])
    expect(c.json).toEqual({ tool_config: { type: 'webhook' } })
  })

  it('getTool, deleteTool(force=false by default), listTools with name prefix and repeated types', async () => {
    fetchMock.mockImplementation(async () => jsonResponse({ id: 't1', tool_config: {}, tools: [], has_more: false }))
    await tools.getTool('t1')
    await tools.deleteTool('t1')
    await tools.listTools({ search: 'transfer_to_human', types: ['webhook'], cursor: 'c1', page_size: 500 })
    expect([callAt(fetchMock, 0).method, callAt(fetchMock, 0).url.pathname]).toEqual(['GET', '/v1/convai/tools/t1'])
    expect([callAt(fetchMock, 1).method, callAt(fetchMock, 1).url.search]).toEqual(['DELETE', '?force=false'])
    const q = callAt(fetchMock, 2).url.searchParams
    expect([q.get('search'), q.getAll('types'), q.get('cursor'), q.get('page_size')]).toEqual(['transfer_to_human', ['webhook'], 'c1', '100'])
  })

  it('toolExecutions and toolDependentAgents: filters and page size within the spec limits', async () => {
    fetchMock.mockImplementation(async () => jsonResponse({ executions: [], agents: [], has_more: false }))
    await tools.toolExecutions('t1', { is_error: true, start_time: 1_700_000_000, cursor: 'c' })
    await tools.toolDependentAgents('t1', { page_size: 0 })
    const ex = callAt(fetchMock, 0)
    expect(ex.url.pathname).toBe('/v1/convai/tools/t1/executions')
    expect(Object.fromEntries(ex.url.searchParams.entries())).toEqual({ is_error: 'true', start_time: '1700000000', cursor: 'c', page_size: '100' })
    const dep = callAt(fetchMock, 1)
    expect(dep.url.pathname).toBe('/v1/convai/tools/t1/dependent-agents')
    expect(dep.url.searchParams.get('page_size')).toBe('1')
  })

  it('collectPages follows cursors, stops on a repeated cursor and reports truncation at the cap', async () => {
    const pages = [
      { items: [1], next_cursor: 'a', has_more: true },
      { items: [2], next_cursor: 'b', has_more: true },
      { items: [3], next_cursor: 'a', has_more: true },
    ]
    let i = 0
    expect(await tools.collectPages(async () => pages[i++], 10)).toEqual({ items: [1, 2, 3], truncated: false })
    let j = 0
    const endless = async () => ({ items: [j], next_cursor: `c${j++}`, has_more: true })
    expect(await tools.collectPages(endless, 3)).toEqual({ items: [0, 1, 2], truncated: true })
  })
})

describe('secrets API', () => {
  it('createSecret: POST {type: new, name, value}, never retried', async () => {
    fetchMock.mockResolvedValue(jsonResponse({}, 500))
    await expect(secrets.createSecret({ name: 'ntv_tool_key_x', value: 'v'.repeat(40) })).rejects.toMatchObject({ operation: 'secrets.create' })
    expect(fetchMock).toHaveBeenCalledTimes(1)
    const c = callAt(fetchMock)
    expect([c.method, c.url.pathname]).toEqual(['POST', '/v1/convai/secrets'])
    expect(c.json).toEqual({ type: 'new', name: 'ntv_tool_key_x', value: 'v'.repeat(40) })
  })

  it('updateSecret: PATCH {type: update, name, value}; get, list (name prefix), dependencies, delete', async () => {
    fetchMock.mockImplementation(async () => jsonResponse({ secret_id: 's1', name: 'n', secrets: [], dependencies: [] }))
    await secrets.updateSecret('s1', { name: 'n', value: 'v'.repeat(40) })
    await secrets.getSecret('s1')
    await secrets.listSecrets({ search: 'ntv_tool_key' })
    await secrets.secretDependencies('s1', 'tools')
    await secrets.deleteSecret('s1')
    expect([callAt(fetchMock, 0).method, callAt(fetchMock, 0).url.pathname, callAt(fetchMock, 0).json]).toEqual(['PATCH', '/v1/convai/secrets/s1', { type: 'update', name: 'n', value: 'v'.repeat(40) }])
    expect([callAt(fetchMock, 1).method, callAt(fetchMock, 1).url.pathname]).toEqual(['GET', '/v1/convai/secrets/s1'])
    expect(Object.fromEntries(callAt(fetchMock, 2).url.searchParams.entries())).toEqual({ search: 'ntv_tool_key', page_size: '100' })
    expect(callAt(fetchMock, 3).url.pathname).toBe('/v1/convai/secrets/s1/dependencies/tools')
    expect([callAt(fetchMock, 4).method, callAt(fetchMock, 4).url.pathname]).toEqual(['DELETE', '/v1/convai/secrets/s1'])
  })
})
