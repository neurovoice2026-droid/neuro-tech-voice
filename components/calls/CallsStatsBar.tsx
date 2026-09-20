'use client'

import { useEffect, useRef, useState } from 'react'
import { Calendar, Clock, Phone, Timer } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { formatDuration } from '@/lib/utils'
import type { CallStats } from '@/types'

function useCountUp(target: number, duration = 700) {
  const [value, setValue] = useState(0)
  const raf = useRef<number | null>(null)
  useEffect(() => {
    // Respect reduced motion: jump straight to the number.
    const reduce = typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
    const start = performance.now()
    function tick(now: number) {
      const p = reduce ? 1 : Math.min((now - start) / duration, 1)
      setValue(Math.round((1 - Math.pow(1 - p, 3)) * target))
      if (p < 1) raf.current = requestAnimationFrame(tick)
    }
    raf.current = requestAnimationFrame(tick)
    return () => {
      if (raf.current) cancelAnimationFrame(raf.current)
    }
  }, [target, duration])
  return value
}

/** Talk time adds up fast: past an hour, hours and minutes read better than "3038m 55s". */
function formatTalkTime(seconds: number): string {
  if (seconds <= 0) return '—'
  if (seconds < 3600) return formatDuration(seconds)
  const hours = Math.floor(seconds / 3600)
  const minutes = Math.floor((seconds % 3600) / 60)
  return minutes > 0 ? `${hours.toLocaleString()}h ${minutes}m` : `${hours.toLocaleString()}h`
}

function TrendBadge({ value, lastMonth }: { value: number; lastMonth: number }) {
  if (lastMonth <= 0) return <span className="text-xs text-muted-foreground">No calls last month</span>
  const up = value > 0
  const down = value < 0
  return (
    <span className={`text-xs font-medium ${up ? 'text-green-600' : down ? 'text-red-500' : 'text-muted-foreground'}`}>
      <span aria-hidden="true">{up ? '↑' : down ? '↓' : '→'}</span> {Math.abs(value)}% vs last month
    </span>
  )
}

interface CallsStatsBarProps {
  stats: CallStats | null
  isLoading: boolean
  error: string | null
}

export function CallsStatsBar({ stats, isLoading, error }: CallsStatsBarProps) {
  const totalCalls = useCountUp(stats?.total_calls ?? 0)
  const thisMonth = useCountUp(stats?.calls_this_month ?? 0)

  if (isLoading) {
    return (
      <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4" aria-busy="true" aria-label="Loading call totals">
        {[...Array(4)].map((_, i) => (
          <Skeleton key={i} className="h-[138px] rounded-xl sm:h-[150px]" />
        ))}
      </div>
    )
  }

  if (error || !stats) {
    return (
      <p role="status" className="rounded-xl border bg-card px-4 py-3 text-sm text-muted-foreground">
        {error ?? 'Call totals aren’t available right now.'}
      </p>
    )
  }

  const cards = [
    { icon: Phone, bg: 'bg-blue-100', color: 'text-blue-600', value: totalCalls.toLocaleString(), label: 'Total calls', sub: <span className="text-xs text-muted-foreground">All time</span> },
    { icon: Calendar, bg: 'bg-purple-100', color: 'text-purple-600', value: thisMonth.toLocaleString(), label: 'This month', sub: <TrendBadge value={stats.month_trend} lastMonth={stats.calls_last_month} /> },
    { icon: Timer, bg: 'bg-green-100', color: 'text-green-600', value: stats.avg_duration_seconds > 0 ? formatDuration(stats.avg_duration_seconds) : '—', label: 'Average length', sub: <span className="text-xs text-muted-foreground">Calls that connected</span> },
    { icon: Clock, bg: 'bg-amber-100', color: 'text-amber-600', value: formatTalkTime(stats.total_duration_seconds), label: 'Total talk time', sub: <span className="text-xs text-muted-foreground">All time</span> },
  ]

  return (
    <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
      {cards.map((c) => (
        <Card key={c.label} className="border py-0 shadow-sm">
          <CardContent className="p-3 sm:p-4">
            <div className={`mb-2 inline-flex rounded-lg p-2 ${c.bg}`}>
              <c.icon aria-hidden="true" className={`size-[18px] ${c.color}`} />
            </div>
            <p className="truncate text-xl font-bold text-foreground sm:text-2xl">{c.value}</p>
            <p className="text-sm font-medium text-foreground">{c.label}</p>
            <div className="mt-0.5">{c.sub}</div>
          </CardContent>
        </Card>
      ))}
    </div>
  )
}
