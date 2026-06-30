import { Suspense } from 'react'
import { CallsPageClient } from '@/components/calls/CallsPageClient'

export default function CallsPage() {
  return (
    <Suspense>
      <CallsPageClient />
    </Suspense>
  )
}
