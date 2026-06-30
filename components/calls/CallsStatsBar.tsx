'use client'

import { useEffect, useRef, useState } from 'react'
import { Phone, Calendar, Timer, Clock } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { formatDuration } from '@/lib/utils'
import type { CallStats } from '@/types'

function useCountUp(target: number, duration = 700) {
  const [val, setVal] = useState(0)
  const raf = useRef<number | null>(null)
  useEffect(() => {
    const start = performance.now()
    function tick(now: number) {
      const p = Math.min((now - start) / duration, 1)
      const eased = 1 - Math.pow(1 - p, 3)
      setVal(Math.round(eased * target))
      if (p < 1) raf.current = requestAnimationFrame(tick)
    }
    raf.current = requestAnimationFrame(tick)
    return () => { if (raf.current) cancelAnimationFrame(raf.current) }
  }, [target, duration])
  return val
}

function TrendBadge({ value }: { value: number }) {
  const isUp = value > 0
  const isDown = value < 0
  return (
    <span className={`text-xs font-medium ${isUp ? 'text-green-600' : isDown ? 'text-red-500' : 'text-gray-400'}`}>
      {isUp ? '↑' : isDown ? '↓' : '→'} {Math.abs(value)}% vs last month
    </span>
  )
}

interface CallsStatsBarProps {
  stats: CallStats | null
  isLoading: boolean
}

export function CallsStatsBar({ stats, isLoading }: CallsStatsBarProps) {
  const totalCalls     = useCountUp(stats?.total_calls ?? 0)
  const thisMonth      = useCountUp(stats?.calls_this_month ?? 0)

  if (isLoading) {
    return (
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {[...Array(4)].map((_, i) => (
          <Skeleton key={i} className="h-24 rounded-xl" />
        ))}
      </div>
    )
  }

  const cards = [
    {
      icon: Phone,
      iconBg: 'bg-blue-100',
      iconColor: 'text-blue-600',
      value: totalCalls.toString(),
      label: 'Total calls',
      sub: <span className="text-xs text-muted-foreground">All time</span>,
    },
    {
      icon: Calendar,
      iconBg: 'bg-purple-100',
      iconColor: 'text-purple-600',
      value: thisMonth.toString(),
      label: 'This month',
      sub: stats ? <TrendBadge value={stats.month_trend} /> : null,
    },
    {
      icon: Timer,
      iconBg: 'bg-green-100',
      iconColor: 'text-green-600',
      value: stats ? formatDuration(stats.avg_duration_seconds) : '0s',
      label: 'Avg duration',
      sub: <span className="text-xs text-muted-foreground">Per completed call</span>,
    },
    {
      icon: Clock,
      iconBg: 'bg-amber-100',
      iconColor: 'text-amber-600',
      value: stats ? formatDuration(stats.total_duration_seconds) : '0s',
      label: 'Total talk time',
      sub: <span className="text-xs text-muted-foreground">All completed calls</span>,
    },
  ]

  return (
    <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
      {cards.map((c) => (
        <Card key={c.label} className="border shadow-sm">
          <CardContent className="p-4">
            <div className="flex items-center gap-3 mb-2">
              <div className={`rounded-lg p-2 ${c.iconBg}`}>
                <c.icon className={`h-[18px] w-[18px] ${c.iconColor}`} />
              </div>
            </div>
            <p className="text-2xl font-bold text-foreground">{c.value}</p>
            <p className="text-sm font-medium text-foreground">{c.label}</p>
            <div className="mt-0.5">{c.sub}</div>
          </CardContent>
        </Card>
      ))}
    </div>
  )
}
