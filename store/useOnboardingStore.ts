import { create } from 'zustand'
import type { Plan } from '@/types'

// ─── Types ────────────────────────────────────────────────────────────────────

export type Personality = 'professional' | 'friendly' | 'formal' | 'casual' | 'energetic' | 'empathetic'

export interface OnboardingCompany {
  name: string
  industry: string
  website: string
  description: string
}

export interface OnboardingAgent {
  name: string
  language: string
  system_prompt: string
  first_message: string
  personality: Personality
}

export interface OnboardingVoice {
  voice_id: string
  voice_name: string
  preview_url: string
}

// ─── State + Actions ──────────────────────────────────────────────────────────

interface OnboardingState {
  currentStep: number
  isLoading: boolean
  company: OnboardingCompany
  agent: OnboardingAgent
  voice: OnboardingVoice
  plan: Plan

  setStep: (step: number) => void
  setCompany: (data: Partial<OnboardingCompany>) => void
  setAgent: (data: Partial<OnboardingAgent>) => void
  setVoice: (data: OnboardingVoice) => void
  setPlan: (plan: Plan) => void
  setLoading: (loading: boolean) => void
  reset: () => void
}

const defaults: Omit<OnboardingState, keyof Pick<OnboardingState,
  'setStep' | 'setCompany' | 'setAgent' | 'setVoice' |
  'setPlan' | 'setLoading' | 'reset'
>> = {
  currentStep: 1,
  isLoading: false,
  company: { name: '', industry: '', website: '', description: '' },
  agent: {
    name: '',
    language: 'en',
    system_prompt: '',
    first_message: '',
    personality: 'professional',
  },
  voice: { voice_id: '', voice_name: '', preview_url: '' },
  plan: 'starter',
}

export const useOnboardingStore = create<OnboardingState>((set) => ({
  ...defaults,

  setStep:    (currentStep) => set({ currentStep }),
  setCompany: (data)  => set((s) => ({ company: { ...s.company, ...data } })),
  setAgent:   (data)  => set((s) => ({ agent:   { ...s.agent,   ...data } })),
  setVoice:   (voice) => set({ voice }),
  setPlan:    (plan)  => set({ plan }),
  setLoading: (isLoading) => set({ isLoading }),
  reset: () => set({ ...defaults }),
}))
