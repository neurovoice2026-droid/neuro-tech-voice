'use client'

import { useEffect, useState, useSyncExternalStore } from 'react'
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer,
} from 'recharts'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import type { ChartDataPoint } from '@/app/api/dashboard/calls-chart/route'

const noopSubscribe = () => () => {}

/** True only in the browser (recharts measures the DOM, so it must not render on the server). */
function useIsClient(): boolean {
  return useSyncExternalStore(noopSubscribe, () => true, () => false)
}

interface ChartState {
  data: ChartDataPoint[]
  loaded: boolean
  error: boolean
}

export function CallsChart() {
  const [state, setState] = useState<ChartState>({ data: [], loaded: false, error: false })
  const isClient = useIsClient()

  useEffect(() => {
    const ctrl = new AbortController()
    fetch('/api/dashboard/calls-chart', { signal: ctrl.signal })
      .then(async (r) => {
        if (!r.ok) throw new Error(`calls-chart ${r.status}`)
        return (await r.json()) as ChartDataPoint[]
      })
      .then((data) => {
        if (!ctrl.signal.aborted) setState({ data, loaded: true, error: false })
      })
      .catch(() => {
        // Aborted on unmount; otherwise show the inline error state below.
        if (!ctrl.signal.aborted) setState({ data: [], loaded: true, error: true })
      })
    return () => ctrl.abort()
  }, [])

  const totalCalls = state.data.reduce((s, d) => s + d.calls, 0)

  return (
    <Card className="border shadow-sm">
      <CardHeader className="pb-2">
        <CardTitle className="text-base font-semibold">Calls This Week</CardTitle>
      </CardHeader>
      <CardContent>
        {!isClient || !state.loaded ? (
          <Skeleton className="h-[220px] w-full rounded-lg" />
        ) : state.error ? (
          <div className="flex h-[220px] items-center justify-center text-sm text-muted-foreground" role="status">
            The chart could not be loaded. It will refresh with the page.
          </div>
        ) : (
          <figure aria-label={`Calls per day over the last 7 days, ${totalCalls} in total`}>
            <ResponsiveContainer width="100%" height={220}>
              <AreaChart data={state.data} margin={{ top: 4, right: 4, bottom: 0, left: -20 }}>
                <defs>
                  <linearGradient id="purpleGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="hsl(263, 70%, 58%)" stopOpacity={0.25} />
                    <stop offset="95%" stopColor="hsl(263, 70%, 58%)" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis
                  dataKey="date"
                  tick={{ fontSize: 12, fill: 'hsl(var(--muted-foreground))' }}
                  axisLine={false}
                  tickLine={false}
                />
                <YAxis
                  allowDecimals={false}
                  tick={{ fontSize: 12, fill: 'hsl(var(--muted-foreground))' }}
                  axisLine={false}
                  tickLine={false}
                />
                <Tooltip
                  contentStyle={{
                    background: 'hsl(var(--card))',
                    border: '1px solid hsl(var(--border))',
                    borderRadius: '8px',
                    fontSize: 12,
                  }}
                  labelStyle={{ fontWeight: 600 }}
                />
                <Area
                  type="monotone"
                  dataKey="calls"
                  name="Calls"
                  stroke="hsl(263, 70%, 58%)"
                  strokeWidth={2}
                  fill="url(#purpleGradient)"
                  dot={{ r: 3, fill: 'hsl(263, 70%, 58%)', strokeWidth: 0 }}
                  activeDot={{ r: 5 }}
                />
              </AreaChart>
            </ResponsiveContainer>
          </figure>
        )}
      </CardContent>
    </Card>
  )
}
