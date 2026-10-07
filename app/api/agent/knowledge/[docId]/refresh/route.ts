// POST /api/agent/knowledge/[docId]/refresh → KnowledgeDocument
//
// Re-fetches a web page document now ("my website changed"). The provider
// keeps the same document id (no agent re-sync needed) and re-indexes it; the
// fallback agent's excerpt is rebuilt from the response. Rate limited: every
// refresh re-scrapes and re-embeds the page.

import { NextResponse } from 'next/server'
import { requireOrg } from '@/lib/api/auth'
import { RequestError, assertSameOrigin, errorResponse, requestErrorResponse } from '@/lib/api/http'
import { createLogger, requestIdFrom } from '@/lib/observability/logger'
import { enforceRateLimit } from '@/lib/security/rate-limit'
import { parseDocId, toDocumentView } from '@/lib/voice-providers/knowledge'
import { refreshUrlKnowledgeDocument } from '@/lib/voice-providers/knowledge-edit'
import { KNOWLEDGE_RATE_LIMITS } from '@/lib/voice-providers/knowledge-limits'

export const maxDuration = 90

export async function POST(request: Request, { params }: { params: Promise<{ docId: string }> }) {
  const requestId = requestIdFrom(request)
  let log = createLogger({ requestId, route: 'agent.knowledge.refresh' })
  try {
    assertSameOrigin(request)
    const { supabase, org } = await requireOrg()
    log = log.child({ orgId: org.id })
    const docId = parseDocId((await params).docId)
    log = log.child({ docId })

    // Ownership check under RLS before any service-role work.
    const { data: doc, error } = await supabase.from('knowledge_documents').select('id, type').eq('id', docId).eq('org_id', org.id).maybeSingle()
    if (error) throw new Error(`knowledge_documents read failed: ${error.message}`)
    if (!doc) throw new RequestError('not_found', 'Document not found.', 404)
    if (doc.type !== 'url') throw new RequestError('invalid_request', 'Only web pages can be refreshed.', 400)

    await enforceRateLimit(KNOWLEDGE_RATE_LIMITS.refresh, org.id, 'Too many refreshes. Please wait a while and try again.')
    const refreshed = await refreshUrlKnowledgeDocument(org.id, docId, log)
    return NextResponse.json(toDocumentView(refreshed), { headers: { 'Cache-Control': 'no-store' } })
  } catch (err) {
    if (err instanceof RequestError) return requestErrorResponse(err, requestId)
    return errorResponse(err, log, 'agent.knowledge.refresh_failed', requestId)
  }
}
