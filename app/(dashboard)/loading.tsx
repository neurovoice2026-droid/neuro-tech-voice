import { OrbLoader } from '@/components/shared/OrbLoader'
import { PageContainer } from '@/components/shared/PageContainer'

// Route-level loading state for every dashboard page. It renders inside the
// dashboard shell (the (dashboard) layout is outside this boundary), so the
// sidebar stays put and the breathing orb fills the content area.
export default function DashboardLoading() {
  return (
    <PageContainer>
      <OrbLoader state="breathing" label="Loading…" className="min-h-[60vh]" />
    </PageContainer>
  )
}
