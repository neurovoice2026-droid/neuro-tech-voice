// GET /api/billing/minutes → MinutesSummaryDto: the period's included minutes,
// the prepaid extra-minute balance, the packs the plan can buy (with their
// prices), the auto top-up settings and the last purchases. Read with the
// tenant's own client (RLS: the owner's organization and its purchases only).
import { NextResponse } from 'next/server'
import { requireOrg } from '@/lib/api/auth'
import { RequestError, errorResponse, requestErrorResponse } from '@/lib/api/http'
import { createLogger, requestIdFrom } from '@/lib/observability/logger'
import { RATE_LIMITS, enforceRateLimit } from '@/lib/security/rate-limit'
import { loadMinutesSummary } from '@/lib/billing/minutes-summary'

export async function GET(request: Request) {
  const requestId = requestIdFrom(request)
  let log = createLogger({ requestId, route: 'billing.minutes.get' })
  try {
    const { supabase, org } = await requireOrg()
    log = log.child({ orgId: org.id })
    await enforceRateLimit(RATE_LIMITS.billingMinutesRead, org.id)
    const summary = await loadMinutesSummary(supabase, org.id)
    return NextResponse.json(summary, { headers: { 'Cache-Control': 'no-store' } })
  } catch (err) {
    if (err instanceof RequestError) return requestErrorResponse(err, requestId)
    return errorResponse(err, log, 'billing.minutes.get_failed', requestId)
  }
}
