import { NextResponse } from 'next/server'
import { requireOrg } from '@/lib/api/auth'
import { errorResponse, RequestError, requestErrorResponse } from '@/lib/api/http'
import { createLogger, requestIdFrom } from '@/lib/observability/logger'
import {
  factTime,
  loadCallFacts,
  localDateOf,
  safeTimeZone,
  shiftMonths,
  zonedDayStart,
} from '@/lib/calls/serialize'
import type { CallStats } from '@/types'

// GET /api/calls/stats — headline numbers for the calls page, from the `calls`
// table (both providers). Months are calendar months in the org's time zone.
export async function GET(request: Request) {
  const requestId = requestIdFrom(request)
  let log = createLogger({ requestId, route: 'calls.stats' })
  try {
    const { supabase, org } = await requireOrg()
    log = log.child({ orgId: org.id })
    const tz = safeTimeZone(org.timezone)

    const { facts, total, truncated } = await loadCallFacts(supabase, org.id)
    if (truncated) log.warn('calls.stats.truncated', { total, loaded: facts.length })

    const today = localDateOf(new Date(), tz)
    const thisMonthStart = zonedDayStart(shiftMonths(today, 0), tz).getTime()
    const lastMonthStart = zonedDayStart(shiftMonths(today, -1), tz).getTime()

    let callsThisMonth = 0
    let callsLastMonth = 0
    let completed = 0
    let totalDuration = 0
    for (const f of facts) {
      const t = factTime(f)
      if (t >= thisMonthStart) callsThisMonth++
      else if (t >= lastMonthStart) callsLastMonth++
      if (f.status === 'completed') {
        completed++
        totalDuration += Math.max(0, f.duration_seconds ?? 0)
      }
    }

    const monthTrend = callsLastMonth === 0
      ? (callsThisMonth > 0 ? 100 : 0)
      : Math.round(((callsThisMonth - callsLastMonth) / callsLastMonth) * 100)

    const stats: CallStats = {
      total_calls: total,
      calls_this_month: callsThisMonth,
      calls_last_month: callsLastMonth,
      month_trend: monthTrend,
      avg_duration_seconds: completed > 0 ? Math.round(totalDuration / completed) : 0,
      total_duration_seconds: Math.round(totalDuration),
    }
    return NextResponse.json(stats)
  } catch (err) {
    if (err instanceof RequestError) return requestErrorResponse(err, requestId)
    return errorResponse(err, log, 'calls.stats.failed', requestId)
  }
}
