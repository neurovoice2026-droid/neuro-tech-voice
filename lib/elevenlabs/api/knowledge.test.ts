import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import * as kb from './knowledge'
import * as el from '../client'
import { setCircuitStore } from '@/lib/voice-providers/circuit-registry'
import { MemoryCircuitStore } from '@/lib/voice-providers/circuit-breaker'
import { setProviderEventSink } from '@/lib/observability/telemetry'
import { callAt, installFetch, jsonResponse, type FetchMock } from '@/tests/helpers/fetch'

const BASE = 'https://api.elevenlabs.io'
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

const ids = (n: number, prefix = 'd') => Array.from({ length: n }, (_, i) => `${prefix}${i}`)

function streamResponse(chunks: Uint8Array[], status = 200): Response {
  let i = 0
  const body = new ReadableStream<Uint8Array>({
    pull(ctrl) {
      if (i < chunks.length) ctrl.enqueue(chunks[i++])
      else ctrl.close()
    },
  })
  return new Response(body, { status, headers: { 'content-type': 'text/html' } })
}

describe('summaries', () => {
  it('sends repeated document_ids, 100 per call, and merges per-id results', async () => {
    fetchMock.mockImplementation(async (input) => {
      const url = new URL(String(input))
      const got = url.searchParams.getAll('document_ids')
      return jsonResponse(Object.fromEntries(got.map((id) => [id, { status: 'success', data: { id } }])))
    })
    const res = await kb.summaries([...ids(150), 'd0', ''], { orgId: 'o' })
    expect(fetchMock).toHaveBeenCalledTimes(2)
    const first = callAt(fetchMock, 0)
    expect(first.method).toBe('GET')
    expect(first.url.pathname).toBe('/v1/convai/knowledge-base/summaries')
    expect(first.url.searchParams.getAll('document_ids')).toHaveLength(100)
    expect(callAt(fetchMock, 1).url.searchParams.getAll('document_ids')).toHaveLength(50)
    expect(Object.keys(res)).toHaveLength(150)
  })
  it('isMissing is true only for a per-id 404 failure', () => {
    expect(kb.isMissing({ status: 'failure', error_code: 404, error_status: 'not_found', error_message: 'x' })).toBe(true)
    expect(kb.isMissing({ status: 'failure', error_code: 500, error_status: 'x', error_message: 'x' })).toBe(false)
    expect(kb.isMissing({ status: 'success', data: {} })).toBe(false)
    expect(kb.isMissing(undefined)).toBe(false)
  })
})

describe('bulk endpoints', () => {
  it('bulkDelete: 20 ids per call with force, retried on 5xx (idempotent)', async () => {
    fetchMock.mockImplementation(async (_input, init) => {
      const body = JSON.parse(String(init?.body)) as { document_ids: string[] }
      return jsonResponse(Object.fromEntries(body.document_ids.map((id) => [id, { status: 'success', data: { id } }])))
    })
    await kb.bulkDelete(ids(45), true, { orgId: 'o' })
    expect(fetchMock).toHaveBeenCalledTimes(3)
    expect(callAt(fetchMock, 0).json).toEqual({ document_ids: ids(20), force: true })
    expect(callAt(fetchMock, 0).url.pathname).toBe('/v1/convai/knowledge-base/bulk-delete')
    expect((callAt(fetchMock, 2).json as { document_ids: string[] }).document_ids).toHaveLength(5)

    fetchMock.mockReset()
    fetchMock.mockResolvedValueOnce(new Response('busy', { status: 503 })).mockResolvedValueOnce(jsonResponse({ a: { status: 'success', data: { id: 'a' } } }))
    await kb.bulkDelete(['a'], true)
    expect(fetchMock).toHaveBeenCalledTimes(2)
  })
  it('bulkMove: 20 ids per call to the folder', async () => {
    fetchMock.mockResolvedValue(new Response(null, { status: 200 }))
    await kb.bulkMove(ids(21), 'fold')
    expect(fetchMock).toHaveBeenCalledTimes(2)
    expect(callAt(fetchMock, 0).json).toEqual({ document_ids: ids(20), move_to: 'fold' })
  })
  it('ragIndexBatch: 100 items per call, duplicates removed', async () => {
    fetchMock.mockImplementation(async () => jsonResponse({}))
    const items = ids(120).map((id) => ({ document_id: id, model: 'e5_mistral_7b_instruct' as const, create_if_missing: false }))
    await kb.ragIndexBatch([...items, items[0]])
    expect(fetchMock).toHaveBeenCalledTimes(2)
    expect(callAt(fetchMock, 0).url.pathname).toBe('/v1/convai/knowledge-base/rag-index')
    expect((callAt(fetchMock, 0).json as { items: unknown[] }).items).toHaveLength(100)
    expect((callAt(fetchMock, 1).json as { items: unknown[] }).items).toHaveLength(20)
  })
})

