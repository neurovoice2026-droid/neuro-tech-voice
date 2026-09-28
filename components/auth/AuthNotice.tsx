'use client'

import { useSearchParams } from 'next/navigation'
import { AlertCircle } from 'lucide-react'
import { Alert, AlertDescription } from '@/components/ui/alert'

// Messages for ?error= codes that the auth callbacks redirect back with.
// Rendered inside <Suspense> by the pages, so reading the query string doesn't
// turn the prerendered sign-in pages into per-request renders.
const NOTICES: Record<string, string> = {
  // Also where a confirmation link opened on another device ends up: the
  // email is confirmed by then, only the automatic sign-in failed.
  auth_failed:
    'We couldn’t finish signing you in. Please try again. If you just confirmed your email, it worked: sign in below.',
  link_expired: 'That link has expired or was already used. Request a new one below.',
  link_invalid: 'That link isn’t valid. Request a new one below.',
}

export function AuthNotice() {
  const code = useSearchParams().get('error')
  const message = code ? NOTICES[code] : undefined
  if (!message) return null

  return (
    <Alert variant="destructive" className="py-3">
      <AlertCircle className="h-4 w-4" />
      <AlertDescription>{message}</AlertDescription>
    </Alert>
  )
}
