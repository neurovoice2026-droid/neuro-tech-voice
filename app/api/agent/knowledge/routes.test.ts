import { beforeEach, describe, expect, it, vi } from 'vitest'
import { memoryDb, type MemoryDb } from '@/tests/helpers/memory-db'

type Row = Record<string, unknown>
const state = vi.hoisted(() => ({
  db: null as unknown as MemoryDb,
  removed: [] as string[][],
  uploaded: [] as Array<{ path: string; upsert: boolean }>,
  signed: [] as string[],
  deferred: [] as Promise<unknown>[],
  objects: new Map<string, Uint8Array>(),
  rateDenied: new Set<string>(),
}))
const storage = {
  from: () => ({
    remove: async (paths: string[]) => { state.removed.push(paths); return { data: [], error: null } },
    upload: async (path: string, _b: Blob, o: { upsert?: boolean }) => { state.uploaded.push({ path, upsert: !!o?.upsert }); return { data: {}, error: null } },
    createSignedUploadUrl: async (path: string) => { state.signed.push(path); return { data: { path, token: 'tok', signedUrl: `https://x/${path}?token=tok` }, error: null } },
    download: (path: string) => ({
      asStream: async () => {
        const bytes = state.objects.get(path)
        if (!bytes) return { data: null, error: { message: 'not found', status: 404 } }
        return { data: new Blob([bytes as Uint8Array<ArrayBuffer>]).stream(), error: null }
      },
    }),
  }),
}
const client = () => ({ from: state.db.from, rpc: state.db.rpc, storage })
const ORG = '11111111-1111-4111-8111-111111111111'
const AGENT = '22222222-2222-4222-8222-222222222222'
const DOC = '33333333-3333-4333-8333-333333333333'
const USER = '55555555-5555-4555-8555-555555555555'
vi.mock('@/lib/api/auth', () => ({ requireOrg: async () => ({ supabase: client(), user: { id: USER }, org: { id: ORG, name: 'Acme', timezone: null, plan: null } }) }))
vi.mock('@/lib/supabase/admin', () => ({ createAdminClient: () => client() }))
vi.mock('@/lib/security/rate-limit', () => ({
  RATE_LIMITS: { knowledgeUpload: { name: 'knowledge_upload' }, knowledgeProcess: { name: 'knowledge_process' } },
  enforceRateLimit: async (rule: { name: string }) => {
    if (state.rateDenied.has(rule.name)) {
      const { RequestError } = await import('@/lib/api/http')
      throw new RequestError('rate_limited', 'Too many', 429)
    }
  },
  rateLimit: async () => ({ allowed: true, remaining: 1, resetAt: 0 }),
}))
vi.mock('@/lib/agents/ensure-agent', () => ({ ensureAgent: async () => ({ id: AGENT }), defaultAgentName: () => 'A' }))
vi.mock('@/lib/observability/telemetry', () => ({ deferBackground: (p: Promise<unknown>) => { state.deferred.push(p) }, emitProviderEvent: () => {} }))
const el = vi.hoisted(() => ({ isConfigured: vi.fn(() => true), knowledgeBase: { delete: vi.fn() } }))
vi.mock('@/lib/elevenlabs/client', () => el)
const kbMock = vi.hoisted(() => ({
  deleteEntity: vi.fn(), summaries: vi.fn(), updateDocument: vi.fn(), refreshUrlDocument: vi.fn(), ragIndex: vi.fn(),
  ragQuery: vi.fn(), createCrawl: vi.fn(), getCrawl: vi.fn(), cancelCrawl: vi.fn(), listDocuments: vi.fn(), ragOverview: vi.fn(),
  createFolder: vi.fn(), contentPrefix: vi.fn(), ragIndexBatch: vi.fn(), updateFile: vi.fn(), ragIndexes: vi.fn(), deleteRagIndex: vi.fn(),
  listFolderDocuments: vi.fn(), bulkDelete: vi.fn(),
}))
vi.mock('@/lib/elevenlabs/api/knowledge', async (orig) => ({ ...(await orig<object>()), ...kbMock }))
const sync = vi.hoisted(() => ({ bumpRevision: vi.fn(), syncAgent: vi.fn(), providersFor: vi.fn() }))
vi.mock('@/lib/voice-providers/agent-sync.ts', () => sync)
const knowledge = vi.hoisted(() => ({ processDocument: vi.fn() }))
vi.mock('@/lib/voice-providers/knowledge.ts', async (orig) => ({ ...(await orig<object>()), processDocument: knowledge.processDocument }))

