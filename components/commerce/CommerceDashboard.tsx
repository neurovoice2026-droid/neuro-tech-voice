'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { PageHeader } from '@/components/dashboard/PageHeader'
import { MetricsCards } from '@/components/dashboard/MetricsCards'
import { CallsChart } from '@/components/dashboard/CallsChart'
import { RecentCallsTable } from '@/components/dashboard/RecentCallsTable'
import { AgentStatusCard } from '@/components/dashboard/AgentStatusCard'
import { RealtimeActivityFeed } from '@/components/dashboard/RealtimeActivityFeed'
import { DashboardWelcome } from '@/components/dashboard/DashboardWelcome'
import { PageContainer } from '@/components/shared/PageContainer'
import { SectionHeading } from '@/components/shared/SectionHeading'
import { useDashboardMetrics } from '@/hooks/useDashboardMetrics'
import { useRecentCalls } from '@/hooks/useRecentCalls'
import { useCommerceOverview } from '@/hooks/useCommerceOverview'
import type { Agent, Organization } from '@/types'
import { StoreOverview } from './StoreOverview'

interface CommerceDashboardProps {
  org: Organization
  agent: Agent | null
  phoneNumber: string | null
}

/**
 * The dashboard of an e-commerce organization: the same shell and header as
 * the service dashboard (greeting, agent toggle), the store overview on top,
 * then the generic call metrics and cards the agent produces either way.
 */
export function CommerceDashboard({ org, agent, phoneNumber }: CommerceDashboardProps) {
  const { metrics, isLoading: metricsLoading } = useDashboardMetrics()
  const { calls, isLoading: callsLoading, error: callsError, refetch: refetchCalls } = useRecentCalls(org.id)
  const { overview, isLoading: overviewLoading, error: overviewError, refetch: refetchOverview, replaceAutomation } = useCommerceOverview()
  const router = useRouter()
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
        <PageHeader org={org} agent={currentAgent} hasPhoneNumber={hasPhoneNumber} onAgentToggle={handleAgentToggle} />

        <section aria-labelledby="dashboard-store" className="mb-10">
          <SectionHeading
            title={<span id="dashboard-store">Store</span>}
            description="The store's connection, call queue and automations."
          />
          <StoreOverview
            overview={overview}
            isLoading={overviewLoading}
            error={overviewError}
            onRetry={refetchOverview}
            onAutomationChanged={replaceAutomation}
            variant="compact"
          />
        </section>

        <MetricsCards metrics={metricsLoading ? null : metrics} loading={metricsLoading} />

        {/* Same grid as the service dashboard: a fixed 360 px side column from xl. */}
        <div className="mt-6 grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,1fr)_360px]">
          <div className="min-w-0 space-y-6">
            <CallsChart />
            <RecentCallsTable calls={calls} isLoading={callsLoading} error={callsError} onRetry={refetchCalls} />
          </div>
          <div className="min-w-0 space-y-6">
            <AgentStatusCard agent={currentAgent} hasPhoneNumber={hasPhoneNumber} />
            <RealtimeActivityFeed calls={calls} isLoading={callsLoading} error={callsError} onRetry={refetchCalls} />
          </div>
        </div>
      </PageContainer>
    </>
  )
}
