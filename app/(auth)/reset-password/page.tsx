import type { Metadata } from 'next'
import Link from 'next/link'
import { Clock } from 'lucide-react'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { buttonVariants } from '@/components/ui/button'
import { Eyebrow } from '@/components/shared/Eyebrow'
import { ResetPasswordForm } from '@/components/auth/ResetPasswordForm'
import { createClient } from '@/lib/supabase/server'

export const metadata: Metadata = {
  title: 'Set a new password',
}

// The reset email's link lands here through /auth/callback, which has already
// signed the user in. Without that session (link expired, page opened
// directly) there is nothing to change: offer a new link.
export default async function ResetPasswordPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  return (
    <div className="flex flex-col gap-8">
      <div>
        <Eyebrow>Reset password</Eyebrow>
        <h1 className="mt-4 font-heading font-title text-[30px] leading-[36px] tracking-[-0.025em] text-balance text-foreground md:text-[36px] md:leading-[42px]">
          Set a new password
        </h1>
        <p className="mt-2 text-[15px] leading-[22px] text-muted-foreground">
          Choose a password you don&apos;t use anywhere else
        </p>
      </div>

      {user ? (
        <ResetPasswordForm />
      ) : (
        <div className="space-y-6">
          <Alert role="status" variant="warning">
            <Clock aria-hidden="true" />
            <AlertTitle>This reset link has expired</AlertTitle>
            <AlertDescription>Reset links work once and for a limited time. Request a new one to continue.</AlertDescription>
          </Alert>
          <Link href="/forgot-password" className={buttonVariants({ size: 'lg', className: 'w-full' })}>
            Send a new reset link
          </Link>
        </div>
      )}
    </div>
  )
}
