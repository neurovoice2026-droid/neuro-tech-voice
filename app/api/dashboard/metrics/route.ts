import { NextResponse } from 'next/server'
import { requireOrg } from '@/lib/api/auth'
import { errorResponse, RequestError, requestErrorResponse } from '@/lib/api/http'
import { createLogger, requestIdFrom } from '@/lib/observability/logger'
import {
  dbError,
  factTime,
  loadCallFacts,
  localDateOf,
  safeTimeZone,
  shiftMonths,
  wallTime,
  zonedDayStart,
} from '@/lib/calls/serialize'
import { CALL_OUTCOMES, type DashboardMetrics } from '@/types'

const WEEK_MS = 7 * 24 * 60 * 60 * 1000
const LIVE = new Set(['ringing', 'in-progress'])

// GET /api/dashboard/metrics — dashboard KPIs from the `calls` table (both
// providers, test sessions excluded). "Today" and "this month" use the org's
// time zone; success_rate is the ANSWERED rate (share of finished calls that
// completed); ai_success_rate is the AI resolution rate from call_successful
// (success / (success + failure)); outcome_breakdown counts calls.outcome.
// sentiment_breakdown counts calls.sentiment, which is no longer derived from
// the AI verdict (older rows only).
export async function GET(request: Request) {
  const requestId = requestIdFrom(request)
  let log = createLogger({ requestId, route: 'dashboard.metrics' })
  try {
    const { supabase, org } = await requireOrg()
    log = log.child({ orgId: org.id })
    const tz = safeTimeZone(org.timezone)

    const [factsResult, usage] = await Promise.all([
      loadCallFacts(supabase, org.id),
      supabase.from('organizations').select('minutes_used, minutes_limit').eq('id', org.id).single(),
    ])
    if (usage.error) throw dbError('organization usage', usage.error)
    const { facts, total, truncated } = factsResult
    if (truncated) log.warn('dashboard.metrics.truncated', { total, loaded: facts.length })

    const now = new Date()
    const today = localDateOf(now, tz)
    const todayStart = zonedDayStart(today, tz).getTime()
    const monthStart = zonedDayStart(shiftMonths(today, 0), tz).getTime()
    const weekStart = now.getTime() - WEEK_MS

    let totalDuration = 0
    let completed = 0
    let completedDuration = 0
    let finished = 0
    let callsToday = 0
    let callsThisWeek = 0
    let callsThisMonth = 0
    const sentiment = { positive: 0, neutral: 0, negative: 0 }
    const aiOutcome = { success: 0, failure: 0, unknown: 0 }
    const outcomes: Record<string, number> = {}
    const hourCounts = new Array<number>(24).fill(0)

    for (const f of facts) {
      const duration = Math.max(0, f.duration_seconds ?? 0)
      const t = factTime(f)
      totalDuration += duration
      if (!LIVE.has(f.status ?? '')) finished++
      if (f.status === 'completed') {
        completed++
        completedDuration += duration
        if (Number.isFinite(t)) hourCounts[wallTime(new Date(t), tz).hour]++
      }
      if (t >= todayStart) callsToday++
      if (t >= weekStart) callsThisWeek++
      if (t >= monthStart) callsThisMonth++
      if (f.sentiment === 'positive' || f.sentiment === 'neutral' || f.sentiment === 'negative') sentiment[f.sentiment]++
      if (f.call_successful === 'success' || f.call_successful === 'failure' || f.call_successful === 'unknown') aiOutcome[f.call_successful]++
      if (f.outcome && (CALL_OUTCOMES as readonly string[]).includes(f.outcome)) outcomes[f.outcome] = (outcomes[f.outcome] ?? 0) + 1
    }
    const judged = aiOutcome.success + aiOutcome.failure

    const peak = Math.max(...hourCounts)
    const metrics: DashboardMetrics = {
      total_calls: total,
      total_duration_seconds: Math.round(totalDuration),
      avg_duration_seconds: completed > 0 ? Math.round(completedDuration / completed) : 0,
      calls_today: callsToday,
      calls_this_week: callsThisWeek,
      calls_this_month: callsThisMonth,
      sentiment_breakdown: sentiment,
      peak_hour: peak > 0 ? hourCounts.indexOf(peak) : 0,
      success_rate: finished > 0 ? Math.round((completed / finished) * 100) : 0,
      minutes_used: Number(usage.data?.minutes_used ?? 0),
      minutes_limit: Number(usage.data?.minutes_limit ?? 0),
      // AI resolution rate: the AI's verdict on each call's goal (not sentiment).
      ai_success_rate: judged > 0 ? Math.round((aiOutcome.success / judged) * 100) : null,
      ai_outcome_breakdown: aiOutcome,
      outcome_breakdown: outcomes,
    }
    return NextResponse.json(metrics)
  } catch (err) {
    if (err instanceof RequestError) return requestErrorResponse(err, requestId)
    return errorResponse(err, log, 'dashboard.metrics.failed', requestId)
  }
}
