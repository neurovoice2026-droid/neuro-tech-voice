'use client'

import { useState } from 'react'
import dynamic from 'next/dynamic'
import Link from 'next/link'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { entitlementsFor, requiredPlanFor } from '@/lib/billing/entitlements'
import { OUTCOME_META } from '@/components/calls/call-display'
import { useDashboardMetrics } from '@/hooks/useDashboardMetrics'
import { useRecentCalls } from '@/hooks/useRecentCalls'
import { PageHeader } from './PageHeader'
import { MetricsCards, MetricsCardsSkeleton } from './MetricsCards'
import { CallsChart } from './CallsChart'
import { RecentCallsTable } from './RecentCallsTable'
import { AgentStatusCard } from './AgentStatusCard'
import { QuickActions } from './QuickActions'
import { IntegrationsStatus } from './IntegrationsStatus'
import { RealtimeActivityFeed } from './RealtimeActivityFeed'
// Opened on click: their code (the in-browser call, the uploader) loads the first time they open.
const TestCallDialog = dynamic(() => import('./TestCallDialog').then((m) => m.TestCallDialog))
const KnowledgeUploadDialog = dynamic(() => import('./KnowledgeUploadDialog').then((m) => m.KnowledgeUploadDialog))
import { DashboardWelcome, type SetupSnapshot } from './DashboardWelcome'
import { CALL_OUTCOMES, type Agent, type CallOutcome, type DashboardMetrics, type Integration, type Organization } from '@/types'

interface DashboardClientProps {
  org: Organization
  agent: Agent | null
  integrations: Pick<Integration, 'type' | 'is_active'>[]
  phoneNumber: string | null
  /** The setup checklist's data, read on the server with the rest of the page. */
  setup?: SetupSnapshot | null
}

// Booked, Answered and Flagged lead: they are the outcomes the owner acts on.
const HEADLINE: CallOutcome[] = ['booked', 'answered', 'flagged']

function OutcomeBreakdownCard({ metrics, isLoading }: { metrics: DashboardMetrics | null; isLoading: boolean }) {
  const breakdown = metrics?.outcome_breakdown
  const analysed = breakdown ? CALL_OUTCOMES.reduce((sum, o) => sum + (breakdown[o] ?? 0), 0) : 0
  const rows = breakdown
    ? [...HEADLINE, ...CALL_OUTCOMES.filter((o) => !HEADLINE.includes(o) && (breakdown[o] ?? 0) > 0)]
    : []

  return (
    <Card className="border shadow-sm">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base font-semibold">What came of your calls</CardTitle>
          <Link href="/calls" className="text-xs font-medium text-primary hover:underline focus-visible:underline focus-visible:outline-none">
            See calls
          </Link>
        </div>
        {metrics && <p className="text-xs text-muted-foreground">All time, test calls left out</p>}
      </CardHeader>
      <CardContent>
        {isLoading && !metrics ? (
          <div className="space-y-3" aria-busy="true">
            {[...Array(4)].map((_, i) => (
              <Skeleton key={i} className="h-7 w-full" />
            ))}
          </div>
        ) : !breakdown ? (
          <p className="py-4 text-center text-sm text-muted-foreground">Outcomes aren’t available right now.</p>
        ) : analysed === 0 ? (
          <p className="py-4 text-center text-sm text-muted-foreground">
            Once calls come in, you’ll see how many were booked, answered or need your attention.
          </p>
        ) : (
          <ul className="space-y-3">
            {rows.map((outcome) => {
              const count = breakdown[outcome] ?? 0
              const pct = analysed > 0 ? Math.round((count / analysed) * 100) : 0
              const meta = OUTCOME_META[outcome]
              return (
                <li key={outcome}>
                  <Link
                    href={`/calls?outcome=${outcome}`}
                    className="block rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
                    aria-label={`${meta.label}: ${count} calls, ${pct} percent. Show these calls`}
                  >
                    <div className="flex items-center justify-between gap-3 text-sm">
                      <span className="flex items-center gap-2 text-foreground">
                        <span aria-hidden="true" className={`size-2 rounded-full ${meta.dot}`} />
                        {meta.label}
                      </span>
                      <span className="tabular-nums text-muted-foreground">
                        <span className="font-medium text-foreground">{count.toLocaleString()}</span> · {pct}%
                      </span>
                    </div>
                    <div className="mt-1.5 h-2 w-full overflow-hidden rounded-full bg-muted" aria-hidden="true">
                      <div className="h-full rounded-full bg-primary/70" style={{ width: `${pct}%` }} />
                    </div>
                  </Link>
                </li>
              )
            })}
          </ul>
        )}
      </CardContent>
    </Card>
  )
}

