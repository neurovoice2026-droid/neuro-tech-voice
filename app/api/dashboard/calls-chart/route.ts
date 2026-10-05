import { NextResponse } from 'next/server'
import { requireOrg } from '@/lib/api/auth'
import { errorResponse, RequestError, requestErrorResponse } from '@/lib/api/http'
import { createLogger, requestIdFrom } from '@/lib/observability/logger'
import {
  factTime,
  loadCallFacts,
  localDateOf,
  safeTimeZone,
  shiftDays,
  zonedDayStart,
} from '@/lib/calls/serialize'

export interface ChartDataPoint {
  /** Short weekday of the org-local day ("Mon"). */
  date: string
  calls: number
  /** Average duration of completed calls that day, in minutes (1 decimal). */
  duration: number
}

const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
const DAYS = 7

// GET /api/dashboard/calls-chart — calls per day for the last 7 days (today
// included), in the org's time zone, from the `calls` table (both providers).
export async function GET(request: Request) {
  const requestId = requestIdFrom(request)
  let log = createLogger({ requestId, route: 'dashboard.calls_chart' })
  try {
    const { supabase, org } = await requireOrg()
    log = log.child({ orgId: org.id })
    const tz = safeTimeZone(org.timezone)

    const today = localDateOf(new Date(), tz)
    const days = Array.from({ length: DAYS }, (_, i) => {
      const local = shiftDays(today, i - (DAYS - 1))
      return {
        local,
        start: zonedDayStart(local, tz).getTime(),
        end: zonedDayStart(shiftDays(local, 1), tz).getTime(),
      }
    })

    const { facts, truncated } = await loadCallFacts(supabase, org.id, { since: new Date(days[0].start) })
    if (truncated) log.warn('dashboard.calls_chart.truncated', { loaded: facts.length })

    const result: ChartDataPoint[] = days.map(({ local, start, end }) => {
      const dayFacts = facts.filter((f) => {
        const t = factTime(f)
        return t >= start && t < end
      })
      const completed = dayFacts.filter((f) => f.status === 'completed')
      const totalSecs = completed.reduce((s, f) => s + Math.max(0, f.duration_seconds ?? 0), 0)
      const weekday = new Date(Date.UTC(local.year, local.month - 1, local.day)).getUTCDay()
      return {
        date: DAY_NAMES[weekday],
        calls: dayFacts.length,
        duration: completed.length > 0 ? Math.round((totalSecs / completed.length / 60) * 10) / 10 : 0,
      }
    })

    return NextResponse.json(result)
  } catch (err) {
    if (err instanceof RequestError) return requestErrorResponse(err, requestId)
    return errorResponse(err, log, 'dashboard.calls_chart.failed', requestId)
  }
}
