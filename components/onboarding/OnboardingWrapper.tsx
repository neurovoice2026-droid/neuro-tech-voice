'use client'

import { useEffect, useRef, useState } from 'react'
import { useOnboardingStore, type SavedOnboardingAgent } from '@/store/useOnboardingStore'
import { OrbLoader } from '@/components/shared/OrbLoader'
import { errorMessage, isAbortError, parseApiError } from '@/hooks/useVoiceCatalog'
import { ErrorBlock } from './commerce/shared'
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

const AGENT_LOAD_FAILED = 'Your saved agent could not be loaded.'

/** GET /api/agent: the org's agent as steps 2 and 3 saved it. */
export async function fetchSavedAgent(signal?: AbortSignal): Promise<SavedOnboardingAgent> {
  const res = await fetch('/api/agent', { headers: { Accept: 'application/json' }, signal })
  if (!res.ok) throw await parseApiError(res, AGENT_LOAD_FAILED)
  return (await res.json()) as SavedOnboardingAgent
}

/** From step 3 on, step 2 has saved the agent on the server: the wizard shows that one. */
export function needsSavedAgent(initialStep: number): boolean {
  return initialStep >= 3
}

export function OnboardingWrapper({ initialStep, organization }: OnboardingWrapperProps) {
  const { currentStep, setStep, setCompany, loadAgent } = useOnboardingStore()
  const contentRef = useRef<HTMLDivElement>(null)

  // The store lives in the page only, so a reload, or the return from a cancelled Checkout (it
  // lands on the launch step), would show the later steps with its defaults: no agent or voice in
  // the summary, English in the voice list, an empty agent form on Back. The saved agent is read
  // first, and no step shows until it is in the store.
  const readAgent = needsSavedAgent(initialStep)
  const [agentLoad, setAgentLoad] = useState<{ done: boolean; error: string | null }>({ done: !readAgent, error: null })
  const [agentAttempt, setAgentAttempt] = useState(0)
  useEffect(() => {
    if (!readAgent) return
    const ctrl = new AbortController()
    fetchSavedAgent(ctrl.signal)
      .then((saved) => {
        if (ctrl.signal.aborted) return
        loadAgent(saved)
        setAgentLoad({ done: true, error: null })
      })
      .catch((err: unknown) => {
        // Aborted: unmounted, or replaced by a retry.
        if (ctrl.signal.aborted || isAbortError(err)) return
        console.error('Onboarding: the saved agent could not be read', err)
        setAgentLoad({ done: false, error: errorMessage(err, AGENT_LOAD_FAILED) })
      })
    return () => ctrl.abort()
  }, [readAgent, loadAgent, agentAttempt])

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

  if (!agentLoad.done) {
    return agentLoad.error ? (
      <ErrorBlock
        title="Your setup could not be loaded"
        message={agentLoad.error}
        onRetry={() => {
          setAgentLoad({ done: false, error: null })
          setAgentAttempt((n) => n + 1)
        }}
        className="mx-auto max-w-[560px]"
      />
    ) : (
      <OrbLoader state="breathing" label="Loading your setup…" className="min-h-[60vh]" />
    )
  }

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
