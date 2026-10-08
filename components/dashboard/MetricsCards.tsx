'use client'

import { useEffect, useRef, useState } from 'react'
import { StatTile } from '@/components/shared/StatTile'
import { formatDuration } from '@/lib/utils'
import type { DashboardMetrics } from '@/types'

/** Counts up to `target` in `duration` ms; with reduced motion it shows the value at once. */
function useCountUp(target: number, duration = 800) {
  const [value, setValue] = useState(0)
  const raf = useRef<number | null>(null)

  useEffect(() => {
    const start = performance.now()
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    function tick(now: number) {
      const elapsed = now - start
      const progress = reduce ? 1 : Math.min(elapsed / duration, 1)
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
  /** True until the first metrics response: the values show a breathing orb. */
  loading?: boolean
}

const fmt = (n: number) => n.toLocaleString('en-US')

export function MetricsCards({ metrics, loading = false }: MetricsCardsProps) {
  const callsToday = useCountUp(metrics?.calls_today ?? 0)
  const successRate = useCountUp(metrics?.success_rate ?? 0)
  const minutesUsed = useCountUp(metrics?.minutes_used ?? 0)
  const avgDuration = useCountUp(metrics?.avg_duration_seconds ?? 0)

  const minutesLimit = metrics?.minutes_limit ?? 0
  const minutesPct = metrics && minutesLimit > 0
    ? Math.round((metrics.minutes_used / minutesLimit) * 100)
    : 0
  const minutesLeft = Math.max(0, minutesLimit - (metrics?.minutes_used ?? 0))
  const meterTone = minutesPct >= 100 ? 'danger' : minutesPct >= 80 ? 'warning' : 'default'
  // No metrics after loading = the request failed (the insights card explains and retries).
  const missing = !loading && !metrics

  return (
    <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
      <StatTile
        label="Calls today"
        loading={loading}
        value={missing ? '—' : fmt(callsToday)}
        // No comparison figure from the API yet: a plain hint, not a trend chip.
        hint="since midnight"
      />
      <StatTile
        label="Avg call duration"
        loading={loading}
        value={missing ? '—' : formatDuration(avgDuration)}
        hint="completed calls"
      />
      <StatTile
        label="Answered rate"
        loading={loading}
        value={missing ? '—' : `${successRate}%`}
        hint={
          <span title="Share of finished calls that were answered and completed (not the AI's verdict)">
            of finished calls
          </span>
        }
      />
      <StatTile
        label="Minutes used"
        loading={loading}
        value={missing ? '—' : fmt(minutesUsed)}
        // A blank line while loading keeps the tile (the tallest in the row) from growing later.
        hint={metrics ? `of ${fmt(minutesLimit)} · ${fmt(minutesLeft)} left` : ' '}
        meter={{ value: minutesPct, tone: meterTone, label: 'Minutes used this period' }}
      />
    </div>
  )
}
