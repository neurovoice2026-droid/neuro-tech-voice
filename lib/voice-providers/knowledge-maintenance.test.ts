import { beforeEach, describe, expect, it, vi } from 'vitest'
import { memoryDb, type MemoryDb } from '@/tests/helpers/memory-db'

type Row = Record<string, unknown>
const state = vi.hoisted(() => ({ db: null as unknown as MemoryDb, removed: [] as string[][] }))
const storage = { from: () => ({ remove: async (p: string[]) => { state.removed.push(p); return { data: [], error: null } } }) }
vi.mock('@/lib/supabase/admin', () => ({ createAdminClient: () => ({ from: state.db.from, rpc: state.db.rpc, storage }) }))
vi.mock('@/lib/observability/telemetry', () => ({ deferBackground: () => {}, emitProviderEvent: () => {} }))
vi.mock('@/lib/elevenlabs/client', () => ({ isConfigured: () => true, knowledgeBase: {} }))
const kbMock = vi.hoisted(() => ({
  summaries: vi.fn(), contentPrefix: vi.fn(), ragIndexBatch: vi.fn(), ragIndexes: vi.fn(), deleteRagIndex: vi.fn(), bulkMove: vi.fn(),
  moveDocument: vi.fn(), bulkDelete: vi.fn(), listFolderDocuments: vi.fn(), listDocuments: vi.fn(), createFolder: vi.fn(), ragOverview: vi.fn(),
  cancelCrawl: vi.fn(), deleteEntity: vi.fn(),
}))
vi.mock('@/lib/elevenlabs/api/knowledge', async (orig) => ({ ...(await orig<object>()), ...kbMock }))
const sync = vi.hoisted(() => ({ bumpRevision: vi.fn(), syncAgent: vi.fn(), providersFor: vi.fn() }))
vi.mock('@/lib/voice-providers/agent-sync.ts', () => sync)
const knowledge = vi.hoisted(() => ({ processDocument: vi.fn() }))
vi.mock('@/lib/voice-providers/knowledge.ts', async (orig) => ({ ...(await orig<object>()), processDocument: knowledge.processDocument }))

import { checkWorkspaceQuota, reconcileKnowledgeDocuments, refreshRagStates, runKnowledgeMaintenance } from './knowledge-maintenance'
import { cleanupOldRagIndexes, resetRagOverviewCache } from './knowledge-rag'
import { moveRootDocumentsToFolders } from './knowledge-folders'
import { deleteAllOrgKnowledge, finishInterruptedDeletes, sweepOrphanDocuments } from './knowledge-delete'
import { createLogger } from '@/lib/observability/logger'

const ORG = '11111111-1111-4111-8111-111111111111'
const ORG2 = '99999999-9999-4999-8999-999999999999'
const AGENT = '22222222-2222-4222-8222-222222222222'
const log = createLogger({ test: true })
const missing = { status: 'failure', error_code: 404, error_status: 'not_found', error_message: 'gone' }
const success = (id: string, extra: Row = {}) => ({
  status: 'success',
  data: { id, name: 'x', type: 'url', metadata: { created_at_unix_secs: 1, last_updated_at_unix_secs: 1_900_000_000, size_bytes: 2048 }, supported_usages: ['auto'], auto_sync_info: { consec_failures: 2, minimum_frequency_days: 7 }, ...extra },
})
const doc = (id: string, extra: Row = {}): Row => ({
  id, org_id: ORG, agent_id: AGENT, type: 'url', status: 'ready', elevenlabs_doc_id: `kb_${id}`, auto_sync: true, deleting_at: null,
  remote_updated_at: new Date(1_800_000_000_000).toISOString(), remote_checked_at: null, rag_status: 'succeeded', rag_model: 'e5_mistral_7b_instruct',
  rag_checked_at: null, elevenlabs_folder_id: 'fold', storage_path: null, ...extra,
})

