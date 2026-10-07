import { beforeEach, describe, expect, it, vi } from 'vitest'
import { memoryDb, type MemoryDb } from '@/tests/helpers/memory-db'

const state = vi.hoisted(() => ({ db: null as unknown as MemoryDb, deferred: [] as Promise<unknown>[] }))
vi.mock('@/lib/supabase/admin', () => ({ createAdminClient: () => ({ from: state.db.from, rpc: state.db.rpc }) }))
vi.mock('@/lib/observability/telemetry', () => ({ deferBackground: (p: Promise<unknown>) => { state.deferred.push(p) }, emitProviderEvent: () => {} }))
vi.mock('@/lib/elevenlabs/client', () => ({ isConfigured: () => true, knowledgeBase: {} }))
const kbMock = vi.hoisted(() => ({
  getCrawl: vi.fn(), cancelCrawl: vi.fn(), deleteEntity: vi.fn(), listFolderDocuments: vi.fn(), contentPrefix: vi.fn(), ragIndexBatch: vi.fn(),
}))
vi.mock('@/lib/elevenlabs/api/knowledge', async (orig) => ({ ...(await orig<object>()), ...kbMock }))
const sync = vi.hoisted(() => ({ bumpRevision: vi.fn(), syncAgent: vi.fn(), providersFor: vi.fn() }))
vi.mock('@/lib/voice-providers/agent-sync.ts', () => sync)

import { crawlPattern, listWebsiteImports, maintainWebsiteImports, pollCrawl, type CrawlRow } from './knowledge-crawl'
import { ProviderError } from './errors'
import { createLogger } from '@/lib/observability/logger'

const ORG = '11111111-1111-4111-8111-111111111111'
const AGENT = '22222222-2222-4222-8222-222222222222'
const log = createLogger({ test: true })

describe('crawlPattern (same host only)', () => {
  const re = (u: string) => new RegExp(crawlPattern(new URL(u), 'regex') as string)
  it('regex: the host and its www. variant, http or https, any path; never another host', () => {
    const p = re('https://www.acme.example/start')
    for (const ok of ['https://acme.example', 'https://www.acme.example/', 'http://acme.example/a/b?x=1', 'https://acme.example:8443/x', 'https://acme.example#top']) {
      expect(p.test(ok), ok).toBe(true)
    }
    for (const bad of ['https://acme.example.evil.com/', 'https://evil.com/acme.example', 'https://xacme.example/', 'https://sub.acme.example/', 'https://acmeXexample/', 'ftp://acme.example/']) {
      expect(p.test(bad), bad).toBe(false)
    }
  })
  it('escapes regex characters of the host and stays under the spec length limit', () => {
    const p = crawlPattern(new URL('https://a-b.example.co.uk/'), 'regex') as string
    expect(p).toContain('a-b\\.example\\.co\\.uk')
    expect(p.length).toBeLessThanOrEqual(2048)
  })
  it('glob and off modes', () => {
    expect(crawlPattern(new URL('https://acme.example/x'), 'glob')).toBe('*://acme.example/*')
    expect(crawlPattern(new URL('https://acme.example/x'), 'off')).toBeNull()
  })
})

function seedCrawl(extra: Partial<CrawlRow> = {}) {
  const t = new Date(Date.now() - 60_000).toISOString()
  const row = {
    id: 'c1', org_id: ORG, agent_id: AGENT, seed_url: 'https://acme.example/', host: 'acme.example', max_pages: 25, status: 'processing',
    crawl_job_id: 'job1', root_folder_id: 'fold_site', pages_identified: 0, pages_scraped: 0, pages_skipped: 0, pages_failed: 0,
    page_count: 0, size_bytes: 0, rag_status: null, rag_progress: null, rag_model: null, rag_cleanup_pending: false, sync_failures: 0,
    error_message: null, consent_at: t, attached_at: null, finished_at: null, last_checked_at: null, created_at: t, updated_at: t, ...extra,
  }
  state.db = memoryDb({ knowledge_crawls: [row], agents: [{ id: AGENT, org_id: ORG, language: 'en' }], agent_provider_resources: [] })
  return row as CrawlRow
}

beforeEach(() => {
  vi.resetAllMocks()
  state.deferred = []
  sync.bumpRevision.mockResolvedValue(2)
  sync.syncAgent.mockResolvedValue([{ provider: 'elevenlabs', status: 'ready' }])
  sync.providersFor.mockResolvedValue(['elevenlabs'])
  kbMock.cancelCrawl.mockResolvedValue(undefined)
  kbMock.deleteEntity.mockResolvedValue(undefined)
})

