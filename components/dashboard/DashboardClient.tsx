'use client'

import { useState } from 'react'
import { PageHeader } from './PageHeader'
import { MetricsCards } from './MetricsCards'
import { CallsChart } from './CallsChart'
import { RecentCallsTable } from './RecentCallsTable'
import { AgentStatusCard } from './AgentStatusCard'
import { QuickActions } from './QuickActions'
import { IntegrationsStatus } from './IntegrationsStatus'
import { RealtimeActivityFeed } from './RealtimeActivityFeed'
import { TestCallDialog } from './TestCallDialog'
import { KnowledgeUploadDialog } from './KnowledgeUploadDialog'
import { DashboardWelcome } from './DashboardWelcome'
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
  const { metrics, isLoading: metricsLoading } = useDashboardMetrics()
  const { calls, isLoading: callsLoading } = useRecentCalls(org.id)

  const [testCallOpen, setTestCallOpen] = useState(false)
  const [knowledgeOpen, setKnowledgeOpen] = useState(false)
  const [currentAgent, setCurrentAgent] = useState(agent)

  function handleAgentToggle(active: boolean) {
    if (currentAgent) setCurrentAgent({ ...currentAgent, is_active: active })
  }

  return (
    <>
      <DashboardWelcome />

      <div className="p-6 space-y-6 max-w-[1600px] mx-auto">
        {/* Header */}
        <PageHeader org={org} agent={currentAgent} onAgentToggle={handleAgentToggle} />

        {/* Metrics */}
        <MetricsCards metrics={metricsLoading ? null : metrics} />

        {/* Main grid */}
        <div className="grid grid-cols-1 gap-6 xl:grid-cols-3">
          {/* Left column — chart + calls table */}
          <div className="xl:col-span-2 space-y-6">
            <CallsChart />
            <RecentCallsTable calls={calls} isLoading={callsLoading} />
          </div>

          {/* Right column — cards */}
          <div className="space-y-6">
            <AgentStatusCard agent={currentAgent} />
            <QuickActions
              onTestCall={() => setTestCallOpen(true)}
              onKnowledgeUpload={() => setKnowledgeOpen(true)}
            />
            <IntegrationsStatus integrations={integrations} />
            <RealtimeActivityFeed calls={calls} />
          </div>
        </div>
      </div>

      {/* Dialogs */}
      <TestCallDialog
        open={testCallOpen}
        onOpenChange={setTestCallOpen}
        phoneNumber={phoneNumber}
        agentName={currentAgent?.name ?? 'Your Agent'}
      />
      <KnowledgeUploadDialog
        open={knowledgeOpen}
        onOpenChange={setKnowledgeOpen}
      />
    </>
  )
}
