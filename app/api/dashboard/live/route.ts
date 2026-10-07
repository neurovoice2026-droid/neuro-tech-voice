import { NextResponse } from 'next/server'
import { requireOrg } from '@/lib/api/auth'
import { errorResponse, RequestError, requestErrorResponse } from '@/lib/api/http'
import { createLogger, requestIdFrom } from '@/lib/observability/logger'
import { orgLiveCount } from '@/lib/calls/insights'

// GET /api/dashboard/live — "Calls in progress" on the org's OWN ElevenLabs
// agent (live-count with agent_id; never the workspace total), cached 15 s
// per org and rate limited on cache misses.
export async function GET(request: Request) {
  const requestId = requestIdFrom(request)
  let log = createLogger({ requestId, route: 'dashboard.live' })
  try {
    const { org } = await requireOrg()
    log = log.child({ orgId: org.id })
    return NextResponse.json(await orgLiveCount(org.id, log), { headers: { 'Cache-Control': 'private, no-store' } })
  } catch (err) {
    if (err instanceof RequestError) return requestErrorResponse(err, requestId)
    return errorResponse(err, log, 'dashboard.live.failed', requestId)
  }
}
