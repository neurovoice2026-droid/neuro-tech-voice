// POST /api/agent/knowledge/url  { url } → 201 KnowledgeDocument
//
// Adds a public web page. The provider fetches the page itself, so only public
// http(s) addresses are accepted: no credentials, localhost, internal names or
// private / loopback / link-local IP literals. The returned document's status
// is 'ready' or 'failed' (with error_message).

import { NextResponse } from 'next/server'
import { z } from 'zod'
import { requireOrg } from '@/lib/api/auth'
import { createAdminClient } from '@/lib/supabase/admin'
import { RequestError, assertSameOrigin, errorResponse, parseJsonBody, requestErrorResponse } from '@/lib/api/http'
import { createLogger, requestIdFrom } from '@/lib/observability/logger'
import { RATE_LIMITS, enforceRateLimit } from '@/lib/security/rate-limit'
import { defaultAgentName, ensureAgent } from '@/lib/agents/ensure-agent'
import {
  KNOWLEDGE_MAX_NAME_CHARS,
  KNOWLEDGE_MAX_URL_CHARS,
  assertDocumentCapacity,
  checkPublicUrl,
  cleanDisplayName,
  newDocumentId,
  processDocument,
  toDocumentView,
} from '@/lib/voice-providers/knowledge'

export const maxDuration = 120

const BodySchema = z.object({
  url: z.string().trim().min(1, 'Enter a web address.').max(KNOWLEDGE_MAX_URL_CHARS, 'The web address is too long.'),
})

export async function POST(request: Request) {
  const requestId = requestIdFrom(request)
  let log = createLogger({ requestId, route: 'agent.knowledge.url' })
  try {
    assertSameOrigin(request)
    const { supabase, org } = await requireOrg()
    log = log.child({ orgId: org.id })
    await enforceRateLimit(RATE_LIMITS.knowledgeUpload, org.id, 'Too many uploads. Please wait a while and try again.')

    const body = await parseJsonBody(request, BodySchema)
    const check = checkPublicUrl(body.url)
    if (!check.ok) throw new RequestError('invalid_request', check.reason, 400)
    const href = check.url.href

    const agent = await ensureAgent(org.id, defaultAgentName(org.name))
    log = log.child({ agentId: agent.id })

    const { data: existing, error: dupErr } = await supabase
      .from('knowledge_documents')
      .select('id')
      .eq('org_id', org.id)
      .eq('agent_id', agent.id)
      .eq('url', href)
      .limit(1)
    if (dupErr) throw new Error(`knowledge_documents read failed: ${dupErr.message}`)
    if (existing?.length) {
      throw new RequestError('conflict', 'This page is already in your knowledge base.', 409)
    }
    // The page's size is known only once the provider fetched it: require room left.
    await assertDocumentCapacity(supabase, org.id, agent.id, { incomingBytes: 0, log })

    const id = newDocumentId()
    const name = cleanDisplayName(`${check.url.hostname}${check.url.pathname === '/' ? '' : check.url.pathname}`).slice(0, KNOWLEDGE_MAX_NAME_CHARS) || check.url.hostname
    const { error: insertErr } = await createAdminClient().from('knowledge_documents').insert({
      id,
      agent_id: agent.id,
      org_id: org.id,
      name,
      type: 'url',
      url: href,
      mime_type: 'text/html',
      status: 'processing',
    })
    if (insertErr) throw new Error(`knowledge_documents insert failed: ${insertErr.message}`)

    log.info('agent.knowledge.url_added', { docId: id, host: check.url.hostname })
    const doc = await processDocument(org.id, id, log)
    return NextResponse.json(toDocumentView(doc), { status: 201 })
  } catch (err) {
    if (err instanceof RequestError) return requestErrorResponse(err, requestId)
    return errorResponse(err, log, 'agent.knowledge.url_failed', requestId)
  }
}