describe('creates are never retried', () => {
  it('createCrawl: one attempt on 5xx, never sends max_depth', async () => {
    fetchMock.mockResolvedValue(new Response('boom', { status: 500 }))
    await expect(
      kb.createCrawl({ url: 'https://a.example/', max_pages: 25, enable_auto_sync: true, auto_remove: false, auto_discover: false, pattern: '^x$' }),
    ).rejects.toMatchObject({ code: 'upstream' })
    expect(fetchMock).toHaveBeenCalledTimes(1)
    const sent = callAt(fetchMock, 0)
    expect(sent.url.pathname).toBe('/v1/convai/knowledge-base/crawl')
    expect(sent.json).not.toHaveProperty('max_depth')
  })
  it('createFolder and createFromUrl: one attempt; createFromUrl uses the upload timeout and sends auto-sync settings', async () => {
    fetchMock.mockResolvedValue(new Response('boom', { status: 502 }))
    await expect(kb.createFolder({ name: 'ntv:test:org:o' })).rejects.toBeTruthy()
    expect(fetchMock).toHaveBeenCalledTimes(1)
    fetchMock.mockReset()
    fetchMock.mockResolvedValueOnce(jsonResponse({ id: 'kb1', name: 'x' }))
    const timeoutSpy = vi.spyOn(AbortSignal, 'timeout')
    await el.knowledgeBase.createFromUrl({ url: 'https://a.example', name: 'a', parent_folder_id: 'f', enable_auto_sync: true, auto_remove: false, minimum_frequency_days: 7 })
    expect(timeoutSpy).toHaveBeenCalledWith(60_000)
    expect(callAt(fetchMock, 0).json).toEqual({ url: 'https://a.example', name: 'a', parent_folder_id: 'f', enable_auto_sync: true, auto_remove: false, minimum_frequency_days: 7 })
  })
  it('createFromFile sends parent_folder_id only when set', async () => {
    fetchMock.mockImplementation(async () => jsonResponse({ id: 'kb1', name: 'x' }))
    await el.knowledgeBase.createFromFile(new Blob(['%PDF-']), 'a.pdf', 'A', undefined, 'fold')
    expect((callAt(fetchMock, 0).rawBody as FormData).get('parent_folder_id')).toBe('fold')
    await el.knowledgeBase.createFromFile(new Blob(['%PDF-']), 'a.pdf', 'A')
    expect((callAt(fetchMock, 1).rawBody as FormData).has('parent_folder_id')).toBe(false)
  })
})

