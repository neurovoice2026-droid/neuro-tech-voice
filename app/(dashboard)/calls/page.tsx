import { Suspense } from 'react'
import { CallsPageClient } from '@/components/calls/CallsPageClient'
import { OrbLoader } from '@/components/shared/OrbLoader'
import { PageContainer } from '@/components/shared/PageContainer'

export default function CallsPage() {
  return (
    <Suspense
      fallback={
        <PageContainer>
          <OrbLoader state="breathing" label="Loading calls…" className="min-h-[60vh]" />
        </PageContainer>
      }
    >
      <CallsPageClient />
    </Suspense>
  )
}
