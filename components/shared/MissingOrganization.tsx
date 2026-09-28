import { AlertTriangle, LogOut } from 'lucide-react'
import { signOut } from '@/lib/auth/actions'
import { Logo } from '@/components/shared/Logo'
import { Button } from '@/components/ui/button'
import { COMPANY } from '@/lib/site'

/**
 * A signed-in user whose organization row (created by the sign-up trigger) is
 * missing. Redirecting anywhere would bounce between /login, /dashboard and
 * /onboarding, so the dashboard and onboarding explain it and offer sign-out.
 */
export function MissingOrganization({ area }: { area: 'dashboard' | 'onboarding' }) {
  console.error(`[${area}] signed-in user has no organization row`)
  return (
    <main className="flex min-h-screen items-center justify-center bg-background px-4 py-12">
      <div role="alert" className="w-full max-w-md rounded-2xl border bg-card p-6 text-center shadow-sm sm:p-8">
        <div className="mb-6 flex justify-center">
          <Logo size="sm" />
        </div>
        <div className="mx-auto mb-5 flex h-12 w-12 items-center justify-center rounded-full bg-amber-50">
          <AlertTriangle className="h-6 w-6 text-amber-600" aria-hidden="true" />
        </div>
        <h1 className="text-xl font-bold text-foreground">Your account isn&apos;t fully set up</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          You&apos;re signed in, but we couldn&apos;t find the business profile that goes with your account.
          Please call us on{' '}
          <a href={COMPANY.phoneHref} className="font-medium text-foreground underline underline-offset-2">
            {COMPANY.phone}
          </a>{' '}
          and we&apos;ll fix it for you.
        </p>
        <form action={signOut} className="mt-6">
          <Button type="submit" variant="outline" className="h-10 px-4">
            <LogOut aria-hidden="true" />
            Sign out
          </Button>
        </form>
      </div>
    </main>
  )
}
