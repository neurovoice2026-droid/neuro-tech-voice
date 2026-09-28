import { beforeEach, describe, expect, it, vi } from 'vitest'

// ─── In-memory Supabase stand-in (just the query shapes the pipeline uses) ────

type Row = Record<string, unknown>
type Filter = (row: Row) => boolean

const state = vi.hoisted(() => ({
  tables: { knowledge_documents: [] as Record<string, unknown>[], knowledge_chunks: [] as Record<string, unknown>[] } as Record<string, Record<string, unknown>[]>,
  storage: new Map<string, Uint8Array | string>(),
  uploads: [] as string[],
  openai: true,
  kv: new Map<string, number>(),
  nextId: 1,
}))

function query(table: string) {
  let op: 'select' | 'insert' | 'update' | 'delete' = 'select'
  let rows: Row[] = []
  let patch: Row = {}
  let head = false
  const filters: Filter[] = []
  let range: [number, number] | null = null

  const run = async () => {
    const data = state.tables[table]
    const matches = data.filter((row) => filters.every((f) => f(row)))
    if (op === 'insert') {
      const inserted = rows.map((r) => ({ id: `id-${state.nextId++}`, ...r }))
      data.push(...inserted)
      return { data: inserted, error: null, count: null }
    }
    if (op === 'update') {
      matches.forEach((row) => Object.assign(row, patch))
      return { data: matches.map((r) => ({ id: r.id })), error: null, count: null }
    }
    if (op === 'delete') {
      state.tables[table] = data.filter((row) => !matches.includes(row))
      return { data: null, error: null, count: null }
    }
    const page = range ? matches.slice(range[0], range[1] + 1) : matches
    return { data: head ? null : page, error: null, count: matches.length }
  }

  const api = {
    select: (_cols?: string, opts?: { head?: boolean }) => {
      head = opts?.head === true
      return api
    },
    insert: (value: Row | Row[]) => {
      op = 'insert'
      rows = Array.isArray(value) ? value : [value]
      return api
    },
    update: (value: Row) => {
      op = 'update'
      patch = value
      return api
    },
    delete: () => {
      op = 'delete'
      return api
    },
    eq: (col: string, value: unknown) => {
      filters.push((row) => row[col] === value)
      return api
    },
    in: (col: string, values: unknown[]) => {
      filters.push((row) => values.includes(row[col]))
      return api
    },
    order: () => api,
    range: (from: number, to: number) => {
      range = [from, to]
      return api
    },
    maybeSingle: async () => {
      const result = await run()
      return { data: (result.data as Row[] | null)?.[0] ?? null, error: null }
    },
    then: (resolve: (v: unknown) => unknown, reject: (e: unknown) => unknown) => run().then(resolve, reject),
  }
  return api
}

const admin = {
  from: (table: string) => query(table),
  storage: {
    from: () => ({
      download: async (path: string) => {
        const value = state.storage.get(path)
        if (value === undefined) return { data: null, error: { message: 'Object not found' } }
        return { data: new Blob([value as BlobPart]), error: null }
      },
      upload: async (path: string, body: string) => {
        state.storage.set(path, body)
        state.uploads.push(path)
        return { data: { path }, error: null }
      },
      remove: async () => ({ data: [], error: null }),
    }),
  },
}

const mocks = vi.hoisted(() => ({
  embedTexts: vi.fn(),
  syncDocumentToProviders: vi.fn(),
  removeDocumentFromProviders: vi.fn(),
  deleteKnowledgeDocument: vi.fn(),
  invalidateKnowledgeCache: vi.fn(),
}))

vi.mock('@/lib/supabase/admin', () => ({ createAdminClient: () => admin }))
vi.mock('@/lib/env', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/env')>()),
  isSupabaseAdminConfigured: () => true,
  isOpenAIConfigured: () => state.openai,
}))
vi.mock('@/lib/openai/client', () => ({
  embedTexts: mocks.embedTexts,
  classifyOpenAIError: () => 'fatal',
  openAIEmbeddingModel: () => 'text-embedding-3-small',
}))
vi.mock('@/lib/kv', () => ({
  kvIncr: async (key: string) => {
    const next = (state.kv.get(key) ?? 0) + 1
    state.kv.set(key, next)
    return next
  },
  kvDel: async (key: string) => {
    state.kv.delete(key)
  },
}))
vi.mock('./providers', () => ({
  loadKnowledgeAgent: async (_admin: unknown, orgId: string, agentId: string) => ({
    id: agentId,
    org_id: orgId,
    cartesia_agent_id: null,
    elevenlabs_agent_id: 'el_agent',
  }),
  syncDocumentToProviders: mocks.syncDocumentToProviders,
  removeDocumentFromProviders: mocks.removeDocumentFromProviders,
}))
vi.mock('./delete', () => ({ deleteKnowledgeDocument: mocks.deleteKnowledgeDocument }))
vi.mock('./search', () => ({ invalidateKnowledgeCache: mocks.invalidateKnowledgeCache }))
vi.mock('./readiness', () => ({ resyncAgentIfKnowledgeFlipped: vi.fn(async () => undefined) }))
vi.mock('./fetch-url', () => ({ fetchWebDocument: vi.fn() }))