beforeEach(() => {
  vi.resetAllMocks()
  resetRagOverviewCache()
  state.removed = []
  state.db = memoryDb({
    agents: [{ id: AGENT, org_id: ORG, language: 'en' }],
    knowledge_documents: [],
    knowledge_crawls: [],
    knowledge_folders: [{ org_id: ORG, folder_id: 'fold' }],
  })
  sync.bumpRevision.mockResolvedValue(2)
  sync.syncAgent.mockResolvedValue([{ provider: 'elevenlabs', status: 'ready' }])
  sync.providersFor.mockResolvedValue(['elevenlabs', 'cartesia'])
  knowledge.processDocument.mockImplementation(async () => ({ status: 'ready' }))
  kbMock.ragOverview.mockResolvedValue({ total_used_bytes: 1, total_max_bytes: 100, models: [] })
  kbMock.cancelCrawl.mockResolvedValue(undefined)
  kbMock.deleteEntity.mockResolvedValue(undefined)
})

describe('reconcile', () => {
  it('heals documents the provider lost: out of the agent, then re-added from their source', async () => {
    state.db.tables.knowledge_documents.push(doc('a'), doc('b'))
    kbMock.summaries.mockResolvedValue({ kb_a: missing, kb_b: success('kb_b') })
    const out = await reconcileKnowledgeDocuments(100, log)
    expect(out).toMatchObject({ checked: 2, missing: 1, reuploaded: 1 })
    const a = state.db.tables.knowledge_documents.find((r) => r.id === 'a') as Row
    expect(a).toMatchObject({ status: 'failed', elevenlabs_doc_id: null, attached_at: null })
    expect(sync.bumpRevision).toHaveBeenCalledWith(AGENT)
    expect(sync.syncAgent).toHaveBeenCalledWith(AGENT, expect.objectContaining({ providers: ['elevenlabs'] }))
    expect(knowledge.processDocument).toHaveBeenCalledWith(ORG, 'a', expect.anything(), { mode: 'retry' })
  })
  it('stores URL sizes and auto-sync state; refreshes the excerpt of re-synced pages and the fallback agent', async () => {
    state.db.tables.knowledge_documents.push(doc('b'))
    kbMock.summaries.mockResolvedValue({ kb_b: success('kb_b') })
    kbMock.contentPrefix.mockResolvedValue({ text: '<p>New prices</p>', truncated: false })
    const out = await reconcileKnowledgeDocuments(100, log)
    expect(out.excerpts).toBe(1)
    const b = state.db.tables.knowledge_documents[0]
    expect(b).toMatchObject({ size_bytes: 2048, sync_failures: 2, content_excerpt: 'New prices', remote_updated_at: new Date(1_900_000_000_000).toISOString() })
    expect(kbMock.contentPrefix).toHaveBeenCalledWith('kb_b', { maxBytes: 256 * 1024 }, expect.anything())
    expect(sync.syncAgent).toHaveBeenCalledWith(AGENT, expect.objectContaining({ providers: ['cartesia'] }))
  })
  it('a provider error changes nothing', async () => {
    state.db.tables.knowledge_documents.push(doc('a'))
    kbMock.summaries.mockRejectedValue(new Error('boom'))
    expect(await reconcileKnowledgeDocuments(100, log)).toMatchObject({ errors: 1, missing: 0 })
    expect(state.db.tables.knowledge_documents[0].status).toBe('ready')
  })
})

