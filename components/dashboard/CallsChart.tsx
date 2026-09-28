'use client'

import { useEffect, useState } from 'react'
import dynamic from 'next/dynamic'
import { Lock, RefreshCw } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { Button } from '@/components/ui/button'
import { UpgradeNotice } from '@/components/shared/UpgradeNotice'
import { cn, formatDuration } from '@/lib/utils'
import type { Plan } from '@/types'

export interface ChartPoint {
  /** Local day, YYYY-MM-DD. */
  date: string
  calls: number
  avg_duration_seconds: number
}

interface ChartProps {
  data: (ChartPoint & { label: string; fullLabel: string })[]
}

const CHART_HEIGHT = 220

function ChartSkeleton() {
  return <Skeleton className="w-full rounded-lg" style={{ height: CHART_HEIGHT }} />
}

// Recharts is large and only needed here: load it on the client, after the
// rest of the dashboard, with a skeleton of the same height meanwhile.
const CallsAreaChart = dynamic<ChartProps>(
  () =>
    import('recharts').then((mod) => {
      const { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } = mod

      function CallsTooltip({ active, payload }: { active?: boolean; payload?: { payload: ChartProps['data'][number] }[] }) {
        const point = active ? payload?.[0]?.payload : undefined
        if (!point) return null
        return (
          <div className="rounded-lg border bg-card px-3 py-2 text-xs shadow-md">
            <p className="font-semibold text-foreground">{point.fullLabel}</p>
            <p className="mt-0.5 text-foreground">
              {point.calls.toLocaleString()} {point.calls === 1 ? 'call' : 'calls'}
            </p>
            {point.calls > 0 && point.avg_duration_seconds > 0 && (
              <p className="text-muted-foreground">Average {formatDuration(point.avg_duration_seconds)}</p>
            )}
          </div>
        )
      }

      function Chart({ data }: ChartProps) {
        return (
          <ResponsiveContainer width="100%" height={CHART_HEIGHT}>
            <AreaChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: -16 }}>
              <defs>
                <linearGradient id="callsAreaFill" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="var(--chart-1)" stopOpacity={0.22} />
                  <stop offset="95%" stopColor="var(--chart-1)" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid vertical={false} stroke="var(--border)" />
              <XAxis
                dataKey="label"
                tick={{ fontSize: 12, fill: 'var(--muted-foreground)' }}
                axisLine={false}
                tickLine={false}
                interval="preserveStartEnd"
                minTickGap={16}
              />
              <YAxis
                allowDecimals={false}
                tick={{ fontSize: 12, fill: 'var(--muted-foreground)' }}
                axisLine={false}
                tickLine={false}
                width={40}
              />
              <Tooltip content={<CallsTooltip />} cursor={{ stroke: 'var(--muted-foreground)', strokeDasharray: '3 3' }} />
              <Area
                type="monotone"
                dataKey="calls"
                name="Calls"
                stroke="var(--chart-1)"
                strokeWidth={2}
                fill="url(#callsAreaFill)"
                dot={data.length <= 7 ? { r: 3, fill: 'var(--chart-1)', strokeWidth: 0 } : false}
                activeDot={{ r: 5, stroke: 'var(--card)', strokeWidth: 2 }}
                isAnimationActive={false}
              />
            </AreaChart>
          </ResponsiveContainer>
        )
      }
      return Chart
    }),
  { ssr: false, loading: ChartSkeleton }
)

function labelsFor(date: string, days: number): { label: string; fullLabel: string } {
  // Noon UTC keeps the calendar day stable in every viewer time zone.
  const d = new Date(`${date}T12:00:00Z`)
  if (Number.isNaN(d.getTime())) return { label: date, fullLabel: date }
  const label = days <= 7
    ? d.toLocaleDateString(undefined, { weekday: 'short', timeZone: 'UTC' })
    : d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', timeZone: 'UTC' })
  const fullLabel = d.toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric', timeZone: 'UTC' })
  return { label, fullLabel }
}

type Result = { key: string; points: ChartPoint[]; error: null } | { key: string; points: null; error: string }

type Range = 7 | 30 | 90

const RANGES: readonly Range[] = [7, 30, 90]

interface CallsChartProps {
  /** Changes when calls change (realtime), so the chart follows along. */
  refreshKey?: number
  /** 30-day view (Pro and up). */
  advancedAnalytics: boolean
  advancedAnalyticsPlan: Plan
  /** 90-day view (full analytics suite, Business and up). */
  fullAnalytics: boolean
  fullAnalyticsPlan: Plan
}

