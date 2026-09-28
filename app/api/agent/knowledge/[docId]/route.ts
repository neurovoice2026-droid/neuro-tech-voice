import { NextResponse } from 'next/server'
import { requireOrgContext } from '@/lib/api/auth'
import { ApiError, handleRoute, noStore, zUuid } from '@/lib/api/http'
import { deleteKnowledgeDocument } from '@/lib/knowledge/delete'
import { RATE_LIMITS, enforceRateLimit } from '@/lib/security/rate-limit'

export const runtime = 'nodejs'
// Provider copies are deleted (in parallel, 15 s timeout each) before the response.
export const maxDuration = 60

type Context = { params: Promise<{ docId: string }> }

/**
 * DELETE: removes the document everywhere (provider copies, chunks, stored
 * file). Provider problems are logged and returned as warnings; the document
 * is removed locally either way so the agent stops using it.
 */
export const DELETE = handleRoute(async (_req, ctx: Context) => {
  const org = await requireOrgContext()
  await enforceRateLimit(RATE_LIMITS.apiWrite, org.user.id)
  const { docId } = await ctx.params
  const id = zUuid.safeParse(docId)
  if (!id.success) throw new ApiError(404, 'document_not_found', 'This document no longer exists.')

  let result: Awaited<ReturnType<typeof deleteKnowledgeDocument>>
  try {
    result = await deleteKnowledgeDocument({ orgId: org.org.id, documentId: id.data })
  } catch (error) {
    if (error instanceof ApiError) throw error
    console.error('[knowledge] delete route failed', { documentId: id.data, error: error instanceof Error ? error.message : String(error) })
    throw new ApiError(500, 'delete_failed', 'We couldn’t remove this document. Please try again.')
  }
  if (!result.deleted) throw new ApiError(404, 'document_not_found', 'This document no longer exists.')
  return noStore(NextResponse.json({ ok: true, warnings: result.warnings }))
})
