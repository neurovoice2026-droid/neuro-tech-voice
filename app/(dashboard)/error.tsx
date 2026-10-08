'use client' // Error boundaries must be Client Components

// Error boundary for every dashboard page. It renders inside the dashboard
// shell (the (dashboard) layout is outside this boundary), so the navigation
// stays usable and the user can retry the page in place.

import { useEffect } from 'react'
import { RotateCw, TriangleAlert } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { PageContainer } from '@/components/shared/PageContainer'

export default function DashboardError({
  error,
  unstable_retry,
}: {
  error: Error & { digest?: string }
  /** Re-fetches and re-renders the segment (a server error may be transient). */
  unstable_retry: () => void
}) {
  useEffect(() => {
    // Server errors arrive with a generic message; the digest matches the server log.
    console.error('[dashboard] page failed to render', error)
  }, [error])

  return (
    <PageContainer width="narrow">
      <div role="alert" className="flex min-h-[60vh] items-center">
        {/* The EmptyState look, composed here because the page needs its own heading
            (EmptyState titles are h3, and nothing else on this page provides an h1). */}
        <div className="flex w-full flex-col items-center justify-center rounded-2xl bg-secondary px-6 py-12 text-center">
          <div className="mb-4 grid size-11 place-items-center rounded-full bg-destructive-soft text-destructive">
            <TriangleAlert aria-hidden="true" className="size-5" />
          </div>
          <h1 className="text-[15px] leading-[22px] font-medium text-foreground">This page could not be loaded</h1>
          <p className="mt-1 max-w-sm text-[13px] leading-[19px] text-muted-foreground">
            Something went wrong on our side. Please try again in a moment.
            {error.digest && (
              <span className="mt-2 block text-xs text-muted-foreground">
                Reference: <span className="font-mono">{error.digest}</span>
              </span>
            )}
          </p>
          <div className="mt-5">
            <Button onClick={() => unstable_retry()}>
              <RotateCw aria-hidden="true" />
              Try again
            </Button>
          </div>
        </div>
      </div>
    </PageContainer>
  )
}
