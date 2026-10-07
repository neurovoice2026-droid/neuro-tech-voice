import { Suspense } from 'react'
import type { Metadata } from 'next'
import { Logo } from '@/components/shared/Logo'
import { LoginForm } from '@/components/auth/LoginForm'
import { AccountDeletedNotice } from './AccountDeletedNotice'

export const metadata: Metadata = {
  title: 'Sign in',
}

export default function LoginPage() {
  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="space-y-2">
        <div className="flex justify-center mb-6">
          <Logo size="sm" showText />
        </div>
        <h1 className="text-2xl font-bold tracking-tight text-foreground">
          Welcome back
        </h1>
        <p className="text-sm text-muted-foreground">
          Sign in to your account to continue
        </p>
      </div>

      {/* After Settings → Delete account (?account_deleted=1); client-side so the page stays static. */}
      <Suspense fallback={null}>
        <AccountDeletedNotice />
      </Suspense>

      {/* Form */}
      <LoginForm />
    </div>
  )
}
