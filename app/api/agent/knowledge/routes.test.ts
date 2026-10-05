import { beforeEach, describe, expect, it, vi } from 'vitest'
type Row = Record<string, unknown>
const state = vi.hoisted(() => ({
  tables: {} as Record<string, Array<Record<string, unknown>>>,
  removed: [] as string[][],
  signed: [] as string[],
  deferred: [] as Promise<unknown>[],
  tick: 0,
}))
class Query {
  private filters: Array<[string, unknown]> = []
  private patch: Row | null = null
  private ins: Row | null = null
  private del = false
  private head = false
  constructor(private table: string) {}
  select(_c?: string, o?: { head?: boolean }) { this.head = !!o?.head; return this }
  insert(r: Row) { this.ins = r; return this }
  update(p: Row) { this.patch = p; return this }
  delete() { this.del = true; return this }
  eq(c: string, v: unknown) { this.filters.push([c, v]); return this }
  order() { return this }
  limit() { return this }
  private run() {
    const rows = (state.tables[this.table] ??= [])
    if (this.ins) {
      const now = new Date(Date.now() + ++state.tick).toISOString()
      const r = { attempt_count: 0, attached_at: null, elevenlabs_doc_id: null, error_message: null, created_at: now, updated_at: now, ...this.ins }
      rows.push(r)
      return { data: [{ ...r }], error: null, count: null }
    }
    const hit = rows.filter((r) => this.filters.every(([c, v]) => r[c] === v))
    if (this.del) { state.tables[this.table] = rows.filter((r) => !hit.includes(r)); return { data: null, error: null, count: null } }
    if (this.patch) for (const r of hit) Object.assign(r, this.patch)
    return { data: this.head ? null : hit.map((r) => ({ ...r })), error: null, count: hit.length }
  }
  maybeSingle() { const r = this.run(); return Promise.resolve({ data: (r.data as Row[] | null)?.[0] ?? null, error: null }) }
  single() { return this.maybeSingle() }
  then<A>(res: (v: unknown) => A, rej?: (e: unknown) => unknown) { return Promise.resolve(this.run()).then(res, rej) }
}
const fakeDb = {
  from: (t: string) => new Query(t),
  storage: { from: () => ({
    remove: async (paths: string[]) => { state.removed.push(paths); return { data: [], error: null } },
    createSignedUploadUrl: async (path: string) => { state.signed.push(path); return { data: { path, token: 'tok', signedUrl: `https://x/${path}?token=tok` }, error: null } },
  }) },
}
const ORG = '11111111-1111-4111-8111-111111111111'
const AGENT = '22222222-2222-4222-8222-222222222222'
const DOC = '33333333-3333-4333-8333-333333333333'
vi.mock('@/lib/api/auth', () => ({ requireOrg: async () => ({ supabase: fakeDb, user: { id: 'u' }, org: { id: ORG, name: 'Acme', timezone: null, plan: null } }) }))
vi.mock('@/lib/supabase/admin', () => ({ createAdminClient: () => fakeDb }))
vi.mock('@/lib/security/rate-limit', () => ({ RATE_LIMITS: { knowledgeUpload: {} }, enforceRateLimit: async () => {} }))
vi.mock('@/lib/agents/ensure-agent', () => ({ ensureAgent: async () => ({ id: AGENT }), defaultAgentName: () => 'A' }))
vi.mock('@/lib/observability/telemetry', () => ({ deferBackground: (p: Promise<unknown>) => { state.deferred.push(p) }, emitProviderEvent: () => {} }))
const el = vi.hoisted(() => ({ knowledgeBase: { delete: vi.fn() } }))
vi.mock('@/lib/elevenlabs/client', () => el)
const sync = vi.hoisted(() => ({ bumpRevision: vi.fn(), syncAgent: vi.fn(), providersFor: vi.fn() }))
vi.mock('@/lib/voice-providers/agent-sync.ts', () => sync)
const knowledge = vi.hoisted(() => ({ processDocument: vi.fn() }))
vi.mock('@/lib/voice-providers/knowledge.ts', async (orig) => ({ ...(await orig<object>()), processDocument: knowledge.processDocument }))

import { DELETE } from '@/app/api/agent/knowledge/[docId]/route'
import { POST as uploadUrl } from '@/app/api/agent/knowledge/upload-url/route'
import { POST as addUrl } from '@/app/api/agent/knowledge/url/route'
import { POST as addText } from '@/app/api/agent/knowledge/text/route'
import { POST as process } from '@/app/api/agent/knowledge/[docId]/process/route'
import { ProviderError } from '@/lib/voice-providers/errors'

const H = { host: 'app.test', origin: 'http://app.test', 'content-type': 'application/json' }
const req = (method: string, body?: unknown, headers: Record<string, string> = H) =>
  new Request('http://app.test/api/x', { method, headers, body: body === undefined ? undefined : JSON.stringify(body) })
const params = (docId: string) => ({ params: Promise.resolve({ docId }) })

beforeEach(() => {
  vi.resetAllMocks()
  state.removed = []; state.signed = []; state.deferred = []
  state.tables = { knowledge_documents: [{ id: DOC, org_id: ORG, agent_id: AGENT, storage_path: `${ORG}/${AGENT}/f.pdf`, elevenlabs_doc_id: 'kb1', name: 'f.pdf' }] }
  sync.bumpRevision.mockResolvedValue(3)
  sync.syncAgent.mockResolvedValue([])
  knowledge.processDocument.mockImplementation(async (_o: string, id: string) => ({ ...state.tables.knowledge_documents.find((r) => r.id === id), status: 'ready', attached_at: 'x', updated_at: 'x' }))
})

