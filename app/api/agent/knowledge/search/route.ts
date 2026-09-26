import { NextResponse } from 'next/server'
import { z } from 'zod'
import { requireOrgAgent, requireOrgContext } from '@/lib/api/auth'
import { ApiError, handleRoute, noStore, parseSearchParams } from '@/lib/api/http'
import { isOpenAIConfigured } from '@/lib/env'
import { searchKnowledgePassages } from '@/lib/knowledge/search'
import { KNOWLEDGE_MAX_QUERY_LENGTH, type KnowledgeSearchResponse } from '@/lib/knowledge/shared'
import { enforceRateLimit, type RateLimitPolicy } from '@/lib/security/rate-limit'

export const runtime = 'nodejs'

// Each search embeds the question (a paid OpenAI call).
const SEARCH_POLICY: RateLimitPolicy = { name: 'knowledgeSearch', limit: 30, windowSeconds: 10 * 60 }

const querySchema = z.object({
  q: z
    .string()
    .trim()
    .min(2, 'Type a question to search for')
    .max(KNOWLEDGE_MAX_QUERY_LENGTH, `Keep the question under ${KNOWLEDGE_MAX_QUERY_LENGTH} characters`),
})

/** GET ?q=: the passages the agent would answer from, with document names and match strength. */
export const GET = handleRoute(async (req) => {
  const ctx = await requireOrgContext()
  const { q } = parseSearchParams(req.nextUrl, querySchema)
  if (!isOpenAIConfigured()) {
    throw new ApiError(503, 'not_configured', 'Searching your documents needs the AI service, which isn’t switched on yet.')
  }
  await enforceRateLimit(SEARCH_POLICY, ctx.org.id)
  const agent = await requireOrgAgent(ctx)

  let passages: Awaited<ReturnType<typeof searchKnowledgePassages>>
  try {
    passages = await searchKnowledgePassages({ orgId: ctx.org.id, agentId: agent.id, query: q, matchCount: 5 })
  } catch (error) {
    if (error instanceof ApiError) throw error
    console.error('[knowledge] search route failed', error instanceof Error ? error.message : String(error))
    throw new ApiError(502, 'search_failed', 'We couldn’t search your documents right now. Please try again in a moment.')
  }

  const body: KnowledgeSearchResponse = {
    query: q,
    results: passages.map((p) => ({
      chunk_id: p.chunk_id,
      document_id: p.document_id,
      document_name: p.document_name,
      heading: p.heading,
      excerpt: p.excerpt,
      content: p.content,
      similarity: p.similarity,
    })),
  }
  return noStore(NextResponse.json(body))
})
