import { create } from 'zustand'
import { DEFAULT_COMMERCE_PROFILE, readCommerceProfile, type CommerceProfile } from '@/lib/commerce/profile'
import type { AutomationDto, CommercePlatform, ConnectionDto } from '@/lib/commerce/types'
import type { BusinessType, Plan } from '@/types'

// The store onboarding's client mirror of the server state. The server is the
// source of truth: GET /api/commerce/onboarding/state hydrates this on mount
// and every step writes through its route before the mirror changes. Nothing
// here is persisted in the browser, and no secret (API keys, tokens) ever
// enters it: the connect form keeps them in its own field state only.

// ─── DTOs (GET /api/commerce/onboarding/state) ───────────────────────────────

export interface CommerceOnboardingAgent {
  id: string
  name: string
  language: string
  system_prompt: string | null
  first_message: string | null
  voice_id: string | null
  voice_name: string | null
  is_active: boolean
}

export interface CommerceChecklistItem {
  key: string
  label: string
  ok: boolean
  href: string | null
}

export interface CommerceOnboardingStateDto {
  business_type: BusinessType | null
  onboarding_step: number
  profile: Partial<CommerceProfile> | null
  connection: ConnectionDto | null
  automations: AutomationDto[]
  agent: CommerceOnboardingAgent | null
  has_phone_number: boolean
  checklist: CommerceChecklistItem[]
}

// ─── State + actions ─────────────────────────────────────────────────────────

interface CommerceOnboardingState {
  currentStep: number
  /** True once the server state was read at least once (the wrapper shows a loader until then). */
  hydrated: boolean
  profile: CommerceProfile
  /** The platform picked at step 2; a connection's platform once one exists. */
  platform: CommercePlatform | null
  connection: ConnectionDto | null
  automations: AutomationDto[]
  agent: CommerceOnboardingAgent | null
  hasPhoneNumber: boolean
  checklist: CommerceChecklistItem[]
  plan: Plan

  hydrate: (dto: CommerceOnboardingStateDto) => void
  setStep: (step: number) => void
  setProfile: (data: Partial<CommerceProfile>) => void
  setPlatform: (platform: CommercePlatform | null) => void
  setConnection: (connection: ConnectionDto | null) => void
  setAutomations: (automations: AutomationDto[]) => void
  upsertAutomation: (automation: AutomationDto) => void
  setAgent: (agent: CommerceOnboardingAgent | null) => void
  setPlan: (plan: Plan) => void
  reset: () => void
}

type Data = Omit<
  CommerceOnboardingState,
  'hydrate' | 'setStep' | 'setProfile' | 'setPlatform' | 'setConnection' | 'setAutomations' | 'upsertAutomation' | 'setAgent' | 'setPlan' | 'reset'
>

const defaults: Data = {
  currentStep: 1,
  hydrated: false,
  profile: { ...DEFAULT_COMMERCE_PROFILE },
  platform: null,
  connection: null,
  automations: [],
  agent: null,
  hasPhoneNumber: false,
  checklist: [],
  plan: 'starter',
}

export const useCommerceOnboardingStore = create<CommerceOnboardingState>((set) => ({
  ...defaults,

  hydrate: (dto) =>
    set((s) => ({
      hydrated: true,
      // A stored profile is read leniently: a bad field falls back to its default.
      profile: readCommerceProfile(dto.profile ?? {}),
      connection: dto.connection ?? null,
      // The connection's platform wins over a pick made before a reload.
      platform: dto.connection?.platform ?? s.platform,
      automations: Array.isArray(dto.automations) ? dto.automations : [],
      agent: dto.agent ?? null,
      hasPhoneNumber: dto.has_phone_number === true,
      checklist: Array.isArray(dto.checklist) ? dto.checklist : [],
    })),
  setStep: (currentStep) => set({ currentStep }),
  setProfile: (data) => set((s) => ({ profile: { ...s.profile, ...data } })),
  setPlatform: (platform) => set({ platform }),
  setConnection: (connection) => set((s) => ({ connection, platform: connection?.platform ?? s.platform })),
  setAutomations: (automations) => set({ automations }),
  upsertAutomation: (automation) =>
    set((s) => ({
      automations: s.automations.some((a) => a.type === automation.type)
        ? s.automations.map((a) => (a.type === automation.type ? automation : a))
        : [...s.automations, automation],
    })),
  setAgent: (agent) => set({ agent }),
  setPlan: (plan) => set({ plan }),
  reset: () => set({ ...defaults, profile: { ...DEFAULT_COMMERCE_PROFILE } }),
}))
