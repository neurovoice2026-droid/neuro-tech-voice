import { NextResponse } from 'next/server'
import { handleRoute, noStore } from '@/lib/api/http'
import { requireOrgContext } from '@/lib/api/auth'
import { dbError } from '../_lib/db'
import { safeTimeZone } from '../_lib/query'
import type { CallStats } from '@/types'

// GET /api/calls/stats — totals for the calls page, aggregated in SQL
// (call_stats) with month boundaries in the organisation's time zone.

export const runtime = 'nodejs'

function toNumber(value: unknown): number {
  const n = typeof value === 'string' ? Number(value) : value
  return typeof n === 'number' && Number.isFinite(n) ? n : 0
}

export const GET = handleRoute(async () => {
  const ctx = await requireOrgContext()
  const { data, error } = await ctx.supabase.rpc('call_stats', {
    p_org_id: ctx.org.id,
    p_tz: safeTimeZone(ctx.org.timezone),
  })
  if (error) throw dbError(error, 'call stats')

  const raw = (data ?? {}) as Record<string, unknown>
  const stats: CallStats = {
    total_calls: toNumber(raw.total_calls),
    calls_this_month: toNumber(raw.calls_this_month),
    calls_last_month: toNumber(raw.calls_last_month),
    month_trend: toNumber(raw.month_trend),
    avg_duration_seconds: toNumber(raw.avg_duration_seconds),
    total_duration_seconds: toNumber(raw.total_duration_seconds),
  }
  return noStore(NextResponse.json(stats))
})
