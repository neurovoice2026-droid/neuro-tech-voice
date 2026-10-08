'use client'

import { LogOut } from 'lucide-react'
import { useTransition } from 'react'
import { Logo } from '@/components/shared/Logo'
import { Button } from '@/components/ui/button'
import { useOnboardingStore } from '@/store/useOnboardingStore'
import { signOut } from '@/lib/auth/actions'
import { StepIndicator, TOTAL_ONBOARDING_STEPS } from './StepIndicator'

export function OnboardingTopBar() {
  const currentStep = useOnboardingStore((s) => s.currentStep)
  const progress = (currentStep / TOTAL_ONBOARDING_STEPS) * 100
  const [isPending, startTransition] = useTransition()

  function handleExit() {
    startTransition(async () => {
      await signOut()
    })
  }

  return (
    // scroll-pt: keyboard focus and in-page jumps stop below the fixed bar.
    <header className="fixed inset-x-0 top-0 z-50 [html:has(&)]:scroll-pt-16">
      <div className="relative flex h-14 items-center justify-between gap-4 bg-white/85 px-4 backdrop-blur-md lg:px-8">
        <Logo size="sm" />

        {/* Step list (md+). Phones get the "Step 2 of 4" line instead. */}
        <StepIndicator
          currentStep={currentStep}
          className="absolute top-1/2 left-1/2 hidden -translate-x-1/2 -translate-y-1/2 md:block"
        />

        <div className="flex items-center gap-2">
          <span className="text-[13px] leading-[19px] text-muted-foreground tabular-nums md:hidden">
            Step {currentStep} of {TOTAL_ONBOARDING_STEPS}
          </span>
          <Button
            variant="ghost"
            size="sm"
            onClick={handleExit}
            loading={isPending}
            loadingText="Signing out…"
            className="text-muted-foreground hover:text-foreground"
          >
            <LogOut aria-hidden="true" />
            Exit
          </Button>
        </div>

        {/* Progress hairline: the bar's bottom rule, filled in ink. */}
        <div aria-hidden="true" className="absolute inset-x-0 bottom-0 h-0.5 bg-rule">
          <div
            className="h-full bg-primary transition-[width] duration-500 ease-site"
            style={{ width: `${progress}%` }}
          />
        </div>
      </div>
    </header>
  )
}
