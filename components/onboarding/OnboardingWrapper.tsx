'use client'

import { useEffect, useRef } from 'react'
import { useOnboardingStore } from '@/store/useOnboardingStore'
import { StepIndicator } from './StepIndicator'
import { Step1Company } from './steps/Step1Company'
import { Step2Agent } from './steps/Step2Agent'
import { Step3Voice } from './steps/Step3Voice'
import { Step6Launch } from './steps/Step5Launch'
import type { Organization } from '@/types'

interface OnboardingWrapperProps {
  initialStep: number
  organization: Organization
}

export function OnboardingWrapper({ initialStep, organization }: OnboardingWrapperProps) {
  const { currentStep, setStep, setCompany } = useOnboardingStore()
  const prevStepRef = useRef(initialStep)

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

  // Track direction for animation
  const direction = currentStep >= prevStepRef.current ? 'forward' : 'back'
  useEffect(() => {
    prevStepRef.current = currentStep
  }, [currentStep])

  const animClass =
    direction === 'forward' ? 'animate-step-enter' : 'animate-step-enter-back'

  return (
    <>
      <StepIndicator currentStep={currentStep} />
      <div key={currentStep} className={animClass}>
        {currentStep === 1 && <Step1Company />}
        {currentStep === 2 && <Step2Agent />}
        {currentStep === 3 && <Step3Voice />}
        {currentStep === 4 && <Step6Launch organization={organization} />}
      </div>
    </>
  )
}
