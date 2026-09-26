import { DashboardSkeleton } from '@/components/dashboard/DashboardClient'

// The same placeholder the page streams behind its Suspense boundary, so
// navigating here shows one skeleton that the dashboard then replaces in place.
export default function DashboardLoading() {
  return (
    <div role="status">
      <span className="sr-only">Loading your dashboard…</span>
      <DashboardSkeleton />
    </div>
  )
}
