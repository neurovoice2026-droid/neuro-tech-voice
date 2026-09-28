import type { Entitlements } from '@/lib/billing/entitlements'
import type { AgentPatchInput } from '@/lib/voice/sync/schemas'
import type { PhoneNumber, Plan } from '@/types'

/** The organisation facts the agent settings need (no billing ids, no tokens). */
export interface AgentOrgSummary {
  id: string
  name: string | null
  industry: string | null
  description: string | null
  plan: Plan
  timezone: string
  sms_enabled: boolean
}

export type LinkedPhoneNumber = Pick<PhoneNumber, 'id' | 'number' | 'friendly_name' | 'is_active'>

/**
 * Body for PATCH /api/agent. Metadata is merged per key on the server, so send
 * only the keys you change (never the whole stored object: its legacy
 * `personality` key would override the tone).
 */
export type AgentPatch = AgentPatchInput

export type AgentUpdate = (payload: AgentPatch, successMessage?: string) => Promise<boolean>

export interface AgentSettingsContext {
  org: AgentOrgSummary
  entitlements: Entitlements
}
