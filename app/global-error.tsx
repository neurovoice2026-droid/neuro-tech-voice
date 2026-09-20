'use client' // Error boundaries must be Client Components

import { useEffect, useTransition } from 'react'
import Link from 'next/link'
import { AlertTriangle, Loader2, RotateCw } from 'lucide-react'
import './globals.css'

// Last-resort boundary: replaces the root layout when it (or anything the
// nearer boundaries don't cover) throws. It has to bring its own <html>,
// <body> and styles.

// Mirrors COMPANY.phone in lib/site.ts (not imported: that module is large).
const SUPPORT_PHONE = '+40 774 566 367'
const SUPPORT_PHONE_HREF = 'tel:+40774566367'

export default function GlobalError({
  error,
  unstable_retry,
}: {
  error: Error & { digest?: string }
  unstable_retry: () => void
}) {
  const [isRetrying, startRetry] = useTransition()

  useEffect(() => {
    console.error('[app] unrecoverable render error', error.digest ?? error.name)
  }, [error])

  return (
    <html lang="en">
      <body
        className="min-h-screen bg-background text-foreground antialiased"
        // The root layout's next/font variables don't exist here, which would
        // leave globals.css's font-sans unresolved (a serif fallback).
        style={{ fontFamily: 'ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, sans-serif' }}
      >
        <title>Something went wrong — Neuro Tech Voice</title>
        <main className="flex min-h-screen items-center justify-center px-4 py-12">
          <div className="w-full max-w-md rounded-2xl border bg-card p-6 text-center shadow-sm sm:p-8">
            <div className="mx-auto mb-5 flex h-12 w-12 items-center justify-center rounded-full bg-red-50">
              <AlertTriangle className="h-6 w-6 text-red-600" aria-hidden="true" />
            </div>
            <h1 className="text-xl font-bold text-foreground">Something went wrong</h1>
            <p className="mt-2 text-sm text-muted-foreground">
              We hit an unexpected problem loading Neuro Tech Voice. It&apos;s usually temporary, so please try again.
            </p>

            <div className="mt-6 flex flex-col gap-2 sm:flex-row sm:justify-center">
              <button
                type="button"
                onClick={() => startRetry(() => unstable_retry())}
                disabled={isRetrying}
                className="inline-flex h-10 items-center justify-center gap-2 rounded-lg bg-primary px-4 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/85 disabled:opacity-60"
              >
                {isRetrying ? (
                  <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                ) : (
                  <RotateCw className="h-4 w-4" aria-hidden="true" />
                )}
                Try again
              </button>
              <Link
                href="/"
                className="inline-flex h-10 items-center justify-center rounded-lg border bg-background px-4 text-sm font-medium text-foreground transition-colors hover:bg-muted"
              >
                Go to the homepage
              </Link>
            </div>

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
        </main>
      </body>
    </html>
  )
}
