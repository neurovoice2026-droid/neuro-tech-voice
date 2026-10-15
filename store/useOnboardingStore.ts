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

const PERSONALITIES: readonly Personality[] = ['professional', 'friendly', 'formal', 'casual', 'energetic', 'empathetic']

/** The org's agent as GET /api/agent returns it: the fields the wizard shows. */
export interface SavedOnboardingAgent {
  name: string
  language: string | null
  system_prompt: string | null
  first_message: string | null
  metadata?: Record<string, unknown> | null
  voice_id: string | null
  voice_name: string | null
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
  /** The agent and voice the earlier steps saved on the server (see wizardStateFromAgent). */
  loadAgent: (saved: SavedOnboardingAgent) => void
  setPlan: (plan: Plan) => void
  setLoading: (loading: boolean) => void
  reset: () => void
}

const defaults: Omit<OnboardingState, keyof Pick<OnboardingState,
  'setStep' | 'setCompany' | 'setAgent' | 'setVoice' | 'loadAgent' |
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

/**
 * The wizard's agent and voice for an agent the earlier steps saved. Nothing here is kept in the
 * browser, so a reload or a return from a cancelled Checkout starts at the defaults above; this is
 * what the store holds instead, read leniently (a missing field keeps its default).
 */
export function wizardStateFromAgent(saved: SavedOnboardingAgent): { agent: OnboardingAgent; voice: OnboardingVoice } {
  const personality = saved.metadata?.personality
  return {
    agent: {
      name: saved.name ?? '',
      language: saved.language || defaults.agent.language,
      system_prompt: saved.system_prompt ?? '',
      first_message: saved.first_message ?? '',
      personality: PERSONALITIES.includes(personality as Personality) ? (personality as Personality) : defaults.agent.personality,
    },
    voice: saved.voice_id
      ? { voice_id: saved.voice_id, voice_name: saved.voice_name ?? '', preview_url: '' }
      : { ...defaults.voice },
  }
}

export const useOnboardingStore = create<OnboardingState>((set) => ({
  ...defaults,

  setStep:    (currentStep) => set({ currentStep }),
  setCompany: (data)  => set((s) => ({ company: { ...s.company, ...data } })),
  setAgent:   (data)  => set((s) => ({ agent:   { ...s.agent,   ...data } })),
  setVoice:   (voice) => set({ voice }),
  loadAgent:  (saved) => set(wizardStateFromAgent(saved)),
  setPlan:    (plan)  => set({ plan }),
  setLoading: (isLoading) => set({ isLoading }),
  reset: () => set({ ...defaults }),
}))
