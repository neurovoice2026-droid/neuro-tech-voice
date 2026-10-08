'use client'

import { useEffect, useState, useSyncExternalStore } from 'react'
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer,
} from 'recharts'
import type { DotItemDotProps } from 'recharts/types/util/types'
import { Card, CardAction, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { OrbLoader } from '@/components/shared/OrbLoader'
import type { ChartDataPoint } from '@/app/api/dashboard/calls-chart/route'
import { CardError } from './CardError'

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

const CHART_HEIGHT = 220
const SERIES = 'var(--chart-1)'
const AXIS_TICK = { fontSize: 12, fill: 'var(--muted-foreground)' }

/** Only the latest day gets a marker: the line's end, ringed in the surface colour. */
function EndDot(props: DotItemDotProps & { lastIndex: number }) {
  const { cx, cy, index, lastIndex } = props
  if (index !== lastIndex || cx == null || cy == null) return <g />
  return <circle cx={cx} cy={cy} r={4.5} fill={SERIES} stroke="var(--card)" strokeWidth={2} />
}

export function CallsChart() {
  const [state, setState] = useState<ChartState>({ data: [], loaded: false, error: false })
  const [attempt, setAttempt] = useState(0)
  const isClient = useIsClient()

  function retry() {
    setState({ data: [], loaded: false, error: false })
    setAttempt((n) => n + 1)
  }

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
  }, [attempt])

  const totalCalls = state.data.reduce((s, d) => s + d.calls, 0)
  const lastIndex = state.data.length - 1
  const ready = isClient && state.loaded && !state.error

  return (
    <Card>
      <CardHeader>
        <CardTitle>Calls this week</CardTitle>
        {/* Always rendered (empty until ready) so the header keeps its height when the total arrives. */}
        <CardAction className="self-center text-[13px] leading-[19px] text-muted-foreground tabular-nums">
          {ready && `${totalCalls.toLocaleString('en-US')} ${totalCalls === 1 ? 'call' : 'calls'} · last 7 days`}
        </CardAction>
      </CardHeader>
      <CardContent>
        {!isClient || !state.loaded ? (
          <OrbLoader label="Loading this week's calls…" className="h-[220px]" />
        ) : state.error ? (
          <div className="grid h-[220px] place-items-center">
            <CardError role="status" message="The chart could not be loaded." onRetry={retry} className="px-0 py-0" />
          </div>
        ) : (
          <figure aria-label={`Calls per day over the last 7 days, ${totalCalls} in total`} className="-mx-1 [&_svg:focus-visible]:outline-2 [&_svg:focus-visible]:outline-offset-2 [&_svg:focus-visible]:outline-solid [&_svg:focus-visible]:outline-ring">
            <ResponsiveContainer width="100%" height={CHART_HEIGHT}>
              <AreaChart data={state.data} margin={{ top: 8, right: 8, bottom: 0, left: -24 }}>
                <defs>
                  <linearGradient id="callsArea" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor={SERIES} stopOpacity={0.1} />
                    <stop offset="100%" stopColor={SERIES} stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid vertical={false} stroke="var(--chart-grid)" />
                <XAxis
                  dataKey="date"
                  tick={AXIS_TICK}
                  axisLine={false}
                  tickLine={false}
                  tickMargin={10}
                  padding={{ left: 8, right: 8 }}
                />
                <YAxis
                  allowDecimals={false}
                  tick={AXIS_TICK}
                  axisLine={false}
                  tickLine={false}
                  tickMargin={8}
                  width={48}
                />
                <Tooltip
                  cursor={{ stroke: 'var(--border)', strokeWidth: 1 }}
                  contentStyle={{
                    background: 'var(--popover)',
                    border: 'none',
                    borderRadius: 12,
                    boxShadow: 'var(--shadow-pop)',
                    fontSize: 12,
                    padding: '8px 12px',
                  }}
                  labelStyle={{ color: 'var(--foreground)', fontWeight: 500, marginBottom: 2 }}
                  itemStyle={{ color: 'var(--foreground)', padding: 0 }}
                />
                <Area
                  type="linear"
                  dataKey="calls"
                  name="Calls"
                  stroke={SERIES}
                  strokeWidth={2}
                  strokeLinejoin="round"
                  strokeLinecap="round"
                  fill="url(#callsArea)"
                  dot={(props: DotItemDotProps) => <EndDot key={props.index} {...props} lastIndex={lastIndex} />}
                  activeDot={{ r: 4.5, fill: SERIES, stroke: 'var(--card)', strokeWidth: 2 }}
                  isAnimationActive={false}
                />
              </AreaChart>
            </ResponsiveContainer>
          </figure>
        )}
      </CardContent>
    </Card>
  )
}