import { ingestKnowledgeDocument } from './ingest'
import { REFRESHING_MESSAGE, WAITING_FOR_AI_MESSAGE } from './shared'

const ORG = '11111111-1111-4111-8111-111111111111'
const AGENT = '22222222-2222-4222-8222-222222222222'
const PATH = `${ORG}/${AGENT}/33333333-3333-4333-8333-333333333333-faq.md`

function addDocument(overrides: Row = {}): Row {
  const doc: Row = {
    id: 'doc-1',
    org_id: ORG,
    agent_id: AGENT,
    name: 'FAQ.md',
    type: 'md',
    url: null,
    storage_path: PATH,
    size_bytes: 10,
    character_count: 0,
    chunk_count: 0,
    content_sha256: null,
    extracted_text_path: null,
    elevenlabs_doc_id: null,
    cartesia_doc_id: null,
    status: 'processing',
    error_message: null,
    provider_sync: {},
    created_at: '2026-09-17T00:00:00Z',
    updated_at: '2026-09-17T00:00:00Z',
    ...overrides,
  }
  state.tables.knowledge_documents.push(doc)
  return doc
}

const FAQ = '# Parking\n\nFree parking behind the building.\n\n# Hours\n\nOpen Monday to Friday, 9 to 17.'

beforeEach(() => {
  vi.clearAllMocks()
  state.tables.knowledge_documents = []
  state.tables.knowledge_chunks = []
  state.storage.clear()
  state.uploads = []
  state.kv.clear()
  state.openai = true
  state.nextId = 1
  state.storage.set(PATH, FAQ)
  mocks.embedTexts.mockImplementation(async (texts: string[]) => texts.map(() => [0.1, 0.2]))
  mocks.syncDocumentToProviders.mockResolvedValue({
    provider_sync: { elevenlabs: { status: 'synced', synced_at: 'now', error: null } },
    cartesia_doc_id: null,
    elevenlabs_doc_id: 'el_doc',
  })
  vi.spyOn(console, 'warn').mockImplementation(() => undefined)
  vi.spyOn(console, 'error').mockImplementation(() => undefined)
})

