import { beforeEach, expect, it, vi } from 'vitest'
// processDocument against in-memory fakes (no network, no real Supabase).
import { memoryDb, type MemoryDb } from '@/tests/helpers/memory-db'

type Row = Record<string, unknown>

const state = vi.hoisted(() => ({
  objects: new Map<string, Uint8Array>(),
  tick: 0,
  deferred: [] as Promise<unknown>[],
  db: null as unknown as MemoryDb,
}))

function ts() {
  state.tick += 1
  return new Date(Date.UTC(2026, 9, 5, 12, 0, 0, state.tick)).toISOString().replace('Z', '+00:00')
}

const storage = {
  from: () => ({
    download: (path: string) => ({
      asStream: async () => {
        const bytes = state.objects.get(path)
        if (!bytes) return { data: null, error: { message: 'Object not found', status: 400, statusCode: '404' } }
        return { data: new Blob([bytes as Uint8Array<ArrayBuffer>]).stream(), error: null }
      },
    }),
  }),
}

vi.mock('@/lib/supabase/admin', () => ({ createAdminClient: () => ({ from: state.db.from, rpc: state.db.rpc, storage }) }))
vi.mock('@/lib/observability/telemetry', () => ({
  deferBackground: (p: Promise<unknown>) => { state.deferred.push(p) },
  emitProviderEvent: () => {},
}))
const el = vi.hoisted(() => ({
  isConfigured: vi.fn(() => true),
  knowledgeBase: { createFromFile: vi.fn(), createFromText: vi.fn(), createFromUrl: vi.fn(), delete: vi.fn() },
}))
vi.mock('@/lib/elevenlabs/client', () => el)
const kbMock = vi.hoisted(() => ({
  summaries: vi.fn(), ragIndex: vi.fn(), ragIndexes: vi.fn(), deleteRagIndex: vi.fn(), contentPrefix: vi.fn(),
  listDocuments: vi.fn(), createFolder: vi.fn(), ragOverview: vi.fn(),
}))
vi.mock('@/lib/elevenlabs/api/knowledge', async (orig) => ({ ...(await orig<object>()), ...kbMock }))
const sync = vi.hoisted(() => ({ bumpRevision: vi.fn(), syncAgent: vi.fn(), providersFor: vi.fn() }))
vi.mock('@/lib/voice-providers/agent-sync.ts', () => sync)

import { processDocument } from '@/lib/voice-providers/knowledge'
import { ProviderError } from '@/lib/voice-providers/errors'
import { createLogger } from '@/lib/observability/logger'

const ORG = '11111111-1111-4111-8111-111111111111'
const AGENT = '22222222-2222-4222-8222-222222222222'
const DOC = '33333333-3333-4333-8333-333333333333'
const OTHER = '44444444-4444-4444-8444-444444444444'
const log = createLogger({ test: true })
const ok = (provider = 'elevenlabs', status = 'ready', extra: Row = {}) => [{ provider, status, externalId: 'x', appliedVoiceId: null, errorCode: null, error: null, ...extra }]
const success = (id: string, extra: Row = {}) => ({
  status: 'success',
  data: { id, name: 'x', type: 'file', metadata: { created_at_unix_secs: 1, last_updated_at_unix_secs: 1_800_000_000, size_bytes: 4321 }, supported_usages: ['prompt', 'auto'], folder_parent_id: 'fold_org', ...extra },
})
const missing = { status: 'failure', error_code: 404, error_status: 'not_found', error_message: 'gone' }
const ragIdx = (status = 'processing', model = 'multilingual_e5_large_instruct') => ({ id: 'idx1', model, status, progress_percentage: 40, document_model_index_usage: { used_bytes: 900 } })

