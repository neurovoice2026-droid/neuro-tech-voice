'use client'

import { useEffect, useRef, useState } from 'react'
import { StatTile } from '@/components/shared/StatTile'
import { StatBadge } from '@/components/shared/StatBadge'
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

// Every tile reserves the same hint space in every state, so nothing grows when the
// stats arrive and all four tiles keep one height: one chip-tall line (24 px) in a
// wide tile; in a tile under 160 px (two columns on a phone, four next to the sidebar
// around 1024 px), where the trend chip and "vs last month" cannot share a line, a
// chip line plus a text line (44 px).
function Hint({ children }: { children?: React.ReactNode }) {
  return (
    <span className="@container/hint block min-w-0">
      <span className="flex min-h-6 min-w-0 items-center @max-[159px]/hint:min-h-11 @max-[159px]/hint:items-start">
        {children}
      </span>
    </span>
  )
}

function MonthTrend({ value }: { value: number }) {
  return (
    <Hint>
      <span className="flex min-w-0 flex-nowrap items-center gap-x-1.5 gap-y-1 whitespace-nowrap @max-[159px]/hint:flex-wrap">
        <StatBadge value={value} className="shrink-0" />
        <span className="min-w-0 truncate">vs last month</span>
      </span>
    </Hint>
  )
}

interface CallsStatsBarProps {
  stats: CallStats | null
  isLoading: boolean
}

/**
 * Four tinted metric tiles above the calls list; each shows a breathing orb while the stats load.
 * No label icons, like the dashboard metrics: tiles carry an icon only when it means something
 * (AI provenance, live).
 */
export function CallsStatsBar({ stats, isLoading }: CallsStatsBarProps) {
  const totalCalls = useCountUp(stats?.total_calls ?? 0)
  const thisMonth  = useCountUp(stats?.calls_this_month ?? 0)

  return (
    <section aria-label="Call statistics" className="grid grid-cols-2 gap-3 lg:grid-cols-4">
      <StatTile
        size="sm"
        label="Total calls"
        loading={isLoading}
        value={totalCalls.toLocaleString()}
        hint={<Hint>All time</Hint>}
      />
      <StatTile
        size="sm"
        label="This month"
        loading={isLoading}
        value={thisMonth.toLocaleString()}
        hint={stats ? <MonthTrend value={stats.month_trend} /> : <Hint />}
      />
      <StatTile
        size="sm"
        label="Avg duration"
        loading={isLoading}
        value={stats ? formatDuration(stats.avg_duration_seconds) : '0s'}
        hint={<Hint>Per completed call</Hint>}
      />
      <StatTile
        size="sm"
        label="Total talk time"
        loading={isLoading}
        value={stats ? formatDuration(stats.total_duration_seconds) : '0s'}
        hint={<Hint>All completed calls</Hint>}
      />
    </section>
  )
}
