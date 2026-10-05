// POST /api/agent/sync → AgentStatusView. Forces a full re-sync of the org's
// agent with every enabled provider (awaited), re-binds numbers whose routing
// became stale, then returns the fresh status. Rate limited per org.

import { NextResponse } from 'next/server'
import { requireOrg } from '@/lib/api/auth'
import { RequestError, assertSameOrigin, errorResponse, requestErrorResponse } from '@/lib/api/http'
import { createLogger, requestIdFrom } from '@/lib/observability/logger'
import { RATE_LIMITS, enforceRateLimit } from '@/lib/security/rate-limit'
import {
  activeProviders,
  buildAgentStatusView,
  defaultAgentName,
  ensureAgent,
  rebindStaleNumbers,
  runAgentSync,
  snapshotExternalIds,
} from '@/lib/agents/ensure-agent'

// Both providers are synced in sequence, then numbers are re-bound.
export const maxDuration = 60

export async function POST(request: Request) {
  const requestId = requestIdFrom(request)
  let log = createLogger({ requestId, route: 'agent.sync' })
  try {
    assertSameOrigin(request)
    const { supabase, org } = await requireOrg()
    log = log.child({ orgId: org.id })

    // 429 + Retry-After (RequestError) when the org exceeded its sync budget.
    await enforceRateLimit(RATE_LIMITS.agentSync, org.id, 'Too many sync requests. Please wait a moment and try again.')

    const agent = await ensureAgent(org.id, defaultAgentName(org.name))
    log = log.child({ agentId: agent.id })

    const [providers, before] = await Promise.all([activeProviders(supabase, agent.id), snapshotExternalIds(org.id, agent.id)])
    const results = await runAgentSync(agent.id, { providers, force: true, log })
    const rebound = await rebindStaleNumbers(org.id, agent.id, before, log)
    log.info('agent.sync', {
      results: results.map((r) => `${r.provider}:${r.status}`),
      numbersRebound: rebound.length,
    })

    const view = await buildAgentStatusView(supabase, org.id, agent.id)
    return NextResponse.json(view, { headers: { 'Cache-Control': 'no-store' } })
  } catch (err) {
    if (err instanceof RequestError) return requestErrorResponse(err, requestId)
    return errorResponse(err, log, 'agent.sync_failed', requestId)
  }
}