import { DELETE, GET as getDoc, PATCH } from '@/app/api/agent/knowledge/[docId]/route'
import { GET as list } from '@/app/api/agent/knowledge/route'
import { POST as uploadUrl } from '@/app/api/agent/knowledge/upload-url/route'
import { POST as addUrl } from '@/app/api/agent/knowledge/url/route'
import { POST as addText } from '@/app/api/agent/knowledge/text/route'
import { POST as process } from '@/app/api/agent/knowledge/[docId]/process/route'
import { POST as refresh } from '@/app/api/agent/knowledge/[docId]/refresh/route'
import { POST as replaceStart } from '@/app/api/agent/knowledge/[docId]/replace/route'
import { POST as replaceComplete } from '@/app/api/agent/knowledge/[docId]/replace/complete/route'
import { GET as websites, POST as importWebsite } from '@/app/api/agent/knowledge/website/route'
import { DELETE as deleteWebsite } from '@/app/api/agent/knowledge/website/[crawlId]/route'
import { POST as testKb } from '@/app/api/agent/knowledge/test/route'
import { GET as usage } from '@/app/api/agent/knowledge/usage/route'
import { ProviderError } from '@/lib/voice-providers/errors'
import { resetRagOverviewCache } from '@/lib/voice-providers/knowledge-rag'

const H = { host: 'app.test', origin: 'http://app.test', 'content-type': 'application/json' }
const req = (method: string, body?: unknown, headers: Record<string, string> = H) =>
  new Request('http://app.test/api/x', { method, headers, body: body === undefined ? undefined : JSON.stringify(body) })
const params = (docId: string) => ({ params: Promise.resolve({ docId }) })
const crawlParams = (crawlId: string) => ({ params: Promise.resolve({ crawlId }) })
const docs = () => state.db.tables.knowledge_documents
const doc = () => docs().find((r) => r.id === DOC) as Row
const success = (id: string, extra: Row = {}) => ({
  status: 'success',
  data: { id, name: 'x', type: 'text', metadata: { created_at_unix_secs: 1, last_updated_at_unix_secs: 1_800_000_000, size_bytes: 600 }, supported_usages: ['prompt', 'auto'], ...extra },
})
const ragIdx = (status = 'processing') => ({ id: 'idx', model: 'e5_mistral_7b_instruct', status, progress_percentage: 50, document_model_index_usage: { used_bytes: 10 } })

let tick = 0
const now = () => new Date(Date.UTC(2026, 9, 7, 10, 0, 0, ++tick)).toISOString()

beforeEach(() => {
  vi.resetAllMocks()
  vi.unstubAllEnvs()
  resetRagOverviewCache()
  el.isConfigured.mockReturnValue(true)
  state.removed = []; state.signed = []; state.deferred = []; state.uploaded = []; state.objects.clear(); state.rateDenied.clear()
  const t = now()
  state.db = memoryDb(
    {
      agents: [{ id: AGENT, org_id: ORG, language: 'en', created_at: t }],
      knowledge_documents: [{
        id: DOC, org_id: ORG, agent_id: AGENT, storage_path: `${ORG}/${AGENT}/f.pdf`, elevenlabs_doc_id: 'kb1', name: 'f.pdf', type: 'pdf',
        status: 'ready', attached_at: t, size_bytes: 1000, character_count: 400, usage_mode: 'auto', deleting_at: null, created_at: t, updated_at: t,
        rag_status: 'succeeded', rag_model: 'e5_mistral_7b_instruct', rag_checked_at: t, attempt_count: 0,
      }],
      knowledge_crawls: [],
      knowledge_folders: [{ org_id: ORG, folder_id: 'fold_org' }],
      agent_provider_resources: [{ org_id: ORG, agent_id: AGENT, provider: 'elevenlabs', status: 'ready', external_id: 'el_agent_1', synced_revision: 1 }],
      audit_log: [],
    },
    { onUpdate: (_t, r) => { r.updated_at = now() }, unique: { knowledge_folders: [['org_id']] } },
  )
  sync.bumpRevision.mockResolvedValue(3)
  sync.syncAgent.mockResolvedValue([{ provider: 'elevenlabs', status: 'ready', externalId: 'x', appliedVoiceId: null, errorCode: null, error: null }])
  sync.providersFor.mockResolvedValue(['elevenlabs'])
  knowledge.processDocument.mockImplementation(async (_o: string, id: string) => ({ ...docs().find((r) => r.id === id), status: 'ready', attached_at: 'x', updated_at: 'x' }))
  kbMock.summaries.mockImplementation(async (ids: string[]) => Object.fromEntries(ids.map((id) => [id, success(id)])))
  kbMock.ragIndex.mockResolvedValue(ragIdx())
  kbMock.ragOverview.mockResolvedValue({ total_used_bytes: 10, total_max_bytes: 100, models: [] })
})

