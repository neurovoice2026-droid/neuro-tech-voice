import { Suspense } from 'react'
import { AutomationsPage } from '@/components/commerce/AutomationsPage'
import { OrbLoader } from '@/components/shared/OrbLoader'
import { PageContainer } from '@/components/shared/PageContainer'

// Suspense: the selected template lives in the query string (useSearchParams).
export default function StoreAutomationsPage() {
  return (
    <Suspense
      fallback={
        <PageContainer>
          <OrbLoader state="breathing" label="Loading automations…" className="min-h-[60vh]" />
        </PageContainer>
      }
    >
      <AutomationsPage />
    </Suspense>
  )
}
