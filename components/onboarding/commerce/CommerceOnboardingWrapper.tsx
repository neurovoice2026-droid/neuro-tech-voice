'use client'

// The store onboarding (six steps). Mirrors OnboardingWrapper: the server's
// step is the start position, each step change scrolls to the top and focuses
// the title, and the enter animation runs per step block. Unlike the service
// flow, the whole state is read from the server on mount and refreshed on
// demand, so a reload resumes with what is saved (never with browser state).

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { toast } from 'sonner'
import { useCommerceOnboardingStore } from '@/store/useCommerceOnboardingStore'
import { OrbLoader } from '@/components/shared/OrbLoader'
import type { Organization } from '@/types'
import { StepEnterProvider, type StepDirection } from '../StepIndicator'
import { PROGRESS_NOT_SAVED, commerceErrorMessage, persistStep } from './api'
import { useCommerceOnboardingState } from './hooks'
import { CommerceNavigationContext, type CommerceNavigation } from './navigation'
import { ErrorBlock } from './shared'
import { oauthReturnFrom, type OAuthReturn } from './shopify'
import { StoreStep } from './steps/StoreStep'
import { PlatformStep } from './steps/PlatformStep'
import { AccessStep } from './steps/AccessStep'
import { AutomationsStep } from './steps/AutomationsStep'
import { AgentStep } from './steps/AgentStep'
import { LaunchStep } from './steps/LaunchStep'

interface CommerceOnboardingWrapperProps {
  initialStep: number
  organization: Organization
}

export function CommerceOnboardingWrapper({ initialStep, organization }: CommerceOnboardingWrapperProps) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const currentStep = useCommerceOnboardingStore((s) => s.currentStep)
  const setStep = useCommerceOnboardingStore((s) => s.setStep)
  const { loaded, error, refetch } = useCommerceOnboardingState()
  const contentRef = useRef<HTMLDivElement>(null)

  const [oauth, setOauth] = useState<OAuthReturn | null>(() => oauthReturnFrom(searchParams))
  // A return from Shopify always lands on the access step (the result is shown there); the
  // position is persisted so a reload stays there too. Otherwise: the server's step.
  const startStep = oauth ? 3 : initialStep

  useEffect(() => {
    setStep(startStep)
    if (oauth) {
      // The install came back from Shopify, so that is the platform of this step: a refused
      // install leaves no connection behind, and without this the access step would have no
      // form to retry from (and the fallback below would move away from the result).
      useCommerceOnboardingStore.getState().setPlatform('shopify')
      // The position is a resume hint only: a failed persist changes where a reload lands,
      // nothing else, and the result shown on the access step matters more than reporting it.
      void persistStep(3).catch(() => undefined)
      // The query string carried a one-time result: drop it so a reload does not replay it.
      router.replace('/onboarding', { scroll: false })
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // A reload at step 3+ with no platform picked and no connection has nothing to show: go back
  // to the platform choice (the persisted position is left alone; it is only a resume hint).
  useEffect(() => {
    if (!loaded) return
    const s = useCommerceOnboardingStore.getState()
    if (s.currentStep >= 3 && s.currentStep <= 4 && !s.connection && !s.platform) s.setStep(2)
  }, [loaded])

  // A later refetch that fails (the first one shows the error block) is reported without
  // taking the current step away.
  const reportedErrorRef = useRef<string | null>(null)
  useEffect(() => {
    if (!loaded || !error || reportedErrorRef.current === error) return
    reportedErrorRef.current = error
    toast.error(error)
  }, [loaded, error])

  const goTo = useCallback(
    (step: number, opts?: { persist?: boolean }) => {
      useCommerceOnboardingStore.getState().setStep(step)
      if (opts?.persist === false) return
      persistStep(step).catch((err: unknown) => {
        toast.error(commerceErrorMessage(err, PROGRESS_NOT_SAVED), {
          description: 'You can keep going; a reload resumes from the last saved step.',
        })
      })
    },
    [],
  )
  const dismissOauth = useCallback(() => setOauth(null), [])
  const navigation = useMemo<CommerceNavigation>(
    () => ({ goTo, refetchState: refetch, oauth, dismissOauth }),
    [goTo, refetch, oauth, dismissOauth],
  )

  // Direction of the last step change, for the enter slide (see OnboardingWrapper).
  const [shown, setShown] = useState<{ step: number; direction: StepDirection }>({ step: currentStep, direction: 'forward' })
  if (shown.step !== currentStep) {
    setShown({ step: currentStep, direction: currentStep > shown.step ? 'forward' : 'back' })
  }

  // A new step starts at its top with the title focused; the first render and the sync to the
  // start step on mount are not navigation.
  const settledRef = useRef(false)
  const lastStepRef = useRef<number | null>(null)
  useEffect(() => {
    const previous = lastStepRef.current
    lastStepRef.current = currentStep
    if (!settledRef.current) {
      settledRef.current = currentStep === startStep
      return
    }
    if (previous === currentStep) return
    window.scrollTo({ top: 0, behavior: 'instant' })
    contentRef.current?.querySelector<HTMLElement>('h1')?.focus({ preventScroll: true })
  }, [currentStep, startStep])

  if (!loaded) {
    return error ? (
      <ErrorBlock
        title="Your setup could not be loaded"
        message={error}
        onRetry={refetch}
        className="mx-auto max-w-[560px]"
      />
    ) : (
      <OrbLoader state="breathing" label="Loading your store setup…" className="min-h-[60vh]" />
    )
  }

  return (
    <CommerceNavigationContext.Provider value={navigation}>
      <StepEnterProvider value={shown.direction}>
        <div key={currentStep} ref={contentRef}>
          {currentStep === 1 && <StoreStep />}
          {currentStep === 2 && <PlatformStep />}
          {currentStep === 3 && <AccessStep />}
          {currentStep === 4 && <AutomationsStep />}
          {currentStep === 5 && <AgentStep />}
          {currentStep === 6 && <LaunchStep organization={organization} />}
        </div>
      </StepEnterProvider>
    </CommerceNavigationContext.Provider>
  )
}
