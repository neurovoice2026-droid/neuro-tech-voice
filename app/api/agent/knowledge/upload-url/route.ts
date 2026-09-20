import { randomUUID } from 'node:crypto'
import { NextResponse } from 'next/server'
import { z } from 'zod'
import { requireOrgAgent, requireOrgContext } from '@/lib/api/auth'
import { ApiError, handleRoute, noStore, parseJson, zUuid } from '@/lib/api/http'
import {
  assertDocumentCapacity,
  knowledgeStoragePrefix,
  loadDocument,
  requireKnowledgeAdmin,
  safeStorageFileName,
} from '@/lib/knowledge/documents'
import {
  KNOWLEDGE_BUCKET,
  KNOWLEDGE_FILE_TYPES,
  knowledgeFileTypeFromName,
  validateKnowledgeFile,
  type KnowledgeUploadTarget,
} from '@/lib/knowledge/shared'
import { RATE_LIMITS, enforceRateLimit } from '@/lib/security/rate-limit'

export const runtime = 'nodejs'

const bodySchema = z.object({
  name: z.string().trim().min(1).max(255),
  size: z.number().int().nonnegative(),
  type: z.string().max(255).optional().default(''),
  /** Uploading a new version of this document (it doesn't count against the document limit). */
  replaces_document_id: zUuid.nullish(),
})

/**
 * POST: a one-time signed upload URL so the browser sends the file straight
 * to Supabase Storage (Vercel caps request bodies at 4.5 MB; files may be 10 MB).
 * The bucket itself enforces the 10 MB limit and the allowed types.
 */
export const POST = handleRoute(async (req) => {
  const ctx = await requireOrgContext()
  await enforceRateLimit(RATE_LIMITS.apiWrite, ctx.user.id)
  const body = await parseJson(req, bodySchema)

  const problem = validateKnowledgeFile(body)
  const fileType = knowledgeFileTypeFromName(body.name)
  if (problem || !fileType) {
    throw new ApiError(400, 'unsupported_file', problem ?? 'Upload a PDF, Word (.docx), .txt or .md file.')
  }

  const agent = await requireOrgAgent(ctx)
  const admin = requireKnowledgeAdmin()
  let replacing = false
  if (body.replaces_document_id) {
    const replaced = await loadDocument(admin, ctx.org.id, body.replaces_document_id)
    if (!replaced || replaced.agent_id !== agent.id) {
      throw new ApiError(404, 'document_not_found', 'The document you’re replacing no longer exists.')
    }
    // Checked here too so the file isn't uploaded only to be refused when it's registered.
    if (replaced.type === 'url') {
      throw new ApiError(400, 'invalid_replacement', 'Web pages are updated with Refresh rather than replaced by a file.')
    }
    replacing = true
  }
  await assertDocumentCapacity(admin, ctx.org.id, agent.id, replacing ? 1 : 0)
  // Each file is counted once, here: registering the upload afterwards is free,
  // so a limit is never hit after the bytes are already in storage.
  await enforceRateLimit(RATE_LIMITS.knowledgeWrite, ctx.org.id)

  const path = `${knowledgeStoragePrefix(ctx.org.id, agent.id)}${randomUUID()}-${safeStorageFileName(body.name, fileType)}`
  const { data, error } = await admin.storage.from(KNOWLEDGE_BUCKET).createSignedUploadUrl(path)
  if (error || !data) {
    console.error('[knowledge] signed upload url failed', error?.message)
    throw new ApiError(502, 'storage_unavailable', 'We couldn’t prepare the upload. Please try again in a moment.')
  }

  const target: KnowledgeUploadTarget = {
    path: data.path,
    signed_url: data.signedUrl,
    token: data.token,
    content_type: KNOWLEDGE_FILE_TYPES[fileType].contentType,
  }
  return noStore(NextResponse.json(target))
})
