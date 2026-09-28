import 'server-only'
import { searchKnowledge } from '@/lib/knowledge/search'
import { isOpenAIConfigured } from '@/lib/env'
import { ApiError } from '@/lib/api/http'
import { parseToolArguments } from '@/lib/voice/tools/schemas'
import { capUtf8, failure, MAX_RESULT_BYTES, success, type ToolHandler } from '@/lib/voice/tools/runtime'
import type { KnowledgeSourceRef } from '@/lib/voice/contracts'

// search_knowledge: passages from the business's own documents. The model
// answers only from them; the refs travel back on the tool response so the
// transcript can show what the answer came from.

const MATCH_COUNT = 4
const HEADER = 'Passages from the business documents, most relevant first. Answer only from these, in your own words and in the call language. If they do not answer the question, say you do not have that information (use your not-in-documents line).'

export const searchKnowledgeTool: ToolHandler = async (ctx, args) => {
  const parsed = parseToolArguments('search_knowledge', args)
  if (!parsed.ok) return failure(parsed.message)
  if (!ctx.agent) return failure('No business documents are available on this call. Say you do not have that information to hand and offer to take a message.')
  if (!isOpenAIConfigured()) {
    return failure("The business documents can't be searched right now. Say you don't have that information to hand and offer to take a message so the team can follow up.")
  }

  let passages: Awaited<ReturnType<typeof searchKnowledge>>
  try {
    passages = await searchKnowledge({ orgId: ctx.org.id, agentId: ctx.agent.id, query: parsed.data.query, matchCount: MATCH_COUNT })
  } catch (error) {
    if (!(error instanceof ApiError && error.code === 'not_configured')) {
      console.error('[tools] knowledge search failed', error instanceof Error ? error.message : error)
    }
    return failure("The business documents can't be searched right now. Apologise briefly, say you don't have that detail to hand and offer to take a message.")
  }

  if (passages.length === 0) {
    return success(
      'Nothing in the business documents matches this question. Do not guess: say you do not have that information (your not-in-documents line) and offer to take a message if appropriate.',
      { sources: [] }
    )
  }

  // Fit as many whole passages as the result budget allows, leaving room for the header.
  const encoder = new TextEncoder()
  let used = encoder.encode(HEADER).length + 64
  const blocks: string[] = []
  const sources: KnowledgeSourceRef[] = []
  for (const [index, passage] of passages.entries()) {
    const block = `\n\n[${index + 1}] ${passage.document_name}\n${passage.content.trim()}`
    const size = encoder.encode(block).length
    if (blocks.length > 0 && used + size > MAX_RESULT_BYTES) break
    blocks.push(block)
    used += size
    sources.push({
      document_id: passage.document_id,
      document_name: passage.document_name,
      chunk_id: passage.chunk_id,
      excerpt: passage.excerpt,
      similarity: passage.similarity,
    })
  }
  return success(capUtf8(`${HEADER}${blocks.join('')}`), { sources })
}
