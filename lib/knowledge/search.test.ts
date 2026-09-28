import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  createEmbedding: vi.fn(),
  rpc: vi.fn(),
  limit: vi.fn(),
  kv: new Map<string, unknown>(),
}))

vi.mock('@/lib/openai/client', () => ({
  // Two dimensions keep the fixtures short; the check is the same.
  EMBEDDING_DIMENSIONS: 2,
  getOpenAI: () => ({ embeddings: { create: mocks.createEmbedding } }),
  openAIEmbeddingModel: () => 'text-embedding-3-small',
}))
vi.mock('@/lib/kv', () => ({
  kvGet: vi.fn(async (key: string) => mocks.kv.get(key) ?? null),
  kvSet: vi.fn(async (key: string, value: unknown) => {
    mocks.kv.set(key, value)
  }),
  kvDel: vi.fn(async (key: string) => {
    mocks.kv.delete(key)
  }),
}))
vi.mock('@/lib/supabase/admin', () => {
  const query = {
    select: () => query,
    eq: () => query,
    gt: () => query,
    limit: mocks.limit,
  }
  return { createAdminClient: () => ({ rpc: mocks.rpc, from: () => query }) }
})

import {
  MAX_PASSAGE_CHARS,
  bestPassage,
  hasReadyKnowledge,
  invalidateKnowledgeCache,
  queryTerms,
  searchKnowledge,
  shapeSearchResults,
  type MatchedChunkRow,
} from './search'

const ORG = '11111111-1111-4111-8111-111111111111'
const AGENT = '22222222-2222-4222-8222-222222222222'

function row(overrides: Partial<MatchedChunkRow>): MatchedChunkRow {
  return {
    chunk_id: 'c1',
    document_id: 'd1',
    document_name: 'FAQ',
    heading: null,
    content: 'Free parking behind the building.',
    similarity: 0.5,
    ...overrides,
  }
}

beforeEach(() => {
  vi.clearAllMocks()
  mocks.kv.clear()
})

describe('shapeSearchResults', () => {
  it('sorts by similarity, drops weak matches and keeps the best chunk per document', () => {
    const results = shapeSearchResults(
      [
        row({ chunk_id: 'a', document_id: 'd1', similarity: 0.41 }),
        row({ chunk_id: 'b', document_id: 'd2', document_name: 'Prices', similarity: 0.62, content: 'Parking costs nothing.' }),
        row({ chunk_id: 'c', document_id: 'd1', similarity: 0.55 }),
        row({ chunk_id: 'd', document_id: 'd3', similarity: 0.2 }),
      ],
      'parking'
    )
    expect(results.map((r) => [r.chunk_id, r.document_id])).toEqual([
      ['b', 'd2'],
      ['c', 'd1'],
    ])
    expect(results[0]).toMatchObject({ document_name: 'Prices', similarity: 0.62, excerpt: 'Parking costs nothing.', heading: null })
  })

  it('caps the number of results', () => {
    const rows = Array.from({ length: 12 }, (_, i) => row({ chunk_id: `c${i}`, document_id: `d${i}`, similarity: 0.9 - i * 0.01 }))
    expect(shapeSearchResults(rows, 'x', { matchCount: 3 })).toHaveLength(3)
    expect(shapeSearchResults(rows, 'x', { matchCount: 50 })).toHaveLength(10)
  })

  it('keeps passages within 1,200 characters including the heading and excerpts within 160', () => {
    const sentences = Array.from({ length: 60 }, (_, i) => `Sentence ${i} talks about general things in the studio.`)
    sentences[40] = 'Parking is free for customers behind the building on Oak Street.'
    const [result] = shapeSearchResults(
      [row({ heading: 'Visiting › Getting here', content: sentences.join(' '), similarity: 0.7 })],
      'Where can I park? parking'
    )
    expect(result.heading).toBe('Visiting › Getting here')
    expect(result.content.length + result.heading!.length + 1).toBeLessThanOrEqual(MAX_PASSAGE_CHARS)
    expect(result.content).toContain('Parking is free for customers')
    expect(result.excerpt.length).toBeLessThanOrEqual(160)
  })

  it('ignores rows without content or with invalid similarity', () => {
    const results = shapeSearchResults(
      [row({ content: '   ', similarity: 0.9 }), row({ chunk_id: 'x', document_id: 'd9', similarity: Number.NaN })],
      'q'
    )
    expect(results).toEqual([])
  })
})