describe('RAG state', () => {
  it('reads in-progress states and re-indexes for the agent model after a language change', async () => {
    state.db.tables.agents[0].language = 'ro'
    state.db.tables.knowledge_documents.push(doc('a', { rag_status: 'processing', rag_model: 'multilingual_e5_large_instruct' }), doc('b'))
    kbMock.ragIndexBatch.mockResolvedValue({
      kb_a: { status: 'success', data: { id: 'i1', model: 'multilingual_e5_large_instruct', status: 'succeeded', progress_percentage: 100, document_model_index_usage: { used_bytes: 5 } } },
      kb_b: { status: 'success', data: { id: 'i2', model: 'multilingual_e5_large_instruct', status: 'created', progress_percentage: 0, document_model_index_usage: { used_bytes: 0 } } },
    })
    expect(await refreshRagStates(100, log)).toMatchObject({ documents: 2 })
    expect(kbMock.ragIndexBatch).toHaveBeenCalledWith(
      [
        { document_id: 'kb_a', model: 'multilingual_e5_large_instruct', create_if_missing: false },
        { document_id: 'kb_b', model: 'multilingual_e5_large_instruct', create_if_missing: true },
      ],
      { orgId: ORG },
    )
    const b = state.db.tables.knowledge_documents.find((r) => r.id === 'b') as Row
    expect(b).toMatchObject({ rag_model: 'multilingual_e5_large_instruct', rag_status: 'created', rag_cleanup_pending: true })
  })
  it('deletes indexes of other models once the current one succeeded', async () => {
    state.db.tables.knowledge_documents.push(doc('a', { rag_cleanup_pending: true, rag_model: 'multilingual_e5_large_instruct' }))
    kbMock.ragIndexes.mockResolvedValue({ indexes: [{ id: 'old', model: 'e5_mistral_7b_instruct' }, { id: 'cur', model: 'multilingual_e5_large_instruct' }] })
    expect(await cleanupOldRagIndexes(10, log)).toEqual({ checked: 1, deleted: 1 })
    expect(kbMock.deleteRagIndex).toHaveBeenCalledWith('kb_a', 'old', { orgId: ORG })
    expect(state.db.tables.knowledge_documents[0].rag_cleanup_pending).toBe(false)
  })
})

describe('folders', () => {
  it('moves root-level documents into the org folder, 20 per call, one by one when a batch fails', async () => {
    for (let i = 0; i < 22; i++) state.db.tables.knowledge_documents.push(doc(`d${i}`, { elevenlabs_folder_id: null }))
    kbMock.bulkMove.mockResolvedValueOnce(undefined).mockRejectedValueOnce(new Error('one id is gone'))
    kbMock.moveDocument.mockResolvedValueOnce(undefined).mockRejectedValueOnce(new Error('gone'))
    const out = await moveRootDocumentsToFolders(100, log)
    expect(out).toEqual({ moved: 21, orgs: 1, failed: 1 })
    expect(kbMock.bulkMove.mock.calls[0][0]).toHaveLength(20)
    expect(kbMock.bulkMove.mock.calls[0][1]).toBe('fold')
    expect(state.db.tables.knowledge_documents.filter((r) => r.elevenlabs_folder_id === 'fold')).toHaveLength(21)
  })
})

