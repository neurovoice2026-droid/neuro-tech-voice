// GET /api/agent/status → AgentStatusView: per-provider sync state of the
// org's agent (primary/fallback, enabled, configured), the voice sync state
// and each number's routing state. Only sanitized error messages are exposed.

import { NextResponse } from 'next/server'
import { requireOrg } from '@/lib/api/auth'
import { RequestError, errorResponse, requestErrorResponse } from '@/lib/api/http'
import { createLogger, requestIdFrom } from '@/lib/observability/logger'
import { buildAgentStatusView, defaultAgentName, ensureAgent } from '@/lib/agents/ensure-agent'

export async function GET(request: Request) {
  const requestId = requestIdFrom(request)
  let log = createLogger({ requestId, route: 'agent.status' })
  try {
    const { supabase, org } = await requireOrg()
    log = log.child({ orgId: org.id })
    const agent = await ensureAgent(org.id, defaultAgentName(org.name))
    const view = await buildAgentStatusView(supabase, org.id, agent.id)
    return NextResponse.json(view, { headers: { 'Cache-Control': 'no-store' } })
  } catch (err) {
    if (err instanceof RequestError) return requestErrorResponse(err, requestId)
    return errorResponse(err, log, 'agent.status_failed', requestId)
  }
}