describe('DELETE', () => {
  it('provider error → 502, row kept and back in the spec, storage untouched', async () => {
    kbMock.deleteEntity.mockRejectedValueOnce(new ProviderError({ system: 'elevenlabs', operation: 'kb.delete', code: 'upstream', status: 500, detail: 'secret upstream body' }))
    const res = await DELETE(req('DELETE'), params(DOC))
    expect(res.status).toBe(502)
    expect(JSON.stringify(await res.json())).not.toContain('secret')
    expect(docs()).toHaveLength(1)
    expect(doc().deleting_at).toBeNull()
    expect(state.removed).toHaveLength(0)
  })
  it('marks the row deleting (out of the spec) BEFORE the provider delete; 404 upstream is fine', async () => {
    kbMock.deleteEntity.mockImplementationOnce(async () => {
      // At the moment of the provider call, the row is already excluded and the revision bumped.
      expect(doc().deleting_at).toBeTruthy()
      expect(sync.bumpRevision).toHaveBeenCalledWith(AGENT)
      throw new ProviderError({ system: 'elevenlabs', operation: 'kb.delete', code: 'not_found', status: 404 })
    })
    const res = await DELETE(req('DELETE'), params(DOC))
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ success: true, warnings: [] })
    expect(kbMock.deleteEntity).toHaveBeenCalledWith('kb1', true, { orgId: ORG, agentId: AGENT })
    expect(state.removed).toEqual([[`${ORG}/${AGENT}/f.pdf`]])
    expect(docs()).toHaveLength(0)
    await Promise.all(state.deferred)
    expect(sync.syncAgent).toHaveBeenCalledWith(AGENT, expect.any(Object))
  })
  it('foreign storage path → warning, not removed', async () => {
    doc().storage_path = 'other-org/x.pdf'
    kbMock.deleteEntity.mockResolvedValueOnce(undefined)
    const res = await DELETE(req('DELETE'), params(DOC))
    expect((await res.json()).warnings).toHaveLength(1)
    expect(state.removed).toHaveLength(0)
  })
  it('rejects bad ids and cross-site requests; unknown doc → 404', async () => {
    expect((await DELETE(req('DELETE'), params('abc'))).status).toBe(400)
    expect((await DELETE(req('DELETE', undefined, { ...H, origin: 'https://evil.test' }), params(DOC))).status).toBe(403)
    expect((await DELETE(req('DELETE'), params('44444444-4444-4444-8444-444444444444'))).status).toBe(404)
  })
})

describe('list', () => {
  it('refreshes indexing state (batch, read only) and returns the view without server-only columns', async () => {
    Object.assign(doc(), { rag_status: 'processing', rag_checked_at: null, content_excerpt: 'secret excerpt', pending_storage_path: `${ORG}/x` })
    kbMock.ragIndexBatch.mockResolvedValueOnce({ kb1: { status: 'success', data: ragIdx('succeeded') } })
    const res = await list(req('GET'))
    const body = (await res.json()) as Row[]
    expect(kbMock.ragIndexBatch).toHaveBeenCalledWith([{ document_id: 'kb1', model: 'e5_mistral_7b_instruct', create_if_missing: false }], { orgId: ORG }, { fast: true })
    expect(body[0].rag_status).toBe('succeeded')
    expect(body[0]).not.toHaveProperty('content_excerpt')
    expect(body[0]).not.toHaveProperty('pending_storage_path')
  })
  it('re-indexes for the new model after a language change (create_if_missing)', async () => {
    state.db.tables.agents[0].language = 'ro'
    kbMock.ragIndexBatch.mockResolvedValueOnce({ kb1: { status: 'success', data: { ...ragIdx('created'), model: 'multilingual_e5_large_instruct' } } })
    await list(req('GET'))
    expect(kbMock.ragIndexBatch).toHaveBeenCalledWith([{ document_id: 'kb1', model: 'multilingual_e5_large_instruct', create_if_missing: true }], { orgId: ORG }, { fast: true })
    expect(doc()).toMatchObject({ rag_model: 'multilingual_e5_large_instruct', rag_cleanup_pending: true, rag_status: 'created' })
  })
  it('a provider failure never fails the list', async () => {
    doc().rag_status = 'processing'
    doc().rag_checked_at = null
    kbMock.ragIndexBatch.mockRejectedValueOnce(new ProviderError({ system: 'elevenlabs', operation: 'kb.rag_index_batch', code: 'timeout' }))
    expect((await list(req('GET'))).status).toBe(200)
  })
})

