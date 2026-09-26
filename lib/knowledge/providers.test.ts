import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { KnowledgeDocument } from '@/types'

const state = vi.hoisted(() => ({
  cartesia: true,
  elevenlabs: true,
  kv: new Map<string, unknown>(),
}))

const cartesiaMock = vi.hoisted(() => ({
  createFolder: vi.fn(),
  createDocument: vi.fn(),
  updateDocument: vi.fn(),
  deleteDocument: vi.fn(),
  attachFolderToAgent: vi.fn(),
}))

const elevenLabsMock = vi.hoisted(() => ({
  createElevenLabsTextDocument: vi.fn(),
  computeElevenLabsRagIndex: vi.fn(),
  deleteElevenLabsDocument: vi.fn(),
  getElevenLabsAgentKnowledge: vi.fn(),
  updateElevenLabsAgentKnowledge: vi.fn(),
}))

vi.mock('@/lib/env', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/env')>()),
  isSupabaseAdminConfigured: () => true,
  isCartesiaConfigured: () => state.cartesia,
  isElevenLabsConfigured: () => state.elevenlabs,
}))
vi.mock('@/lib/cartesia/client', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/cartesia/client')>()),
  cartesia: { knowledge: cartesiaMock },
}))
vi.mock('@/lib/elevenlabs/knowledge', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/elevenlabs/knowledge')>()),
  ...elevenLabsMock,
}))
vi.mock('@/lib/kv', () => ({
  kvGet: async (key: string) => state.kv.get(key) ?? null,
  kvSet: async (key: string, value: unknown) => {
    state.kv.set(key, value)
  },
  kvIncr: async (key: string) => {
    const next = ((state.kv.get(key) as number | undefined) ?? 0) + 1
    state.kv.set(key, next)
    return next
  },
  kvDel: async (key: string) => {
    state.kv.delete(key)
  },
}))
vi.mock('@/lib/supabase/admin', () => {
  const chain = {
    select: () => chain,
    eq: () => chain,
    not: () => chain,
    limit: async () => ({ data: [], error: null }),
  }
  return { createAdminClient: () => ({ from: () => chain }) }
})

import { CartesiaError } from '@/lib/cartesia/client'
import { CARTESIA_PART_MAX_BYTES, removeDocumentFromProviders, syncDocumentToProviders, type KnowledgeAgentRef } from './providers'

const AGENT: KnowledgeAgentRef = {
  id: '22222222-2222-4222-8222-222222222222',
  org_id: '11111111-1111-4111-8111-111111111111',
  cartesia_agent_id: 'agent_cartesia',
  elevenlabs_agent_id: 'agent_el',
}

function doc(overrides: Partial<KnowledgeDocument> = {}): KnowledgeDocument {
  return {
    id: 'doc-1',
    agent_id: AGENT.id,
    org_id: AGENT.org_id,
    elevenlabs_doc_id: null,
    cartesia_doc_id: null,
    name: 'Price list',
    type: 'pdf',
    url: null,
    storage_path: 'x',
    size_bytes: 1,
    character_count: 1,
    chunk_count: 1,
    content_sha256: null,
    extracted_text_path: null,
    status: 'ready',
    error_message: null,
    provider_sync: {},
    created_at: '2026-09-17T00:00:00Z',
    updated_at: null,
    ...overrides,
  }
}

beforeEach(() => {
  vi.clearAllMocks()
  state.cartesia = true
  state.elevenlabs = true
  state.kv.clear()
  cartesiaMock.createFolder.mockResolvedValue({ id: 'folder_1' })
  let n = 0
  cartesiaMock.createDocument.mockImplementation(async () => ({ id: `cdoc_${++n}` }))
  cartesiaMock.updateDocument.mockResolvedValue(undefined)
  cartesiaMock.deleteDocument.mockResolvedValue(undefined)
  cartesiaMock.attachFolderToAgent.mockResolvedValue(undefined)
  elevenLabsMock.createElevenLabsTextDocument.mockResolvedValue({ id: 'el_new', name: 'Price list' })
  elevenLabsMock.updateElevenLabsAgentKnowledge.mockResolvedValue({ changed: true, rag: null })
  elevenLabsMock.deleteElevenLabsDocument.mockResolvedValue(undefined)
  elevenLabsMock.computeElevenLabsRagIndex.mockResolvedValue(undefined)
  elevenLabsMock.getElevenLabsAgentKnowledge.mockResolvedValue({ locators: [], rag: null })
  vi.spyOn(console, 'error').mockImplementation(() => undefined)
  vi.spyOn(console, 'warn').mockImplementation(() => undefined)
})

