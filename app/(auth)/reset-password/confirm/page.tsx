import type { Metadata } from 'next'
import Link from 'next/link'
import { Clock } from 'lucide-react'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { buttonVariants } from '@/components/ui/button'
import { Eyebrow } from '@/components/shared/Eyebrow'
import { ConfirmResetButton } from '@/components/auth/ConfirmResetButton'
import { confirmPasswordReset } from '@/lib/auth/actions'

export const metadata: Metadata = {
  title: 'Reset password',
  // The URL carries a one-time token.
  referrer: 'no-referrer',
}

// Landing page of the reset email when its template links here with the
// token hash (docs/voice-providers.md). Opening the page uses nothing up: the
// token is only spent when the user presses Continue, so mail scanners that
// open links cannot burn it, and it works in any browser or device.
export default async function ConfirmResetPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>
}) {
  const { token_hash: tokenHash, type } = await searchParams
  const usable = typeof tokenHash === 'string' && tokenHash.length > 0 && (type === undefined || type === 'recovery')

  return (
    <div className="flex flex-col gap-8">
      <div>
        <Eyebrow>Reset password</Eyebrow>
        <h1 className="mt-4 font-heading font-title text-[30px] leading-[36px] tracking-[-0.025em] text-balance text-foreground md:text-[36px] md:leading-[42px]">
          Reset your password
        </h1>
        <p className="mt-2 text-[15px] leading-[22px] text-muted-foreground">
          Continue to choose a new password for your account
        </p>
      </div>

      {usable ? (
        <form action={confirmPasswordReset}>
          <input type="hidden" name="token_hash" value={tokenHash} />
          <ConfirmResetButton />
        </form>
      ) : (
        <div className="space-y-6">
          <Alert role="status" variant="warning">
            <Clock aria-hidden="true" />
            <AlertTitle>This reset link is incomplete</AlertTitle>
            <AlertDescription>Open the link from the email again, or request a new one.</AlertDescription>
          </Alert>
          <Link href="/forgot-password" className={buttonVariants({ size: 'lg', className: 'w-full' })}>
            Send a new reset link
          </Link>
        </div>
      )}
    </div>
  )
}