describe('edits, refresh, RAG, crawl, query', () => {
  it('uses the documented paths and methods', async () => {
    fetchMock.mockImplementation(async () => jsonResponse({ id: 'x', indexes: [], chunks: [] }))
    await kb.updateDocument('kb 1', { name: 'N', content: 'C' })
    await kb.refreshUrlDocument('kb1')
    await kb.ragIndex('kb1', 'multilingual_e5_large_instruct')
    await kb.ragIndexes('kb1')
    await kb.deleteRagIndex('kb1', 'idx1')
    await kb.ragOverview()
    await kb.getCrawl('job1')
    await kb.ragQuery('agent_1', { query: 'hours?', use_agent_defaults: true })
    const calls = fetchMock.mock.calls.map((_, i) => callAt(fetchMock, i))
    expect(calls.map((c) => `${c.method} ${c.url.pathname}`)).toEqual([
      'PATCH /v1/convai/knowledge-base/kb%201',
      'POST /v1/convai/knowledge-base/kb1/refresh',
      'POST /v1/convai/knowledge-base/kb1/rag-index',
      'GET /v1/convai/knowledge-base/kb1/rag-index',
      'DELETE /v1/convai/knowledge-base/kb1/rag-index/idx1',
      'GET /v1/convai/knowledge-base/rag-index',
      'GET /v1/convai/knowledge-base/crawl/job1',
      'POST /v1/convai/agents/agent_1/knowledge-base/rag-query',
    ])
    expect(calls[0].json).toEqual({ name: 'N', content: 'C' })
    expect(calls[2].json).toEqual({ model: 'multilingual_e5_large_instruct' })
    expect(calls[7].json).toEqual({ query: 'hours?', use_agent_defaults: true })
  })
  it('cancelCrawl and deleteEntity(force)', async () => {
    fetchMock.mockResolvedValue(new Response(null, { status: 200 }))
    await kb.cancelCrawl('job1')
    await kb.deleteEntity('fold1', true)
    expect(callAt(fetchMock, 0).url.pathname).toBe('/v1/convai/knowledge-base/crawl/job1/cancel')
    expect(callAt(fetchMock, 0).method).toBe('POST')
    expect(callAt(fetchMock, 1).url.href).toBe(`${BASE}/v1/convai/knowledge-base/fold1?force=true`)
  })
  it('listFolderDocuments follows next_cursor within the folder only', async () => {
    fetchMock
      .mockResolvedValueOnce(jsonResponse({ documents: [{ id: 'a' }, { id: 'b' }], next_cursor: 'c2', has_more: true }))
      .mockResolvedValueOnce(jsonResponse({ documents: [{ id: 'c' }], next_cursor: null, has_more: false }))
    const res = await kb.listFolderDocuments('fold1', { types: ['url'], maxItems: 50 })
    expect(res).toMatchObject({ complete: true })
    expect(res.documents.map((d) => d.id)).toEqual(['a', 'b', 'c'])
    const first = callAt(fetchMock, 0).url
    expect(first.searchParams.get('ancestor_folder_id')).toBe('fold1')
    expect(first.searchParams.getAll('types')).toEqual(['url'])
    expect(first.searchParams.get('page_size')).toBe('100')
    expect(callAt(fetchMock, 1).url.searchParams.get('cursor')).toBe('c2')
  })
})

describe('bounded content reads', () => {
  it('contentPrefix reads at most maxBytes and reports truncation', async () => {
    const enc = new TextEncoder()
    fetchMock.mockResolvedValueOnce(streamResponse([enc.encode('a'.repeat(600)), enc.encode('b'.repeat(600)), enc.encode('c'.repeat(600))]))
    const res = await kb.contentPrefix('kb1', { maxBytes: 1000 })
    expect(res.truncated).toBe(true)
    expect(res.text).toHaveLength(1000)
    fetchMock.mockResolvedValueOnce(streamResponse([enc.encode('short')]))
    expect(await kb.contentPrefix('kb1', { maxBytes: 1000 })).toEqual({ text: 'short', truncated: false })
  })
  it('a body exactly maxBytes long is not marked truncated', async () => {
    fetchMock.mockResolvedValueOnce(streamResponse([new TextEncoder().encode('x'.repeat(10))]))
    expect(await kb.contentPrefix('kb1', { maxBytes: 10 })).toEqual({ text: 'x'.repeat(10), truncated: false })
  })
  it('client content() is bounded too (256 KB by default)', async () => {
    const big = new Uint8Array(300 * 1024).fill(0x61)
    fetchMock.mockResolvedValueOnce(streamResponse([big]))
    const text = await el.knowledgeBase.content('kb1')
    expect(text.length).toBe(256 * 1024)
  })
  it('a body that stalls past the deadline returns what arrived, or times out with nothing', async () => {
    vi.useFakeTimers()
    try {
      const stalled = new ReadableStream<Uint8Array>({
        start(ctrl) {
          ctrl.enqueue(new TextEncoder().encode('partial'))
        },
      })
      fetchMock.mockResolvedValueOnce(new Response(stalled, { status: 200 }))
      const p = kb.contentPrefix('kb1', { maxBytes: 1000, bodyTimeoutMs: 50 })
      await vi.advanceTimersByTimeAsync(100)
      expect(await p).toEqual({ text: 'partial', truncated: true })

      fetchMock.mockResolvedValueOnce(new Response(new ReadableStream<Uint8Array>({ start() {} }), { status: 200 }))
      const q = kb.contentPrefix('kb1', { maxBytes: 1000, bodyTimeoutMs: 50 })
      const assertion = expect(q).rejects.toMatchObject({ code: 'timeout' })
      await vi.advanceTimersByTimeAsync(100)
      await assertion
    } finally {
      vi.useRealTimers()
    }
  })
})