describe('syncDocumentToProviders', () => {
  it('records both providers as disabled when neither is configured', async () => {
    state.cartesia = false
    state.elevenlabs = false
    const result = await syncDocumentToProviders({ doc: doc(), agent: AGENT, text: 'Hello' })
    expect(result.provider_sync.cartesia?.status).toBe('disabled')
    expect(result.provider_sync.elevenlabs?.status).toBe('disabled')
    expect(cartesiaMock.createFolder).not.toHaveBeenCalled()
    expect(elevenLabsMock.createElevenLabsTextDocument).not.toHaveBeenCalled()
  })

  it('creates the agent folder, uploads the text, attaches the folder and the standby agent document', async () => {
    const result = await syncDocumentToProviders({ doc: doc(), agent: AGENT, text: 'Haircut 30 EUR' })
    expect(cartesiaMock.createFolder).toHaveBeenCalledWith(`ntv-${AGENT.id}`)
    expect(cartesiaMock.createDocument).toHaveBeenCalledWith({
      folderId: 'folder_1',
      name: 'Price list',
      content: 'Haircut 30 EUR',
      metadata: { ntv_document_id: 'doc-1', ntv_part: '1' },
    })
    expect(cartesiaMock.attachFolderToAgent).toHaveBeenCalledWith('folder_1', 'agent_cartesia')
    expect(result.provider_sync.cartesia).toMatchObject({ status: 'synced', folder_id: 'folder_1', doc_ids: ['cdoc_1'], attached: true, error: null })
    expect(result.cartesia_doc_id).toBe('cdoc_1')

    expect(elevenLabsMock.updateElevenLabsAgentKnowledge).toHaveBeenCalledWith('agent_el', {
      add: [{ type: 'text', name: 'Price list', id: 'el_new', usage_mode: 'auto' }],
      remove: [],
      enableRagModel: null,
    })
    expect(result.provider_sync.elevenlabs).toMatchObject({ status: 'synced', attached: true })
    expect(result.elevenlabs_doc_id).toBe('el_new')
  })

  it('does nothing when the text and attachments are already in place', async () => {
    const first = await syncDocumentToProviders({ doc: doc(), agent: AGENT, text: 'Same' })
    vi.clearAllMocks()
    const again = await syncDocumentToProviders({
      doc: doc({ provider_sync: first.provider_sync, cartesia_doc_id: first.cartesia_doc_id, elevenlabs_doc_id: first.elevenlabs_doc_id }),
      agent: AGENT,
      text: 'Same',
    })
    expect(cartesiaMock.createDocument).not.toHaveBeenCalled()
    expect(cartesiaMock.updateDocument).not.toHaveBeenCalled()
    expect(elevenLabsMock.createElevenLabsTextDocument).not.toHaveBeenCalled()
    expect(again.provider_sync).toEqual(first.provider_sync)
  })

  it('updates changed text in place on Cartesia and swaps the ElevenLabs document', async () => {
    const first = await syncDocumentToProviders({ doc: doc(), agent: AGENT, text: 'Old prices' })
    elevenLabsMock.createElevenLabsTextDocument.mockResolvedValue({ id: 'el_v2', name: 'Price list' })
    const second = await syncDocumentToProviders({
      doc: doc({ provider_sync: first.provider_sync, cartesia_doc_id: first.cartesia_doc_id, elevenlabs_doc_id: first.elevenlabs_doc_id }),
      agent: AGENT,
      text: 'New prices',
    })
    expect(cartesiaMock.updateDocument).toHaveBeenCalledWith('cdoc_1', { name: 'Price list', content: 'New prices' })
    expect(elevenLabsMock.updateElevenLabsAgentKnowledge).toHaveBeenLastCalledWith('agent_el', expect.objectContaining({ remove: ['el_new'] }))
    expect(elevenLabsMock.deleteElevenLabsDocument).toHaveBeenCalledWith('el_new')
    expect(second.elevenlabs_doc_id).toBe('el_v2')
    expect(second.provider_sync.elevenlabs?.stale_doc_id).toBeNull()
  })

  it('splits long text into parts under the Cartesia size limit', async () => {
    const paragraph = 'a'.repeat(400_000)
    const text = [paragraph, paragraph, paragraph].join('\n\n')
    const result = await syncDocumentToProviders({ doc: doc(), agent: { ...AGENT, cartesia_agent_id: null }, text })
    expect(cartesiaMock.createDocument).toHaveBeenCalledTimes(2)
    for (const call of cartesiaMock.createDocument.mock.calls) {
      expect(Buffer.byteLength(call[0].content)).toBeLessThanOrEqual(CARTESIA_PART_MAX_BYTES)
    }
    expect(cartesiaMock.createDocument.mock.calls[1][0].name).toBe('Price list (part 2 of 2)')
    expect(cartesiaMock.attachFolderToAgent).not.toHaveBeenCalled()
    expect(result.provider_sync.cartesia).toMatchObject({ status: 'synced', attached: false, doc_ids: ['cdoc_1', 'cdoc_2'] })
  })

  it('indexes a long document with the standby agent’s RAG model and switches RAG on with that model', async () => {
    state.cartesia = false
    const text = 'word '.repeat(70_000)
    elevenLabsMock.getElevenLabsAgentKnowledge.mockResolvedValue({ locators: [], rag: { enabled: true, embedding_model: 'e5_mistral_7b_instruct' } })
    const first = await syncDocumentToProviders({ doc: doc(), agent: AGENT, text })
    expect(elevenLabsMock.computeElevenLabsRagIndex).toHaveBeenCalledWith('el_new', 'e5_mistral_7b_instruct')
    expect(elevenLabsMock.updateElevenLabsAgentKnowledge).toHaveBeenCalledWith('agent_el', expect.objectContaining({ enableRagModel: 'e5_mistral_7b_instruct' }))
    expect(first.provider_sync.elevenlabs).toMatchObject({ status: 'synced', rag_indexed: true, rag_model: 'e5_mistral_7b_instruct' })

    // Unchanged text and model: no new index.
    vi.clearAllMocks()
    elevenLabsMock.getElevenLabsAgentKnowledge.mockResolvedValue({ locators: [], rag: { enabled: true, embedding_model: 'e5_mistral_7b_instruct' } })
    elevenLabsMock.updateElevenLabsAgentKnowledge.mockResolvedValue({ changed: false, rag: null })
    const docWithSync = doc({ provider_sync: first.provider_sync, elevenlabs_doc_id: first.elevenlabs_doc_id })
    await syncDocumentToProviders({ doc: docWithSync, agent: AGENT, text })
    expect(elevenLabsMock.createElevenLabsTextDocument).not.toHaveBeenCalled()
    expect(elevenLabsMock.computeElevenLabsRagIndex).not.toHaveBeenCalled()

    // The agent's RAG model changed: the same document is indexed again for it.
    elevenLabsMock.getElevenLabsAgentKnowledge.mockResolvedValue({ locators: [], rag: { enabled: true, embedding_model: 'multilingual_e5_large_instruct' } })
    const third = await syncDocumentToProviders({ doc: docWithSync, agent: AGENT, text })
    expect(elevenLabsMock.computeElevenLabsRagIndex).toHaveBeenCalledWith('el_new', 'multilingual_e5_large_instruct')
    expect(third.provider_sync.elevenlabs).toMatchObject({ rag_model: 'multilingual_e5_large_instruct' })
  })

  it('finds the existing folder when the name is taken', async () => {
    cartesiaMock.createFolder.mockRejectedValue(
      new CartesiaError({ status: 409, errorCode: 'kb_folder_duplicate_name', message: 'duplicate', endpoint: 'POST /agents/folders' })
    )
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(JSON.stringify({ data: [{ id: 'folder_existing', name: `ntv-${AGENT.id}` }], has_more: false }), { status: 200 })
    )
    vi.stubEnv('CARTESIA_API_KEY', 'test-cartesia-key')
    const result = await syncDocumentToProviders({ doc: doc(), agent: AGENT, text: 'x' })
    expect(result.provider_sync.cartesia?.folder_id).toBe('folder_existing')
    fetchSpy.mockRestore()
    vi.unstubAllEnvs()
  })

  it('records provider failures on the document instead of throwing', async () => {
    cartesiaMock.createFolder.mockRejectedValue(new CartesiaError({ status: 503, message: 'down', endpoint: 'POST /agents/folders' }))
    elevenLabsMock.createElevenLabsTextDocument.mockRejectedValue(new Error('network'))
    const result = await syncDocumentToProviders({ doc: doc(), agent: AGENT, text: 'x' })
    expect(result.provider_sync.cartesia).toMatchObject({ status: 'error', error: expect.stringMatching(/couldn’t be reached/) })
    expect(result.provider_sync.elevenlabs).toMatchObject({ status: 'error', error: expect.stringMatching(/backup agent/) })
  })

  it('reports a failed folder attach without losing the uploaded copy', async () => {
    cartesiaMock.attachFolderToAgent.mockRejectedValue(new CartesiaError({ status: 503, message: 'down', endpoint: 'PATCH /agents/folders/{id}' }))
    const result = await syncDocumentToProviders({ doc: doc(), agent: AGENT, text: 'x' })
    expect(result.provider_sync.cartesia).toMatchObject({ status: 'error', doc_ids: ['cdoc_1'], attached: false })
    expect(result.cartesia_doc_id).toBe('cdoc_1')
  })

  it('treats a managed agent Cartesia can’t link folders to as synced, and stops retrying the link (docs F3)', async () => {
    cartesiaMock.attachFolderToAgent.mockRejectedValue(new CartesiaError({ status: 400, errorCode: 'kb_agent_not_found', message: 'no', endpoint: 'PATCH /agents/folders/{id}' }))
    const first = await syncDocumentToProviders({ doc: doc(), agent: AGENT, text: 'x' })
    expect(first.provider_sync.cartesia).toMatchObject({ status: 'synced', error: null, attached: false, attach_unsupported_for: 'agent_cartesia' })
    cartesiaMock.attachFolderToAgent.mockClear()
    const again = await syncDocumentToProviders({ doc: doc({ provider_sync: first.provider_sync, cartesia_doc_id: 'cdoc_1' }), agent: AGENT, text: 'x' })
    expect(cartesiaMock.attachFolderToAgent).not.toHaveBeenCalled()
    expect(again.provider_sync.cartesia).toMatchObject({ status: 'synced', attach_unsupported_for: 'agent_cartesia' })
  })
})