describe('DELETE', () => {
  it('provider error → 502, row kept, storage untouched', async () => {
    el.knowledgeBase.delete.mockRejectedValueOnce(new ProviderError({ system: 'elevenlabs', operation: 'kb.delete', code: 'upstream', status: 500, detail: 'secret upstream body' }))
    const res = await DELETE(req('DELETE'), params(DOC))
    expect(res.status).toBe(502)
    const body = await res.json()
    expect(JSON.stringify(body)).not.toContain('secret')
    expect(state.tables.knowledge_documents).toHaveLength(1)
    expect(state.removed).toHaveLength(0)
  })
  it('404 upstream is fine; removes storage, row; bumps + defers sync', async () => {
    el.knowledgeBase.delete.mockRejectedValueOnce(new ProviderError({ system: 'elevenlabs', operation: 'kb.delete', code: 'not_found', status: 404 }))
    const res = await DELETE(req('DELETE'), params(DOC))
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ success: true, warnings: [] })
    expect(el.knowledgeBase.delete).toHaveBeenCalledWith('kb1', true, { orgId: ORG, agentId: AGENT })
    expect(state.removed).toEqual([[`${ORG}/${AGENT}/f.pdf`]])
    expect(state.tables.knowledge_documents).toHaveLength(0)
    expect(sync.bumpRevision).toHaveBeenCalledWith(AGENT)
    await Promise.all(state.deferred)
    expect(sync.syncAgent).toHaveBeenCalledWith(AGENT, expect.any(Object))
  })
  it('foreign storage path → warning, not removed', async () => {
    state.tables.knowledge_documents[0].storage_path = 'other-org/x.pdf'
    el.knowledgeBase.delete.mockResolvedValueOnce(undefined)
    const res = await DELETE(req('DELETE'), params(DOC))
    expect((await res.json()).warnings).toHaveLength(1)
    expect(state.removed).toHaveLength(0)
  })
  it('rejects bad ids and cross-site requests', async () => {
    expect((await DELETE(req('DELETE'), params('abc'))).status).toBe(400)
    expect((await DELETE(req('DELETE', undefined, { ...H, origin: 'https://evil.test' }), params(DOC))).status).toBe(403)
  })
  it('unknown doc → 404', async () => {
    expect((await DELETE(req('DELETE'), params('44444444-4444-4444-8444-444444444444'))).status).toBe(404)
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
    expect(body.document.mime_type).toBe('application/pdf')
    expect(body.document.can_retry).toBe(false)
    expect(body.upload.path).toMatch(new RegExp(`^${ORG}/${AGENT}/${body.document.id}-Menu-ete\\.pdf$`))
    expect(body.upload.token).toBe('tok')
  })
  it('rejects too large, wrong type and contradictory mime', async () => {
    expect((await uploadUrl(req('POST', { name: 'a.pdf', size: 21 * 1024 * 1024, mime: 'application/pdf' }))).status).toBe(413)
    expect((await uploadUrl(req('POST', { name: 'a.exe', size: 10, mime: '' }))).status).toBe(415)
    expect((await uploadUrl(req('POST', { name: 'a.pdf', size: 10, mime: 'image/png' }))).status).toBe(415)
    expect((await uploadUrl(req('POST', { name: '', size: 10, mime: '' }))).status).toBe(400)
  })
})

describe('url + text', () => {
  it('url: blocks private, accepts public, rejects duplicates', async () => {
    expect((await addUrl(req('POST', { url: 'http://10.0.0.1/admin' }))).status).toBe(400)
    const ok = await addUrl(req('POST', { url: 'https://example.com/faq#top' }))
    expect(ok.status).toBe(201)
    const created = state.tables.knowledge_documents.find((r) => r.type === 'url')!
    expect(created.url).toBe('https://example.com/faq')
    expect(created.name).toBe('example.com/faq')
    expect((await addUrl(req('POST', { url: 'https://example.com/faq' }))).status).toBe(409)
  })
  it('text: stores and processes', async () => {
    const storage = fakeDb.storage.from() as unknown as Record<string, unknown>
    ;(fakeDb.storage as unknown as { from: () => unknown }).from = () => ({ ...storage, upload: async () => ({ data: {}, error: null }) })
    const res = await addText(req('POST', { name: 'Hours', text: 'Open\r\n9-5' }))
    expect(res.status).toBe(201)
    const row = state.tables.knowledge_documents.find((r) => r.type === 'text')!
    expect(row.character_count).toBe(8)
    expect(String(row.storage_path)).toMatch(new RegExp(`^${ORG}/${AGENT}/.*-Hours\\.txt$`))
    expect((await addText(req('POST', { name: 'x', text: '   ' }))).status).toBe(400)
  })
})

describe('process', () => {
  it('needs a storage path', async () => {
    state.tables.knowledge_documents[0].storage_path = null
    expect((await process(req('POST'), params(DOC))).status).toBe(400)
  })
  it('runs processDocument in initial mode', async () => {
    const res = await process(req('POST'), params(DOC))
    expect(res.status).toBe(200)
    expect(knowledge.processDocument).toHaveBeenCalledWith(ORG, DOC, expect.anything(), { mode: 'initial' })
  })
})
