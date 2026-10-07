// GET  /api/agent/knowledge/website → { websites: WebsiteImport[] }
//   The organization's website imports; running ones are refreshed from the
//   provider (at most every 10 s each, by their stored job id only).
// POST /api/agent/knowledge/website { url, consent: true } → 201 WebsiteImport
//   Imports a public website the owner confirms they own or are authorised
//   for: same host only, at most ELEVENLABS_CRAWL_MAX_PAGES pages (≤ 50),
//   refreshed weekly. The consent (who, when, domain) goes to audit_log.

import { NextResponse } from 'next/server'
import { z } from 'zod'
import { requireOrg } from '@/lib/api/auth'
import { RequestError, assertSameOrigin, errorResponse, parseJsonBody, requestErrorResponse } from '@/lib/api/http'
import { createLogger, requestIdFrom } from '@/lib/observability/logger'
import { enforceRateLimit, rateLimit } from '@/lib/security/rate-limit'
import { defaultAgentName, ensureAgent } from '@/lib/agents/ensure-agent'
import { KNOWLEDGE_MAX_URL_CHARS } from '@/lib/voice-providers/knowledge'
import { listWebsiteImports, startWebsiteImport, toCrawlView } from '@/lib/voice-providers/knowledge-crawl'
import { KNOWLEDGE_RATE_LIMITS } from '@/lib/voice-providers/knowledge-limits'

// Finishing an import attaches its folder to the agent (one provider sync).
export const maxDuration = 60

const BodySchema = z.strictObject({
  url: z.string().trim().min(1, 'Enter your website address.').max(KNOWLEDGE_MAX_URL_CHARS, 'The web address is too long.'),
  consent: z.literal(true, { error: 'Confirm that you own this website or are authorised to import it.' }),
})

export async function GET(request: Request) {
  const requestId = requestIdFrom(request)
  let log = createLogger({ requestId, route: 'agent.knowledge.website.list' })
  try {
    const { org } = await requireOrg()
    log = log.child({ orgId: org.id })
    // Refreshing running imports calls the provider: bounded per organization
    // (counted only when a read is due; the list itself is always returned).
    const allowPoll = async () => (await rateLimit(KNOWLEDGE_RATE_LIMITS.crawlStatus, org.id)).allowed
    const rows = await listWebsiteImports(org.id, log, { allowPoll })
    return NextResponse.json({ websites: rows.map(toCrawlView) }, { headers: { 'Cache-Control': 'no-store' } })
  } catch (err) {
    if (err instanceof RequestError) return requestErrorResponse(err, requestId)
    return errorResponse(err, log, 'agent.knowledge.website.list_failed', requestId)
  }
}

export async function POST(request: Request) {
  const requestId = requestIdFrom(request)
  let log = createLogger({ requestId, route: 'agent.knowledge.website.import' })
  try {
    assertSameOrigin(request)
    const { supabase, user, org } = await requireOrg()
    log = log.child({ orgId: org.id })
    const body = await parseJsonBody(request, BodySchema)
    await enforceRateLimit(KNOWLEDGE_RATE_LIMITS.crawl, org.id, 'Too many website imports today. Please try again tomorrow.')

    const agent = await ensureAgent(org.id, defaultAgentName(org.name))
    log = log.child({ agentId: agent.id })
    const row = await startWebsiteImport({ supabase, orgId: org.id, agentId: agent.id, userId: user.id, url: body.url, log })
    return NextResponse.json(toCrawlView(row), { status: 201, headers: { 'Cache-Control': 'no-store' } })
  } catch (err) {
    if (err instanceof RequestError) return requestErrorResponse(err, requestId)
    return errorResponse(err, log, 'agent.knowledge.website.import_failed', requestId)
  }
}
