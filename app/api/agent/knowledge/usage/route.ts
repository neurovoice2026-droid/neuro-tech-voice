// GET /api/agent/knowledge/usage → the organization's knowledge budgets:
//   { bytes_used, bytes_limit, documents, documents_limit, prompt_chars_used,
//     prompt_chars_limit, prompt_doc_max_bytes, websites, websites_limit,
//     crawl_max_pages }
// Organization-level numbers only (the shared workspace quota is never shown).

import { NextResponse } from 'next/server'
import { requireOrg } from '@/lib/api/auth'
import { RequestError, errorResponse, requestErrorResponse } from '@/lib/api/http'
import { createLogger, requestIdFrom } from '@/lib/observability/logger'
import { KNOWLEDGE_MAX_DOCS_PER_AGENT } from '@/lib/voice-providers/knowledge'
import { KNOWLEDGE_MAX_WEBSITES, crawlMaxPages, orgKnowledgeUsage, promptDocMaxBytes } from '@/lib/voice-providers/knowledge-limits'

export async function GET(request: Request) {
  const requestId = requestIdFrom(request)
  let log = createLogger({ requestId, route: 'agent.knowledge.usage' })
  try {
    const { supabase, org } = await requireOrg()
    log = log.child({ orgId: org.id })
    const usage = await orgKnowledgeUsage(supabase, org.id, KNOWLEDGE_MAX_DOCS_PER_AGENT)
    return NextResponse.json(
      {
        bytes_used: usage.bytesUsed,
        bytes_limit: usage.bytesLimit,
        documents: usage.documents,
        documents_limit: usage.documentsLimit,
        prompt_chars_used: usage.promptChars,
        prompt_chars_limit: usage.promptCharsLimit,
        prompt_doc_max_bytes: promptDocMaxBytes(),
        websites: usage.websites,
        websites_limit: KNOWLEDGE_MAX_WEBSITES,
        crawl_max_pages: crawlMaxPages(),
      },
      { headers: { 'Cache-Control': 'no-store' } },
    )
  } catch (err) {
    if (err instanceof RequestError) return requestErrorResponse(err, requestId)
    return errorResponse(err, log, 'agent.knowledge.usage_failed', requestId)
  }
}
