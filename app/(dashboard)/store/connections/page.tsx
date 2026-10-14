import { Suspense } from 'react'
import { ConnectionsPage } from '@/components/commerce/ConnectionsPage'
import { OrbLoader } from '@/components/shared/OrbLoader'
import { PageContainer } from '@/components/shared/PageContainer'

// Suspense: the page reads the Shopify callback's query string (useSearchParams).
export default function StoreConnectionsPage() {
  return (
    <Suspense
      fallback={
        <PageContainer>
          <OrbLoader state="breathing" label="Loading connections…" className="min-h-[60vh]" />
        </PageContainer>
      }
    >
      <ConnectionsPage />
    </Suspense>
  )
}
