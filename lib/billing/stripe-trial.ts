// Included minutes while a paid plan's Stripe subscription is still in its
// free days (status 'trialing': the 14 days POST /api/onboarding/complete
// gives a customer's first plan subscription). Nothing has been paid yet, so
// the plan's full allowance would be free minutes at real cost (about $0.10 a
// minute blended): Scale's 15,000 would be about $1,500 for a sign-up that
// cancels before day 14. Until the first payment, a paid plan therefore
// includes at most STRIPE_TRIAL_MINUTES; the billing webhook writes the plan's
// full minutes_limit once the subscription is active, and the first paid
// invoice (billing_reason subscription_cycle) starts a new usage period with
// minutes_used back to 0. Prepaid extra-minute packs can be bought during the
// free days (they are charged when bought).
//
// Safe default chosen without the owner (standing instruction: decide,
// document, report); the owner can change the number here.

import { PLANS } from '@/types'
import type { Plan } from '@/types'

/** The most included minutes a paid plan grants before its first payment. */
export const STRIPE_TRIAL_MINUTES = 100

/** organizations.minutes_limit for `plan` held by a subscription in this Stripe status. */
export function includedMinutesFor(plan: Plan, subscriptionStatus: string | null | undefined): number {
  const full = PLANS[plan].minutes_limit
  if (plan === 'trial' || subscriptionStatus !== 'trialing') return full
  return Math.min(full, STRIPE_TRIAL_MINUTES)
}
