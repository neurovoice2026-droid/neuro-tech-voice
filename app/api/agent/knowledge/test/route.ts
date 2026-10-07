// POST /api/agent/knowledge/test { query } → { chunks: TestChunk[], dropped: number }
//
// "Test your knowledge base": the passages the organization's own agent would
// retrieve for a question (provider RAG query, no conversation and no call).
// The agent is resolved on the server; passages of anything that is not one of
// the organization's documents or imported websites are dropped.

import { NextResponse } from 'next/server'
import { z } from 'zod'
import { requireOrg } from '@/lib/api/auth'
import { RequestError, assertSameOrigin, errorResponse, parseJsonBody, requestErrorResponse } from '@/lib/api/http'
import { createLogger, requestIdFrom } from '@/lib/observability/logger'
import { enforceRateLimit } from '@/lib/security/rate-limit'
import { KNOWLEDGE_RATE_LIMITS } from '@/lib/voice-providers/knowledge-limits'
import { TEST_QUERY_MAX_CHARS, testKnowledge } from '@/lib/voice-providers/knowledge-test'

export const maxDuration = 30

const BodySchema = z.strictObject({
  query: z
    .string()
    .trim()
    .min(2, 'Type a question.')
    .max(TEST_QUERY_MAX_CHARS, `Questions can be up to ${TEST_QUERY_MAX_CHARS} characters.`)
    .refine((q) => !q.includes('\u0000'), 'The question contains invalid characters.'),
})

export async function POST(request: Request) {
  const requestId = requestIdFrom(request)
  let log = createLogger({ requestId, route: 'agent.knowledge.test' })
  try {
    assertSameOrigin(request)
    const { supabase, org } = await requireOrg()
    log = log.child({ orgId: org.id })
    const body = await parseJsonBody(request, BodySchema)
    await enforceRateLimit(KNOWLEDGE_RATE_LIMITS.test, org.id, 'Too many test questions. Please wait a while and try again.')
    const result = await testKnowledge(supabase, org.id, body.query, log)
    return NextResponse.json(result, { headers: { 'Cache-Control': 'no-store' } })
  } catch (err) {
    if (err instanceof RequestError) return requestErrorResponse(err, requestId)
    return errorResponse(err, log, 'agent.knowledge.test_failed', requestId)
  }
}
