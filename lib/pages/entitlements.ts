// OWNER: the plan gates the site quotes, copied from the rebuilt platform's
// lib/billing/entitlements.ts (branch HEAD 249b5c5: the table, PLAN_ORDER,
// entitlementsFor and requiredPlanFor, verbatim). The production app on main
// enforces none of this table: it has no lib/billing/entitlements.ts, no SMS,
// no voice lab and no per-day test-call quota; its only plan copy is
// PLANS[].features in types/index.ts. Delete this file and import
// "@/lib/billing/entitlements" again when the platform ships.
//
// The service ladder follows the homepage cards (lib/pages/home/pricing.ts):
// Growth is "everything in Starter" with more minutes, so it has Starter's
// entitlements; Scale is "everything in Business" with more minutes, so it
// has Business's; Enterprise ('custom') adds the largest voice-lab allowance
// and the most test calls.
//
// Store plans (types/index.ts STORE_PLANS) get the entitlements of a service
// plan: a listed store plan those of the listed service plan with the nearest
// price, Store Starter ($100) those of Growth ($99, the same as Starter's),
// Store Growth ($250) those of Pro ($249), Store Scale ($500) those of
// Business ($499); the sales-led Store Enterprise those of the sales-led
// Enterprise ('custom'). That is what their feature lists promise
// (recordings and analytics arrive with Store Growth, every integration with
// Store Scale) and it keeps one table instead of two. Store plans are never
// "above" or "below" a service plan in a way that matters to a buyer, because
// an organization can only buy from its own family, so requiredPlanFor
// answers per family.

import { PLANS, type Plan, type PlanFamily } from '@/types'

export interface Entitlements {
  recordings: boolean
  googleIntegrations: boolean
  advancedAnalytics: boolean
  fullAnalytics: boolean
  allIntegrations: boolean
  voiceCloning: boolean
  smsConfirmations: boolean
  outboundCalls: boolean
  /**
   * Paid plans can buy prepaid extra minutes (minute packs or auto top-up)
   * and keep calling once the included minutes are used up; the trial
   * cannot, so it stops at its minutes. Nothing is billed after the fact.
   * The key keeps its old name.
   */
  overageAllowed: boolean
  /** Voice lab text-to-speech quota. */
  ttsCharactersPerMonth: number
  /** Voice lab speech-to-text quota. */
  sttSecondsPerMonth: number
  testCallsPerDay: number
}

const TRIAL: Entitlements = {
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
}

const STARTER: Entitlements = {
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
}

const PRO: Entitlements = {
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
}

const BUSINESS: Entitlements = {
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
}

const CUSTOM: Entitlements = {
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
}

const ENTITLEMENTS: Record<Plan, Entitlements> = {
  trial: TRIAL,
  starter: STARTER,
  // "Everything in Starter, plus" minutes (the homepage Growth card).
  growth: STARTER,
  pro: PRO,
  business: BUSINESS,
  // "Everything in Business, plus" minutes and priority onboarding (the homepage Scale card).
  scale: BUSINESS,
  custom: CUSTOM,
  store_starter: STARTER,
  store_growth: PRO,
  store_scale: BUSINESS,
  store_enterprise: CUSTOM,
}

/**
 * The service plan whose entitlements (and call capacity) a store plan
 * shares: for a listed store plan the listed service plan with the nearest
 * price, for the sales-led Store Enterprise the sales-led Enterprise.
 */
export const STORE_PLAN_EQUIVALENT: Readonly<Record<'store_starter' | 'store_growth' | 'store_scale' | 'store_enterprise', Plan>> = {
  store_starter: 'growth',
  store_growth: 'pro',
  store_scale: 'business',
  store_enterprise: 'custom',
}

/**
 * Every plan, cheapest first (store plans interleaved by price), the
 * sales-led tiers last. requiredPlanFor walks it per family.
 */
export const PLAN_ORDER: readonly Plan[] = [
  'trial',
  'starter',
  'growth',
  'store_starter',
  'pro',
  'store_growth',
  'business',
  'store_scale',
  'scale',
  'custom',
  'store_enterprise',
]

/** Unknown plan values (a bad row, a plan added in Stripe first) get trial limits, never more. */
export function entitlementsFor(plan: Plan): Entitlements {
  return { ...(ENTITLEMENTS[plan] ?? ENTITLEMENTS.trial) }
}

/**
 * Cheapest plan of the family that unlocks a feature (for numeric quotas, the
 * cheapest with any allowance). Service plans by default, so every existing
 * site quote is unchanged; 'ecommerce' answers with a store plan, the only
 * kind an online store can buy.
 */
export function requiredPlanFor(feature: keyof Entitlements, family: PlanFamily = 'services'): Plan {
  const order = PLAN_ORDER.filter((plan) => PLANS[plan].family === 'any' || PLANS[plan].family === family)
  for (const plan of order) {
    const value = ENTITLEMENTS[plan][feature]
    if (value === true || (typeof value === 'number' && value > 0)) return plan
  }
  return order[order.length - 1]
}
