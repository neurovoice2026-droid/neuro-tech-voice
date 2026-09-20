// ─── Knowledge base retrieval ────────────────────────────────────────────────
// ElevenLabs hosted the knowledge base and did retrieval invisibly, so the app
// only ever stored a document id. Fish Audio and Telnyx have no equivalent, so
// retrieval is ours: embed the caller's turn, search pgvector, hand the best
// chunks to the model as context.

import { createAdminClient } from '@/lib/supabase/admin'

/**
 * text-embedding-3-small at 1536 dimensions.
 *
 * The width is pinned in migration 010's `vector(1536)` column, so changing
 * this model means altering that column and re-embedding every document —
 * it is not a drop-in swap.
 */
export const EMBEDDING_MODEL = 'text-embedding-3-small'
export const EMBEDDING_DIMS = 1536

const DEFAULT_BASE_URL = 'https://api.openai.com/v1'

export async function embed(input: string | string[]): Promise<number[][]> {
  const base = process.env.LLM_BASE_URL ?? DEFAULT_BASE_URL
  const res = await fetch(`${base}/embeddings`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${process.env.LLM_API_KEY!}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: EMBEDDING_MODEL,
      input: Array.isArray(input) ? input : [input],
    }),
  })

  if (!res.ok) {
    throw new Error(`Embedding request failed ${res.status}: ${await res.text()}`)
  }

  const json = (await res.json()) as { data: Array<{ embedding: number[]; index: number }> }
  // The API does not guarantee ordering, and a silently mis-ordered batch
  // attaches every chunk's text to its neighbour's vector.
  return json.data.sort((a, b) => a.index - b.index).map((d) => d.embedding)
}

/**
 * Fetch context for one conversational turn.
 *
 * Returns plain strings rather than scored rows because the caller only pastes
 * them into a prompt. Failures return an empty array instead of throwing —
 * an agent answering without its knowledge base is degraded, but an agent that
 * drops the call because a vector search timed out is broken.
 */
export async function retrieveContext(
  agentId: string,
  query: string,
  opts: { matchCount?: number; minSimilarity?: number } = {}
): Promise<string[]> {
  try {
    const [vector] = await embed(query)
    const supabase = createAdminClient()

    const { data, error } = await supabase.rpc('match_knowledge_chunks', {
      p_agent_id: agentId,
      p_embedding: vector,
      p_match_count: opts.matchCount ?? 5,
      p_min_similarity: opts.minSimilarity ?? 0.3,
    })

    if (error) {
      console.error('Knowledge retrieval failed:', error.message)
      return []
    }

    return ((data ?? []) as Array<{ content: string }>).map((r) => r.content)
  } catch (err) {
    console.error('Knowledge retrieval failed:', err instanceof Error ? err.message : err)
    return []
  }
}

// ─── Ingestion ───────────────────────────────────────────────────────────────

/**
 * Split text for embedding.
 *
 * Chunks overlap so a fact spanning a boundary survives in at least one of
 * them; without overlap, the sentence that happens to straddle the cut is
 * effectively unsearchable. Paragraph boundaries are preferred over a hard
 * character count because they usually mark a topic change.
 */
export function chunkText(text: string, maxChars = 1200, overlap = 200): string[] {
  const clean = text.replace(/\r\n/g, '\n').replace(/\n{3,}/g, '\n\n').trim()
  if (!clean) return []
  if (clean.length <= maxChars) return [clean]

  const chunks: string[] = []
  let start = 0

  while (start < clean.length) {
    let end = Math.min(start + maxChars, clean.length)

    if (end < clean.length) {
      // Prefer a paragraph break, then a sentence end, then a space — but only
      // if it lands in the last third, otherwise the chunk gets too short.
      const window = clean.slice(start, end)
      const floor = Math.floor(maxChars * 0.6)
      const para = window.lastIndexOf('\n\n')
      const sentence = Math.max(window.lastIndexOf('. '), window.lastIndexOf('! '), window.lastIndexOf('? '))
      const space = window.lastIndexOf(' ')

      if (para > floor) end = start + para
      else if (sentence > floor) end = start + sentence + 1
      else if (space > floor) end = start + space
    }

    const chunk = clean.slice(start, end).trim()
    if (chunk) chunks.push(chunk)

    if (end >= clean.length) break
    start = Math.max(start + 1, end - overlap)
  }

  return chunks
}

/**
 * Chunk, embed and store a document. Replaces any chunks it already had, so
 * re-ingesting an updated document does not leave stale text searchable.
 */
export async function ingestDocument(params: {
  documentId: string
  agentId: string
  orgId: string
  text: string
}): Promise<{ chunkCount: number }> {
  const supabase = createAdminClient()
  const chunks = chunkText(params.text)

  await supabase.from('knowledge_chunks').delete().eq('document_id', params.documentId)

  if (!chunks.length) {
    await supabase
      .from('knowledge_documents')
      .update({ status: 'ready', chunk_count: 0, embedded_at: new Date().toISOString() })
      .eq('id', params.documentId)
    return { chunkCount: 0 }
  }

  // Batched so a large document does not become one enormous request that
  // fails as a unit.
  const BATCH = 64
  for (let i = 0; i < chunks.length; i += BATCH) {
    const slice = chunks.slice(i, i + BATCH)
    const vectors = await embed(slice)
    const { error } = await supabase.from('knowledge_chunks').insert(
      slice.map((content, j) => ({
        document_id: params.documentId,
        agent_id: params.agentId,
        org_id: params.orgId,
        content,
        chunk_index: i + j,
        token_count: Math.ceil(content.length / 4),
        embedding: vectors[j],
      }))
    )
    if (error) throw new Error(`Failed to store chunks: ${error.message}`)
  }

  await supabase
    .from('knowledge_documents')
    .update({
      status: 'ready',
      chunk_count: chunks.length,
      character_count: params.text.length,
      embedded_at: new Date().toISOString(),
    })
    .eq('id', params.documentId)

  return { chunkCount: chunks.length }
}
