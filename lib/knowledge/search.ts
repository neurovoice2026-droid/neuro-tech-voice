import 'server-only'
import { ApiError } from '@/lib/api/http'
import { kvDel, kvGet, kvSet } from '@/lib/kv'
import { EMBEDDING_DIMENSIONS, getOpenAI, openAIEmbeddingModel } from '@/lib/openai/client'
import { createAdminClient } from '@/lib/supabase/admin'
import type { KnowledgeSourceRef } from '@/types'
import { isMissingSchemaError } from './documents'
import { KNOWLEDGE_MAX_QUERY_LENGTH } from './shared'
import { splitSentenceRanges, truncateText } from './text'

// Knowledge search for the voice agent's search_knowledge tool (S3) and the
// dashboard's "Ask your documents" box. The query is embedded, the closest
// chunks come from match_knowledge_chunks (service role, filtered by org and
// agent, ready documents only), and results are shaped for a voice model:
// the best passage per document, at most 1,200 characters, with a short
// excerpt recorded as the "answered from" source.

export const MIN_SIMILARITY = 0.25
export const MAX_PASSAGE_CHARS = 1200
export const EXCERPT_CHARS = 160
const DEFAULT_MATCH_COUNT = 5
const MAX_MATCH_COUNT = 10
const READY_CACHE_SECONDS = 60
/**
 * A caller is waiting on the answer (the voice tool has an 8 s budget), so the
 * question is embedded in one attempt with a short timeout instead of
 * embedTexts' 30 s timeout and retry, which suit background ingestion.
 */
export const QUERY_EMBEDDING_TIMEOUT_MS = 5_000

export interface MatchedChunkRow {
  chunk_id: string
  document_id: string
  document_name: string
  heading: string | null
  content: string
  similarity: number
}

export interface KnowledgePassage extends KnowledgeSourceRef {
  heading: string | null
  /** Best part of the chunk for the query, ≤ 1,200 characters including the heading line. */
  content: string
}

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

function fold(text: string): string {
  return text.normalize('NFKD').replace(/[\u0300-\u036f]/g, '').toLowerCase()
}

/** Query words worth matching (≥ 3 letters), plus CJK bigrams since those scripts have no spaces. */
export function queryTerms(query: string): string[] {
  const terms = new Set<string>()
  for (const word of fold(query).split(/[^\p{L}\p{N}]+/u)) {
    if (!word) continue
    if (/[\u3040-\u30ff\u3400-\u9fff\uac00-\ud7af]/.test(word)) {
      const chars = Array.from(word)
      if (chars.length === 1) terms.add(word)
      for (let i = 0; i < chars.length - 1; i++) terms.add(chars[i] + chars[i + 1])
    } else if (word.length >= 3 || /^\d+$/.test(word)) {
      terms.add(word)
    }
  }
  return [...terms]
}

/**
 * The window of whole sentences (≤ maxChars) that mentions the most query
 * terms. Semantic matches with no shared words fall back to the start of the
 * chunk, where the chunker put the section's first sentences.
 */
export function bestPassage(content: string, query: string, maxChars: number): string {
  const text = content.trim()
  if (text.length <= maxChars) return text

  const ranges = splitSentenceRanges(text)
  const terms = queryTerms(query)
  const scores = ranges.map(([start, end]) => {
    const sentence = fold(text.slice(start, end))
    return terms.reduce((score, term) => score + (sentence.includes(term) ? 1 : 0), 0)
  })

  let bestStart = 0
  let bestEnd = 0
  let bestScore = -1
  for (let i = 0; i < ranges.length; i++) {
    let score = 0
    let j = i
    // Leave room for the two ellipses a middle window gets.
    while (j < ranges.length && ranges[j][1] - ranges[i][0] <= maxChars - 2) {
      score += scores[j]
      j++
    }
    if (j === i) continue
    if (score > bestScore) {
      bestScore = score
      bestStart = i
      bestEnd = j - 1
    }
    if (terms.length === 0) break
  }

  if (bestScore <= 0 || bestEnd < bestStart) return truncateText(text, maxChars)
  const from = ranges[bestStart][0]
  const to = ranges[bestEnd][1]
  const prefix = from > 0 ? '…' : ''
  const suffix = to < text.length ? '…' : ''
  return `${prefix}${text.slice(from, to)}${suffix}`
}

export function makeExcerpt(passage: string): string {
  return truncateText(passage.replace(/^…/, '').replace(/\s+/g, ' '), EXCERPT_CHARS)
}