describe('upload-url', () => {
  it('creates a processing row and a signed URL in the org folder', async () => {
    const res = await uploadUrl(req('POST', { name: '../Menu été.PDF', size: 1234, mime: 'application/pdf' }))
    expect(res.status).toBe(201)
    const body = await res.json()
    expect(body.document.status).toBe('processing')
    expect(body.document.name).toBe('Menu été.PDF')
    expect(body.document.type).toBe('pdf')
    expect(body.upload.path).toMatch(new RegExp(`^${ORG}/${AGENT}/${body.document.id}-Menu-ete\\.pdf$`))
  })
  it('rejects too large, wrong type and contradictory mime', async () => {
    expect((await uploadUrl(req('POST', { name: 'a.pdf', size: 21 * 1024 * 1024, mime: 'application/pdf' }))).status).toBe(413)
    expect((await uploadUrl(req('POST', { name: 'a.exe', size: 10, mime: '' }))).status).toBe(415)
    expect((await uploadUrl(req('POST', { name: 'a.pdf', size: 10, mime: 'image/png' }))).status).toBe(415)
    expect((await uploadUrl(req('POST', { name: '', size: 10, mime: '' }))).status).toBe(400)
  })
  it('enforces the per-organization byte budget from server-written sizes', async () => {
    vi.stubEnv('KNOWLEDGE_ORG_MAX_BYTES', String(1024 * 1024))
    const res = await uploadUrl(req('POST', { name: 'big.pdf', size: 1024 * 1024, mime: 'application/pdf' }))
    expect(res.status).toBe(409)
    expect((await res.json()).error).toMatch(/knowledge base is full/)
  })
  it('counts running website imports against the budget and pauses uploads when the workspace quota is critical', async () => {
    vi.stubEnv('KNOWLEDGE_ORG_MAX_BYTES', String(3 * 1024 * 1024))
    state.db.tables.knowledge_crawls.push({ id: 'c1', org_id: ORG, status: 'processing', max_pages: 25, size_bytes: 0, page_count: 0 })
    expect((await uploadUrl(req('POST', { name: 'a.pdf', size: 600_000, mime: 'application/pdf' }))).status).toBe(409)
    state.db.tables.knowledge_crawls = []
    kbMock.ragOverview.mockResolvedValueOnce({ total_used_bytes: 96, total_max_bytes: 100, models: [] })
    const res = await uploadUrl(req('POST', { name: 'a.pdf', size: 10, mime: 'application/pdf' }))
    expect(res.status).toBe(503)
    // The workspace-wide quota figures never reach the tenant (request ids are random, so check the fields).
    const body = await res.json()
    expect(JSON.stringify({ ...body, request_id: undefined, requestId: undefined })).not.toMatch(/\b96\b|\b100\b/)
  })
})

describe('url + text', () => {
  it('url: blocks private, accepts public, rejects duplicates', async () => {
    expect((await addUrl(req('POST', { url: 'http://10.0.0.1/admin' }))).status).toBe(400)
    const ok = await addUrl(req('POST', { url: 'https://example.com/faq#top' }))
    expect(ok.status).toBe(201)
    const created = docs().find((r) => r.type === 'url')!
    expect(created.url).toBe('https://example.com/faq')
    expect(created.name).toBe('example.com/faq')
    expect((await addUrl(req('POST', { url: 'https://example.com/faq' }))).status).toBe(409)
  })
  it('text: stores and processes', async () => {
    const res = await addText(req('POST', { name: 'Hours', text: 'Open\r\n9-5' }))
    expect(res.status).toBe(201)
    const row = docs().find((r) => r.type === 'text')!
    expect(row.character_count).toBe(8)
    expect(String(row.storage_path)).toMatch(new RegExp(`^${ORG}/${AGENT}/.*-Hours\\.txt$`))
    expect((await addText(req('POST', { name: 'x', text: '   ' }))).status).toBe(400)
  })
})

describe('process', () => {
  it('needs a storage path', async () => {
    doc().storage_path = null
    expect((await process(req('POST'), params(DOC))).status).toBe(400)
  })
  it('runs processDocument in initial mode', async () => {
    const res = await process(req('POST'), params(DOC))
    expect(res.status).toBe(200)
    expect(knowledge.processDocument).toHaveBeenCalledWith(ORG, DOC, expect.anything(), { mode: 'initial' })
  })
})

