'use client' // Error boundaries must be Client Components

// Error boundary for every dashboard page. It renders inside the dashboard
// shell (the (dashboard) layout is outside this boundary), so the navigation
// stays usable and the user can retry the page in place.

import { useEffect } from 'react'
import { AlertTriangle, RotateCw } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'

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
    <div className="p-6 max-w-[1600px] mx-auto">
      <Card className="mx-auto max-w-lg">
        <CardContent className="flex flex-col items-center gap-4 py-10 text-center" role="alert">
          <div className="rounded-full bg-red-50 p-4">
            <AlertTriangle className="h-8 w-8 text-red-500" aria-hidden="true" />
          </div>
          <div className="space-y-1">
            <h2 className="text-lg font-semibold text-foreground">This page could not be loaded</h2>
            <p className="text-sm text-muted-foreground">
              Something went wrong on our side. Please try again in a moment.
            </p>
            {error.digest && (
              <p className="text-xs text-muted-foreground">Reference: {error.digest}</p>
            )}
          </div>
          <Button onClick={() => unstable_retry()} className="gap-2">
            <RotateCw className="h-4 w-4" aria-hidden="true" />
            Try again
          </Button>
        </CardContent>
      </Card>
    </div>
  )
}
