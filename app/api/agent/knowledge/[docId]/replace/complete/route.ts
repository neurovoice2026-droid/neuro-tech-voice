// POST /api/agent/knowledge/[docId]/replace/complete  { name? } → { document, warning }
//
// Step 2 of a file replacement: the uploaded file is validated (type, magic
// bytes, size, byte budget), swapped at the provider with PATCH update-file
// (same document id, so no re-attach), and becomes the stored source. The
// previous file is removed from Storage.

import { NextResponse } from 'next/server'
import { z } from 'zod'
import { requireOrg } from '@/lib/api/auth'
import { RequestError, assertSameOrigin, errorResponse, parseJsonBody, requestErrorResponse } from '@/lib/api/http'
import { createLogger, requestIdFrom } from '@/lib/observability/logger'
import { RATE_LIMITS, enforceRateLimit } from '@/lib/security/rate-limit'
import { KNOWLEDGE_MAX_NAME_CHARS, parseDocId, toDocumentView } from '@/lib/voice-providers/knowledge'
import { completeFileReplacement } from '@/lib/voice-providers/knowledge-edit'

export const maxDuration = 120

const BodySchema = z.strictObject({
  name: z.string().trim().min(1).max(KNOWLEDGE_MAX_NAME_CHARS).optional(),
})

export async function POST(request: Request, { params }: { params: Promise<{ docId: string }> }) {
  const requestId = requestIdFrom(request)
  let log = createLogger({ requestId, route: 'agent.knowledge.replace_complete' })
  try {
    assertSameOrigin(request)
    const { supabase, org } = await requireOrg()
    log = log.child({ orgId: org.id })
    const docId = parseDocId((await params).docId)
    log = log.child({ docId })

    // Ownership check under RLS before any service-role work.
    const { data: doc, error } = await supabase.from('knowledge_documents').select('id').eq('id', docId).eq('org_id', org.id).maybeSingle()
    if (error) throw new Error(`knowledge_documents read failed: ${error.message}`)
    if (!doc) throw new RequestError('not_found', 'Document not found.', 404)

    await enforceRateLimit(RATE_LIMITS.knowledgeProcess, org.id)
    const body = await parseJsonBody(request, BodySchema)
    const result = await completeFileReplacement(org.id, docId, body.name ?? null, log)
    return NextResponse.json({ document: toDocumentView(result.document), warning: result.warning }, { headers: { 'Cache-Control': 'no-store' } })
  } catch (err) {
    if (err instanceof RequestError) return requestErrorResponse(err, requestId)
    return errorResponse(err, log, 'agent.knowledge.replace_complete_failed', requestId)
  }
}
