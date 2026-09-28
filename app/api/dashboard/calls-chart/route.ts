import { NextResponse, type NextRequest } from 'next/server'
import { z } from 'zod'
import { ApiError, handleRoute, noStore, parseSearchParams } from '@/lib/api/http'
import { requireOrgContext } from '@/lib/api/auth'
import { entitlementsFor, requiredPlanFor } from '@/lib/billing/entitlements'
import { dbError } from '@/app/api/calls/_lib/db'
import { safeTimeZone } from '@/app/api/calls/_lib/query'
import { PLANS } from '@/types'

// GET /api/dashboard/calls-chart?days=7|30|90 — calls per local day, zero-filled,
// oldest first (calls_chart). The 30-day view is part of advanced analytics
// (Pro and up), the 90-day view of the full analytics suite (Business and up).

export const runtime = 'nodejs'

const QuerySchema = z.object({
  days: z.enum(['7', '30', '90']).optional().default('7').transform(Number),
})

interface ChartDataPoint {
  /** Local calendar day, YYYY-MM-DD. */
  date: string
  calls: number
  avg_duration_seconds: number
}

export const GET = handleRoute(async (req: NextRequest) => {
  const ctx = await requireOrgContext()
  const { days } = parseSearchParams(req.nextUrl, QuerySchema)
  const entitlements = entitlementsFor(ctx.org.plan)
  if (days > 30 && !entitlements.fullAnalytics) {
    const plan = PLANS[requiredPlanFor('fullAnalytics')].name
    throw new ApiError(403, 'upgrade_required', `The 90-day view is part of the full analytics suite on ${plan} and above.`)
  }
  if (days > 7 && !entitlements.advancedAnalytics) {
    const plan = PLANS[requiredPlanFor('advancedAnalytics')].name
    throw new ApiError(403, 'upgrade_required', `The 30-day view is part of advanced analytics on ${plan} and above.`)
  }

  const { data, error } = await ctx.supabase.rpc('calls_chart', {
    p_org_id: ctx.org.id,
    p_days: days,
    p_tz: safeTimeZone(ctx.org.timezone),
  })
  if (error) throw dbError(error, 'calls chart')

  const points: ChartDataPoint[] = ((data ?? []) as { day: string; calls: unknown; avg_duration_seconds: unknown }[]).map((row) => ({
    date: String(row.day).slice(0, 10),
    calls: Number(row.calls) || 0,
    avg_duration_seconds: Math.round(Number(row.avg_duration_seconds) || 0),
  }))
  return noStore(NextResponse.json({ days, points }))
})
