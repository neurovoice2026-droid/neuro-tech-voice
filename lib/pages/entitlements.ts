// OWNER: the plan gates the site quotes, copied from the rebuilt platform's
// lib/billing/entitlements.ts (branch HEAD 249b5c5: the table, PLAN_ORDER,
// entitlementsFor and requiredPlanFor, verbatim). The production app on main
// enforces none of this table: it has no lib/billing/entitlements.ts, no SMS,
// no voice lab and no per-day test-call quota; its only plan copy is
// PLANS[].features in types/index.ts. Delete this file and import
// "@/lib/billing/entitlements" again when the platform ships.

import type { Plan } from '@/types'

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

/** Cheapest plan that unlocks a feature (for numeric quotas, the cheapest with any allowance). */
export function requiredPlanFor(feature: keyof Entitlements): Plan {
  for (const plan of PLAN_ORDER) {
    const value = ENTITLEMENTS[plan][feature]
    if (value === true || (typeof value === 'number' && value > 0)) return plan
  }
  return 'custom'
}
