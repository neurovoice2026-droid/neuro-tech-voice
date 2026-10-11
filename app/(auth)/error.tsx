'use client' // Error boundaries must be Client Components

// Error boundary for the auth pages (sign in, sign up, password reset). It
// renders inside the auth shell, so a failed request (offline, server error,
// a deploy in between) shows a retry instead of Next's full-page error.

import { useEffect } from 'react'
import Link from 'next/link'
import { RotateCw, TriangleAlert } from 'lucide-react'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Button, buttonVariants } from '@/components/ui/button'

export default function AuthError({
  error,
  unstable_retry,
}: {
  error: Error & { digest?: string }
  /** Re-fetches and re-renders the segment (a server error may be transient). */
  unstable_retry: () => void
}) {
  useEffect(() => {
    // Server errors arrive with a generic message; the digest matches the server log.
    console.error('[auth] page failed', error)
  }, [error])

  return (
    <div className="flex flex-col gap-6">
      <Alert variant="destructive" role="alert">
        <TriangleAlert aria-hidden="true" />
        <AlertTitle>Something went wrong</AlertTitle>
        <AlertDescription className="text-destructive">
          Please check your connection and try again.
          {error.digest && (
            <span className="mt-1 block text-xs">
              Reference: <span className="font-mono">{error.digest}</span>
            </span>
          )}
        </AlertDescription>
      </Alert>
      <div className="space-y-2">
        <Button size="lg" className="w-full" onClick={() => unstable_retry()}>
          <RotateCw aria-hidden="true" />
          Try again
        </Button>
        <Link href="/login" className={buttonVariants({ variant: 'ghost', size: 'lg', className: 'w-full' })}>
          Back to sign in
        </Link>
      </div>
    </div>
  )
}
