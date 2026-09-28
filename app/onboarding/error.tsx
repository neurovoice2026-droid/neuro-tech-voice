'use client' // Error boundaries must be Client Components

import { useEffect, useTransition } from 'react'
import { AlertTriangle, Loader2, RotateCw } from 'lucide-react'
import { Button } from '@/components/ui/button'

// Mirrors COMPANY.phone in lib/site.ts (not imported: that module is large).
const SUPPORT_PHONE = '+40 774 566 367'
const SUPPORT_PHONE_HREF = 'tel:+40774566367'

// Renders inside the onboarding layout (top bar stays). The onboarding draft
// lives in this tab's sessionStorage, so retrying doesn't start over.
export default function OnboardingError({
  error,
  unstable_retry,
}: {
  error: Error & { digest?: string }
  unstable_retry: () => void
}) {
  const [isRetrying, startRetry] = useTransition()

  useEffect(() => {
    console.error('[onboarding] step failed to render', error.digest ?? error.name)
  }, [error])

  return (
    <div role="alert" className="rounded-2xl border bg-card p-6 text-center shadow-sm sm:p-8">
      <div className="mx-auto mb-5 flex h-12 w-12 items-center justify-center rounded-full bg-red-50">
        <AlertTriangle className="h-6 w-6 text-red-600" aria-hidden="true" />
      </div>
      <h1 className="text-xl font-bold text-foreground">We couldn&apos;t load this step</h1>
      <p className="mx-auto mt-2 max-w-sm text-sm text-muted-foreground">
        Something went wrong on our side. Your answers so far are kept in this tab, so trying again won&apos;t start over.
      </p>

      <Button
        className="mt-6 h-10 px-4"
        onClick={() => startRetry(() => unstable_retry())}
        disabled={isRetrying}
      >
        {isRetrying ? <Loader2 className="animate-spin" aria-hidden="true" /> : <RotateCw aria-hidden="true" />}
        {isRetrying ? 'Trying again…' : 'Try again'}
      </Button>

      <p className="mt-6 text-xs text-muted-foreground">
        Still stuck? Call us on{' '}
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
  )
}
