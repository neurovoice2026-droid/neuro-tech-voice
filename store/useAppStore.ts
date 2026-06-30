import { create } from 'zustand'
import type { Organization, Agent, Call } from '@/types'

interface AppState {
  organization: Organization | null
  agent: Agent | null
  calls: Call[]
  isLoading: boolean

  // Actions
  setOrganization: (org: Organization | null) => void
  setAgent: (agent: Agent | null) => void
  setCalls: (calls: Call[]) => void
  addCall: (call: Call) => void
  updateCall: (id: string, updates: Partial<Call>) => void
  setLoading: (loading: boolean) => void
}

export const useAppStore = create<AppState>((set) => ({
  organization: null,
  agent: null,
  calls: [],
  isLoading: false,

  setOrganization: (org) => set({ organization: org }),
  setAgent: (agent) => set({ agent }),
  setCalls: (calls) => set({ calls }),
  addCall: (call) => set((state) => ({ calls: [call, ...state.calls] })),
  updateCall: (id, updates) =>
    set((state) => ({
      calls: state.calls.map((c) => (c.id === id ? { ...c, ...updates } : c)),
    })),
  setLoading: (isLoading) => set({ isLoading }),
}))