describe('PATCH (edit in place)', () => {
  const TEXT_PATH = `${ORG}/${AGENT}/t-Hours.txt`
  const asText = () => Object.assign(doc(), { type: 'text', name: 'Hours', storage_path: TEXT_PATH, size_bytes: 20, character_count: 20 })

  it('edits pasted text: Storage first (upsert), then PATCH content, same id, no re-upload', async () => {
    asText()
    kbMock.updateDocument.mockResolvedValueOnce({ id: 'kb1' })
    const res = await PATCH(req('PATCH', { text: 'Open 9-6 on Saturdays' }), params(DOC))
    expect(res.status).toBe(200)
    expect(state.uploaded).toEqual([{ path: TEXT_PATH, upsert: true }])
    expect(kbMock.updateDocument).toHaveBeenCalledWith('kb1', { content: 'Open 9-6 on Saturdays' }, { orgId: ORG, agentId: AGENT })
    expect(doc()).toMatchObject({ elevenlabs_doc_id: 'kb1', size_bytes: 21, character_count: 21, content_excerpt: 'Open 9-6 on Saturdays' })
    // Content edits keep the locator: no agent re-push.
    expect(sync.syncAgent).not.toHaveBeenCalledWith(AGENT, expect.objectContaining({ providers: ['elevenlabs'] }))
  })
  it('renames at the provider and pushes the locator change', async () => {
    kbMock.updateDocument.mockResolvedValueOnce({ id: 'kb1' })
    const res = await PATCH(req('PATCH', { name: 'Price list 2026' }), params(DOC))
    expect(res.status).toBe(200)
    expect(kbMock.updateDocument).toHaveBeenCalledWith('kb1', { name: 'Price list 2026' }, expect.anything())
    expect(doc().name).toBe('Price list 2026')
    expect(sync.bumpRevision).toHaveBeenCalledWith(AGENT)
    expect(sync.syncAgent).toHaveBeenCalledWith(AGENT, expect.objectContaining({ providers: ['elevenlabs'] }))
  })
  it('text edits only for pasted text; validation and unknown keys rejected', async () => {
    expect((await PATCH(req('PATCH', { text: 'x' }), params(DOC))).status).toBe(400)
    expect((await PATCH(req('PATCH', {}), params(DOC))).status).toBe(400)
    expect((await PATCH(req('PATCH', { usage_mode: 'always' }), params(DOC))).status).toBe(400)
    expect((await PATCH(req('PATCH', { name: 'x', storage_path: 'evil' }), params(DOC))).status).toBe(400)
    expect((await PATCH(req('PATCH', { text: 'a\u0000b' }), params(DOC))).status).toBe(400)
    expect((await PATCH(req('PATCH', { name: 'x' }, { ...H, origin: 'https://evil.test' }), params(DOC))).status).toBe(403)
  })
  it('usage_mode prompt: allowed for a small supported document within the cap', async () => {
    asText()
    const res = await PATCH(req('PATCH', { usage_mode: 'prompt' }), params(DOC))
    expect(res.status).toBe(200)
    expect(doc().usage_mode).toBe('prompt')
    expect(sync.syncAgent).toHaveBeenCalledWith(AGENT, expect.objectContaining({ providers: ['elevenlabs'] }))
  })
  it('usage_mode prompt: rejected over the org character cap, for large files, and when the provider does not support it', async () => {
    vi.stubEnv('KNOWLEDGE_PROMPT_MAX_CHARS', '500')
    asText()
    doc().character_count = 400
    docs().push({ id: 'other', org_id: ORG, agent_id: AGENT, usage_mode: 'prompt', character_count: 200, status: 'ready', deleting_at: null })
    let res = await PATCH(req('PATCH', { usage_mode: 'prompt' }), params(DOC))
    expect(res.status).toBe(409)
    expect((await res.json()).error).toMatch(/limited to 500 characters/)
    expect(doc().usage_mode).toBe('auto')

    vi.unstubAllEnvs()
    Object.assign(doc(), { type: 'pdf', size_bytes: 5 * 1024 * 1024 })
    expect((await PATCH(req('PATCH', { usage_mode: 'prompt' }), params(DOC))).status).toBe(409)

    asText()
    kbMock.summaries.mockResolvedValueOnce({ kb1: success('kb1', { supported_usages: ['auto'] }) })
    res = await PATCH(req('PATCH', { usage_mode: 'prompt' }), params(DOC))
    expect(res.status).toBe(409)
    expect(doc().usage_mode).toBe('auto')
  })
  it('a document being processed or deleted cannot be edited', async () => {
    doc().status = 'processing'
    expect((await PATCH(req('PATCH', { name: 'x' }), params(DOC))).status).toBe(409)
    Object.assign(doc(), { status: 'ready', deleting_at: now() })
    expect((await PATCH(req('PATCH', { name: 'x' }), params(DOC))).status).toBe(409)
  })
  it('GET returns the stored text for editing', async () => {
    asText()
    state.objects.set(TEXT_PATH, new TextEncoder().encode('﻿Open 9-5'))
    const body = await (await getDoc(req('GET'), params(DOC))).json()
    expect(body.text).toBe('Open 9-5')
    expect(body.document.id).toBe(DOC)
  })
})

