'use client' // Error boundaries must be Client Components

import { useEffect, useTransition } from 'react'
import Link from 'next/link'
import { AlertTriangle, Loader2, RotateCw } from 'lucide-react'
import { Button, buttonVariants } from '@/components/ui/button'
import { cn } from '@/lib/utils'

// Mirrors COMPANY.phone in lib/site.ts (not imported: that module is large
// and this boundary ships with every dashboard page).
const SUPPORT_PHONE = '+40 774 566 367'
const SUPPORT_PHONE_HREF = 'tel:+40774566367'

// Renders inside the dashboard shell, so the sidebar stays usable and the
// owner can move to another page while this one recovers.
export default function DashboardError({
  error,
  unstable_retry,
}: {
  error: Error & { digest?: string }
  unstable_retry: () => void
}) {
  const [isRetrying, startRetry] = useTransition()

  useEffect(() => {
    console.error('[dashboard] page failed to render', error.digest ?? error.name)
  }, [error])

  return (
    <div className="flex min-h-[60vh] items-center justify-center p-6">
      <div role="alert" className="w-full max-w-md rounded-2xl border bg-card p-6 text-center shadow-sm sm:p-8">
        <div className="mx-auto mb-5 flex h-12 w-12 items-center justify-center rounded-full bg-red-50">
          <AlertTriangle className="h-6 w-6 text-red-600" aria-hidden="true" />
        </div>
        <h1 className="text-xl font-bold text-foreground">This page didn&apos;t load</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Something went wrong on our side while loading it. This is usually temporary, so please try
          again in a moment.
        </p>

        <div className="mt-6 flex flex-col gap-2 sm:flex-row sm:justify-center">
          <Button
            className="h-10 px-4"
            onClick={() => startRetry(() => unstable_retry())}
            disabled={isRetrying}
          >
            {isRetrying ? <Loader2 className="animate-spin" aria-hidden="true" /> : <RotateCw aria-hidden="true" />}
            {isRetrying ? 'Trying again…' : 'Try again'}
          </Button>
          <Link href="/dashboard" className={cn(buttonVariants({ variant: 'outline' }), 'h-10 px-4')}>
            Back to dashboard
          </Link>
        </div>

        <p className="mt-6 text-xs text-muted-foreground">
          If it keeps happening, call us on{' '}
          <a href={SUPPORT_PHONE_HREF} className="font-medium text-foreground underline underline-offset-2">
            {SUPPORT_PHONE}
          </a>
          {error.digest ? (
            <>
              {' '}and mention reference <span className="font-mono text-foreground">{error.digest}</span>
            </>
          ) : null}
          .
        </p>
      </div>
    </div>
  )
}
