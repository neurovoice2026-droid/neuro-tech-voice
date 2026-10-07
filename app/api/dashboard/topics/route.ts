import { NextResponse } from 'next/server'
import { requireOrg } from '@/lib/api/auth'
import { errorResponse, RequestError, requestErrorResponse } from '@/lib/api/http'
import { createLogger, requestIdFrom } from '@/lib/observability/logger'
import { orgTopics } from '@/lib/calls/insights'

// GET /api/dashboard/topics — "What callers ask about": the latest topic
// discovery results of the org's OWN ElevenLabs agent (last 30 days), cached
// 6 h per org and rate limited on cache misses. { available: false } when the
// provider has none (the card hides).
export async function GET(request: Request) {
  const requestId = requestIdFrom(request)
  let log = createLogger({ requestId, route: 'dashboard.topics' })
  try {
    const { org } = await requireOrg()
    log = log.child({ orgId: org.id })
    return NextResponse.json(await orgTopics(org.id, log), { headers: { 'Cache-Control': 'private, no-store' } })
  } catch (err) {
    if (err instanceof RequestError) return requestErrorResponse(err, requestId)
    return errorResponse(err, log, 'dashboard.topics.failed', requestId)
  }
}
