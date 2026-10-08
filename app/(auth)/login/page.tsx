import { Suspense } from 'react'
import type { Metadata } from 'next'
import { Eyebrow } from '@/components/shared/Eyebrow'
import { LoginForm } from '@/components/auth/LoginForm'
import { AccountDeletedNotice } from './AccountDeletedNotice'

export const metadata: Metadata = {
  title: 'Sign in',
}

export default function LoginPage() {
  return (
    <div className="flex flex-col gap-8">
      <div>
        <Eyebrow>Sign in</Eyebrow>
        <h1 className="mt-4 font-heading font-title text-[30px] leading-[36px] tracking-[-0.025em] text-balance text-foreground md:text-[36px] md:leading-[42px]">
          Welcome back
        </h1>
        <p className="mt-2 text-[15px] leading-[22px] text-muted-foreground">
          Sign in to your account to continue
        </p>
      </div>

      {/* After Settings → Delete account (?account_deleted=1); client-side so the page stays static. */}
      <Suspense fallback={null}>
        <AccountDeletedNotice />
      </Suspense>

      <LoginForm />
    </div>
  )
}
