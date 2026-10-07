import 'server-only'
// The shared platform workspace's subscription, verified against the official
// OpenAPI spec (2026-10):
//   GET /v1/user/subscription → ExtendedSubscriptionResponseModel
// Platform/admin only: credits, voice slots and invoices of the ONE workspace
// every tenant shares. Never shown to a tenant. Needs the user_read permission
// on the API key (a ConvAI-only key gets 401/403 → monitoring reports
// "unknown", never "ok").
//
// Fields used (all in the spec): tier*, status* (SubscriptionStatusType),
// character_count* / character_limit* (credits), max_credit_limit_extension*
// (integer | "unlimited"), can_extend_character_limit*,
// next_character_count_reset_unix, voice_slots_used* / voice_limit*,
// voice_add_edit_counter* / max_voice_add_edits, professional_voice_slots_used* /
// professional_voice_limit*, can_use_instant_voice_cloning*, has_open_invoices*,
// open_invoices* (only their count is used), current_overage* {amount, currency}.
// The deprecated max_character_limit_extension / allowed_to_extend_character_limit
// are not read.

import { req, type Ctx } from '../client'

/** SubscriptionStatusType. */
export type ELSubscriptionStatus = 'trialing' | 'active' | 'incomplete' | 'past_due' | 'free' | 'free_disabled'

export const SUBSCRIPTION_STATUSES: readonly ELSubscriptionStatus[] = ['trialing', 'active', 'incomplete', 'past_due', 'free', 'free_disabled'] as const

/** Statuses that put every tenant's calls at risk (billing problem or a disabled free tier). */
export const BLOCKING_SUBSCRIPTION_STATUSES: ReadonlySet<string> = new Set(['incomplete', 'past_due', 'free_disabled'])

export interface ELSubscription {
  tier: string
  status: ELSubscriptionStatus | string
  character_count: number
  character_limit: number
  max_credit_limit_extension?: number | 'unlimited' | null
  can_extend_character_limit?: boolean
  next_character_count_reset_unix?: number | null
  voice_slots_used?: number
  voice_limit?: number
  voice_add_edit_counter?: number
  max_voice_add_edits?: number | null
  professional_voice_slots_used?: number
  professional_voice_limit?: number
  can_use_instant_voice_cloning?: boolean
  has_open_invoices?: boolean
  open_invoices?: unknown[]
  current_overage?: { amount?: string; currency?: string } | null
}

/** GET /v1/user/subscription (read-only, retried like any GET). */
export function getSubscription(ctx?: Ctx) {
  return req<ELSubscription>('user.subscription', '/v1/user/subscription', { timeoutMs: 8_000, ctx })
}