describe('refresh (URL)', () => {
  it('refreshes a URL document, stores size and excerpt from the response, same id', async () => {
    Object.assign(doc(), { type: 'url', url: 'https://example.com/faq' })
    kbMock.refreshUrlDocument.mockResolvedValueOnce({ ...success('kb1').data, type: 'url', extracted_inner_html: '<h1>Hours</h1><p>9-6</p>', metadata: { created_at_unix_secs: 1, last_updated_at_unix_secs: 1_900_000_000, size_bytes: 777 } })
    const res = await refresh(req('POST'), params(DOC))
    expect(res.status).toBe(200)
    expect(doc()).toMatchObject({ elevenlabs_doc_id: 'kb1', size_bytes: 777, content_excerpt: 'Hours\n9-6' })
    expect(sync.bumpRevision).not.toHaveBeenCalled()
  })
  it('only URL documents; rate limited', async () => {
    expect((await refresh(req('POST'), params(DOC))).status).toBe(400)
    Object.assign(doc(), { type: 'url' })
    state.rateDenied.add('knowledge_refresh')
    expect((await refresh(req('POST'), params(DOC))).status).toBe(429)
    expect(kbMock.refreshUrlDocument).not.toHaveBeenCalled()
  })
})

describe('replace file', () => {
  it('start → signed URL in the org folder; complete → update-file, same id, old object removed', async () => {
    const start = await replaceStart(req('POST', { name: 'Prices 2026.pdf', size: 20, mime: 'application/pdf' }), params(DOC))
    expect(start.status).toBe(201)
    const pending = doc().pending_storage_path as string
    expect(pending.startsWith(`${ORG}/${AGENT}/`)).toBe(true)
    state.objects.set(pending, new TextEncoder().encode('%PDF-1.7 new prices'))
    kbMock.updateFile.mockResolvedValueOnce({ ...success('kb1').data, type: 'file', extracted_inner_html: '<p>New prices</p>' })
    const done = await replaceComplete(req('POST', { name: 'Prices 2026.pdf' }), params(DOC))
    expect(done.status).toBe(200)
    expect(kbMock.updateFile).toHaveBeenCalledWith('kb1', expect.any(Blob), 'Prices-2026.pdf', { orgId: ORG, agentId: AGENT })
    expect(doc()).toMatchObject({ storage_path: pending, pending_storage_path: null, elevenlabs_doc_id: 'kb1', name: 'Prices 2026.pdf', content_excerpt: 'New prices' })
    expect(state.removed).toContainEqual([`${ORG}/${AGENT}/f.pdf`])
  })
  it('rejects a bad replacement file and keeps the original', async () => {
    await replaceStart(req('POST', { name: 'x.pdf', size: 20, mime: 'application/pdf' }), params(DOC))
    state.objects.set(doc().pending_storage_path as string, new TextEncoder().encode('not a pdf'))
    expect((await replaceComplete(req('POST', {}), params(DOC))).status).toBe(415)
    expect(doc().storage_path).toBe(`${ORG}/${AGENT}/f.pdf`)
    expect(kbMock.updateFile).not.toHaveBeenCalled()
  })
  it('only uploaded files can be replaced', async () => {
    Object.assign(doc(), { type: 'url' })
    expect((await replaceStart(req('POST', { name: 'x.pdf', size: 20, mime: 'application/pdf' }), params(DOC))).status).toBe(400)
  })
})

