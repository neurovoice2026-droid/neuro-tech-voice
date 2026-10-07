// POST /api/agent/knowledge/[docId]/replace  { name, size, mime }
//   → 201 { document, upload: { path, token, signedUrl } }
//
// Step 1 of replacing an uploaded file with a new version (e.g. a new price
// list) without deleting the document: a one-time signed Storage URL in the
// organization's folder. The browser uploads there, then calls
// POST /api/agent/knowledge/[docId]/replace/complete, which swaps the file at
// the provider (same document id, same agent attachment).

import { NextResponse } from 'next/server'
import { z } from 'zod'
import { requireOrg } from '@/lib/api/auth'
import { RequestError, assertSameOrigin, errorResponse, parseJsonBody, requestErrorResponse } from '@/lib/api/http'
import { createLogger, requestIdFrom } from '@/lib/observability/logger'
import { RATE_LIMITS, enforceRateLimit } from '@/lib/security/rate-limit'
import { KNOWLEDGE_MAX_NAME_CHARS, parseDocId, toDocumentView } from '@/lib/voice-providers/knowledge'
import { startFileReplacement } from '@/lib/voice-providers/knowledge-edit'

const BodySchema = z.strictObject({
  name: z.string().trim().min(1, 'The file needs a name.').max(KNOWLEDGE_MAX_NAME_CHARS, 'The file name is too long.'),
  size: z.number().int().min(1, 'The file is empty.'),
  mime: z.string().max(200).default(''),
})

export async function POST(request: Request, { params }: { params: Promise<{ docId: string }> }) {
  const requestId = requestIdFrom(request)
  let log = createLogger({ requestId, route: 'agent.knowledge.replace' })
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

    await enforceRateLimit(RATE_LIMITS.knowledgeUpload, org.id, 'Too many uploads. Please wait a while and try again.')
    const body = await parseJsonBody(request, BodySchema)
    const started = await startFileReplacement(supabase, org.id, docId, body, log)
    return NextResponse.json(
      { document: toDocumentView(started.document), upload: started.upload },
      { status: 201, headers: { 'Cache-Control': 'no-store' } },
    )
  } catch (err) {
    if (err instanceof RequestError) return requestErrorResponse(err, requestId)
    return errorResponse(err, log, 'agent.knowledge.replace_failed', requestId)
  }
}
