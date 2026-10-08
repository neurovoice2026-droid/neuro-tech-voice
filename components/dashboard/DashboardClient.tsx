'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { PageHeader } from './PageHeader'
import { MetricsCards } from './MetricsCards'
import { CallsChart } from './CallsChart'
import { RecentCallsTable } from './RecentCallsTable'
import { AgentStatusCard } from './AgentStatusCard'
import { CallInsightsCard } from './CallInsightsCard'
import { MessagesToFollowUpCard } from './MessagesToFollowUpCard'
import { QuickActions } from './QuickActions'
import { IntegrationsStatus } from './IntegrationsStatus'
import { RealtimeActivityFeed } from './RealtimeActivityFeed'
import { TestCallDialog } from './TestCallDialog'
import { KnowledgeUploadDialog } from './KnowledgeUploadDialog'
import { DashboardWelcome } from './DashboardWelcome'
import { PageContainer } from '@/components/shared/PageContainer'
import { useDashboardMetrics } from '@/hooks/useDashboardMetrics'
import { useRecentCalls } from '@/hooks/useRecentCalls'
import type { Agent, Organization, Integration } from '@/types'

interface DashboardClientProps {
  org: Organization
  agent: Agent | null
  integrations: Integration[]
  phoneNumber: string | null
}

export function DashboardClient({ org, agent, integrations, phoneNumber }: DashboardClientProps) {
  const { metrics, isLoading: metricsLoading, error: metricsError, refetch: refetchMetrics } = useDashboardMetrics()
  const { calls, isLoading: callsLoading, error: callsError, refetch: refetchCalls } = useRecentCalls(org.id)
  const router = useRouter()

  const [testCallOpen, setTestCallOpen] = useState(false)
  const [knowledgeOpen, setKnowledgeOpen] = useState(false)
  const [currentAgent, setCurrentAgent] = useState(agent)

  const hasPhoneNumber = Boolean(phoneNumber)

  function handleAgentToggle(active: boolean) {
    if (currentAgent) setCurrentAgent({ ...currentAgent, is_active: active })
    // Re-render the (dashboard) layout so the shell's agent dot (mobile header) follows.
    router.refresh()
  }

  return (
    <>
      <DashboardWelcome agentActive={agent?.is_active === true} />

      <PageContainer>
        {/* Header */}
        <PageHeader org={org} agent={currentAgent} hasPhoneNumber={hasPhoneNumber} onAgentToggle={handleAgentToggle} />

        {/* Metrics */}
        <MetricsCards metrics={metricsLoading ? null : metrics} loading={metricsLoading} />

        {/* Main grid: a fixed 360 px side column from xl, so its cards never get cramped at 1280. */}
        <div className="mt-6 grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,1fr)_360px]">
          {/* Left column (wide): chart, insights, calls table, follow-ups (their rows read best wide,
              and the two columns end at about the same height) */}
          <div className="min-w-0 space-y-6">
            <CallsChart />
            <CallInsightsCard metrics={metrics} loading={metricsLoading} error={metricsError} onRetry={refetchMetrics} />
            <RecentCallsTable calls={calls} isLoading={callsLoading} error={callsError} onRetry={refetchCalls} />
            <MessagesToFollowUpCard />
          </div>

          {/* Right column: agent, shortcuts, integrations, live feed */}
          <div className="min-w-0 space-y-6">
            <AgentStatusCard agent={currentAgent} hasPhoneNumber={hasPhoneNumber} />
            <QuickActions
              onTestCall={() => setTestCallOpen(true)}
              onKnowledgeUpload={() => setKnowledgeOpen(true)}
            />
            <IntegrationsStatus integrations={integrations} />
            <RealtimeActivityFeed calls={calls} isLoading={callsLoading} error={callsError} onRetry={refetchCalls} />
          </div>
        </div>
      </PageContainer>

      {/* Dialogs */}
      <TestCallDialog
        open={testCallOpen}
        onOpenChange={setTestCallOpen}
        phoneNumber={phoneNumber}
        agentName={currentAgent?.name ?? 'your agent'}
      />
      <KnowledgeUploadDialog
        open={knowledgeOpen}
        onOpenChange={setKnowledgeOpen}
      />
    </>
  )
}
