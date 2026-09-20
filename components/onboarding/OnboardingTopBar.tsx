'use client'

import { LogOut } from 'lucide-react'
import { useTransition } from 'react'
import { Logo } from '@/components/shared/Logo'
import { Button } from '@/components/ui/button'
import { useOnboardingStore } from '@/store/useOnboardingStore'
import { signOut } from '@/lib/auth/actions'
import { TOTAL_ONBOARDING_STEPS } from '@/app/onboarding/_lib/onboarding-state'

export function OnboardingTopBar() {
  const currentStep = useOnboardingStore((s) => s.currentStep)
  const progress = (currentStep / TOTAL_ONBOARDING_STEPS) * 100
  const [isPending, startTransition] = useTransition()

  // The draft stays in this tab's session storage, so signing back in here
  // resumes where the owner left off (a different account's draft is discarded).
  function handleExit() {
    startTransition(async () => {
      await signOut()
    })
  }

  return (
    <div className="fixed left-0 right-0 top-0 z-50">
      {/* Top bar */}
      <div className="flex h-16 items-center justify-between gap-3 border-b bg-white/80 px-4 backdrop-blur-md lg:px-8">
        <div className="flex min-w-0 items-center">
          <Logo size="sm" showText />
        </div>
        <div className="flex shrink-0 items-center gap-2 sm:gap-4">
          <span className="text-xs text-muted-foreground sm:text-sm">
            Step {currentStep} of {TOTAL_ONBOARDING_STEPS}
          </span>
          <Button
            variant="ghost"
            size="sm"
            onClick={handleExit}
            disabled={isPending}
            className="h-9 text-muted-foreground hover:text-foreground"
          >
            <LogOut className="mr-1.5 h-3.5 w-3.5" aria-hidden="true" />
            {isPending ? 'Signing out…' : 'Exit'}
          </Button>
        </div>
      </div>

      {/* Progress bar */}
      <div
        role="progressbar"
        aria-label="Setup progress"
        aria-valuemin={0}
        aria-valuemax={TOTAL_ONBOARDING_STEPS}
        aria-valuenow={currentStep}
        aria-valuetext={`Step ${currentStep} of ${TOTAL_ONBOARDING_STEPS}`}
        className="h-1.5 bg-purple-100"
      >
        <div
          className="h-full bg-purple-600 transition-all duration-500 ease-in-out motion-reduce:transition-none"
          style={{ width: `${progress}%` }}
        />
      </div>
    </div>
  )
}