describe('deletion', () => {
  it('deleteAllOrgKnowledge: cancels running crawls, bulk-deletes documents, website folders and the org folder (404 = done)', async () => {
    for (let i = 0; i < 25; i++) state.db.tables.knowledge_documents.push(doc(`d${i}`))
    state.db.tables.knowledge_documents.push(doc('other-org', { org_id: ORG2 }))
    state.db.tables.knowledge_crawls.push({ id: 'c1', org_id: ORG, status: 'processing', crawl_job_id: 'job1', root_folder_id: 'fold_site' })
    kbMock.bulkDelete.mockImplementation(async (ids: string[]) => Object.fromEntries(ids.map((id) => [id, id === 'kb_d3' ? { status: 'failure', error_code: 404 } : { status: 'success', data: { id } }])))
    const out = await deleteAllOrgKnowledge(ORG, log)
    expect(out).toEqual({ documents: 25, websites: 1, folder: true, deleted: 26, alreadyGone: 1, failed: 0 })
    expect(kbMock.cancelCrawl).toHaveBeenCalledWith('job1', { orgId: ORG })
    const deletedIds = kbMock.bulkDelete.mock.calls.flatMap((c) => c[0] as string[])
    expect(deletedIds).not.toContain('kb_other-org')
    expect(kbMock.bulkDelete.mock.calls.every((c) => c[1] === true)).toBe(true)
    expect(state.db.tables.knowledge_documents.filter((r) => r.org_id === ORG).every((r) => r.deleting_at)).toBe(true)
    expect(state.db.tables.knowledge_documents.find((r) => r.org_id === ORG2)?.deleting_at).toBeNull()
  })
  it('deleteAllOrgKnowledge never throws on provider failures; counts them', async () => {
    state.db.tables.knowledge_documents.push(doc('a'))
    kbMock.bulkDelete.mockRejectedValue(new Error('down'))
    const out = await deleteAllOrgKnowledge(ORG, log)
    expect(out.failed).toBeGreaterThan(0)
    expect(state.db.tables.knowledge_folders[0].folder_id).toBe('fold')
  })
  it('sweepOrphanDocuments deletes only old direct children of the org folder that no row knows', async () => {
    state.db.tables.knowledge_documents.push(doc('known'))
    const old = Math.floor(Date.now() / 1000) - 7200
    kbMock.listFolderDocuments.mockResolvedValue({
      documents: [
        { id: 'kb_known', folder_parent_id: 'fold', metadata: { created_at_unix_secs: old } },
        { id: 'orphan_old', folder_parent_id: 'fold', metadata: { created_at_unix_secs: old } },
        { id: 'orphan_new', folder_parent_id: 'fold', metadata: { created_at_unix_secs: Math.floor(Date.now() / 1000) } },
        { id: 'website_page', folder_parent_id: 'fold_site', metadata: { created_at_unix_secs: old } },
      ],
      complete: true,
    })
    kbMock.bulkDelete.mockResolvedValue({ orphan_old: { status: 'success', data: { id: 'orphan_old' } } })
    expect(await sweepOrphanDocuments(5, log)).toEqual({ orgs: 1, orphans: 1, deleted: 1 })
    expect(kbMock.bulkDelete).toHaveBeenCalledWith(['orphan_old'], true, { orgId: ORG })
  })
  it('finishInterruptedDeletes completes rows left in deleting', async () => {
    state.db.tables.knowledge_documents.push(doc('x', { deleting_at: new Date(Date.now() - 3_600_000).toISOString(), storage_path: `${ORG}/a/b.txt` }))
    expect(await finishInterruptedDeletes(10, log)).toEqual({ finished: 1, failed: 0 })
    expect(kbMock.deleteEntity).toHaveBeenCalledWith('kb_x', true, expect.anything())
    expect(state.db.tables.knowledge_documents).toHaveLength(0)
    expect(state.removed).toEqual([[`${ORG}/a/b.txt`]])
  })
})

describe('quota + runner', () => {
  it('warns at 80 % and errors at 95 % of the workspace RAG quota', async () => {
    const warn = vi.fn()
    const error = vi.fn()
    const spyLog = { ...log, warn, error, child: () => spyLog } as unknown as typeof log
    kbMock.ragOverview.mockResolvedValueOnce({ total_used_bytes: 85, total_max_bytes: 100, models: [] })
    expect(await checkWorkspaceQuota(spyLog)).toEqual({ used_pct: 85 })
    expect(warn).toHaveBeenCalledWith('knowledge.rag_quota_high', { usedPct: 85 })
    kbMock.ragOverview.mockResolvedValueOnce({ total_used_bytes: 97, total_max_bytes: 100, models: [] })
    await checkWorkspaceQuota(spyLog)
    expect(error).toHaveBeenCalledWith('knowledge.rag_quota_critical', undefined, { usedPct: 97 })
  })
  it('runs every step and isolates failures', async () => {
    kbMock.ragOverview.mockRejectedValue(new Error('down'))
    const report = await runKnowledgeMaintenance(log)
    expect(Object.keys(report)).toEqual(['crawls', 'reconcile', 'rag', 'rag_cleanup', 'crawl_rag_cleanup', 'folders', 'orphans', 'deletes', 'quota'])
    expect(report.quota).toMatchObject({ error: 'down' })
  })
})