describe('website import', () => {
  it('requires explicit consent', async () => {
    expect((await importWebsite(req('POST', { url: 'https://acme.example' }))).status).toBe(400)
    expect((await importWebsite(req('POST', { url: 'https://acme.example', consent: false }))).status).toBe(400)
  })
  it('blocks non-public addresses (SSRF guard)', async () => {
    expect((await importWebsite(req('POST', { url: 'http://192.168.1.1', consent: true }))).status).toBe(400)
    expect(kbMock.createCrawl).not.toHaveBeenCalled()
  })
  it('records consent, then starts a capped same-host crawl in the org folder with weekly auto-sync', async () => {
    kbMock.createCrawl.mockResolvedValueOnce({ id: 'job1', type: 'discovery', root_folder_id: 'fold_site', status: 'queued', created_at: 1 })
    const res = await importWebsite(req('POST', { url: 'https://www.acme.example/', consent: true }))
    expect(res.status).toBe(201)
    const body = await res.json()
    expect(body).not.toHaveProperty('crawl_job_id')
    expect(body).not.toHaveProperty('root_folder_id')
    expect(body.status).toBe('queued')
    const params = kbMock.createCrawl.mock.calls[0][0]
    expect(params).toEqual({
      url: 'https://www.acme.example/',
      max_pages: 25,
      pattern: '^https?://(?:www\\.)?acme\\.example(?::\\d+)?(?:[/?#].*)?$',
      parent_folder_id: 'fold_org',
      enable_auto_sync: true,
      auto_remove: false,
      auto_discover: false,
      minimum_frequency_days: 7,
    })
    expect(params).not.toHaveProperty('max_depth')
    expect(state.db.tables.audit_log[0]).toMatchObject({ org_id: ORG, actor_user_id: USER, action: 'knowledge.website_import_consent', details: expect.objectContaining({ domain: 'www.acme.example' }) })
    expect(state.db.tables.knowledge_crawls[0]).toMatchObject({ crawl_job_id: 'job1', root_folder_id: 'fold_site', consent_user_id: USER, status: 'queued' })
  })
  it('one running import per org; ELEVENLABS_CRAWL_MAX_PAGES is capped at 50', async () => {
    vi.stubEnv('ELEVENLABS_CRAWL_MAX_PAGES', '500')
    kbMock.createCrawl.mockResolvedValueOnce({ id: 'job1', type: 'discovery', root_folder_id: 'fold_site', status: 'queued', created_at: 1 })
    expect((await importWebsite(req('POST', { url: 'https://acme.example', consent: true }))).status).toBe(201)
    expect(kbMock.createCrawl.mock.calls[0][0].max_pages).toBe(25)
    expect((await importWebsite(req('POST', { url: 'https://other.example', consent: true }))).status).toBe(409)
    expect(kbMock.createCrawl).toHaveBeenCalledTimes(1)
  })
  it('a provider failure marks the import failed', async () => {
    kbMock.createCrawl.mockRejectedValueOnce(new ProviderError({ system: 'elevenlabs', operation: 'kb.crawl_create', code: 'validation', status: 422 }))
    expect((await importWebsite(req('POST', { url: 'https://acme.example', consent: true }))).status).toBe(422)
    expect(state.db.tables.knowledge_crawls[0].status).toBe('failed')
  })
  it('GET polls the stored job only and finishes it: folder attached as one RAG locator', async () => {
    state.db.tables.knowledge_crawls.push({
      id: '66666666-6666-4666-8666-666666666666', org_id: ORG, agent_id: AGENT, seed_url: 'https://acme.example/', host: 'acme.example', max_pages: 25,
      status: 'processing', crawl_job_id: 'job1', root_folder_id: 'fold_site', created_at: now(), updated_at: now(), last_checked_at: null,
      pages_identified: 0, pages_scraped: 0, pages_skipped: 0, pages_failed: 0, page_count: 0, size_bytes: 0,
    })
    kbMock.getCrawl.mockResolvedValueOnce({ id: 'job1', status: 'succeeded', pages_identified: 3, pages_scraped: 2, pages_skipped: 0, pages_failed: 1, root_folder_id: 'fold_site' })
    kbMock.listFolderDocuments.mockResolvedValue({ documents: [{ id: 'p1', type: 'url', metadata: { size_bytes: 1000 } }, { id: 'p2', type: 'url', metadata: { size_bytes: 500 } }], complete: true })
    kbMock.contentPrefix.mockResolvedValue({ text: '<p>About us</p>', truncated: false })
    kbMock.ragIndexBatch.mockResolvedValueOnce({ p1: { status: 'success', data: ragIdx('succeeded') }, p2: { status: 'success', data: ragIdx('processing') } })
    const body = await (await websites(req('GET'))).json()
    expect(kbMock.getCrawl).toHaveBeenCalledWith('job1', { orgId: ORG, agentId: AGENT })
    expect(body.websites[0]).toMatchObject({ status: 'succeeded', page_count: 2, size_bytes: 1500, pages_failed: 1, rag_status: 'processing' })
    expect(body.websites[0]).not.toHaveProperty('crawl_job_id')
    const row = state.db.tables.knowledge_crawls[0]
    expect(row.content_excerpt).toContain('About us')
    expect(row.attached_at).toBeTruthy()
    expect(sync.syncAgent).toHaveBeenCalledWith(AGENT, expect.objectContaining({ providers: ['elevenlabs'] }))
  })
  it('DELETE cancels a running crawl and deletes its folder; not found for other orgs', async () => {
    const id = '66666666-6666-4666-8666-666666666666'
    state.db.tables.knowledge_crawls.push({ id, org_id: ORG, agent_id: AGENT, status: 'processing', crawl_job_id: 'job1', root_folder_id: 'fold_site' })
    const res = await deleteWebsite(req('DELETE'), crawlParams(id))
    expect(res.status).toBe(200)
    expect(kbMock.cancelCrawl).toHaveBeenCalledWith('job1', expect.anything())
    expect(kbMock.deleteEntity).toHaveBeenCalledWith('fold_site', true, expect.anything())
    expect(state.db.tables.knowledge_crawls).toHaveLength(0)
    state.db.tables.knowledge_crawls.push({ id, org_id: 'another-org', agent_id: AGENT, status: 'succeeded' })
    expect((await deleteWebsite(req('DELETE'), crawlParams(id))).status).toBe(404)
  })
})