describe('removeDocumentFromProviders', () => {
  it('deletes every provider copy and reports what was left behind', async () => {
    cartesiaMock.deleteDocument
      .mockResolvedValueOnce(undefined)
      .mockRejectedValueOnce(new CartesiaError({ status: 404, message: 'gone', endpoint: 'DELETE /agents/documents/{id}' }))
    const warnings = await removeDocumentFromProviders(
      doc({
        cartesia_doc_id: 'cdoc_1',
        elevenlabs_doc_id: 'el_1',
        provider_sync: { cartesia: { status: 'synced', synced_at: null, error: null, doc_ids: ['cdoc_1', 'cdoc_2'] } as never },
      })
    )
    expect(cartesiaMock.deleteDocument).toHaveBeenCalledTimes(2)
    expect(elevenLabsMock.deleteElevenLabsDocument).toHaveBeenCalledWith('el_1')
    expect(warnings).toEqual([])
    expect(elevenLabsMock.deleteElevenLabsDocument).toHaveBeenCalledTimes(1)

    elevenLabsMock.deleteElevenLabsDocument.mockRejectedValueOnce(new Error('down'))
    state.cartesia = false
    const left = await removeDocumentFromProviders(doc({ cartesia_doc_id: 'cdoc_9', elevenlabs_doc_id: 'el_2' }))
    expect(left).toEqual(['cartesia', 'elevenlabs'])
  })
})
