'use client'

import { LogOut } from 'lucide-react'
import { useTransition } from 'react'
import { Logo } from '@/components/shared/Logo'
import { Button } from '@/components/ui/button'
import { useOnboardingStore } from '@/store/useOnboardingStore'
import { useCommerceOnboardingStore } from '@/store/useCommerceOnboardingStore'
import { COMMERCE_ONBOARDING_STEPS, TOTAL_COMMERCE_ONBOARDING_STEPS, type OnboardingVariant } from '@/lib/commerce/business-type'
import { signOut } from '@/lib/auth/actions'
import { ONBOARDING_STEPS, StepIndicator, TOTAL_ONBOARDING_STEPS, type OnboardingStepDef } from './StepIndicator'

interface OnboardingTopBarProps {
  /**
   * Which flow the bar belongs to (decided by the server from the organization row):
   * 'services' is the original four-step bar, 'ecommerce' the six store steps,
   * 'choose' (the business-type screen) shows no step list at all.
   */
  variant?: OnboardingVariant
}

/** The step list and its total, per flow; the words around them are the same for both. */
const STEP_LISTS: Record<OnboardingVariant, { steps: readonly OnboardingStepDef[]; total: number }> = {
  services: { steps: ONBOARDING_STEPS, total: TOTAL_ONBOARDING_STEPS },
  ecommerce: { steps: COMMERCE_ONBOARDING_STEPS, total: TOTAL_COMMERCE_ONBOARDING_STEPS },
  // The business-type screen comes before step 1 of either flow: no list, no counter.
  choose: { steps: [], total: 0 },
}

export function OnboardingTopBar({ variant = 'services' }: OnboardingTopBarProps) {
  // Both stores are read unconditionally (hooks), the variant picks which one drives the bar.
  const serviceStep = useOnboardingStore((s) => s.currentStep)
  const commerceStep = useCommerceOnboardingStore((s) => s.currentStep)
  const [isPending, startTransition] = useTransition()

  const { steps, total } = STEP_LISTS[variant]
  const currentStep = variant === 'ecommerce' ? commerceStep : serviceStep
  // The business-type screen shows an empty progress rule.
  const showSteps = variant !== 'choose'
  const progress = showSteps ? (currentStep / total) * 100 : 0

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
        {showSteps && (
          <StepIndicator
            currentStep={currentStep}
            steps={steps}
            className="absolute top-1/2 left-1/2 hidden -translate-x-1/2 -translate-y-1/2 md:block"
          />
        )}

        <div className="flex items-center gap-2">
          {showSteps && (
            <span className="text-[13px] leading-[19px] text-muted-foreground tabular-nums md:hidden">
              Step {currentStep} of {total}
            </span>
          )}
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
