'use client'

import { useEffect, useRef, useState } from 'react'
import { useOnboardingStore } from '@/store/useOnboardingStore'
import { Skeleton } from '@/components/ui/skeleton'
import { normalizeAgentLanguage } from '@/lib/voice/languages'
import { normalizeTone } from '@/lib/voice/tone'
import {
  TOTAL_ONBOARDING_STEPS, isGreetingCustomized, isSystemPromptCustomized, isValidTimeZone, resolveResumeStep,
  type ExistingAgentDraft, type OnboardingOrganization,
} from '@/app/onboarding/_lib/onboarding-state'
import { StepIndicator } from './StepIndicator'
import { Step1Company } from './steps/Step1Company'
import { Step2Agent } from './steps/Step2Agent'
import { Step3Voice } from './steps/Step3Voice'
import { StepLaunch } from './steps/Step5Launch'

interface OnboardingWrapperProps {
  initialStep: number
  organization: OnboardingOrganization
  existingAgent: ExistingAgentDraft | null
  hasPhoneNumber: boolean
  calendarConnected: boolean
}

export function OnboardingWrapper({
  initialStep, organization, existingAgent, hasPhoneNumber, calendarConnected,
}: OnboardingWrapperProps) {
  const currentStep = useOnboardingStore((s) => s.currentStep)
  const setStep = useOnboardingStore((s) => s.setStep)
  const [hydrated, setHydrated] = useState(false)
  const [launched, setLaunched] = useState(false)
  const [shown, setShown] = useState({ step: currentStep, direction: 'forward' as 'forward' | 'back' })
  const skipFocusRef = useRef(true)

  // Restore this tab's draft, then fill anything missing from the server.
  useEffect(() => {
    let cancelled = false
    const finish = () => {
      if (cancelled) return
      const store = useOnboardingStore.getState()
      const hasDraft = store.orgId === organization.id
      if (!hasDraft) {
        // No draft, or one left by another account in this tab.
        store.reset()
        const fresh = useOnboardingStore.getState()
        fresh.setOrgId(organization.id)
        fresh.setCompany({
          name: organization.name ?? '',
          industry: organization.industry ?? '',
          website: organization.website ?? '',
          description: organization.description ?? '',
          // 'UTC' is the column default, not a choice: the device's zone is a better guess.
          ...(organization.timezone && organization.timezone !== 'UTC' && isValidTimeZone(organization.timezone)
            ? { timezone: organization.timezone }
            : {}),
        })
        if (existingAgent) {
          const company = useOnboardingStore.getState().company
          const agentDraft = {
            name: existingAgent.name ?? '',
            language: normalizeAgentLanguage(existingAgent.language),
            system_prompt: existingAgent.system_prompt ?? '',
            first_message: existingAgent.first_message ?? '',
            tone: normalizeTone(existingAgent.tone),
          }
          fresh.setAgent(agentDraft)
          // Text we generated last time keeps following tone, language and industry.
          fresh.setEdited({
            first_message: isGreetingCustomized(agentDraft.first_message, {
              language: agentDraft.language, tone: agentDraft.tone, company: company.name, agentName: agentDraft.name,
            }),
            system_prompt: isSystemPromptCustomized(agentDraft.system_prompt, {
              name: company.name, description: company.description, industry: company.industry,
            }),
          })
          if (existingAgent.cartesia_voice_id) {
            fresh.setVoice({
              cartesia_voice_id: existingAgent.cartesia_voice_id,
              cartesia_voice_name: existingAgent.cartesia_voice_name ?? '',
              preview_url: null,
              gender: null,
            })
          }
        }
      }
      // A refresh right after changing the language on the agent step skips
      // that step's own check; the voice step then starts with native voices.
      useOnboardingStore.getState().dropVoiceForOtherLanguage()
      const data = useOnboardingStore.getState()
      data.setStep(resolveResumeStep(data, { serverStep: initialStep, hasDraft }))
      setHydrated(true)
    }

    const pending = useOnboardingStore.persist.rehydrate()
    if (pending instanceof Promise) {
      pending.then(finish, (error: unknown) => {
        console.warn('[onboarding] the saved draft could not be restored', error)
        finish()
      })
    } else {
      finish()
    }
    return () => {
      cancelled = true
    }
  }, [organization, existingAgent, initialStep])

  // Slide direction for the step animation (derived during render).
  if (shown.step !== currentStep) {
    setShown({ step: currentStep, direction: currentStep >= shown.step ? 'forward' : 'back' })
  }

  // Start each new step at the top, with focus on its heading.
  useEffect(() => {
    if (!hydrated) return
    if (skipFocusRef.current) {
      skipFocusRef.current = false
      return
    }
    window.scrollTo(0, 0)
    document.querySelector<HTMLElement>('[data-step-heading]')?.focus({ preventScroll: true })
  }, [currentStep, hydrated])

  if (!hydrated) return <OnboardingSkeleton />

  const animClass = shown.direction === 'forward' ? 'animate-step-enter' : 'animate-step-enter-back'

  return (
    <>
      {/* After launch every step reads as done and the wizard can't be reopened. */}
      <StepIndicator currentStep={launched ? TOTAL_ONBOARDING_STEPS + 1 : currentStep} onStepClick={launched ? undefined : setStep} />
      <div key={currentStep} className={`${animClass} motion-reduce:animate-none`}>
        {currentStep === 1 && <Step1Company />}
        {currentStep === 2 && <Step2Agent />}
        {currentStep === 3 && <Step3Voice />}
        {currentStep === 4 && (
          <StepLaunch
            organization={organization}
            hasPhoneNumber={hasPhoneNumber}
            calendarConnected={calendarConnected}
            onLaunched={() => setLaunched(true)}
          />
        )}
      </div>
    </>
  )
}

function OnboardingSkeleton() {
  return (
    <div aria-busy="true" aria-label="Loading your setup">
      <div className="mb-8 flex items-center justify-center gap-3 sm:mb-10">
        {[0, 1, 2, 3].map((i) => (
          <Skeleton key={i} className="h-7 w-7 rounded-full sm:h-8 sm:w-8" />
        ))}
      </div>
      <div className="space-y-8">
        <div className="space-y-3">
          <Skeleton className="h-11 w-11 rounded-xl" />
          <Skeleton className="h-7 w-64 max-w-full" />
          <Skeleton className="h-4 w-80 max-w-full" />
        </div>
        <div className="space-y-6">
          <Skeleton className="h-11 w-full" />
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 sm:gap-3">
            {Array.from({ length: 6 }, (_, i) => (
              <Skeleton key={i} className="h-12 rounded-xl sm:h-24" />
            ))}
          </div>
          <Skeleton className="h-24 w-full" />
          <Skeleton className="h-11 w-full" />
        </div>
      </div>
    </div>
  )
}