describe('test your knowledge base', () => {
  it('queries the org agent (resolved server-side) and drops chunks of foreign documents', async () => {
    state.db.tables.knowledge_crawls.push({ id: 'c1', org_id: ORG, agent_id: AGENT, status: 'succeeded', host: 'acme.example', root_folder_id: 'fold_site' })
    kbMock.ragQuery.mockResolvedValueOnce({
      chunks: [
        { document_id: 'kb1', document_name: 'ignored', source_url: null, chunk_id: 'c', text: '<p>Open 9-5</p>', vector_distance: 0.21234, content_format: 'html', document_type: 'file' },
        { document_id: 'page1', document_name: 'acme.example/about', source_url: 'https://acme.example/about', chunk_id: 'c2', text: 'About', vector_distance: null, content_format: 'markdown', document_type: 'url' },
        { document_id: 'foreign', document_name: 'Other tenant secrets', source_url: null, chunk_id: 'c3', text: 'secret', vector_distance: 0.1, content_format: 'html', document_type: 'text' },
      ],
    })
    kbMock.summaries.mockResolvedValueOnce({
      page1: success('page1', { folder_parent_id: 'fold_site', folder_path: [{ id: 'fold_org' }, { id: 'fold_site' }] }),
      foreign: success('foreign', { folder_parent_id: 'fold_other', folder_path: [{ id: 'fold_other' }] }),
    })
    const res = await testKb(req('POST', { query: 'Are you open on Saturday?' }))
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(kbMock.ragQuery).toHaveBeenCalledWith('el_agent_1', { query: 'Are you open on Saturday?', use_agent_defaults: true }, { orgId: ORG, agentId: AGENT })
    expect(body.chunks).toEqual([
      { document_id: DOC, document_name: 'f.pdf', source: 'document', source_url: null, text: 'Open 9-5', distance: 0.212 },
      { document_id: null, document_name: 'acme.example/about', source: 'website', source_url: 'https://acme.example/about', text: 'About', distance: null },
    ])
    expect(body.dropped).toBe(1)
    expect(JSON.stringify(body)).not.toContain('secret')
  })
  it('validates the question, is rate limited and needs a provisioned agent', async () => {
    expect((await testKb(req('POST', { query: '' }))).status).toBe(400)
    expect((await testKb(req('POST', { query: 'x'.repeat(501) }))).status).toBe(400)
    expect((await testKb(req('POST', { query: 'ok?', agent_id: 'el_other' }))).status).toBe(400)
    state.rateDenied.add('knowledge_test')
    expect((await testKb(req('POST', { query: 'hours?' }))).status).toBe(429)
    state.rateDenied.clear()
    state.db.tables.agent_provider_resources = []
    expect((await testKb(req('POST', { query: 'hours?' }))).status).toBe(409)
    expect(kbMock.ragQuery).not.toHaveBeenCalled()
  })
})

describe('usage', () => {
  it('reports org-level budgets only', async () => {
    doc().usage_mode = 'prompt'
    const body = await (await usage(req('GET'))).json()
    expect(body).toMatchObject({ bytes_used: 1000, bytes_limit: 50 * 1024 * 1024, documents: 1, documents_limit: 100, prompt_chars_used: 400, prompt_chars_limit: 8000, crawl_max_pages: 25 })
    expect(JSON.stringify(body)).not.toMatch(/total_max_bytes|workspace/)
  })
})
