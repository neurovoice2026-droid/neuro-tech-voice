'use client'

import { useEffect, useState } from 'react'
import { MessageCircleQuestion, Sparkles } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { LiveDot } from '@/components/shared/LiveDot'
import { OrbLoader } from '@/components/shared/OrbLoader'
import { StatTile } from '@/components/shared/StatTile'
import { outcomeLabel } from '@/lib/calls/labels'
import { cn } from '@/lib/utils'
import type { DashboardMetrics } from '@/types'
import { CardError } from './CardError'

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

/** How long the Retry button shows its orb (the metrics hook reports no in-flight state). */
const RETRY_FEEDBACK_MS = 1500

interface CallInsightsCardProps {
  /** Last good metrics (kept when a background refresh fails). */
  metrics: DashboardMetrics | null
  /** True until the first metrics response (success or failure). */
  loading: boolean
  /** Message of the last failed metrics request, if any. */
  error: string | null
  onRetry: () => void
}

export function CallInsightsCard({ metrics, loading, error, onRetry }: CallInsightsCardProps) {
  const live = useJson<LiveResponse>('/api/dashboard/live', LIVE_REFRESH_MS)
  const topics = useJson<TopicsResponse>('/api/dashboard/topics')
  const [retrying, setRetrying] = useState(false)
  useEffect(() => {
    if (!retrying) return
    const id = setTimeout(() => setRetrying(false), RETRY_FEEDBACK_MS)
    return () => clearTimeout(id)
  }, [retrying])
  const retry = () => {
    setRetrying(true)
    onRetry()
  }

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

  const showTopics = !!topics?.available && topics.topics.length > 0
  const overline = 'text-[11px] leading-4 font-medium tracking-[0.12em] text-muted-foreground uppercase'

  const outcomesSection = metrics && (
    <section aria-labelledby="insights-outcomes" className="min-w-0">
      <h3 id="insights-outcomes" className={cn(overline, 'mb-3')}>Call outcomes</h3>
      {rows.length === 0 ? (
        <p className="text-[13px] text-muted-foreground">Outcomes appear here once calls have been analysed.</p>
      ) : (
        <ul className="space-y-3">
          {rows.map(([key, n]) => {
            const label = key === '__other' ? 'Other outcomes' : (outcomeLabel(key) ?? key)
            const share = totalWithOutcome > 0 ? Math.round((n / totalWithOutcome) * 100) : 0
            return (
              <li key={key} title={`${label}: ${n} call${n === 1 ? '' : 's'} (${share}%)`}>
                <div className="flex items-baseline justify-between gap-2 text-[13px] leading-[19px]">
                  <span className="truncate text-foreground">{label}</span>
                  <span className="text-muted-foreground tabular-nums">{n}</span>
                </div>
                <div className="mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-secondary" aria-hidden="true">
                  <div className="h-full rounded-full bg-chart-ink" style={{ width: `${Math.max(2, (n / max) * 100)}%` }} />
                </div>
              </li>
            )
          })}
        </ul>
      )}
    </section>
  )

  const topicsSection = showTopics && (
    <section aria-labelledby="insights-topics" className="min-w-0">
      <h3 id="insights-topics" className={cn(overline, 'mb-1.5 flex items-center gap-1.5')}>
        <MessageCircleQuestion className="size-3.5" aria-hidden="true" /> What callers ask about
      </h3>
      <ol>
        {topics.topics.map((t) => (
          // flex-wrap: in a narrow card the counts move under the topic instead of cutting it off.
          <li key={t.label} className="flex flex-wrap items-baseline justify-between gap-x-3 border-b border-rule py-2 text-[13px] leading-[19px] last:border-b-0" title={t.description || undefined}>
            <span className="min-w-0 truncate text-foreground">{t.label}</span>
            <span className="ml-auto whitespace-nowrap text-xs text-muted-foreground tabular-nums">
              {t.conversations} call{t.conversations === 1 ? '' : 's'}
              {t.success_rate !== null ? ` · ${t.success_rate}% resolved` : ''}
            </span>
          </li>
        ))}
      </ol>
    </section>
  )

  return (
    <Card className="gap-0">
      <CardHeader className="pb-4">
        <CardTitle>Call insights</CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        {!metrics && loading ? (
          // Reserves the tiles + outcome bars it replaces, so the calls table below does not jump.
          <OrbLoader label="Loading call insights…" className="min-h-[826px] md:min-h-[447px]" />
        ) : !metrics ? (
          <CardError
            message="Call insights could not be loaded."
            detail={error}
            onRetry={retry}
            retrying={retrying}
            className="px-0 py-0"
          />
        ) : (
          <>
            {error && (
              <p className="flex flex-wrap items-center gap-x-2 gap-y-1 rounded-xl bg-band px-3 py-2 text-xs leading-4 text-muted-foreground">
                Could not refresh these numbers; showing the last ones loaded.
                <Button
                  variant="link"
                  className="text-xs"
                  onClick={retry}
                  disabled={retrying}
                >
                  {retrying ? 'Retrying…' : 'Retry'}
                </Button>
              </p>
            )}
            <div className="grid gap-3 sm:grid-cols-2">
              <StatTile
                size="sm"
                label="AI resolution rate"
                icon={<Sparkles className="text-brand" aria-hidden="true" />}
                value={metrics.ai_success_rate === null || metrics.ai_success_rate === undefined ? '—' : `${metrics.ai_success_rate}%`}
                hint={
                  <span title="Successful ÷ (successful + not successful), as judged by the AI after each call">
                    {judged > 0 ? `${ai?.success ?? 0} of ${judged} calls the AI could judge` : 'No AI verdicts yet'}
                  </span>
                }
              />
              {live?.available && (
                <StatTile
                  size="sm"
                  label="Calls in progress"
                  icon={<LiveDot active={(live.count ?? 0) > 0} />}
                  value={<span aria-live="polite">{live.count ?? 0}</span>}
                  hint="right now, on your agent"
                />
              )}
            </div>
          </>
        )}

        {/* While the first metrics load, the orb alone holds the card (topics wait for it). */}
        {!(loading && !metrics) && (outcomesSection || topicsSection) && (
          <div className={cn('grid gap-x-10 gap-y-6', outcomesSection && topicsSection ? 'md:grid-cols-2' : null)}>
            {outcomesSection}
            {topicsSection}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
