import { beforeEach, expect, it, vi } from 'vitest'
// processDocument against in-memory fakes (no network, no real Supabase).
type Row = Record<string, unknown>

const state = vi.hoisted(() => ({
  tables: {} as Record<string, Array<Record<string, unknown>>>,
  objects: new Map<string, Uint8Array>(),
  tick: 0,
  deferred: [] as Promise<unknown>[],
}))

function ts() {
  state.tick += 1
  return new Date(Date.UTC(2026, 9, 5, 12, 0, 0, state.tick)).toISOString().replace('Z', '+00:00')
}

class Query {
  private filters: Array<[string, unknown]> = []
  private patch: Row | null = null
  private del = false
  constructor(private table: string) {}
  select() { return this }
  update(p: Row) { this.patch = p; return this }
  delete() { this.del = true; return this }
  eq(c: string, v: unknown) { this.filters.push([c, v]); return this }
  in() { return this }
  order() { return this }
  limit() { return this }
  private run() {
    const rows = (state.tables[this.table] ??= [])
    const hit = rows.filter((r) => this.filters.every(([c, v]) => r[c] === v))
    if (this.del) {
      state.tables[this.table] = rows.filter((r) => !hit.includes(r))
      return { data: null, error: null }
    }
    if (this.patch) for (const r of hit) Object.assign(r, this.patch, { updated_at: ts() })
    return { data: hit.map((r) => ({ ...r })), error: null }
  }
  maybeSingle() { const r = this.run(); return Promise.resolve({ data: (r.data as Row[] | null)?.[0] ?? null, error: null }) }
  single() { return this.maybeSingle() }
  then<A>(res: (v: { data: unknown; error: null }) => A, rej?: (e: unknown) => unknown) { return Promise.resolve(this.run()).then(res, rej) }
}

const fakeDb = {
  from: (t: string) => new Query(t),
  storage: {
    from: () => ({
      download: (path: string) => ({
        asStream: async () => {
          const bytes = state.objects.get(path)
          if (!bytes) return { data: null, error: { message: 'Object not found', status: 400, statusCode: '404' } }
          return { data: new Blob([bytes as Uint8Array<ArrayBuffer>]).stream(), error: null }
        },
      }),
    }),
  },
}

vi.mock('@/lib/supabase/admin', () => ({ createAdminClient: () => fakeDb }))
vi.mock('@/lib/observability/telemetry', () => ({
  deferBackground: (p: Promise<unknown>) => { state.deferred.push(p) },
  emitProviderEvent: () => {},
}))
const el = vi.hoisted(() => ({
  knowledgeBase: {
    get: vi.fn(), createFromFile: vi.fn(), createFromText: vi.fn(), createFromUrl: vi.fn(),
    delete: vi.fn(), ragIndex: vi.fn(), content: vi.fn(),
  },
}))
vi.mock('@/lib/elevenlabs/client', () => el)
const sync = vi.hoisted(() => ({ bumpRevision: vi.fn(), syncAgent: vi.fn(), providersFor: vi.fn() }))
vi.mock('@/lib/voice-providers/agent-sync.ts', () => sync)

import { processDocument } from '@/lib/voice-providers/knowledge'
import { ProviderError } from '@/lib/voice-providers/errors'
import { createLogger } from '@/lib/observability/logger'

const ORG = '11111111-1111-4111-8111-111111111111'
const AGENT = '22222222-2222-4222-8222-222222222222'
const DOC = '33333333-3333-4333-8333-333333333333'
const log = createLogger({ test: true })
const ok = (provider = 'elevenlabs', status = 'ready') => [{ provider, status, externalId: 'x', appliedVoiceId: null, errorCode: null, error: null }]

