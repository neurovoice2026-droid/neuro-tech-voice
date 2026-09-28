import { NextResponse, after } from 'next/server'
import { z } from 'zod'
import { requireOrgAgent, requireOrgContext } from '@/lib/api/auth'
import { ApiError, handleRoute, noStore, parseJson } from '@/lib/api/http'
import {
  KNOWLEDGE_DOCUMENT_COLUMNS,
  assertDocumentCapacity,
  isMissingSchemaError,
  requireKnowledgeAdmin,
  toDocumentView,
  withDocumentDefaults,
} from '@/lib/knowledge/documents'
import { INGEST_LOCK_SECONDS, ingestKnowledgeDocument } from '@/lib/knowledge/ingest'
import { ingestLockKey, tryAcquireLock } from '@/lib/knowledge/lock'
import { defaultUrlDocumentName, normalizeKnowledgeUrl } from '@/lib/knowledge/shared'
import { RATE_LIMITS, enforceRateLimit } from '@/lib/security/rate-limit'
import { UnsafeUrlError, assertPublicHttpsUrl } from '@/lib/security/ssrf'

export const runtime = 'nodejs'
export const maxDuration = 60

const bodySchema = z.object({
  url: z.string().trim().min(1, 'Enter a web address').max(2048),
})

/** POST: adds a web page (or an online PDF) by address; it is fetched and indexed in the background. */
export const POST = handleRoute(async (req) => {
  const ctx = await requireOrgContext()
  await enforceRateLimit(RATE_LIMITS.knowledgeWrite, ctx.org.id)
  const body = await parseJson(req, bodySchema)

  const url = normalizeKnowledgeUrl(body.url)
  if (!url) {
    throw new ApiError(400, 'invalid_url', 'That doesn’t look like a web address. Try something like https://example.com/faq.')
  }
  try {
    // Early, friendly rejection; the fetch re-checks every redirect hop.
    await assertPublicHttpsUrl(url)
  } catch (error) {
    if (error instanceof UnsafeUrlError) {
      throw new ApiError(
        400,
        'invalid_url',
        error.message === 'URL host could not be resolved'
          ? 'We couldn’t find that website. Check the address for typos.'
          : 'We can only read public web pages. Check the address and try again.'
      )
    }
    throw error
  }

  const agent = await requireOrgAgent(ctx)
  const admin = requireKnowledgeAdmin()

  const { data: existing, error: existingError } = await admin
    .from('knowledge_documents')
    .select('id')
    .eq('org_id', ctx.org.id)
    .eq('agent_id', agent.id)
    .eq('url', url)
    .limit(1)
  if (existingError) {
    console.error('[knowledge] duplicate url check failed', existingError.code, existingError.message)
    throw new ApiError(500, 'knowledge_unavailable', 'We couldn’t add this page. Please try again.')
  }
  if ((existing ?? []).length > 0) {
    throw new ApiError(409, 'already_added', 'This page is already in your knowledge base. Use Refresh on it to pick up changes.')
  }
  await assertDocumentCapacity(admin, ctx.org.id, agent.id)

  const { data: row, error: insertError } = await admin
    .from('knowledge_documents')
    .insert({
      org_id: ctx.org.id,
      agent_id: agent.id,
      name: defaultUrlDocumentName(url),
      type: 'url',
      url,
      size_bytes: 0,
      status: 'processing',
    })
    .select(KNOWLEDGE_DOCUMENT_COLUMNS)
    .single()
  if (insertError || !row) {
    console.error('[knowledge] url document insert failed', insertError?.code, insertError?.message)
    if (isMissingSchemaError(insertError)) {
      throw new ApiError(503, 'not_configured', 'The knowledge base needs a database update before it can read pages.')
    }
    throw new ApiError(500, 'knowledge_unavailable', 'We couldn’t add this page. Please try again.')
  }

  const doc = withDocumentDefaults(row as unknown as Record<string, unknown>)
  const lockAcquired = await tryAcquireLock(ingestLockKey(doc.id), INGEST_LOCK_SECONDS)
  after(() => ingestKnowledgeDocument({ orgId: ctx.org.id, documentId: doc.id, previousStatus: null, lockAcquired }))
  return noStore(NextResponse.json(toDocumentView(doc), { status: 201 }))
})