describe('bestPassage', () => {
  it('returns short content unchanged', () => {
    expect(bestPassage('Open 9 to 5.', 'hours', 100)).toBe('Open 9 to 5.')
  })

  it('picks the window of sentences that mentions the query and marks cuts with ellipses', () => {
    const text = `${'Filler sentence about nothing. '.repeat(30)}Refunds are paid within five days. ${'More filler here. '.repeat(30)}`
    const passage = bestPassage(text, 'How long do refunds take?', 200)
    expect(passage.length).toBeLessThanOrEqual(200)
    expect(passage).toContain('Refunds are paid within five days.')
    expect(passage.startsWith('…')).toBe(true)
  })

  it('falls back to the beginning when no words match (a purely semantic match)', () => {
    const text = 'First sentence here. '.repeat(40)
    const passage = bestPassage(text, 'zzz qqq', 120)
    expect(passage.startsWith('First sentence here.')).toBe(true)
    expect(passage.length).toBeLessThanOrEqual(120)
  })

  it('matches words regardless of diacritics and case', () => {
    expect(queryTerms('Cât costă TUNSOAREA?')).toEqual(['cat', 'costa', 'tunsoarea'])
    expect(queryTerms('营业时间')).toEqual(['营业', '业时', '时间'])
  })
})

describe('searchKnowledge', () => {
  it('embeds the query, calls match_knowledge_chunks scoped by org and agent, and shapes results', async () => {
    mocks.createEmbedding.mockResolvedValue({ data: [{ index: 0, embedding: [0.1, 0.2] }] })
    mocks.rpc.mockResolvedValue({
      data: [row({ chunk_id: 'c1', heading: 'Visiting', content: 'Free parking behind the building.', similarity: 0.66 })],
      error: null,
    })
    const results = await searchKnowledge({ orgId: ORG, agentId: AGENT, query: '  where to   park ' })
    expect(mocks.createEmbedding).toHaveBeenCalledWith(
      { model: 'text-embedding-3-small', input: 'where to park', encoding_format: 'float', dimensions: 2 },
      { timeout: 5_000 }
    )
    expect(mocks.rpc).toHaveBeenCalledWith('match_knowledge_chunks', {
      p_org_id: ORG,
      p_agent_id: AGENT,
      p_embedding: [0.1, 0.2],
      p_match_count: 20,
      p_min_similarity: 0.25,
    })
    expect(results).toEqual([
      {
        document_id: 'd1',
        document_name: 'FAQ',
        chunk_id: 'c1',
        excerpt: 'Free parking behind the building.',
        similarity: 0.66,
        content: 'Visiting\nFree parking behind the building.',
      },
    ])
  })

  it('returns nothing for an empty query without calling OpenAI', async () => {
    expect(await searchKnowledge({ orgId: ORG, agentId: AGENT, query: '   ' })).toEqual([])
    expect(mocks.createEmbedding).not.toHaveBeenCalled()
  })

  it('reports a missing search function as not configured', async () => {
    mocks.createEmbedding.mockResolvedValue({ data: [{ index: 0, embedding: [0.1, 0.2] }] })
    mocks.rpc.mockResolvedValue({ data: null, error: { code: 'PGRST202', message: 'not found' } })
    await expect(searchKnowledge({ orgId: ORG, agentId: AGENT, query: 'hours' })).rejects.toMatchObject({ status: 503, code: 'not_configured' })
  })

  it('refuses an embedding with the wrong dimensions before searching', async () => {
    mocks.createEmbedding.mockResolvedValue({ data: [{ index: 0, embedding: [0.1] }] })
    await expect(searchKnowledge({ orgId: ORG, agentId: AGENT, query: 'hours' })).rejects.toThrow(/dimensions/)
    expect(mocks.rpc).not.toHaveBeenCalled()
  })

  it('rejects ids that are not UUIDs', async () => {
    await expect(searchKnowledge({ orgId: 'x', agentId: AGENT, query: 'hours' })).rejects.toMatchObject({ status: 400 })
  })
})

describe('hasReadyKnowledge', () => {
  it('checks for a ready document and caches the answer', async () => {
    mocks.limit.mockResolvedValue({ data: [{ id: 'd1' }], error: null })
    expect(await hasReadyKnowledge(AGENT)).toBe(true)
    expect(await hasReadyKnowledge(AGENT)).toBe(true)
    expect(mocks.limit).toHaveBeenCalledTimes(1)

    await invalidateKnowledgeCache(AGENT)
    mocks.limit.mockResolvedValue({ data: [], error: null })
    expect(await hasReadyKnowledge(AGENT)).toBe(false)
  })

  it('answers false on database errors without caching them', async () => {
    mocks.limit.mockResolvedValue({ data: null, error: { code: '500', message: 'boom' } })
    const spy = vi.spyOn(console, 'error').mockImplementation(() => undefined)
    expect(await hasReadyKnowledge(AGENT)).toBe(false)
    expect(mocks.kv.size).toBe(0)
    spy.mockRestore()
    expect(await hasReadyKnowledge('not-a-uuid')).toBe(false)
  })
})
