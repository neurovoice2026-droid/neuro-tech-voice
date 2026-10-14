import { Suspense } from 'react'
import { ConnectionsPage } from '@/components/commerce/ConnectionsPage'
import { OrbLoader } from '@/components/shared/OrbLoader'
import { PageContainer } from '@/components/shared/PageContainer'

// Suspense: the page reads the Shopify callback's query string (useSearchParams).
export default function MagazinConexiuniPage() {
  return (
    <Suspense
      fallback={
        <PageContainer>
          <OrbLoader state="breathing" label="Se încarcă conexiunile…" className="min-h-[60vh]" />
        </PageContainer>
      }
    >
      <ConnectionsPage />
    </Suspense>
  )
}
