import { NextResponse, after } from 'next/server'
import { z } from 'zod'
import { getOrgAgent, requireOrgAgent, requireOrgContext } from '@/lib/api/auth'
import { ApiError, handleRoute, noStore, parseJson, zUuid } from '@/lib/api/http'
import {
  KNOWLEDGE_DOCUMENT_COLUMNS,
  assertDocumentCapacity,
  cleanDocumentName,
  isMissingSchemaError,
  listAgentDocuments,
  listResponse,
  loadDocument,
  requireKnowledgeAdmin,
  toDocumentView,
  uploadedFileType,
  withDocumentDefaults,
} from '@/lib/knowledge/documents'
import { INGEST_LOCK_SECONDS, ingestKnowledgeDocument } from '@/lib/knowledge/ingest'
import { ingestLockKey, tryAcquireLock } from '@/lib/knowledge/lock'
import { KNOWLEDGE_BUCKET, KNOWLEDGE_MAX_FILE_BYTES, formatMegabytes } from '@/lib/knowledge/shared'
import { RATE_LIMITS, enforceRateLimit } from '@/lib/security/rate-limit'
import type { KnowledgeDocument } from '@/types'

export const runtime = 'nodejs'
// Reading, embedding and copying a document runs in after() within this budget.
export const maxDuration = 60

/** GET: the agent's documents with status, counts and provider copies. */
export const GET = handleRoute(async () => {
  const ctx = await requireOrgContext()
  const agent = await getOrgAgent(ctx)
  if (!agent) return noStore(NextResponse.json(listResponse([])))
  const documents = await listAgentDocuments(ctx.supabase, ctx.org.id, agent.id)
  return noStore(NextResponse.json(listResponse(documents)))
})

const registerSchema = z.object({
  storage_path: z.string().min(1).max(512),
  name: z.string().trim().min(1).max(255),
  replaces_document_id: zUuid.nullish(),
})

/**
 * POST: registers a file the browser uploaded to the signed URL from
 * /upload-url, then reads and indexes it in the background.
 */
export const POST = handleRoute(async (req) => {
  const ctx = await requireOrgContext()
  await enforceRateLimit(RATE_LIMITS.apiWrite, ctx.user.id)
  const body = await parseJson(req, registerSchema)
  const agent = await requireOrgAgent(ctx)
  const admin = requireKnowledgeAdmin()

  // Only a path we issued for this org and agent: nobody can register another org's object.
  const type = uploadedFileType(body.storage_path, ctx.org.id, agent.id)
  if (!type) throw new ApiError(400, 'invalid_upload', 'This upload isn’t valid. Please upload the file again.')

  // An upload that is refused below would otherwise stay in storage unused.
  const discardUpload = async () => {
    const { error } = await admin.storage.from(KNOWLEDGE_BUCKET).remove([body.storage_path])
    if (error) console.warn('[knowledge] refused upload not removed', error.message)
  }

  let replaced: KnowledgeDocument | null = null
  if (body.replaces_document_id) {
    replaced = await loadDocument(admin, ctx.org.id, body.replaces_document_id)
    if (!replaced || replaced.agent_id !== agent.id) {
      await discardUpload()
      throw new ApiError(404, 'document_not_found', 'The document you’re replacing no longer exists.')
    }
    if (replaced.type === 'url') {
      await discardUpload()
      throw new ApiError(400, 'invalid_replacement', 'Web pages are updated with Refresh rather than replaced by a file.')
    }
  }

  const { data: existing, error: existingError } = await admin
    .from('knowledge_documents')
    .select('id')
    .eq('org_id', ctx.org.id)
    .eq('storage_path', body.storage_path)
    .limit(1)
  if (existingError) {
    console.error('[knowledge] duplicate check failed', existingError.code, existingError.message)
    throw new ApiError(500, 'knowledge_unavailable', 'We couldn’t add this document. Please try again.')
  }
  if ((existing ?? []).length > 0) {
    throw new ApiError(409, 'already_added', 'This upload has already been added.')
  }
  await assertDocumentCapacity(admin, ctx.org.id, agent.id, replaced ? 1 : 0).catch(async (error: unknown) => {
    await discardUpload()
    throw error
  })

  const { data: info, error: infoError } = await admin.storage.from(KNOWLEDGE_BUCKET).info(body.storage_path)
  if (infoError || !info) {
    throw new ApiError(400, 'upload_missing', 'We couldn’t find the uploaded file. Please upload it again.')
  }
  const size = typeof info.size === 'number' ? info.size : 0
  if (size > KNOWLEDGE_MAX_FILE_BYTES) {
    await discardUpload()
    throw new ApiError(413, 'file_too_large', `Files can be up to ${formatMegabytes(KNOWLEDGE_MAX_FILE_BYTES)}.`)
  }
  if (size === 0) {
    await discardUpload()
    throw new ApiError(400, 'empty_file', 'This file is empty.')
  }

  // Columns that exist before migration 010 too; the pipeline fills the rest.
  const { data: row, error: insertError } = await admin
    .from('knowledge_documents')
    .insert({
      org_id: ctx.org.id,
      agent_id: agent.id,
      name: cleanDocumentName(body.name) || 'Untitled document',
      type,
      storage_path: body.storage_path,
      size_bytes: size,
      status: 'processing',
    })
    .select(KNOWLEDGE_DOCUMENT_COLUMNS)
    .single()
  if (insertError || !row) {
    console.error('[knowledge] document insert failed', insertError?.code, insertError?.message)
    await discardUpload()
    if (isMissingSchemaError(insertError)) {
      throw new ApiError(503, 'not_configured', 'The knowledge base needs a database update before it can read documents.')
    }
    throw new ApiError(500, 'knowledge_unavailable', 'We couldn’t add this document. Please try again.')
  }

  const doc = withDocumentDefaults(row as unknown as Record<string, unknown>)
  const lockAcquired = await tryAcquireLock(ingestLockKey(doc.id), INGEST_LOCK_SECONDS)
  after(() =>
    ingestKnowledgeDocument({
      orgId: ctx.org.id,
      documentId: doc.id,
      previousStatus: null,
      replacesDocumentId: replaced?.id ?? null,
      lockAcquired,
    })
  )
  return noStore(NextResponse.json(toDocumentView(doc), { status: 201 }))
})
