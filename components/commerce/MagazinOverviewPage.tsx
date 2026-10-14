'use client'

import { RotateCw } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { PageContainer } from '@/components/shared/PageContainer'
import { PageHeader } from '@/components/shared/PageHeader'
import { useCommerceOverview } from '@/hooks/useCommerceOverview'
import { StoreOverview } from './StoreOverview'

/** /magazin: the full store overview. */
export function MagazinOverviewPage() {
  const { overview, isLoading, error, refetch, replaceAutomation } = useCommerceOverview()
  return (
    <PageContainer>
      <PageHeader
        eyebrow="Magazin"
        title="Prezentare"
        description="Starea conexiunii, datele sincronizate, coada de apeluri și automatizările magazinului."
        actions={
          <Button variant="outline" size="sm" onClick={refetch} disabled={isLoading}>
            <RotateCw aria-hidden="true" />
            Reîmprospătează
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