function seed(doc: Row, path?: string, bytes?: Uint8Array, extra: Record<string, Row[]> = {}) {
  const now = ts()
  state.db = memoryDb(
    {
      agents: [{ id: AGENT, org_id: ORG, language: 'fr' }],
      knowledge_documents: [{
        id: DOC, org_id: ORG, agent_id: AGENT, name: 'Prix été.pdf', type: 'pdf', url: null, storage_path: path ?? null,
        elevenlabs_doc_id: null, status: 'processing', error_message: null, attached_at: null, last_synced_at: null,
        attempt_count: 0, size_bytes: 10, character_count: 0, usage_mode: 'auto', deleting_at: null, rag_status: null, rag_model: null,
        created_at: now, updated_at: now, ...doc,
      }],
      agent_provider_resources: [{ org_id: ORG, agent_id: AGENT, provider: 'elevenlabs', status: 'ready', synced_revision: 1 }],
      knowledge_folders: [],
      knowledge_crawls: [],
      ...extra,
    },
    { onUpdate: (_t, r) => { r.updated_at = ts() }, unique: { knowledge_folders: [['org_id']] } },
  )
  state.objects.clear()
  if (path && bytes) state.objects.set(path, bytes)
  state.deferred = []
}
const row = () => state.db.tables.knowledge_documents.find((r) => r.id === DOC) as Row
const pdf = new TextEncoder().encode('%PDF-1.7\nhello')
const PATH = `${ORG}/${AGENT}/${DOC}-Prix-ete.pdf`

beforeEach(() => {
  vi.resetAllMocks()
  vi.unstubAllEnvs()
  el.isConfigured.mockReturnValue(true)
  sync.bumpRevision.mockResolvedValue(2)
  sync.syncAgent.mockImplementation(async (_id: string, o: { providers?: string[] }) => ok(o.providers?.[0] ?? 'elevenlabs'))
  sync.providersFor.mockResolvedValue(['elevenlabs', 'cartesia'])
  el.knowledgeBase.createFromFile.mockResolvedValue({ id: 'kb_file', name: 'x' })
  el.knowledgeBase.createFromText.mockResolvedValue({ id: 'kb_text', name: 'x' })
  el.knowledgeBase.createFromUrl.mockResolvedValue({ id: 'kb_url', name: 'x' })
  el.knowledgeBase.delete.mockResolvedValue(undefined)
  kbMock.ragIndex.mockResolvedValue(ragIdx())
  kbMock.contentPrefix.mockResolvedValue({ text: '<p>Hello&nbsp;world</p>', truncated: false })
  kbMock.summaries.mockImplementation(async (ids: string[]) => Object.fromEntries(ids.map((id) => [id, success(id)])))
  kbMock.listDocuments.mockResolvedValue({ documents: [], has_more: false })
  kbMock.createFolder.mockResolvedValue({ id: 'fold_org', name: 'f' })
  kbMock.ragOverview.mockResolvedValue({ total_used_bytes: 1, total_max_bytes: 100, models: [] })
})

it('file happy path: org folder, upload, attach, rag state, metadata, bounded excerpt, fallback sync', async () => {
  seed({}, PATH, pdf)
  const doc = await processDocument(ORG, DOC, log)
  expect(doc.status).toBe('ready')
  expect(doc.elevenlabs_doc_id).toBe('kb_file')
  expect(doc.attached_at).toBeTruthy()
  // Lazily created per-org folder, environment-scoped name, never retried blindly.
  expect(kbMock.createFolder).toHaveBeenCalledWith({ name: `ntv:test:org:${ORG}` }, { orgId: ORG })
  expect(state.db.tables.knowledge_folders[0]).toMatchObject({ org_id: ORG, folder_id: 'fold_org', lock_token: null })
  const [blob, filename, name, , parent] = el.knowledgeBase.createFromFile.mock.calls[0]
  expect((blob as Blob).type).toBe('application/pdf')
  expect(filename).toBe('Prix-ete.pdf')
  expect(name).toBe('Prix été.pdf')
  expect(parent).toBe('fold_org')
  expect(row()).toMatchObject({
    elevenlabs_folder_id: 'fold_org',
    size_bytes: pdf.byteLength, // files keep the validated size, not the provider's
    rag_status: 'processing',
    rag_progress: 40,
    rag_model: 'multilingual_e5_large_instruct',
    rag_index_id: 'idx1',
    rag_used_bytes: 900,
    supported_usages: ['prompt', 'auto'],
    content_excerpt: 'Hello world',
    character_count: 11,
  })
  expect(kbMock.ragIndex).toHaveBeenCalledWith('kb_file', 'multilingual_e5_large_instruct', { orgId: ORG, agentId: AGENT })
  expect(kbMock.contentPrefix).toHaveBeenCalledWith('kb_file', { maxBytes: 256 * 1024 }, { orgId: ORG, agentId: AGENT })
  expect(sync.syncAgent).toHaveBeenCalledWith(AGENT, expect.objectContaining({ providers: ['elevenlabs'] }))
  await Promise.all(state.deferred)
  expect(sync.syncAgent).toHaveBeenLastCalledWith(AGENT, expect.objectContaining({ providers: ['cartesia'] }))
})

