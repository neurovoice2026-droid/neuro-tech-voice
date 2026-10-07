'use client'

// Shown on /login?account_deleted=1, where Settings → Delete account sends the
// owner after the deletion started (a toast would not survive that full-page
// redirect). Read on the client so the login page stays static.

import { useSearchParams } from 'next/navigation'
import { CheckCircle2 } from 'lucide-react'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'

export function AccountDeletedNotice() {
  const searchParams = useSearchParams()
  if (searchParams.get('account_deleted') !== '1') return null
  return (
    <Alert role="status" className="border-green-200 bg-green-50 py-3 text-green-900">
      <CheckCircle2 className="h-4 w-4 text-green-600" aria-hidden="true" />
      <AlertTitle>Your account is being deleted</AlertTitle>
      <AlertDescription className="text-green-800">
        You have been signed out. We are removing your data here and at our providers, and we will email you when
        everything is gone.
      </AlertDescription>
    </Alert>
  )
}
