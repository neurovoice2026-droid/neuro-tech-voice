// POST /api/agent/knowledge/[docId]/process → KnowledgeDocument
//
// Step 2 of a file upload: the browser has put the file in Storage (signed
// upload URL); the server pulls it from there, validates it, uploads it to the
// voice provider and attaches it to the org's agent. The returned document's
// status is 'ready' or 'failed' (with error_message); a settled document is
// returned unchanged, and 409 means another run is in progress.

import { NextResponse } from 'next/server'
import { requireOrg } from '@/lib/api/auth'
import { RequestError, assertSameOrigin, errorResponse, requestErrorResponse } from '@/lib/api/http'
import { createLogger, requestIdFrom } from '@/lib/observability/logger'
import { parseDocId, processDocument, toDocumentView } from '@/lib/voice-providers/knowledge'

export const maxDuration = 120

export async function POST(request: Request, { params }: { params: Promise<{ docId: string }> }) {
  const requestId = requestIdFrom(request)
  let log = createLogger({ requestId, route: 'agent.knowledge.process' })
  try {
    assertSameOrigin(request)
    const { supabase, org } = await requireOrg()
    log = log.child({ orgId: org.id })
    const docId = parseDocId((await params).docId)

    // Ownership check under RLS before any service-role work.
    const { data: doc, error } = await supabase
      .from('knowledge_documents')
      .select('id, storage_path')
      .eq('id', docId)
      .eq('org_id', org.id)
      .maybeSingle()
    if (error) throw new Error(`knowledge_documents read failed: ${error.message}`)
    if (!doc) throw new RequestError('not_found', 'Document not found.', 404)
    if (!doc.storage_path) {
      throw new RequestError('invalid_request', 'This document has no uploaded file to process.', 400)
    }

    const processed = await processDocument(org.id, docId, log, { mode: 'initial' })
    return NextResponse.json(toDocumentView(processed), { headers: { 'Cache-Control': 'no-store' } })
  } catch (err) {
    if (err instanceof RequestError) return requestErrorResponse(err, requestId)
    return errorResponse(err, log, 'agent.knowledge.process_failed', requestId)
  }
}
