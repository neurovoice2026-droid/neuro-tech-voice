'use client'

import Link from 'next/link'
import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { CheckCircle2, Loader2, RotateCcw } from 'lucide-react'
import { Button, buttonVariants } from '@/components/ui/button'
import { useCheckoutWait } from '@/hooks/useCheckoutWait'
import { AUTH } from '@/lib/site'
import { cn } from '@/lib/utils'

// Stripe Checkout sends a paid sign-up back here. The Stripe webhook finishes
// onboarding and sets the plan a few seconds later; until it has, the
// dashboard would bounce the owner back to setup as if the payment never
// happened. So this screen waits for it, then opens the dashboard.

export function CheckoutActivation() {
  const router = useRouter()
  const wait = useCheckoutWait({ active: true, flow: 'onboarding', initialPlan: 'trial' })

  useEffect(() => {
    if (wait.state === 'applied') router.replace('/dashboard?welcome=true')
  }, [wait.state, router])

  const timedOut = wait.state === 'timed_out'
  return (
    <div className="flex justify-center">
      <div className="w-full max-w-md space-y-6 rounded-2xl border bg-card p-6 text-center shadow-sm sm:p-8">
        <div role="status" aria-live="polite" className="space-y-3">
          {wait.state === 'applied' ? (
            <CheckCircle2 className="mx-auto size-10 text-emerald-600" aria-hidden="true" />
          ) : timedOut ? null : (
            <Loader2 className="mx-auto size-10 animate-spin text-primary" aria-hidden="true" />
          )}
          <h1 className="text-xl font-semibold text-foreground">
            {wait.state === 'applied'
              ? 'You’re all set'
              : timedOut
                ? 'Your payment went through'
                : 'Activating your plan…'}
          </h1>
          <p className="text-sm text-muted-foreground">
            {wait.state === 'applied'
              ? 'Opening your dashboard…'
              : timedOut
                ? 'Confirming it with our payment provider is taking longer than usual. Nothing else is needed from you; check again in a minute.'
                : 'Payment received. We’re switching on your subscription, this usually takes a few seconds.'}
          </p>
        </div>
        {timedOut && (
          <div className="flex flex-col gap-2 sm:flex-row sm:justify-center">
            <Button onClick={wait.restart} className="h-10 gap-2">
              <RotateCcw aria-hidden="true" />
              Check again
            </Button>
            <Link href={AUTH.contactSales} className={cn(buttonVariants({ variant: 'outline' }), 'h-10')}>
              Call support
            </Link>
          </div>
        )}
      </div>
    </div>
  )
}