const SENTIMENT_ROWS = [
  { key: 'positive', label: 'Positive', bar: 'bg-green-500', dot: 'bg-green-500' },
  { key: 'neutral', label: 'Neutral', bar: 'bg-gray-300', dot: 'bg-gray-400' },
  { key: 'negative', label: 'Negative', bar: 'bg-red-500', dot: 'bg-red-500' },
] as const

function hourRange(hour: number): string {
  const start = Math.min(23, Math.max(0, Math.floor(hour)))
  return `${String(start).padStart(2, '0')}:00–${String((start + 1) % 24).padStart(2, '0')}:00`
}

function CallerMoodCard({ metrics, isLoading, timezone }: { metrics: DashboardMetrics | null; isLoading: boolean; timezone: string }) {
  const breakdown = metrics?.sentiment_breakdown
  const rated = breakdown ? breakdown.positive + breakdown.neutral + breakdown.negative : 0

  return (
    <Card className="border shadow-sm">
      <CardHeader className="pb-2">
        <CardTitle className="text-base font-semibold">How callers felt</CardTitle>
        {metrics && <p className="text-xs text-muted-foreground">Mood at the end of each call, all time</p>}
      </CardHeader>
      <CardContent>
        {isLoading && !metrics ? (
          <div className="space-y-3" aria-busy="true">
            <Skeleton className="h-3 w-full rounded-full" />
            <Skeleton className="h-5 w-full" />
            <Skeleton className="h-5 w-2/3" />
          </div>
        ) : !breakdown ? (
          <p className="py-4 text-center text-sm text-muted-foreground">Caller mood isn’t available right now.</p>
        ) : rated === 0 ? (
          <p className="py-4 text-center text-sm text-muted-foreground">
            After your first conversations, you’ll see how many callers left happy.
          </p>
        ) : (
          <div className="space-y-3">
            <div className="flex h-3 w-full overflow-hidden rounded-full bg-muted" aria-hidden="true">
              {SENTIMENT_ROWS.map((row) => {
                const pct = (breakdown[row.key] / rated) * 100
                return pct > 0 ? <div key={row.key} className={`h-full ${row.bar}`} style={{ width: `${pct}%` }} /> : null
              })}
            </div>
            <ul className="grid grid-cols-3 gap-2 text-sm">
              {SENTIMENT_ROWS.map((row) => {
                const count = breakdown[row.key]
                return (
                  <li key={row.key}>
                    <Link
                      href={`/calls?sentiment=${row.key}`}
                      className="block rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
                      aria-label={`${row.label}: ${count} calls, ${Math.round((count / rated) * 100)} percent. Show these calls`}
                    >
                      <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
                        <span aria-hidden="true" className={`size-2 rounded-full ${row.dot}`} />
                        {row.label}
                      </span>
                      <span className="font-semibold tabular-nums text-foreground">{Math.round((count / rated) * 100)}%</span>
                    </Link>
                  </li>
                )
              })}
            </ul>
            {metrics && metrics.total_calls > 0 && (
              <p className="border-t pt-3 text-xs text-muted-foreground">
                Busiest hour: <span className="font-medium text-foreground">{hourRange(metrics.peak_hour)}</span> ({timezone})
              </p>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  )
}

export function DashboardClient({ org, agent, integrations, phoneNumber, setup }: DashboardClientProps) {
  const { metrics, isLoading: metricsLoading, error: metricsError } = useDashboardMetrics(org.id)
  const { calls, isLoading: callsLoading, error: callsError, version, refetch: refetchCalls } = useRecentCalls(org.id)
  const entitlements = entitlementsFor(org.plan)

  const [testCallOpen, setTestCallOpen] = useState(false)
  const [knowledgeOpen, setKnowledgeOpen] = useState(false)
  // Mounted from the first open on, so closing still animates.
  const [testCallUsed, setTestCallUsed] = useState(false)
  const [knowledgeUsed, setKnowledgeUsed] = useState(false)
  const [currentAgent, setCurrentAgent] = useState(agent)

  function handleAgentToggle(active: boolean) {
    if (currentAgent) setCurrentAgent({ ...currentAgent, is_active: active })
  }

  return (
    <>
      <DashboardWelcome orgId={org.id} initialSetup={setup} />

      <div className="mx-auto max-w-[1600px] space-y-4 p-4 sm:space-y-6 sm:p-6">
        <PageHeader org={org} agent={currentAgent} onAgentToggle={handleAgentToggle} />

        <MetricsCards metrics={metrics} isLoading={metricsLoading} error={metricsError} />

        <div className="grid grid-cols-1 gap-4 sm:gap-6 xl:grid-cols-3">
          <div className="min-w-0 space-y-4 sm:space-y-6 xl:col-span-2">
            <CallsChart
              refreshKey={version}
              advancedAnalytics={entitlements.advancedAnalytics}
              advancedAnalyticsPlan={requiredPlanFor('advancedAnalytics')}
              fullAnalytics={entitlements.fullAnalytics}
              fullAnalyticsPlan={requiredPlanFor('fullAnalytics')}
            />
            <RecentCallsTable calls={calls} isLoading={callsLoading} error={callsError} onRetry={() => void refetchCalls()} />
          </div>

          <div className="min-w-0 space-y-4 sm:space-y-6">
            <AgentStatusCard agent={currentAgent} />
            <OutcomeBreakdownCard metrics={metrics} isLoading={metricsLoading} />
            <CallerMoodCard metrics={metrics} isLoading={metricsLoading} timezone={org.timezone || 'UTC'} />
            <QuickActions
              onTestCall={() => {
                setTestCallUsed(true)
                setTestCallOpen(true)
              }}
              onKnowledgeUpload={() => {
                setKnowledgeUsed(true)
                setKnowledgeOpen(true)
              }}
            />
            <RealtimeActivityFeed calls={calls} isLoading={callsLoading} error={callsError} />
            <IntegrationsStatus integrations={integrations} />
          </div>
        </div>
      </div>

      {testCallUsed && (
        <TestCallDialog
          open={testCallOpen}
          onOpenChange={setTestCallOpen}
          phoneNumber={phoneNumber}
          agentName={currentAgent?.name ?? 'Your agent'}
        />
      )}
      {knowledgeUsed && <KnowledgeUploadDialog open={knowledgeOpen} onOpenChange={setKnowledgeOpen} />}
    </>
  )
}

/** Suspense fallback with the dashboard's layout, so nothing jumps when data arrives. */
export function DashboardSkeleton() {
  return (
    <div className="mx-auto max-w-[1600px] space-y-4 p-4 sm:space-y-6 sm:p-6" aria-busy="true" aria-label="Loading your dashboard">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="space-y-2">
          <Skeleton className="h-8 w-64 max-w-full" />
          <Skeleton className="h-4 w-80 max-w-full" />
        </div>
        <Skeleton className="h-[70px] w-full rounded-xl sm:w-72" />
      </div>
      <div className="space-y-3 sm:space-y-4">
        <MetricsCardsSkeleton />
      </div>
      <div className="grid grid-cols-1 gap-4 sm:gap-6 xl:grid-cols-3">
        <div className="space-y-4 sm:space-y-6 xl:col-span-2">
          <Skeleton className="h-[320px] rounded-xl" />
          <Skeleton className="h-[360px] rounded-xl" />
        </div>
        <div className="space-y-4 sm:space-y-6">
          <Skeleton className="h-48 rounded-xl" />
          <Skeleton className="h-56 rounded-xl" />
          <Skeleton className="h-40 rounded-xl" />
          <Skeleton className="h-40 rounded-xl" />
        </div>
      </div>
    </div>
  )
}
