import { HOME_PRICING } from '@/lib/pages/home/pricing'
import { PLANS, type BillingInterval, type Plan } from '@/types'
import { TRIAL_TIER } from './plan-tier-view'

// The billing page's Upgrade / Downgrade / Switch rule is planChangeRelation
// (lib/billing/upgrade.ts, re-exported by components/billing/minutes-logic.ts):
// a sales-led plan is the top rung of its family, so every other plan is a
// downgrade from Enterprise. This file says what the current plan is called
// and costs, which cards the plan picker shows, and the picker's cycle words.

/** The billing-cycle switch's words, the homepage's and onboarding's: "Monthly | Yearly". */
export const BILLING_CYCLE_LABEL: Readonly<Record<BillingInterval, string>> = {
  month: HOME_PRICING.billing.monthly,
  year: HOME_PRICING.billing.yearly,
}

/** The current plan's name on the billing page: the trial as its card calls it ("Free trial"), any other plan as PLANS does. */
export function currentPlanName(plan: Plan): string {
  return plan === 'trial' ? TRIAL_TIER.name : PLANS[plan].name
}

/**
 * The plan picker's cards before the family's sales-led band: the trial card
 * only while the organization is on it (as its current plan), then the
 * family's self-serve plans. A paying organization is never offered the
 * trial card: its sign-up words ("$0 for 14 days", "No card needed") are not
 * what canceling gives (the free plan's 5 minutes, at once), and canceling
 * lives in the Stripe portal ("Payment method & invoices").
 */
export function billingPickerPlans(currentPlan: Plan, selfServe: readonly Plan[]): Plan[] {
  return currentPlan === 'trial' ? ['trial', ...selfServe] : [...selfServe]
}

/**
 * The price a plan is billed at, on the interval the organization pays
 * (organizations.billing_interval; monthly when unknown), in a sentence
 * fragment: "$249 / month", "$2,490 / year"; "No subscription" on the trial;
 * "Priced with you" for a sales-led plan without a published price,
 * "From $1,000 / month" for one with a starting price.
 */
export function planPriceText(plan: Plan, interval: BillingInterval = 'month'): string {
  const cfg = PLANS[plan]
  const money = (n: number) => `$${n.toLocaleString('en-US')}`
  const yearly = interval === 'year'
  const price = yearly ? cfg.price_annual : cfg.price_monthly
  const per = yearly ? 'year' : 'month'
  if (plan === 'trial') return 'No subscription'
  if (cfg.contact_sales) return price > 0 ? `From ${money(price)} / ${per}` : 'Priced with you'
  return `${money(price)} / ${per}`
}
