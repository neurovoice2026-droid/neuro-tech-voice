import { create } from 'zustand'
import { createJSONStorage, persist, type StateStorage } from 'zustand/middleware'
import type { Plan } from '@/types'
import { normalizeAgentLanguage } from '@/lib/voice/languages'
import {
  ONBOARDING_STORAGE_KEY,
  ONBOARDING_STORE_VERSION,
  clampStep,
  createOnboardingDefaults,
  migrateOnboardingState,
  sanitizeOnboardingData,
  voiceMatchesLanguage,
  type OnboardingAgent,
  type OnboardingCompany,
  type OnboardingData,
  type OnboardingEdits,
  type OnboardingVoice,
} from '@/app/onboarding/_lib/onboarding-state'

export type {
  OnboardingAgent,
  OnboardingCompany,
  OnboardingData,
  OnboardingEdits,
  OnboardingVoice,
  VoiceGender,
} from '@/app/onboarding/_lib/onboarding-state'

// ─── Storage ──────────────────────────────────────────────────────────────────

// sessionStorage, not localStorage: a draft belongs to this tab's signup and
// shouldn't outlive it on a shared computer. Every access is guarded because
// storage throws on the server, in some private modes and when site data is
// blocked; there the wizard still works, a refresh just starts from the
// server's copy.
const sessionDraftStorage: StateStorage = {
  getItem: (name) => {
    try {
      return window.sessionStorage.getItem(name)
    } catch {
      return null
    }
  },
  setItem: (name, value) => {
    try {
      window.sessionStorage.setItem(name, value)
    } catch {
      // Quota or blocked storage: progress lives in memory for this page view.
    }
  },
  removeItem: (name) => {
    try {
      window.sessionStorage.removeItem(name)
    } catch {
      // Nothing stored, nothing to remove.
    }
  },
}

// ─── State + Actions ──────────────────────────────────────────────────────────

interface OnboardingActions {
  setOrgId: (orgId: string) => void
  setStep: (step: number) => void
  setCompany: (data: Partial<OnboardingCompany>) => void
  setAgent: (data: Partial<OnboardingAgent>) => void
  setEdited: (data: Partial<OnboardingEdits>) => void
  /** Step3Voice (S5) calls this with the picked Cartesia voice; it is remembered for the agent's current language. */
  setVoice: (voice: OnboardingVoice) => void
  clearVoice: () => void
  /** Clears a voice picked for another language. Returns true when it did. */
  dropVoiceForOtherLanguage: () => boolean
  setPlan: (plan: Plan) => void
  setAnnual: (annual: boolean) => void
  reset: () => void
}

export type OnboardingState = OnboardingData & OnboardingActions

function pickData(state: OnboardingState): OnboardingData {
  return {
    orgId: state.orgId,
    currentStep: state.currentStep,
    company: state.company,
    agent: state.agent,
    voice: state.voice,
    voiceLanguage: state.voiceLanguage,
    edited: state.edited,
    plan: state.plan,
    annual: state.annual,
  }
}

export const useOnboardingStore = create<OnboardingState>()(
  persist(
    (set, get) => ({
      ...createOnboardingDefaults(),

      setOrgId:   (orgId)  => set({ orgId }),
      setStep:    (step)   => set({ currentStep: clampStep(step) }),
      setCompany: (data)   => set((s) => ({ company: { ...s.company, ...data } })),
      setAgent:   (data)   => set((s) => ({ agent:   { ...s.agent,   ...data } })),
      setEdited:  (data)   => set((s) => ({ edited:  { ...s.edited,  ...data } })),
      setVoice:   (voice)  => set((s) => ({ voice: { ...voice }, voiceLanguage: normalizeAgentLanguage(s.agent.language) })),
      clearVoice: ()       => set({ voice: createOnboardingDefaults().voice, voiceLanguage: null }),
      dropVoiceForOtherLanguage: () => {
        if (voiceMatchesLanguage(get())) return false
        get().clearVoice()
        return true
      },
      setPlan:    (plan)   => set({ plan }),
      setAnnual:  (annual) => set({ annual }),
      reset: () => set(createOnboardingDefaults()),
    }),
    {
      name: ONBOARDING_STORAGE_KEY,
      version: ONBOARDING_STORE_VERSION,
      storage: createJSONStorage(() => sessionDraftStorage),
      partialize: pickData,
      migrate: (persisted, version) => migrateOnboardingState(persisted, version),
      // Same-version drafts are sanitised too, so a corrupted entry can't crash a step.
      merge: (persisted, current) =>
        persisted === undefined
          ? current
          : { ...current, ...sanitizeOnboardingData(persisted, current.company.timezone) },
      // An unreadable entry (bad JSON) is dropped so the next load starts clean.
      onRehydrateStorage: () => (_state, error) => {
        if (error) {
          console.warn('[onboarding] the saved draft could not be read; starting from the server copy', error)
          sessionDraftStorage.removeItem(ONBOARDING_STORAGE_KEY)
        }
      },
      // OnboardingWrapper rehydrates after mount, so the server HTML and the
      // first client render agree.
      skipHydration: true,
    }
  )
)
