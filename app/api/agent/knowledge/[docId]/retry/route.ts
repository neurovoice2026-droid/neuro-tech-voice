// POST /api/agent/knowledge/[docId]/retry → KnowledgeDocument
//
// Re-runs a document that is not (yet) on the agent: failed documents, runs
// abandoned mid-way (processing for over 5 minutes), and documents that were
// uploaded but never attached (re-synced; re-uploaded from the stored source
// when the provider no longer has them). 409 while a run is in progress; a
// document already attached is returned unchanged.

import { NextResponse } from 'next/server'
import { requireOrg } from '@/lib/api/auth'
import { RequestError, assertSameOrigin, errorResponse, requestErrorResponse } from '@/lib/api/http'
import { createLogger, requestIdFrom } from '@/lib/observability/logger'
import { RATE_LIMITS, enforceRateLimit } from '@/lib/security/rate-limit'
import { parseDocId, processDocument, toDocumentView } from '@/lib/voice-providers/knowledge'

export const maxDuration = 120

export async function POST(request: Request, { params }: { params: Promise<{ docId: string }> }) {
  const requestId = requestIdFrom(request)
  let log = createLogger({ requestId, route: 'agent.knowledge.retry' })
  try {
    assertSameOrigin(request)
    const { supabase, org } = await requireOrg()
    log = log.child({ orgId: org.id })
    const docId = parseDocId((await params).docId)

    // Ownership check under RLS before any service-role work.
    const { data: doc, error } = await supabase
      .from('knowledge_documents')
      .select('id')
      .eq('id', docId)
      .eq('org_id', org.id)
      .maybeSingle()
    if (error) throw new Error(`knowledge_documents read failed: ${error.message}`)
    if (!doc) throw new RequestError('not_found', 'Document not found.', 404)

    // A retry re-uploads to the provider: it counts against the upload budget.
    await enforceRateLimit(RATE_LIMITS.knowledgeUpload, org.id, 'Too many uploads. Please wait a while and try again.')

    const processed = await processDocument(org.id, docId, log, { mode: 'retry' })
    return NextResponse.json(toDocumentView(processed), { headers: { 'Cache-Control': 'no-store' } })
  } catch (err) {
    if (err instanceof RequestError) return requestErrorResponse(err, requestId)
    return errorResponse(err, log, 'agent.knowledge.retry_failed', requestId)
  }
}