function seed(doc: Row, path?: string, bytes?: Uint8Array) {
  const now = ts()
  state.tables = {
    agents: [{ id: AGENT, org_id: ORG, language: 'fr' }],
    knowledge_documents: [{
      id: DOC, org_id: ORG, agent_id: AGENT, name: 'Prix été.pdf', type: 'pdf', url: null, storage_path: path ?? null,
      elevenlabs_doc_id: null, status: 'processing', error_message: null, attached_at: null, last_synced_at: null,
      attempt_count: 0, size_bytes: 10, created_at: now, updated_at: now, ...doc,
    }],
    agent_provider_resources: [{ org_id: ORG, agent_id: AGENT, provider: 'elevenlabs', status: 'ready', synced_revision: 1 }],
  }
  state.objects.clear()
  if (path && bytes) state.objects.set(path, bytes)
  state.deferred = []
}
const row = () => state.tables.knowledge_documents[0]
const pdf = new TextEncoder().encode('%PDF-1.7\nhello')
const PATH = `${ORG}/${AGENT}/${DOC}-Prix-ete.pdf`

beforeEach(() => {
  vi.resetAllMocks()
  sync.bumpRevision.mockResolvedValue(2)
  sync.syncAgent.mockImplementation(async (_id: string, o: { providers?: string[] }) => ok(o.providers?.[0] ?? 'elevenlabs'))
  sync.providersFor.mockResolvedValue(['elevenlabs', 'cartesia'])
  el.knowledgeBase.createFromFile.mockResolvedValue({ id: 'kb_file', name: 'x' })
  el.knowledgeBase.createFromText.mockResolvedValue({ id: 'kb_text', name: 'x' })
  el.knowledgeBase.createFromUrl.mockResolvedValue({ id: 'kb_url', name: 'x' })
  el.knowledgeBase.ragIndex.mockResolvedValue({ id: 'kb', status: 'processing' })
  el.knowledgeBase.content.mockResolvedValue('<p>Hello&nbsp;world</p>')
  el.knowledgeBase.get.mockResolvedValue({ id: 'kb', name: 'x', type: 'file' })
  el.knowledgeBase.delete.mockResolvedValue(undefined)
})

