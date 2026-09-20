import { NextResponse } from 'next/server'
import { handleRoute, noStore } from '@/lib/api/http'
import { requireOrgContext } from '@/lib/api/auth'
import { dbError } from '@/app/api/calls/_lib/db'
import { safeTimeZone } from '@/app/api/calls/_lib/query'
import { CALL_OUTCOMES, type CallOutcome, type DashboardMetrics } from '@/types'

// GET /api/dashboard/metrics — headline numbers from one SQL aggregate
// (dashboard_metrics, test calls excluded, days in the org's time zone) plus
// the minutes counters from the organisation row.

export const runtime = 'nodejs'

function toNumber(value: unknown): number {
  const n = typeof value === 'string' ? Number(value) : value
  return typeof n === 'number' && Number.isFinite(n) ? n : 0
}

export const GET = handleRoute(async () => {
  const ctx = await requireOrgContext()
  const { data, error } = await ctx.supabase.rpc('dashboard_metrics', {
    p_org_id: ctx.org.id,
    p_tz: safeTimeZone(ctx.org.timezone),
  })
  if (error) throw dbError(error, 'dashboard metrics')

  const raw = (data ?? {}) as Record<string, unknown>
  const sentiment = (raw.sentiment_breakdown ?? {}) as Record<string, unknown>
  const outcomes = (raw.outcome_breakdown ?? {}) as Record<string, unknown>

  const metrics: DashboardMetrics = {
    total_calls: toNumber(raw.total_calls),
    total_duration_seconds: toNumber(raw.total_duration_seconds),
    avg_duration_seconds: toNumber(raw.avg_duration_seconds),
    calls_today: toNumber(raw.calls_today),
    calls_this_week: toNumber(raw.calls_this_week),
    calls_this_month: toNumber(raw.calls_this_month),
    sentiment_breakdown: {
      positive: toNumber(sentiment.positive),
      neutral: toNumber(sentiment.neutral),
      negative: toNumber(sentiment.negative),
    },
    peak_hour: toNumber(raw.peak_hour),
    success_rate: toNumber(raw.success_rate),
    minutes_used: toNumber(ctx.org.minutes_used),
    minutes_limit: toNumber(ctx.org.minutes_limit),
    outcome_breakdown: Object.fromEntries(
      CALL_OUTCOMES.map((outcome) => [outcome, toNumber(outcomes[outcome])])
    ) as Record<CallOutcome, number>,
  }
  return noStore(NextResponse.json(metrics))
})