/** Sorts by similarity, drops weak matches, keeps the best chunk per document and trims it for the model. */
export function shapeSearchResults(
  rows: MatchedChunkRow[],
  query: string,
  opts: { matchCount?: number; minSimilarity?: number } = {}
): KnowledgePassage[] {
  const matchCount = Math.min(MAX_MATCH_COUNT, Math.max(1, Math.floor(opts.matchCount ?? DEFAULT_MATCH_COUNT)))
  const minSimilarity = opts.minSimilarity ?? MIN_SIMILARITY
  const seen = new Set<string>()
  const passages: KnowledgePassage[] = []

  const sorted = rows
    .filter((row) => typeof row.similarity === 'number' && Number.isFinite(row.similarity) && row.similarity >= minSimilarity)
    .filter((row) => typeof row.content === 'string' && row.content.trim() !== '')
    .sort((a, b) => b.similarity - a.similarity)

  for (const row of sorted) {
    if (seen.has(row.document_id)) continue
    seen.add(row.document_id)
    const heading = row.heading?.trim() ? truncateText(row.heading.trim(), 120) : null
    const budget = MAX_PASSAGE_CHARS - (heading ? heading.length + 1 : 0)
    const passage = bestPassage(row.content, query, budget)
    passages.push({
      document_id: row.document_id,
      document_name: row.document_name,
      chunk_id: row.chunk_id,
      excerpt: makeExcerpt(passage),
      similarity: Math.round(row.similarity * 1000) / 1000,
      heading,
      content: passage,
    })
    if (passages.length >= matchCount) break
  }
  return passages
}

/** Embeds a search question. Throws ApiError 503 not_configured without OpenAI. */
export async function embedQuery(query: string): Promise<number[]> {
  const client = getOpenAI()
  const model = openAIEmbeddingModel()
  const res = await client.embeddings.create(
    {
      model,
      input: query,
      encoding_format: 'float',
      // Same dimensions as the stored chunks (knowledge_chunks.embedding is vector(1536)).
      ...(model.startsWith('text-embedding-3') ? { dimensions: EMBEDDING_DIMENSIONS } : {}),
    },
    { timeout: QUERY_EMBEDDING_TIMEOUT_MS }
  )
  const vector = res.data[0]?.embedding
  if (!Array.isArray(vector) || vector.length !== EMBEDDING_DIMENSIONS) {
    throw new Error(`Query embedding has ${Array.isArray(vector) ? vector.length : 0} dimensions; expected ${EMBEDDING_DIMENSIONS}`)
  }
  return vector
}

/** Passages with their heading kept separately (dashboard search test). */
export async function searchKnowledgePassages(input: {
  orgId: string
  agentId: string
  query: string
  matchCount?: number
}): Promise<KnowledgePassage[]> {
  const query = input.query.replace(/\s+/g, ' ').trim().slice(0, KNOWLEDGE_MAX_QUERY_LENGTH)
  if (!query) return []
  if (!UUID_REGEX.test(input.orgId) || !UUID_REGEX.test(input.agentId)) {
    throw new ApiError(400, 'validation_error', 'Invalid organization or agent id.')
  }
  const matchCount = Math.min(MAX_MATCH_COUNT, Math.max(1, Math.floor(input.matchCount ?? DEFAULT_MATCH_COUNT)))

  const embedding = await embedQuery(query)
  const { data, error } = await createAdminClient().rpc('match_knowledge_chunks', {
    p_org_id: input.orgId,
    p_agent_id: input.agentId,
    p_embedding: embedding,
    // Extra candidates so one long document can't crowd out the others after de-duplication.
    p_match_count: Math.min(50, matchCount * 4),
    p_min_similarity: MIN_SIMILARITY,
  })
  if (error) {
    console.error('[knowledge] match_knowledge_chunks failed', error.code, error.message)
    if (isMissingSchemaError(error)) {
      throw new ApiError(503, 'not_configured', 'Knowledge search isn’t available yet.')
    }
    throw new Error('Knowledge search failed')
  }
  return shapeSearchResults((data ?? []) as MatchedChunkRow[], query, { matchCount })
}

/**
 * Binding signature for the search_knowledge tool: the source reference plus
 * the passage text, headed by its section when there is one.
 */
export async function searchKnowledge(input: {
  orgId: string
  agentId: string
  query: string
  matchCount?: number
}): Promise<(KnowledgeSourceRef & { content: string })[]> {
  const passages = await searchKnowledgePassages(input)
  return passages.map((p) => ({
    document_id: p.document_id,
    document_name: p.document_name,
    chunk_id: p.chunk_id,
    excerpt: p.excerpt,
    similarity: p.similarity,
    content: p.heading ? `${p.heading}\n${p.content}` : p.content,
  }))
}

function readyCacheKey(agentId: string): string {
  return `kb:ready:${agentId}`
}

/** Whether the agent has at least one searchable document (enables the search_knowledge tool). Cached 60 s. */
export async function hasReadyKnowledge(agentId: string): Promise<boolean> {
  if (!UUID_REGEX.test(agentId)) return false
  const cached = await kvGet<{ ready: boolean }>(readyCacheKey(agentId))
  if (cached && typeof cached.ready === 'boolean') return cached.ready

  const { data, error } = await createAdminClient()
    .from('knowledge_documents')
    .select('id')
    .eq('agent_id', agentId)
    .eq('status', 'ready')
    .gt('chunk_count', 0)
    .limit(1)
  if (error) {
    // Without the tool the agent uses its fallback line; don't cache a failure.
    console.error('[knowledge] ready check failed', error.code, error.message)
    return false
  }
  const ready = (data ?? []).length > 0
  await kvSet(readyCacheKey(agentId), { ready }, READY_CACHE_SECONDS)
  return ready
}

/** Call after a document becomes ready, is deleted or changes status. */
export async function invalidateKnowledgeCache(agentId: string): Promise<void> {
  await kvDel(readyCacheKey(agentId))
}