it('reuses the existing org folder and adopts one created by a run whose write was lost', async () => {
  seed({}, PATH, pdf, { knowledge_folders: [{ org_id: ORG, folder_id: 'fold_existing' }] })
  await processDocument(ORG, DOC, log)
  expect(kbMock.createFolder).not.toHaveBeenCalled()
  expect(el.knowledgeBase.createFromFile.mock.calls[0][4]).toBe('fold_existing')

  seed({}, PATH, pdf)
  kbMock.listDocuments.mockResolvedValueOnce({ documents: [{ id: 'fold_adopt', type: 'folder', name: `ntv:test:org:${ORG}`, folder_parent_id: null }], has_more: false })
  await processDocument(ORG, DOC, log)
  expect(kbMock.createFolder).not.toHaveBeenCalled()
  expect(state.db.tables.knowledge_folders[0].folder_id).toBe('fold_adopt')
})

it('a folder deleted out of band is forgotten and the document is created at the root', async () => {
  seed({}, PATH, pdf, { knowledge_folders: [{ org_id: ORG, folder_id: 'fold_gone' }] })
  kbMock.summaries.mockImplementation(async (ids: string[]) => Object.fromEntries(ids.map((id) => [id, success(id, { folder_parent_id: null })])))
  el.knowledgeBase.createFromFile.mockRejectedValueOnce(new ProviderError({ system: 'elevenlabs', operation: 'kb.create_file', code: 'not_found', status: 404 }))
  const doc = await processDocument(ORG, DOC, log)
  expect(doc.status).toBe('ready')
  expect(el.knowledgeBase.createFromFile).toHaveBeenCalledTimes(2)
  expect(el.knowledgeBase.createFromFile.mock.calls[1][4]).toBeNull()
  expect(state.db.tables.knowledge_folders[0].folder_id).toBeNull()
  expect(row().elevenlabs_folder_id).toBeNull()
})

it('bad magic bytes → failed, no upstream call', async () => {
  seed({}, PATH, new TextEncoder().encode('not a pdf'))
  const doc = await processDocument(ORG, DOC, log)
  expect(doc.status).toBe('failed')
  expect(doc.error_message).toBe('This file is not a valid PDF.')
  expect(doc.attempt_count).toBe(1)
  expect(el.knowledgeBase.createFromFile).not.toHaveBeenCalled()
})

it('missing upload → failed with re-upload message', async () => {
  seed({}, PATH)
  const doc = await processDocument(ORG, DOC, log)
  expect(doc.status).toBe('failed')
  expect(doc.error_message).toMatch(/upload did not complete/)
})

it('path outside org folder is never read', async () => {
  seed({ storage_path: `99999999-9999-4999-8999-999999999999/x/y.pdf` })
  state.objects.set('99999999-9999-4999-8999-999999999999/x/y.pdf', pdf)
  const doc = await processDocument(ORG, DOC, log)
  expect(doc.status).toBe('failed')
  expect(el.knowledgeBase.createFromFile).not.toHaveBeenCalled()
})

it('a file larger than declared is re-checked against the byte budget', async () => {
  vi.stubEnv('KNOWLEDGE_ORG_MAX_BYTES', String(1024 * 1024))
  const big = new Uint8Array(1024 * 1024 + 10)
  big.set(new TextEncoder().encode('%PDF-1.7'))
  seed({ size_bytes: 10 }, PATH, big)
  const doc = await processDocument(ORG, DOC, log)
  expect(doc.status).toBe('failed')
  expect(doc.error_message).toMatch(/knowledge base is full/)
  expect(el.knowledgeBase.createFromFile).not.toHaveBeenCalled()
})

