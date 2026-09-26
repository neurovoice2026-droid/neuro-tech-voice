'use client'

import { useEffect, useRef, useState } from 'react'
import { AlertTriangle, CalendarCheck, CheckCircle2, Clock, PhoneCall, PhoneIncoming, Zap } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { formatDuration } from '@/lib/utils'
import type { DashboardMetrics } from '@/types'

function useCountUp(target: number, duration = 800) {
  const [value, setValue] = useState(0)
  const raf = useRef<number | null>(null)

  useEffect(() => {
    const reduce = typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
    const start = performance.now()
    function tick(now: number) {
      const progress = reduce ? 1 : Math.min((now - start) / duration, 1)
      setValue(Math.round((1 - Math.pow(1 - progress, 3)) * target))
      if (progress < 1) raf.current = requestAnimationFrame(tick)
    }
    raf.current = requestAnimationFrame(tick)
    return () => {
      if (raf.current) cancelAnimationFrame(raf.current)
    }
  }, [target, duration])

  return value
}

/** Same heights as the loaded cards (the minutes card is taller), so nothing jumps when numbers arrive. */
export function MetricsCardsSkeleton() {
  return (
    <>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 sm:gap-4 xl:grid-cols-4">
        {[...Array(4)].map((_, i) => (
          <Skeleton
            key={i}
            className={i === 3 ? 'h-[172px] rounded-xl sm:h-[180px]' : 'h-[158px] rounded-xl sm:h-[166px] xl:h-[180px]'}
          />
        ))}
      </div>
      <div className="grid grid-cols-3 gap-3 sm:gap-4">
        {[...Array(3)].map((_, i) => (
          <Skeleton key={i} className="h-[105px] rounded-xl sm:h-[95px]" />
        ))}
      </div>
    </>
  )
}

interface MetricsCardsProps {
  metrics: DashboardMetrics | null
  isLoading: boolean
  error: string | null
}

function share(part: number, total: number): string {
  if (total <= 0) return 'No calls yet'
  return `${Math.round((part / total) * 100)}% of all calls`
}

