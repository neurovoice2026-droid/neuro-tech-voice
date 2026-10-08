'use client'

import { useEffect, useRef, useState } from 'react'
import { useOnboardingStore } from '@/store/useOnboardingStore'
import { Step1Company } from './steps/Step1Company'
import { Step2Agent } from './steps/Step2Agent'
import { Step3Voice } from './steps/Step3Voice'
import { Step6Launch } from './steps/Step5Launch'
import { StepEnterProvider, type StepDirection } from './StepIndicator'
import type { Organization } from '@/types'

interface OnboardingWrapperProps {
  initialStep: number
  organization: Organization
}

export function OnboardingWrapper({ initialStep, organization }: OnboardingWrapperProps) {
  const { currentStep, setStep, setCompany } = useOnboardingStore()
  const contentRef = useRef<HTMLDivElement>(null)

  // Sync store with server-authoritative step on first render
  useEffect(() => {
    setStep(initialStep)
    // Pre-populate company data if already saved
    if (organization.name) {
      setCompany({
        name: organization.name ?? '',
        industry: organization.industry ?? '',
        website: organization.website ?? '',
        description: organization.description ?? '',
      })
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Direction of the last step change, for the enter slide. Updated while rendering, only when
  // the step changes, so later re-renders of the same step never swap (and restart) the animation.
  const [shown, setShown] = useState<{ step: number; direction: StepDirection }>({
    step: currentStep,
    direction: 'forward',
  })
  if (shown.step !== currentStep) {
    setShown({ step: currentStep, direction: currentStep > shown.step ? 'forward' : 'back' })
  }

  // A new step starts at its top with the title focused (keyboard and screen reader users land on
  // it, nothing is left scrolled out of view). The first render and the sync to the server's step
  // on mount are not navigation, so they leave focus and scroll alone.
  const settledRef = useRef(false)
  const lastStepRef = useRef<number | null>(null)
  useEffect(() => {
    const previous = lastStepRef.current
    lastStepRef.current = currentStep
    if (!settledRef.current) {
      settledRef.current = currentStep === initialStep
      return
    }
    if (previous === currentStep) return
    window.scrollTo({ top: 0, behavior: 'instant' })
    contentRef.current?.querySelector<HTMLElement>('h1')?.focus({ preventScroll: true })
  }, [currentStep, initialStep])

  // The step list lives in the top bar (OnboardingTopBar → StepIndicator). Each step animates its
  // own header, body and action row (StepIndicator's useStepEnter), never this wrapper: a transform
  // here would become the containing block of the steps' fixed action bars mid-animation.
  return (
    <StepEnterProvider value={shown.direction}>
      <div key={currentStep} ref={contentRef}>
        {currentStep === 1 && <Step1Company />}
        {currentStep === 2 && <Step2Agent />}
        {currentStep === 3 && <Step3Voice />}
        {currentStep === 4 && <Step6Launch organization={organization} />}
      </div>
    </StepEnterProvider>
  )
}