it('attach failure keeps the provider id, marks failed; retry checks existence with summaries and resyncs without re-upload', async () => {
  seed({}, PATH, pdf)
  sync.syncAgent.mockResolvedValueOnce(ok('elevenlabs', 'degraded', { errorCode: 'upstream', error: 'The voice provider is having trouble right now.' }))
  const failed = await processDocument(ORG, DOC, log)
  expect(failed.status).toBe('failed')
  expect(failed.elevenlabs_doc_id).toBe('kb_file')
  expect(failed.error_message).toMatch(/could not be added to your agent/)
  const ready = await processDocument(ORG, DOC, log, { mode: 'retry' })
  expect(ready.status).toBe('ready')
  expect(el.knowledgeBase.createFromFile).toHaveBeenCalledTimes(1)
  expect(kbMock.summaries).toHaveBeenCalledWith(['kb_file'], { orgId: ORG, agentId: AGENT })
})

it('retry re-uploads when summaries reports the document missing (404)', async () => {
  seed({ status: 'failed', elevenlabs_doc_id: 'kb_gone', attempt_count: 1 }, PATH, pdf)
  kbMock.summaries.mockResolvedValueOnce({ kb_gone: missing })
  const doc = await processDocument(ORG, DOC, log, { mode: 'retry' })
  expect(doc.status).toBe('ready')
  expect(doc.elevenlabs_doc_id).toBe('kb_file')
})

it('a summaries failure other than 404 is not treated as missing (no duplicate upload)', async () => {
  seed({ status: 'failed', elevenlabs_doc_id: 'kb_1', attempt_count: 1 }, PATH, pdf)
  kbMock.summaries.mockResolvedValueOnce({ kb_1: { status: 'failure', error_code: 500, error_status: 'x', error_message: 'y' } })
  const doc = await processDocument(ORG, DOC, log, { mode: 'retry' })
  expect(doc.status).toBe('failed')
  expect(doc.elevenlabs_doc_id).toBe('kb_1')
  expect(el.knowledgeBase.createFromFile).not.toHaveBeenCalled()
})

it('initial on an in-flight run → 409; settled → returned unchanged; deleting → 409', async () => {
  seed({}, PATH, pdf)
  row().updated_at = new Date().toISOString() // claimed recently (≠ created_at)
  await expect(processDocument(ORG, DOC, log)).rejects.toMatchObject({ status: 409 })
  await expect(processDocument(ORG, DOC, log, { mode: 'retry' })).rejects.toMatchObject({ status: 409 })
  seed({ status: 'ready', attached_at: ts(), elevenlabs_doc_id: 'kb' }, PATH, pdf)
  expect((await processDocument(ORG, DOC, log, { mode: 'retry' })).status).toBe('ready')
  expect(kbMock.summaries).not.toHaveBeenCalled()
  seed({ status: 'failed', deleting_at: ts() }, PATH, pdf)
  await expect(processDocument(ORG, DOC, log, { mode: 'retry' })).rejects.toMatchObject({ status: 409 })
})

it('retry on an attached document whose RAG index failed re-indexes it', async () => {
  seed({ status: 'ready', attached_at: ts(), elevenlabs_doc_id: 'kb', rag_status: 'failed', rag_model: 'multilingual_e5_large_instruct' }, PATH, pdf)
  kbMock.ragIndexes.mockResolvedValueOnce({ indexes: [ragIdx('failed')] })
  kbMock.ragIndex.mockResolvedValueOnce(ragIdx('created'))
  const doc = await processDocument(ORG, DOC, log, { mode: 'retry' })
  expect(kbMock.deleteRagIndex).toHaveBeenCalledWith('kb', 'idx1', expect.anything())
  expect(kbMock.ragIndex).toHaveBeenCalledWith('kb', 'multilingual_e5_large_instruct', expect.anything())
  expect(doc.rag_status).toBe('created')
  expect(el.knowledgeBase.createFromFile).not.toHaveBeenCalled()
})

it('text doc: createFromText in the folder, local text as excerpt (no content read)', async () => {
  const p = `${ORG}/${AGENT}/${DOC}-faq.txt`
  seed({ type: 'text', name: 'FAQ' }, p, new TextEncoder().encode('﻿Open 9-5'))
  const doc = await processDocument(ORG, DOC, log)
  expect(doc.status).toBe('ready')
  expect(el.knowledgeBase.createFromText).toHaveBeenCalledWith({ text: 'Open 9-5', name: 'FAQ', parent_folder_id: 'fold_org' }, expect.anything())
  expect(kbMock.contentPrefix).not.toHaveBeenCalled()
  expect(row().content_excerpt).toBe('Open 9-5')
})

