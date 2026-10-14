'use client'

import { RotateCw } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { PageContainer } from '@/components/shared/PageContainer'
import { PageHeader } from '@/components/shared/PageHeader'
import { useCommerceOverview } from '@/hooks/useCommerceOverview'
import { StoreOverview } from './StoreOverview'

/** /store: the full store overview. */
export function StoreOverviewPage() {
  const { overview, isLoading, error, refetch, replaceAutomation } = useCommerceOverview()
  return (
    <PageContainer>
      <PageHeader
        eyebrow="Store"
        title="Overview"
        description="Connection status, synced data, the call queue and the store's automations."
        actions={
          <Button variant="outline" size="sm" onClick={refetch} disabled={isLoading}>
            <RotateCw aria-hidden="true" />
            Refresh
          </Button>
        }
      />
      <StoreOverview
        overview={overview}
        isLoading={isLoading}
        error={error}
        onRetry={refetch}
        onAutomationChanged={replaceAutomation}
        variant="full"
      />
    </PageContainer>
  )
}