export function MetricsCards({ metrics, isLoading, error }: MetricsCardsProps) {
  const callsToday = useCountUp(metrics?.calls_today ?? 0)
  const answeredRate = useCountUp(Math.round(metrics?.success_rate ?? 0))
  const minutesUsed = useCountUp(metrics?.minutes_used ?? 0)
  const booked = useCountUp(metrics?.outcome_breakdown.booked ?? 0)
  const answered = useCountUp(metrics?.outcome_breakdown.answered ?? 0)
  const flagged = useCountUp(metrics?.outcome_breakdown.flagged ?? 0)

  if (isLoading && !metrics) {
    return (
      <div className="space-y-3 sm:space-y-4" aria-busy="true" aria-label="Loading your numbers">
        <MetricsCardsSkeleton />
      </div>
    )
  }

  if (!metrics) {
    return (
      <p role="status" className="rounded-xl border bg-card px-4 py-3 text-sm text-muted-foreground">
        {error ?? 'Your numbers aren’t available right now.'} They’ll refresh on their own.
      </p>
    )
  }

  const limit = metrics.minutes_limit
  const minutesPct = limit > 0 ? Math.round((metrics.minutes_used / limit) * 100) : 0
  const left = Math.max(0, limit - metrics.minutes_used)
  const handled = Math.round((metrics.success_rate / 100) * metrics.total_calls)

  const cards = [
    {
      label: 'Calls today',
      value: callsToday.toLocaleString(),
      icon: PhoneCall,
      iconColor: 'text-purple-600',
      iconBg: 'bg-purple-100',
      sub: `${metrics.calls_this_week.toLocaleString()} in the last 7 days`,
    },
    {
      label: 'Answered rate',
      value: `${answeredRate}%`,
      icon: PhoneIncoming,
      iconColor: 'text-green-600',
      iconBg: 'bg-green-100',
      sub: metrics.total_calls > 0
        ? `${handled.toLocaleString()} of ${metrics.total_calls.toLocaleString()} calls handled`
        : 'No calls yet',
    },
    {
      label: 'Average call',
      value: metrics.avg_duration_seconds > 0 ? formatDuration(metrics.avg_duration_seconds) : '—',
      icon: Clock,
      iconColor: 'text-blue-600',
      iconBg: 'bg-blue-100',
      sub: `${metrics.calls_this_month.toLocaleString()} calls this month`,
    },
  ]

  const outcomes = [
    { label: 'Booked', value: booked, raw: metrics.outcome_breakdown.booked, icon: CalendarCheck, color: 'text-emerald-600', bg: 'bg-emerald-50' },
    { label: 'Answered', value: answered, raw: metrics.outcome_breakdown.answered, icon: CheckCircle2, color: 'text-blue-600', bg: 'bg-blue-50' },
    { label: 'Flagged', value: flagged, raw: metrics.outcome_breakdown.flagged, icon: AlertTriangle, color: 'text-amber-600', bg: 'bg-amber-50' },
  ]

  return (
    <div className="space-y-3 sm:space-y-4">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 sm:gap-4 xl:grid-cols-4">
        {cards.map((c) => (
          <Card key={c.label} className="border py-0 shadow-sm">
            <CardContent className="p-4 sm:p-5">
              <div className={`inline-flex rounded-xl p-2.5 ${c.iconBg}`}>
                <c.icon aria-hidden="true" className={`size-5 ${c.iconColor}`} />
              </div>
              <p className="mt-3 text-2xl font-bold text-foreground">{c.value}</p>
              <p className="text-sm text-muted-foreground">{c.label}</p>
              <p className="mt-1 text-xs text-muted-foreground">{c.sub}</p>
            </CardContent>
          </Card>
        ))}

        <Card className="border py-0 shadow-sm">
          <CardContent className="p-4 sm:p-5">
            <div className="inline-flex rounded-xl bg-amber-100 p-2.5">
              <Zap aria-hidden="true" className="size-5 text-amber-600" />
            </div>
            <p className="mt-3 text-2xl font-bold text-foreground">
              {minutesUsed.toLocaleString()}
              <span className="text-sm font-normal text-muted-foreground"> / {limit.toLocaleString()}</span>
            </p>
            <p className="text-sm text-muted-foreground">Minutes used</p>
            <div className="mt-2">
              <div
                className="h-1.5 w-full overflow-hidden rounded-full bg-muted"
                role="progressbar"
                aria-label="Minutes used this period"
                aria-valuemin={0}
                aria-valuemax={limit}
                aria-valuenow={metrics.minutes_used}
              >
                <div
                  className={`h-full rounded-full transition-all duration-700 ${minutesPct >= 100 ? 'bg-red-500' : minutesPct >= 80 ? 'bg-amber-500' : 'bg-primary'}`}
                  style={{ width: `${Math.min(minutesPct, 100)}%` }}
                />
              </div>
              <p className="mt-1 text-xs text-muted-foreground">
                {minutesPct >= 100 ? 'Included minutes used up' : `${left.toLocaleString()} minutes left`}
              </p>
            </div>
          </CardContent>
        </Card>
      </div>

      <section aria-label="Call outcomes" className="grid grid-cols-3 gap-3 sm:gap-4">
        {outcomes.map((o) => (
          <Card key={o.label} className="border py-0 shadow-sm">
            <CardContent className="flex flex-col gap-2 p-3 sm:flex-row sm:items-center sm:gap-3 sm:p-4">
              <span className={`inline-flex w-fit rounded-lg p-2 ${o.bg}`}>
                <o.icon aria-hidden="true" className={`size-4 ${o.color}`} />
              </span>
              <div className="min-w-0">
                <p className="text-lg font-bold leading-tight text-foreground sm:text-xl">{o.value.toLocaleString()}</p>
                <p className="truncate text-xs text-muted-foreground sm:text-sm">{o.label}</p>
                <p className="hidden text-xs text-muted-foreground sm:block">{share(o.raw, metrics.total_calls)}</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </section>
    </div>
  )
}
