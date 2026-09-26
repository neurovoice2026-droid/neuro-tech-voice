import { NextResponse, after } from 'next/server'
import { requireOrgContext } from '@/lib/api/auth'
import { ApiError, handleRoute, noStore, zUuid } from '@/lib/api/http'
import { loadDocument, requireKnowledgeAdmin, toDocumentView } from '@/lib/knowledge/documents'
import { INGEST_LOCK_SECONDS, ingestKnowledgeDocument } from '@/lib/knowledge/ingest'
import { ingestLockKey, releaseLock, tryAcquireLock } from '@/lib/knowledge/lock'
import { REFRESHING_MESSAGE } from '@/lib/knowledge/shared'
import { RATE_LIMITS, enforceRateLimit } from '@/lib/security/rate-limit'

export const runtime = 'nodejs'
export const maxDuration = 60

type Context = { params: Promise<{ docId: string }> }

/**
 * POST: reads the document again (re-fetches a page, re-processes a file) and
 * re-indexes it when its text changed. Also finishes documents that were
 * waiting for the AI service, retries failures and refreshes provider copies.
 */
export const POST = handleRoute(async (_req, ctx: Context) => {
  const org = await requireOrgContext()
  await enforceRateLimit(RATE_LIMITS.knowledgeWrite, org.org.id)
  const { docId } = await ctx.params
  const id = zUuid.safeParse(docId)
  if (!id.success) throw new ApiError(404, 'document_not_found', 'This document no longer exists.')

  const admin = requireKnowledgeAdmin()
  const doc = await loadDocument(admin, org.org.id, id.data)
  if (!doc) throw new ApiError(404, 'document_not_found', 'This document no longer exists.')

  const lockKey = ingestLockKey(doc.id)
  if (!(await tryAcquireLock(lockKey, INGEST_LOCK_SECONDS))) {
    throw new ApiError(409, 'already_processing', 'This document is already being read. It will be ready shortly.')
  }

  // A ready document stays ready while it is read again, so calls keep
  // answering from the current version until the new one replaces it.
  const keepServing = doc.status === 'ready' && doc.chunk_count > 0
  const patch = keepServing
    ? { error_message: REFRESHING_MESSAGE }
    : { status: 'processing' as const, error_message: null }
  const { data, error } = await admin
    .from('knowledge_documents')
    .update(patch)
    .eq('id', doc.id)
    .eq('org_id', org.org.id)
    .select('id')
  if (error || (data ?? []).length === 0) {
    await releaseLock(lockKey)
    if (error) console.error('[knowledge] resync status update failed', error.code, error.message)
    throw new ApiError(error ? 500 : 404, error ? 'knowledge_unavailable' : 'document_not_found', error
      ? 'We couldn’t start the refresh. Please try again.'
      : 'This document no longer exists.')
  }

  after(() =>
    ingestKnowledgeDocument({ orgId: org.org.id, documentId: doc.id, previousStatus: doc.status, lockAcquired: true })
  )
  const view = toDocumentView({ ...doc, ...patch, updated_at: new Date().toISOString() })
  return noStore(NextResponse.json(view, { status: 202 }))
})
