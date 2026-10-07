'use client'

import { useEffect, useState } from 'react'
import { Activity, MessageCircleQuestion, Sparkles } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { outcomeLabel } from '@/lib/calls/labels'
import type { DashboardMetrics } from '@/types'

// Post-call analysis on the dashboard: the AI resolution rate (the AI's
// verdict on each call's goal, never sentiment), the outcome breakdown,
// calls in progress on the org's own agent, and the topics callers ask
// about (hidden when the provider has none).

interface TopicsResponse {
  available: boolean
  topics: Array<{ label: string; description: string; conversations: number; success_rate: number | null }>
}

interface LiveResponse {
  available: boolean
  count: number | null
}

const LIVE_REFRESH_MS = 30_000
const OUTCOMES_SHOWN = 6

function useJson<T>(url: string, refreshMs?: number): T | null {
  const [data, setData] = useState<T | null>(null)
  const [tick, setTick] = useState(0)
  useEffect(() => {
    const ctrl = new AbortController()
    fetch(url, { signal: ctrl.signal })
      .then(async (res) => (res.ok ? ((await res.json()) as T) : null))
      .then((value) => {
        if (!ctrl.signal.aborted && value) setData(value)
      })
      .catch((err: unknown) => {
        // Optional insight: keep the last value (or nothing) on a failed refresh.
        if (!ctrl.signal.aborted) console.warn('Insight request failed', url, err)
      })
    return () => ctrl.abort()
  }, [url, tick])
  useEffect(() => {
    if (!refreshMs) return
    const id = setInterval(() => setTick((t) => t + 1), refreshMs)
    return () => clearInterval(id)
  }, [refreshMs])
  return data
}

export function CallInsightsCard({ metrics }: { metrics: DashboardMetrics | null }) {
  const live = useJson<LiveResponse>('/api/dashboard/live', LIVE_REFRESH_MS)
  const topics = useJson<TopicsResponse>('/api/dashboard/topics')

  const outcomes = Object.entries(metrics?.outcome_breakdown ?? {})
    .filter(([, n]) => n > 0)
    .sort((a, b) => b[1] - a[1])
  const shown = outcomes.slice(0, OUTCOMES_SHOWN)
  const rest = outcomes.slice(OUTCOMES_SHOWN).reduce((s, [, n]) => s + n, 0)
  const rows = rest > 0 ? [...shown, ['__other', rest] as [string, number]] : shown
  const totalWithOutcome = outcomes.reduce((s, [, n]) => s + n, 0)
  const max = Math.max(1, ...rows.map(([, n]) => n))
  const ai = metrics?.ai_outcome_breakdown
  const judged = ai ? ai.success + ai.failure : 0

  return (
    <Card className="border shadow-sm">
      <CardHeader className="pb-2">
        <CardTitle className="text-base font-semibold">Call insights</CardTitle>
      </CardHeader>
      <CardContent className="space-y-5">
        {!metrics ? (
          <div className="space-y-2" aria-busy="true" aria-label="Loading call insights">
            <Skeleton className="h-12 w-full" />
            <Skeleton className="h-24 w-full" />
          </div>
        ) : (
          <>
            <dl className="grid grid-cols-2 gap-3">
              <div className="rounded-xl border bg-gray-50 p-3">
                <dt className="flex items-center gap-1.5 text-xs text-muted-foreground">
                  <Sparkles className="h-3.5 w-3.5 text-purple-600" aria-hidden="true" /> AI resolution rate
                </dt>
                <dd className="mt-1 text-2xl font-semibold text-foreground">
                  {metrics.ai_success_rate === null || metrics.ai_success_rate === undefined ? '—' : `${metrics.ai_success_rate}%`}
                </dd>
                <dd className="text-xs text-muted-foreground" title="Successful ÷ (successful + not successful), as judged by the AI after each call">
                  {judged > 0 ? `${ai?.success ?? 0} of ${judged} calls the AI could judge` : 'No AI verdicts yet'}
                </dd>
              </div>
              {live?.available && (
                <div className="rounded-xl border bg-gray-50 p-3">
                  <dt className="flex items-center gap-1.5 text-xs text-muted-foreground">
                    <Activity className="h-3.5 w-3.5 text-purple-600" aria-hidden="true" /> Calls in progress
                  </dt>
                  <dd className="mt-1 text-2xl font-semibold text-foreground" aria-live="polite">{live.count ?? 0}</dd>
                  <dd className="text-xs text-muted-foreground">right now, on your agent</dd>
                </div>
              )}
            </dl>

            <section aria-labelledby="insights-outcomes">
              <h3 id="insights-outcomes" className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Call outcomes</h3>
              {rows.length === 0 ? (
                <p className="text-sm text-muted-foreground">Outcomes appear here once calls have been analysed.</p>
              ) : (
                <ul className="space-y-2">
                  {rows.map(([key, n]) => {
                    const label = key === '__other' ? 'Other outcomes' : (outcomeLabel(key) ?? key)
                    const share = totalWithOutcome > 0 ? Math.round((n / totalWithOutcome) * 100) : 0
                    return (
                      <li key={key} title={`${label}: ${n} call${n === 1 ? '' : 's'} (${share}%)`}>
                        <div className="flex items-baseline justify-between gap-2 text-sm">
                          <span className="truncate text-foreground">{label}</span>
                          <span className="tabular-nums text-muted-foreground">{n}</span>
                        </div>
                        <div className="mt-1 h-2 w-full" aria-hidden="true">
                          <div className="h-2 rounded-r bg-purple-500" style={{ width: `${Math.max(2, (n / max) * 100)}%` }} />
                        </div>
                      </li>
                    )
                  })}
                </ul>
              )}
            </section>
          </>
        )}

        {topics?.available && topics.topics.length > 0 && (
          <section aria-labelledby="insights-topics">
            <h3 id="insights-topics" className="mb-2 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              <MessageCircleQuestion className="h-3.5 w-3.5" aria-hidden="true" /> What callers ask about
            </h3>
            <ol className="space-y-1.5">
              {topics.topics.map((t) => (
                <li key={t.label} className="flex items-baseline justify-between gap-2 text-sm" title={t.description || undefined}>
                  <span className="truncate text-foreground">{t.label}</span>
                  <span className="whitespace-nowrap text-xs tabular-nums text-muted-foreground">
                    {t.conversations} call{t.conversations === 1 ? '' : 's'}
                    {t.success_rate !== null ? ` · ${t.success_rate}% resolved` : ''}
                  </span>
                </li>
              ))}
            </ol>
          </section>
        )}
      </CardContent>
    </Card>
  )
}