it('file happy path: upload, attach, rag, excerpt, fallback sync', async () => {
  seed({}, PATH, pdf)
  const doc = await processDocument(ORG, DOC, log)
  expect(doc.status).toBe('ready')
  expect(doc.elevenlabs_doc_id).toBe('kb_file')
  expect(doc.attached_at).toBeTruthy()
  expect(row().content_excerpt).toBe('Hello world')
  expect(row().size_bytes).toBe(pdf.byteLength)
  const [blob, filename, name] = el.knowledgeBase.createFromFile.mock.calls[0]
  expect((blob as Blob).type).toBe('application/pdf')
  expect(filename).toBe('Prix-ete.pdf')
  expect(name).toBe('Prix été.pdf')
  expect(sync.syncAgent).toHaveBeenCalledWith(AGENT, expect.objectContaining({ providers: ['elevenlabs'] }))
  expect(el.knowledgeBase.ragIndex).toHaveBeenCalledWith('kb_file', 'multilingual_e5_large_instruct', { orgId: ORG, agentId: AGENT })
  await Promise.all(state.deferred)
  expect(sync.syncAgent).toHaveBeenLastCalledWith(AGENT, expect.objectContaining({ providers: ['cartesia'] }))
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

it('attach failure keeps the provider id, marks failed; retry resyncs without re-upload', async () => {
  seed({}, PATH, pdf)
  sync.syncAgent.mockResolvedValueOnce([{ provider: 'elevenlabs', status: 'degraded', externalId: 'a', appliedVoiceId: null, errorCode: 'validation', error: 'The voice provider rejected this configuration.' }])
  const failed = await processDocument(ORG, DOC, log)
  expect(failed.status).toBe('failed')
  expect(failed.elevenlabs_doc_id).toBe('kb_file')
  expect(failed.error_message).toMatch(/could not be added to your agent/)
  const ready = await processDocument(ORG, DOC, log, { mode: 'retry' })
  expect(ready.status).toBe('ready')
  expect(el.knowledgeBase.createFromFile).toHaveBeenCalledTimes(1)
  expect(el.knowledgeBase.get).toHaveBeenCalledWith('kb_file', expect.anything())
})

it('retry re-uploads when the provider lost the document', async () => {
  seed({ status: 'failed', elevenlabs_doc_id: 'kb_gone', attempt_count: 1 }, PATH, pdf)
  el.knowledgeBase.get.mockRejectedValueOnce(new ProviderError({ system: 'elevenlabs', operation: 'kb.get', code: 'not_found' }))
  const doc = await processDocument(ORG, DOC, log, { mode: 'retry' })
  expect(doc.status).toBe('ready')
  expect(doc.elevenlabs_doc_id).toBe('kb_file')
})

it('initial on an in-flight run → 409; settled → returned unchanged', async () => {
  seed({}, PATH, pdf)
  row().updated_at = new Date().toISOString() // claimed recently (≠ created_at)
  await expect(processDocument(ORG, DOC, log)).rejects.toMatchObject({ status: 409 })
  await expect(processDocument(ORG, DOC, log, { mode: 'retry' })).rejects.toMatchObject({ status: 409 })
  seed({ status: 'ready', attached_at: ts(), elevenlabs_doc_id: 'kb' }, PATH, pdf)
  expect((await processDocument(ORG, DOC, log, { mode: 'retry' })).status).toBe('ready')
  expect(el.knowledgeBase.get).not.toHaveBeenCalled()
})

it('text doc uses createFromText and the local text as excerpt', async () => {
  const p = `${ORG}/${AGENT}/${DOC}-faq.txt`
  seed({ type: 'text', name: 'FAQ' }, p, new TextEncoder().encode('﻿Open 9-5'))
  const doc = await processDocument(ORG, DOC, log)
  expect(doc.status).toBe('ready')
  expect(el.knowledgeBase.createFromText).toHaveBeenCalledWith({ text: 'Open 9-5', name: 'FAQ' }, expect.anything())
  expect(el.knowledgeBase.content).not.toHaveBeenCalled()
  expect(row().content_excerpt).toBe('Open 9-5')
})

it('url doc: private address rejected; public one imported', async () => {
  seed({ type: 'url', url: 'http://169.254.169.254/latest', name: 'meta' })
  expect((await processDocument(ORG, DOC, log)).status).toBe('failed')
  seed({ type: 'url', url: 'https://example.com/faq', name: 'example.com/faq' })
  const doc = await processDocument(ORG, DOC, log)
  expect(doc.status).toBe('ready')
  expect(el.knowledgeBase.createFromUrl).toHaveBeenCalledWith({ url: 'https://example.com/faq', name: 'example.com/faq' }, expect.anything())
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
    state.tables.knowledge_documents = []
    return { id: 'kb_orphan', name: 'x' }
  })
  await expect(processDocument(ORG, DOC, log)).rejects.toMatchObject({ status: 404 })
  expect(el.knowledgeBase.delete).toHaveBeenCalledWith('kb_orphan', true, expect.anything())
})

it('sync lease held elsewhere → waits for a push at our revision', async () => {
  seed({}, PATH, pdf)
  sync.syncAgent.mockResolvedValueOnce(ok('elevenlabs', 'in_progress'))
  state.tables.agent_provider_resources[0].synced_revision = 2
  const doc = await processDocument(ORG, DOC, log)
  expect(doc.status).toBe('ready')
})

it('rag and excerpt failures are non-fatal', async () => {
  seed({}, PATH, pdf)
  el.knowledgeBase.ragIndex.mockRejectedValueOnce(new ProviderError({ system: 'elevenlabs', operation: 'kb.rag_index', code: 'upstream', status: 500 }))
  el.knowledgeBase.content.mockRejectedValueOnce(new ProviderError({ system: 'elevenlabs', operation: 'kb.content', code: 'timeout' }))
  const doc = await processDocument(ORG, DOC, log)
  expect(doc.status).toBe('ready')
})
