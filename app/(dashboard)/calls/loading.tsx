import { CallsPageSkeleton } from '@/components/calls/CallsPageClient'

// The same placeholder the calls page streams behind its Suspense boundary, so
// the list replaces it in place.
export default function CallsLoading() {
  return (
    <div role="status">
      <span className="sr-only">Loading calls…</span>
      <CallsPageSkeleton />
    </div>
  )
}