describe('ingestKnowledgeDocument', () => {
  it('reads, chunks, embeds and marks the document ready, then copies it to the providers', async () => {
    const doc = addDocument()
    await ingestKnowledgeDocument({ orgId: ORG, documentId: 'doc-1' })

    expect(doc).toMatchObject({ status: 'ready', error_message: null, chunk_count: 2, character_count: FAQ.length, elevenlabs_doc_id: 'el_doc' })
    expect(typeof doc.content_sha256).toBe('string')
    expect(doc.extracted_text_path).toBe(`${ORG}/${AGENT}/extracted/doc-1.txt`)
    expect(state.tables.knowledge_chunks.map((c) => [c.heading, c.content, c.document_id, c.org_id, c.agent_id])).toEqual([
      ['Parking', 'Free parking behind the building.', 'doc-1', ORG, AGENT],
      ['Hours', 'Open Monday to Friday, 9 to 17.', 'doc-1', ORG, AGENT],
    ])
    expect(mocks.embedTexts).toHaveBeenCalledWith(['FAQ.md\nParking\n\nFree parking behind the building.', 'FAQ.md\nHours\n\nOpen Monday to Friday, 9 to 17.'])
    expect(mocks.invalidateKnowledgeCache).toHaveBeenCalledWith(AGENT)
    expect(mocks.syncDocumentToProviders).toHaveBeenCalledTimes(1)
    expect(state.kv.size).toBe(0)
  })

  it('skips re-embedding when the text is unchanged', async () => {
    const doc = addDocument()
    await ingestKnowledgeDocument({ orgId: ORG, documentId: 'doc-1' })
    const chunkIds = state.tables.knowledge_chunks.map((c) => c.id)
    mocks.embedTexts.mockClear()

    doc.status = 'processing'
    await ingestKnowledgeDocument({ orgId: ORG, documentId: 'doc-1', previousStatus: 'ready' })
    expect(mocks.embedTexts).not.toHaveBeenCalled()
    expect(doc.status).toBe('ready')
    expect(state.tables.knowledge_chunks.map((c) => c.id)).toEqual(chunkIds)
  })

  it('replaces the chunks when the text changes (new ones first, then the old ones go)', async () => {
    const doc = addDocument()
    await ingestKnowledgeDocument({ orgId: ORG, documentId: 'doc-1' })
    const oldIds = state.tables.knowledge_chunks.map((c) => c.id)

    state.storage.set(PATH, '# Parking\n\nParking now costs 2 EUR per hour.')
    await ingestKnowledgeDocument({ orgId: ORG, documentId: 'doc-1', previousStatus: 'ready' })
    expect(doc.chunk_count).toBe(1)
    expect(state.tables.knowledge_chunks).toHaveLength(1)
    expect(state.tables.knowledge_chunks[0].content).toBe('Parking now costs 2 EUR per hour.')
    expect(oldIds).not.toContain(state.tables.knowledge_chunks[0].id)
  })

  it('waits for the AI service without failing the document', async () => {
    state.openai = false
    const doc = addDocument()
    await ingestKnowledgeDocument({ orgId: ORG, documentId: 'doc-1' })
    expect(doc).toMatchObject({ status: 'processing', error_message: WAITING_FOR_AI_MESSAGE, chunk_count: 0, character_count: FAQ.length })
    expect(state.tables.knowledge_chunks).toHaveLength(0)
    expect(mocks.embedTexts).not.toHaveBeenCalled()
    expect(mocks.syncDocumentToProviders).toHaveBeenCalledTimes(1)

    // A resync once OpenAI is configured finishes it.
    state.openai = true
    await ingestKnowledgeDocument({ orgId: ORG, documentId: 'doc-1', previousStatus: 'processing' })
    expect(doc).toMatchObject({ status: 'ready', error_message: null, chunk_count: 2 })
  })

  it('fails a new document with a plain reason', async () => {
    state.storage.set(PATH, new Uint8Array([0x89, 0x50, 0x00, 0x01]))
    const doc = addDocument()
    await ingestKnowledgeDocument({ orgId: ORG, documentId: 'doc-1' })
    expect(doc.status).toBe('failed')
    expect(doc.error_message).toMatch(/doesn’t contain plain text/)
    expect(mocks.syncDocumentToProviders).not.toHaveBeenCalled()
  })

  it('keeps the previous version when a refresh fails', async () => {
    const doc = addDocument()
    await ingestKnowledgeDocument({ orgId: ORG, documentId: 'doc-1' })
    state.storage.delete(PATH)

    doc.status = 'processing'
    await ingestKnowledgeDocument({ orgId: ORG, documentId: 'doc-1', previousStatus: 'ready' })
    expect(doc.status).toBe('ready')
    expect(doc.error_message).toMatch(/^We couldn’t refresh this document\. .*Your agent keeps using the version it already had\.$/)
    expect(state.tables.knowledge_chunks).toHaveLength(2)
  })

  it('refreshes a ready document in place: it stays ready and searchable, then the note clears', async () => {
    const doc = addDocument()
    await ingestKnowledgeDocument({ orgId: ORG, documentId: 'doc-1' })

    // What the resync route leaves on a ready document.
    doc.error_message = REFRESHING_MESSAGE
    state.storage.set(PATH, '# Parking\n\nParking now costs 2 EUR per hour.')
    await ingestKnowledgeDocument({ orgId: ORG, documentId: 'doc-1', previousStatus: 'ready' })
    expect(doc).toMatchObject({ status: 'ready', error_message: null, chunk_count: 1 })

    // A refresh that fails keeps the version already in use and says so.
    doc.error_message = REFRESHING_MESSAGE
    state.storage.delete(PATH)
    await ingestKnowledgeDocument({ orgId: ORG, documentId: 'doc-1', previousStatus: 'ready' })
    expect(doc.status).toBe('ready')
    expect(doc.error_message).toMatch(/^We couldn’t refresh this document\./)
    expect(state.tables.knowledge_chunks).toHaveLength(1)
  })

  it('fails with a generic message when embedding breaks and leaves no partial chunks', async () => {
    mocks.embedTexts.mockRejectedValue(new Error('boom'))
    const doc = addDocument()
    await ingestKnowledgeDocument({ orgId: ORG, documentId: 'doc-1' })
    expect(doc.status).toBe('failed')
    expect(doc.error_message).toBe('Something went wrong while reading this document. Please try again.')
    expect(state.tables.knowledge_chunks).toHaveLength(0)
  })

  it('removes the replaced document once the new version is ready', async () => {
    addDocument()
    await ingestKnowledgeDocument({ orgId: ORG, documentId: 'doc-1', replacesDocumentId: 'old-doc' })
    expect(mocks.deleteKnowledgeDocument).toHaveBeenCalledWith({ orgId: ORG, documentId: 'old-doc' })
  })

  it('keeps the replaced document when the new version fails', async () => {
    state.storage.delete(PATH)
    addDocument()
    await ingestKnowledgeDocument({ orgId: ORG, documentId: 'doc-1', replacesDocumentId: 'old-doc' })
    expect(mocks.deleteKnowledgeDocument).not.toHaveBeenCalled()
  })

  it('skips when another run holds the lock, and only touches its own organisation', async () => {
    const doc = addDocument()
    state.kv.set('kb:ingest:doc-1', 1)
    await ingestKnowledgeDocument({ orgId: ORG, documentId: 'doc-1' })
    expect(doc.status).toBe('processing')

    state.kv.clear()
    await ingestKnowledgeDocument({ orgId: '99999999-9999-4999-8999-999999999999', documentId: 'doc-1' })
    expect(doc.status).toBe('processing')
    expect(mocks.embedTexts).not.toHaveBeenCalled()
  })
})