export function CallsChart({
  refreshKey = 0, advancedAnalytics, advancedAnalyticsPlan, fullAnalytics, fullAnalyticsPlan,
}: CallsChartProps) {
  const [days, setDays] = useState<Range>(7)
  const [locked, setLocked] = useState<Range | null>(null)
  const [retry, setRetry] = useState(0)
  const [result, setResult] = useState<Result | null>(null)
  const requestKey = `${days}#${retry}`

  useEffect(() => {
    const controller = new AbortController()
    fetch(`/api/dashboard/calls-chart?days=${days}`, { signal: controller.signal, cache: 'no-store' })
      .then(async (res) => {
        if (!res.ok) {
          const body = (await res.json().catch(() => null)) as { error?: { message?: string } } | null
          throw new Error(body?.error?.message ?? 'The chart couldn’t load.')
        }
        return (await res.json()) as { points: ChartPoint[] }
      })
      .then((body) => setResult({ key: requestKey, points: body.points, error: null }))
      .catch((err: unknown) => {
        if (controller.signal.aborted) return
        setResult({ key: requestKey, points: null, error: err instanceof Error ? err.message : 'The chart couldn’t load.' })
      })
    return () => controller.abort()
    // refreshKey re-runs the request without changing what is requested.
  }, [days, requestKey, refreshKey])

  const current = result?.key === requestKey ? result : null
  const points = current?.points ?? (result?.points && result.key.startsWith(`${days}#`) ? result.points : null)
  const data = (points ?? []).map((p) => ({ ...p, ...labelsFor(p.date, days) }))
  const totalCalls = data.reduce((sum, p) => sum + p.calls, 0)

  const allowed = (range: Range) => range === 7 || (range === 30 ? advancedAnalytics : fullAnalytics)

  function choose(next: Range) {
    if (!allowed(next)) {
      setLocked(next)
      return
    }
    setLocked(null)
    setDays(next)
  }

  return (
    <Card className="border shadow-sm">
      <CardHeader className="pb-2">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <CardTitle className="text-base font-semibold">Calls per day</CardTitle>
            {points && (
              <p className="mt-0.5 text-xs text-muted-foreground">
                {totalCalls.toLocaleString()} {totalCalls === 1 ? 'call' : 'calls'} in the last {days} days
              </p>
            )}
          </div>
          <div role="group" aria-label="Chart range" className="inline-flex rounded-lg bg-muted p-0.5">
            {RANGES.map((option) => (
              <button
                key={option}
                type="button"
                onClick={() => choose(option)}
                aria-pressed={days === option}
                className={cn(
                  'inline-flex h-8 items-center gap-1 rounded-md px-2.5 text-xs font-medium sm:h-7 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50',
                  days === option ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'
                )}
              >
                {!allowed(option) && <Lock aria-hidden="true" className="size-3" />}
                {option} days
              </button>
            ))}
          </div>
        </div>
        {locked !== null && (
          <UpgradeNotice
            compact
            className="mt-2"
            feature={locked === 90 ? 'The 90-day view' : 'The 30-day view'}
            requiredPlan={locked === 90 ? fullAnalyticsPlan : advancedAnalyticsPlan}
          />
        )}
      </CardHeader>
      <CardContent>
        {result?.error && !points ? (
          <div className="flex flex-col items-center justify-center gap-3 text-center" style={{ height: CHART_HEIGHT }}>
            <p className="text-sm text-muted-foreground">{result.error}</p>
            <Button variant="outline" size="sm" className="gap-2" onClick={() => setRetry((n) => n + 1)}>
              <RefreshCw aria-hidden="true" className="size-3.5" /> Try again
            </Button>
          </div>
        ) : !points ? (
          <ChartSkeleton />
        ) : (
          <>
            <div className="relative">
              <div aria-hidden="true">
                <CallsAreaChart data={data} />
              </div>
              {totalCalls === 0 && (
                // A flat line at zero reads like a broken chart; say what it means.
                <p className="absolute inset-x-0 top-1/2 mx-auto w-fit max-w-[80%] -translate-y-1/2 rounded-lg border bg-card px-3 py-2 text-center text-sm text-muted-foreground shadow-sm">
                  No calls in the last {days} days yet
                </p>
              )}
            </div>
            <table className="sr-only">
              <caption>Calls per day, last {days} days</caption>
              <thead>
                <tr>
                  <th scope="col">Day</th>
                  <th scope="col">Calls</th>
                  <th scope="col">Average length</th>
                </tr>
              </thead>
              <tbody>
                {data.map((p) => (
                  <tr key={p.date}>
                    <th scope="row">{p.fullLabel}</th>
                    <td>{p.calls}</td>
                    <td>{p.avg_duration_seconds > 0 ? formatDuration(p.avg_duration_seconds) : 'none'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </>
        )}
      </CardContent>
    </Card>
  )
}
