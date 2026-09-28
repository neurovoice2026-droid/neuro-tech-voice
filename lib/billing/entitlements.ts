// What each plan unlocks, and whether an organisation may take calls at all.
// Mirrors the promises in PLANS.features (types/index.ts) and the pricing page,
// so routes gate exactly what the copy sells. Pure; used by API routes, the
// call router and the dashboard (UpgradeNotice).

import type { Organization, Plan } from '@/types'

export interface Entitlements {
  recordings: boolean
  googleIntegrations: boolean
  advancedAnalytics: boolean
  fullAnalytics: boolean
  allIntegrations: boolean
  voiceCloning: boolean
  smsConfirmations: boolean
  outboundCalls: boolean
  /** Paid plans keep answering past the included minutes and bill overage. */
  overageAllowed: boolean
  /** Voice lab text-to-speech quota. */
  ttsCharactersPerMonth: number
  /** Voice lab speech-to-text quota. */
  sttSecondsPerMonth: number
  testCallsPerDay: number
}

const ENTITLEMENTS: Record<Plan, Entitlements> = {
  trial: {
    recordings: false,
    googleIntegrations: false,
    advancedAnalytics: false,
    fullAnalytics: false,
    allIntegrations: false,
    voiceCloning: false,
    smsConfirmations: false,
    outboundCalls: false,
    overageAllowed: false,
    ttsCharactersPerMonth: 2_000,
    sttSecondsPerMonth: 300,
    testCallsPerDay: 5,
  },
  starter: {
    recordings: false,
    googleIntegrations: false,
    advancedAnalytics: false,
    fullAnalytics: false,
    allIntegrations: false,
    voiceCloning: false,
    smsConfirmations: true,
    outboundCalls: true,
    overageAllowed: true,
    ttsCharactersPerMonth: 20_000,
    sttSecondsPerMonth: 3_600,
    testCallsPerDay: 10,
  },
  pro: {
    recordings: true,
    googleIntegrations: true,
    advancedAnalytics: true,
    fullAnalytics: false,
    allIntegrations: false,
    voiceCloning: true,
    smsConfirmations: true,
    outboundCalls: true,
    overageAllowed: true,
    ttsCharactersPerMonth: 100_000,
    sttSecondsPerMonth: 18_000,
    testCallsPerDay: 20,
  },
  business: {
    recordings: true,
    googleIntegrations: true,
    advancedAnalytics: true,
    fullAnalytics: true,
    allIntegrations: true,
    voiceCloning: true,
    smsConfirmations: true,
    outboundCalls: true,
    overageAllowed: true,
    ttsCharactersPerMonth: 300_000,
    sttSecondsPerMonth: 60_000,
    testCallsPerDay: 30,
  },
  custom: {
    recordings: true,
    googleIntegrations: true,
    advancedAnalytics: true,
    fullAnalytics: true,
    allIntegrations: true,
    voiceCloning: true,
    smsConfirmations: true,
    outboundCalls: true,
    overageAllowed: true,
    ttsCharactersPerMonth: 1_000_000,
    sttSecondsPerMonth: 200_000,
    testCallsPerDay: 50,
  },
}

/** Cheapest first; requiredPlanFor walks this order. */
export const PLAN_ORDER: readonly Plan[] = ['trial', 'starter', 'pro', 'business', 'custom']

/** Unknown plan values (a bad row, a plan added in Stripe first) get trial limits, never more. */
export function entitlementsFor(plan: Plan): Entitlements {
  return { ...(ENTITLEMENTS[plan] ?? ENTITLEMENTS.trial) }
}

export type CallBlockReason = 'agent_inactive' | 'number_inactive' | 'trial_expired' | 'minutes_exhausted' | 'org_not_onboarded'

/**
 * Org-level reason to refuse a call, or null to answer it. agent_inactive and
 * number_inactive are decided by the router from its own rows. A trial with no
 * trial_ends_at (pre-migration rows) or an unparseable one isn't treated as
 * expired: refusing real callers on bad data is worse than a few extra days.
 */
export function callBlockReason(
  org: Pick<Organization, 'plan' | 'minutes_used' | 'minutes_limit' | 'trial_ends_at' | 'onboarding_completed'>,
  now: Date = new Date()
): CallBlockReason | null {
  if (!org.onboarding_completed) return 'org_not_onboarded'
  const entitlements = entitlementsFor(org.plan)
  if (org.plan === 'trial' && org.trial_ends_at) {
    const endsAt = Date.parse(org.trial_ends_at)
    if (Number.isFinite(endsAt) && endsAt <= now.getTime()) return 'trial_expired'
  }
  if (!entitlements.overageAllowed && org.minutes_used >= org.minutes_limit) return 'minutes_exhausted'
  return null
}

/**
 * A trial whose end date has passed. Unlike callBlockReason this ignores
 * onboarding, so tools used during setup (test calls) still work before it.
 */
export function isTrialExpired(org: Pick<Organization, 'plan' | 'trial_ends_at'>, now: Date = new Date()): boolean {
  if (org.plan !== 'trial' || !org.trial_ends_at) return false
  const endsAt = Date.parse(org.trial_ends_at)
  return Number.isFinite(endsAt) && endsAt <= now.getTime()
}

/** Cheapest plan that unlocks a feature (for numeric quotas, the cheapest with any allowance). */
export function requiredPlanFor(feature: keyof Entitlements): Plan {
  for (const plan of PLAN_ORDER) {
    const value = ENTITLEMENTS[plan][feature]
    if (value === true || (typeof value === 'number' && value > 0)) return plan
  }
  return 'custom'
}
