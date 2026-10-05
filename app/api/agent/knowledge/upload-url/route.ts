// POST /api/agent/knowledge/upload-url  { name, size, mime }
//   → 201 { document: KnowledgeDocument, upload: { path, token, signedUrl } }
//
// Step 1 of a file upload. Vercel caps request bodies at 4.5 MB, so the browser
// uploads the file straight to Supabase Storage with this one-time signed URL
// (storage.from('knowledge-documents').uploadToSignedUrl(path, token, file)),
// then calls POST /api/agent/knowledge/[docId]/process. The path is built here,
// inside the org's own folder; nothing about it comes from the browser except
// the (sanitized) file name.

import { NextResponse } from 'next/server'
import { z } from 'zod'
import { requireOrg } from '@/lib/api/auth'
import { RequestError, assertSameOrigin, errorResponse, parseJsonBody, requestErrorResponse } from '@/lib/api/http'
import { createLogger, requestIdFrom } from '@/lib/observability/logger'
import { RATE_LIMITS, enforceRateLimit } from '@/lib/security/rate-limit'
import { createAdminClient } from '@/lib/supabase/admin'
import { defaultAgentName, ensureAgent } from '@/lib/agents/ensure-agent'
import {
  KNOWLEDGE_BUCKET,
  KNOWLEDGE_DOC_COLUMNS,
  KNOWLEDGE_MAX_FILE_BYTES,
  KNOWLEDGE_MAX_NAME_CHARS,
  KNOWLEDGE_TYPES_LABEL,
  assertDocumentCapacity,
  cleanDisplayName,
  newDocumentId,
  resolveFileType,
  safeFileName,
  storagePathFor,
  toDocumentView,
  type KnowledgeDocumentRow,
} from '@/lib/voice-providers/knowledge'

const BodySchema = z.object({
  name: z.string().trim().min(1, 'The file needs a name.').max(KNOWLEDGE_MAX_NAME_CHARS, 'The file name is too long.'),
  size: z.number().int().min(1, 'The file is empty.'),
  mime: z.string().max(200).default(''),
})

export async function POST(request: Request) {
  const requestId = requestIdFrom(request)
  let log = createLogger({ requestId, route: 'agent.knowledge.upload_url' })
  try {
    assertSameOrigin(request)
    const { supabase, org } = await requireOrg()
    log = log.child({ orgId: org.id })
    await enforceRateLimit(RATE_LIMITS.knowledgeUpload, org.id, 'Too many uploads. Please wait a while and try again.')

    const body = await parseJsonBody(request, BodySchema)
    if (body.size > KNOWLEDGE_MAX_FILE_BYTES) {
      throw new RequestError('payload_too_large', 'Files can be up to 20 MB.', 413)
    }
    const name = cleanDisplayName(body.name)
    const type = resolveFileType(body.name, body.mime)
    if (!name || !type) {
      throw new RequestError('unsupported_media_type', `Unsupported file type. Use ${KNOWLEDGE_TYPES_LABEL}.`, 415)
    }

    const agent = await ensureAgent(org.id, defaultAgentName(org.name))
    log = log.child({ agentId: agent.id })
    await assertDocumentCapacity(supabase, org.id, agent.id)

    const id = newDocumentId()
    const storagePath = storagePathFor(org.id, agent.id, id, safeFileName(name, type.ext))
    const { data: row, error: insertErr } = await supabase
      .from('knowledge_documents')
      .insert({
        id,
        agent_id: agent.id,
        org_id: org.id,
        name,
        type: type.kind,
        storage_path: storagePath,
        size_bytes: body.size,
        mime_type: type.mime,
        status: 'processing',
      })
      .select(KNOWLEDGE_DOC_COLUMNS)
      .single()
    if (insertErr || !row) throw new Error(`knowledge_documents insert failed: ${insertErr?.message ?? 'no row returned'}`)

    // The path is ours (org folder), so the service-role client is scoped by construction.
    const { data: signed, error: signErr } = await createAdminClient()
      .storage.from(KNOWLEDGE_BUCKET)
      .createSignedUploadUrl(storagePath)
    if (signErr || !signed) {
      log.error('agent.knowledge.signed_url_failed', signErr, { docId: id })
      const { error: cleanupErr } = await supabase.from('knowledge_documents').delete().eq('id', id).eq('org_id', org.id)
      if (cleanupErr) log.error('agent.knowledge.row_cleanup_failed', cleanupErr, { docId: id })
      throw new RequestError('internal', 'Could not prepare the upload. Please try again.', 500)
    }

    log.info('agent.knowledge.upload_url', { docId: id, type: type.kind, bytes: body.size })
    return NextResponse.json(
      {
        document: toDocumentView(row as unknown as KnowledgeDocumentRow),
        upload: { path: signed.path, token: signed.token, signedUrl: signed.signedUrl },
      },
      { status: 201, headers: { 'Cache-Control': 'no-store' } },
    )
  } catch (err) {
    if (err instanceof RequestError) return requestErrorResponse(err, requestId)
    return errorResponse(err, log, 'agent.knowledge.upload_url_failed', requestId)
  }
}