it('url doc: private address rejected; public one imported with weekly auto-sync, never auto-removed, size from summaries', async () => {
  seed({ type: 'url', url: 'http://169.254.169.254/latest', name: 'meta' })
  expect((await processDocument(ORG, DOC, log)).status).toBe('failed')
  seed({ type: 'url', url: 'https://example.com/faq', name: 'example.com/faq', size_bytes: 0 })
  const doc = await processDocument(ORG, DOC, log)
  expect(doc.status).toBe('ready')
  expect(el.knowledgeBase.createFromUrl).toHaveBeenCalledWith(
    { url: 'https://example.com/faq', name: 'example.com/faq', parent_folder_id: 'fold_org', enable_auto_sync: true, auto_remove: false, minimum_frequency_days: 7 },
    expect.anything(),
  )
  expect(row()).toMatchObject({ auto_sync: true, sync_frequency_days: 7, size_bytes: 4321, remote_updated_at: new Date(1_800_000_000_000).toISOString() })
})

it('provider validation on create → product message', async () => {
  seed({}, PATH, pdf)
  el.knowledgeBase.createFromFile.mockRejectedValueOnce(new ProviderError({ system: 'elevenlabs', operation: 'kb.create_file', code: 'validation', status: 422 }))
  const doc = await processDocument(ORG, DOC, log)
  expect(doc.status).toBe('failed')
  expect(doc.error_message).toMatch(/could not be read/)
})

it('row deleted while uploading → orphan removed upstream, 404', async () => {
  seed({}, PATH, pdf)
  el.knowledgeBase.createFromFile.mockImplementationOnce(async () => {
    state.db.tables.knowledge_documents = []
    return { id: 'kb_orphan', name: 'x' }
  })
  await expect(processDocument(ORG, DOC, log)).rejects.toMatchObject({ status: 404 })
  expect(el.knowledgeBase.delete).toHaveBeenCalledWith('kb_orphan', true, expect.anything())
})

it('sync lease held elsewhere → waits for a push at our revision', async () => {
  seed({}, PATH, pdf)
  sync.syncAgent.mockResolvedValueOnce(ok('elevenlabs', 'in_progress'))
  state.db.tables.agent_provider_resources[0].synced_revision = 2
  const doc = await processDocument(ORG, DOC, log)
  expect(doc.status).toBe('ready')
})

it('a sync rejected for validation drops documents the provider lost, then retries', async () => {
  seed({}, PATH, pdf)
  state.db.tables.knowledge_documents.push({ id: OTHER, org_id: ORG, agent_id: AGENT, name: 'old', type: 'text', status: 'ready', elevenlabs_doc_id: 'kb_lost', deleting_at: null, attached_at: ts() })
  sync.syncAgent.mockResolvedValueOnce(ok('elevenlabs', 'failed', { errorCode: 'validation', error: 'rejected' }))
  kbMock.summaries.mockImplementation(async (ids: string[]) => Object.fromEntries(ids.map((id) => [id, id === 'kb_lost' ? missing : success(id)])))
  const doc = await processDocument(ORG, DOC, log)
  expect(doc.status).toBe('ready')
  const other = state.db.tables.knowledge_documents.find((r) => r.id === OTHER) as Row
  expect(other).toMatchObject({ status: 'failed', elevenlabs_doc_id: null, attached_at: null })
  expect(sync.bumpRevision).toHaveBeenCalledTimes(2)
})

it('rag and excerpt failures are non-fatal', async () => {
  seed({}, PATH, pdf)
  kbMock.ragIndex.mockRejectedValueOnce(new ProviderError({ system: 'elevenlabs', operation: 'kb.rag_index', code: 'upstream', status: 500 }))
  kbMock.contentPrefix.mockRejectedValueOnce(new ProviderError({ system: 'elevenlabs', operation: 'kb.content', code: 'timeout' }))
  const doc = await processDocument(ORG, DOC, log)
  expect(doc.status).toBe('ready')
})

it('a truncated provider excerpt records a lower-bound character count', async () => {
  seed({}, PATH, pdf)
  kbMock.contentPrefix.mockResolvedValueOnce({ text: 'x'.repeat(10), truncated: true })
  await processDocument(ORG, DOC, log)
  expect(row().character_count).toBe(256 * 1024)
})
