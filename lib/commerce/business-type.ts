// Which onboarding an organization gets (migration 024). Pure and
// client-safe: the server decides from the organization row, never from the
// browser's state or the JWT.

import type { BusinessType } from '@/types'

/**
 * The cookie that carries what a visitor came to sign up for (a store plan's
 * /register?intent=store) to Step 0 of the onboarding, which pre-selects it.
 * Helpers in lib/auth/business-intent.ts. A suggestion only: the business
 * type is written once, by the owner's own click.
 */
export const BUSINESS_INTENT_COOKIE = 'ntv_business_intent'

export type OnboardingVariant = 'choose' | 'services' | 'ecommerce'

export interface BusinessTypeFields {
  business_type?: BusinessType | null
  business_type_selected_at?: string | null
}

/**
 * 'choose'    the owner has not picked a business type (new sign-up after 024);
 * 'services'  the original onboarding and dashboard (also every legacy org);
 * 'ecommerce' the store onboarding and the Store section (/store).
 * A row from before migration 024 (no column at all) reads as 'services'.
 */
export function onboardingVariant(org: BusinessTypeFields | null | undefined): OnboardingVariant {
  if (!org || !('business_type' in org)) return 'services'
  if (org.business_type === 'ecommerce') return 'ecommerce'
  if (org.business_type === 'services') return 'services'
  return 'choose'
}

/** True when the business type is the pre-024 backfill rather than an explicit choice. */
export function isLegacyBusinessType(org: BusinessTypeFields | null | undefined): boolean {
  return !!org && org.business_type === 'services' && !org.business_type_selected_at
}

export function isEcommerceOrg(org: BusinessTypeFields | null | undefined): boolean {
  return onboardingVariant(org) === 'ecommerce'
}

/** Steps of the store onboarding, in order (onboarding_step for ecommerce orgs). */
export const COMMERCE_ONBOARDING_STEPS = [
  { num: 1, key: 'store', label: 'About your store' },
  { num: 2, key: 'platform', label: 'Connect your store' },
  { num: 3, key: 'access', label: 'Access & sync' },
  { num: 4, key: 'automations', label: 'Automations' },
  { num: 5, key: 'agent', label: 'Your agent' },
  { num: 6, key: 'launch', label: 'Launch' },
] as const

export type CommerceOnboardingStepKey = (typeof COMMERCE_ONBOARDING_STEPS)[number]['key']
export const TOTAL_COMMERCE_ONBOARDING_STEPS = COMMERCE_ONBOARDING_STEPS.length

/** Clamps a stored onboarding_step to a valid store step. */
export function commerceStepOf(raw: unknown): number {
  const n = typeof raw === 'number' && Number.isFinite(raw) ? Math.floor(raw) : 1
  return Math.min(TOTAL_COMMERCE_ONBOARDING_STEPS, Math.max(1, n))
}
