// When an in-place plan change takes effect, in the billing page's words.
// POST /api/billing/checkout decides (lib/stripe/plan-subscription.ts
// planChangeTiming): an upgrade to a higher price on the same billing
// interval applies right away, the prorated difference charged now; a
// downgrade, the same price or a change between monthly and annual billing
// applies at the next renewal, nothing refunded or charged before; during a
// Stripe trial everything applies right away. The page shows its estimate
// before asking (the server knows the trial and the exact amounts) and the
// server's answer after. Pure and client-safe.

import { PLANS, isPlan, type BillingInterval, type Plan } from '@/types'

export type PlanSwitchEffective = 'now' | 'renewal'

const INTERVAL_WORD: Record<BillingInterval, string> = { month: 'monthly', year: 'annual' }

/** The billing interval the organization pays on (organizations.billing_interval; unknown reads as monthly). */
export function currentBillingInterval(value: string | null | undefined): BillingInterval {
  return value === 'year' ? 'year' : 'month'
}

/**
 * The page's estimate of when a change from the current plan takes effect:
 * now for a higher list price on the same interval, at the renewal for
 * anything else (a sales-led plan's price is agreed with sales, so moving off
 * it waits for the renewal).
 */
export function expectedPlanSwitch(
  current: { plan: string | null | undefined; interval: BillingInterval },
  target: { plan: Plan; interval: BillingInterval },
): PlanSwitchEffective {
  if (!isPlan(current.plan) || current.plan === 'trial') return 'now'
  const from = PLANS[current.plan]
  if (from.contact_sales || current.interval !== target.interval) return 'renewal'
  const price = (p: Plan) => (target.interval === 'year' ? PLANS[p].price_annual : PLANS[p].price_monthly)
  return price(target.plan) > price(current.plan) ? 'now' : 'renewal'
}

/** The timing in a successful in-place answer ({ updated, plan, effective, effective_at }); anything unexpected reads as now. */
export function readPlanSwitchTiming(body: unknown): { effective: PlanSwitchEffective; effectiveAt: string | null } {
  const record = body && typeof body === 'object' ? (body as Record<string, unknown>) : {}
  const at = typeof record.effective_at === 'string' && Number.isFinite(Date.parse(record.effective_at)) ? record.effective_at : null
  return record.effective === 'renewal' ? { effective: 'renewal', effectiveAt: at } : { effective: 'now', effectiveAt: null }
}

/** "November 14, 2026" (UTC, so it matches the Stripe period end everywhere). */
export function formatSwitchDate(iso: string): string {
  return new Intl.DateTimeFormat('en-US', { month: 'long', day: 'numeric', year: 'numeric', timeZone: 'UTC' }).format(new Date(iso))
}

/** The toast after the change was accepted. */
export function planSwitchToast(planName: string, timing: { effective: PlanSwitchEffective; effectiveAt: string | null }): string {
  if (timing.effective === 'now') return `Your plan is now ${planName}.`
  const when = timing.effectiveAt ? `on ${formatSwitchDate(timing.effectiveAt)}` : 'at your next renewal'
  return `Your plan changes to ${planName} ${when}. Until then you keep your current plan and its minutes.`
}

/** The card's small print under its button. */
export function planSwitchMicro(effective: PlanSwitchEffective): string {
  return effective === 'now' ? 'Prorated difference charged now' : 'Starts at your next renewal'
}

/**
 * The confirmation dialog's explanation: when it applies, what is charged and
 * when, what happens to the minutes, and a billing-interval change said out loud.
 */
export function planSwitchDescription(input: {
  currentName: string
  targetName: string
  /** "$249 a month" / "$2,490 a year" */
  targetPrice: string
  /** The new plan's included minutes, formatted. */
  targetMinutes: string
  effective: PlanSwitchEffective
  fromInterval: BillingInterval
  toInterval: BillingInterval
}): string {
  const intervalChange =
    input.fromInterval !== input.toInterval
      ? ` Your billing also moves from ${INTERVAL_WORD[input.fromInterval]} to ${INTERVAL_WORD[input.toInterval]} at that renewal.`
      : ''
  if (input.effective === 'now') {
    return (
      `Your subscription changes to ${input.targetName} right away, at ${input.targetPrice}. ` +
      `The price difference for the rest of this billing period is charged to your card now, and ${input.targetName}'s extra minutes ` +
      `are added for the rest of the period. From your next renewal, ${input.targetMinutes} minutes a month. Extra minutes you bought are kept.`
    )
  }
  return (
    `Your subscription changes to ${input.targetName} at your next renewal, at ${input.targetPrice}. ` +
    `Until then you keep ${input.currentName} and its minutes; nothing is refunded or charged today.${intervalChange} ` +
    `During a free trial the change applies right away and nothing is charged until the trial ends. Extra minutes you bought are kept.`
  )
}
