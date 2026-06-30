'use client'

import { useEffect, useRef, useState } from 'react'
import { PhoneCall, Clock, TrendingUp, Zap } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { StatBadge } from '@/components/shared/StatBadge'
import type { DashboardMetrics } from '@/types'

function useCountUp(target: number, duration = 800) {
  const [value, setValue] = useState(0)
  const raf = useRef<number | null>(null)

  useEffect(() => {
    const start = performance.now()
    function tick(now: number) {
      const elapsed = now - start
      const progress = Math.min(elapsed / duration, 1)
      const eased = 1 - Math.pow(1 - progress, 3)
      setValue(Math.round(eased * target))
      if (progress < 1) raf.current = requestAnimationFrame(tick)
    }
    raf.current = requestAnimationFrame(tick)
    return () => { if (raf.current) cancelAnimationFrame(raf.current) }
  }, [target, duration])

  return value
}

interface MetricsCardsProps {
  metrics: DashboardMetrics | null
}

export function MetricsCards({ metrics }: MetricsCardsProps) {
  const callsToday = useCountUp(metrics?.calls_today ?? 0)
  const successRate = useCountUp(metrics?.success_rate ?? 0)
  const minutesUsed = useCountUp(metrics?.minutes_used ?? 0)
  const avgDuration = useCountUp(
    metrics ? Math.round(metrics.avg_duration_seconds / 60) : 0
  )

  const minutesPct = metrics
    ? Math.round((metrics.minutes_used / metrics.minutes_limit) * 100)
    : 0

  const cards = [
    {
      label: 'Calls Today',
      value: callsToday.toString(),
      icon: PhoneCall,
      iconColor: 'text-purple-600',
      iconBg: 'bg-purple-100',
      badge: <StatBadge value={metrics?.calls_today ?? 0} suffix=" today" />,
    },
    {
      label: 'Avg Call Duration',
      value: `${avgDuration}m`,
      icon: Clock,
      iconColor: 'text-blue-600',
      iconBg: 'bg-blue-100',
      badge: null,
    },
    {
      label: 'Success Rate',
      value: `${successRate}%`,
      icon: TrendingUp,
      iconColor: 'text-green-600',
      iconBg: 'bg-green-100',
      badge: <StatBadge value={0} suffix="" />,
    },
    {
      label: 'Minutes Used',
      value: `${minutesUsed}`,
      icon: Zap,
      iconColor: 'text-amber-600',
      iconBg: 'bg-amber-100',
      badge: (
        <span className="text-xs text-muted-foreground">
          of {metrics?.minutes_limit ?? 0}
        </span>
      ),
      extra: (
        <div className="mt-3">
          <div className="flex justify-between text-xs text-muted-foreground mb-1">
            <span>{minutesPct}% used</span>
            <span>{(metrics?.minutes_limit ?? 0) - (metrics?.minutes_used ?? 0)} left</span>
          </div>
          <div className="h-1.5 w-full rounded-full bg-muted overflow-hidden">
            <div
              className="h-full rounded-full bg-amber-500 transition-all duration-700"
              style={{ width: `${Math.min(minutesPct, 100)}%` }}
            />
          </div>
        </div>
      ),
    },
  ]

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
      {cards.map((c) => (
        <Card key={c.label} className="border shadow-sm">
          <CardContent className="p-5">
            <div className="flex items-center justify-between">
              <div className={`rounded-xl p-2.5 ${c.iconBg}`}>
                <c.icon className={`h-5 w-5 ${c.iconColor}`} />
              </div>
              {c.badge}
            </div>
            <div className="mt-3">
              <p className="text-2xl font-bold text-foreground">{c.value}</p>
              <p className="text-sm text-muted-foreground">{c.label}</p>
            </div>
            {c.extra}
          </CardContent>
        </Card>
      ))}
    </div>
  )
}
