// DELETE /api/agent/knowledge/website/[crawlId] → { success: true }
//
// Removes a website import: out of the agent first, then the provider copy
// (a running crawl is cancelled; the imported folder is deleted with all its
// pages), then the row. A provider failure → 502 and the import is kept.

import { NextResponse } from 'next/server'
import { requireOrg } from '@/lib/api/auth'
import { RequestError, assertSameOrigin, errorResponse, requestErrorResponse } from '@/lib/api/http'
import { createLogger, requestIdFrom } from '@/lib/observability/logger'
import { enforceRateLimit } from '@/lib/security/rate-limit'
import { parseDocId } from '@/lib/voice-providers/knowledge'
import { deleteWebsiteImport } from '@/lib/voice-providers/knowledge-crawl'
import { KNOWLEDGE_RATE_LIMITS } from '@/lib/voice-providers/knowledge-limits'

export const maxDuration = 60

export async function DELETE(request: Request, { params }: { params: Promise<{ crawlId: string }> }) {
  const requestId = requestIdFrom(request)
  let log = createLogger({ requestId, route: 'agent.knowledge.website.delete' })
  try {
    assertSameOrigin(request)
    const { supabase, org } = await requireOrg()
    log = log.child({ orgId: org.id })
    // Same UUID rule as document ids (400 otherwise).
    const crawlId = parseDocId((await params).crawlId)

    // Ownership check under RLS before any service-role work.
    const { data, error } = await supabase.from('knowledge_crawls').select('id').eq('id', crawlId).eq('org_id', org.id).maybeSingle()
    if (error) throw new Error(`knowledge_crawls read failed: ${error.message}`)
    if (!data) throw new RequestError('not_found', 'Website import not found.', 404)

    await enforceRateLimit(KNOWLEDGE_RATE_LIMITS.edit, org.id, 'Too many changes. Please wait a while and try again.')
    await deleteWebsiteImport(org.id, crawlId, log)
    return NextResponse.json({ success: true })
  } catch (err) {
    if (err instanceof RequestError) return requestErrorResponse(err, requestId)
    return errorResponse(err, log, 'agent.knowledge.website.delete_failed', requestId)
  }
}