describe('pollCrawl', () => {
  it('a running job updates progress; polls are throttled to one per 10 s per import', async () => {
    const row = seedCrawl()
    kbMock.getCrawl.mockResolvedValue({ id: 'job1', status: 'processing', pages_identified: 9, pages_scraped: 4, root_folder_id: 'fold_site' })
    const polled = await pollCrawl(state.db as never, row, log)
    expect(polled).toMatchObject({ status: 'processing', pages_scraped: 4, pages_identified: 9 })
    await pollCrawl(state.db as never, polled, log)
    expect(kbMock.getCrawl).toHaveBeenCalledTimes(1)
  })
  it('a failed crawl frees what it imported (folder deleted)', async () => {
    const row = seedCrawl()
    kbMock.getCrawl.mockResolvedValue({ id: 'job1', status: 'failed', pages_scraped: 2, root_folder_id: 'fold_site' })
    const polled = await pollCrawl(state.db as never, row, log)
    expect(polled.status).toBe('failed')
    expect(polled.error_message).toMatch(/could not be imported/)
    expect(kbMock.deleteEntity).toHaveBeenCalledWith('fold_site', true, { orgId: ORG })
  })
  it('a job the provider no longer knows → failed', async () => {
    const row = seedCrawl()
    kbMock.getCrawl.mockRejectedValue(new ProviderError({ system: 'elevenlabs', operation: 'kb.crawl_get', code: 'not_found', status: 404 }))
    expect((await pollCrawl(state.db as never, row, log)).status).toBe('failed')
  })
  it('a crawl running for more than 6 hours is cancelled', async () => {
    const row = seedCrawl({ created_at: new Date(Date.now() - 7 * 3_600_000).toISOString() })
    kbMock.getCrawl.mockResolvedValue({ id: 'job1', status: 'processing', root_folder_id: 'fold_site' })
    const polled = await pollCrawl(state.db as never, row, log)
    expect(kbMock.cancelCrawl).toHaveBeenCalledWith('job1', expect.anything())
    expect(polled.status).toBe('failed')
  })
  it('a succeeded crawl with no readable page is failed and its folder removed', async () => {
    const row = seedCrawl()
    kbMock.getCrawl.mockResolvedValue({ id: 'job1', status: 'succeeded', root_folder_id: 'fold_site' })
    kbMock.listFolderDocuments.mockResolvedValue({ documents: [], complete: true })
    const polled = await pollCrawl(state.db as never, row, log)
    expect(polled.status).toBe('failed')
    expect(polled.error_message).toMatch(/robots\.txt/)
    expect(kbMock.deleteEntity).toHaveBeenCalledWith('fold_site', true, expect.anything())
  })
  it('a transient provider error leaves the import running', async () => {
    const row = seedCrawl()
    kbMock.getCrawl.mockRejectedValue(new ProviderError({ system: 'elevenlabs', operation: 'kb.crawl_get', code: 'timeout' }))
    expect((await pollCrawl(state.db as never, row, log)).status).toBe('processing')
  })
})

describe('listWebsiteImports', () => {
  it('asks the rate limiter only when a provider read is due', async () => {
    seedCrawl({ status: 'succeeded', rag_status: 'succeeded' })
    const allowPoll = vi.fn(async () => true)
    await listWebsiteImports(ORG, log, { allowPoll })
    expect(allowPoll).not.toHaveBeenCalled()
    expect(kbMock.getCrawl).not.toHaveBeenCalled()
  })
  it('refreshes the indexing state of a finished import (read only) at most every 30 s', async () => {
    seedCrawl({ status: 'succeeded', rag_status: 'processing', rag_model: 'e5_mistral_7b_instruct', last_checked_at: new Date(Date.now() - 60_000).toISOString() })
    kbMock.listFolderDocuments.mockResolvedValue({ documents: [{ id: 'p1' }], complete: true })
    kbMock.ragIndexBatch.mockResolvedValue({ p1: { status: 'success', data: { id: 'i', model: 'e5_mistral_7b_instruct', status: 'succeeded', progress_percentage: 100, document_model_index_usage: { used_bytes: 1 } } } })
    const [row] = await listWebsiteImports(ORG, log, { allowPoll: async () => true })
    expect(kbMock.ragIndexBatch).toHaveBeenCalledWith([{ document_id: 'p1', model: 'e5_mistral_7b_instruct', create_if_missing: false }], { orgId: ORG })
    expect(row).toMatchObject({ status: 'succeeded', rag_status: 'succeeded', rag_progress: 100 })
    await listWebsiteImports(ORG, log, { allowPoll: async () => true })
    expect(kbMock.ragIndexBatch).toHaveBeenCalledTimes(1)
  })
})

describe('maintainWebsiteImports', () => {
  it('ends imports stuck in starting (they would block new imports) and polls running ones', async () => {
    seedCrawl({ status: 'starting', crawl_job_id: null, created_at: new Date(Date.now() - 3_600_000).toISOString() })
    await maintainWebsiteImports(10, log)
    expect(state.db.tables.knowledge_crawls[0].status).toBe('failed')
  })
})
