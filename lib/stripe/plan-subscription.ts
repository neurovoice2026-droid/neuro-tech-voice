import 'server-only'
// The organization's plan subscription in Stripe, and how a plan change is
// applied to it (POST /api/billing/checkout; POST /api/onboarding/complete
// uses the lookup).
//
// Lookup (findPlanSubscriptions). A plan subscription belongs to the
// organization's Stripe customer, is not a phone-number subscription (every
// number is its own subscription on the same customer) and is stamped for
// this organization or not stamped at all. The one the organization records
// (organizations.stripe_subscription_id) is retrieved directly; otherwise
// every subscription of the customer is read, page by page, so any number of
// phone subscriptions can never hide the plan's.
//   • live: active or trialing, with an item to re-price: switched in place;
//   • due: past_due, unpaid, incomplete or paused: its open invoice has to be
//     paid first (a new Checkout would add a second plan subscription that
//     bills next to it);
//   • hadAny: the customer has had a plan subscription before (any status but
//     incomplete_expired, which never started): no second free trial.
//
// Plan change (planChangeTiming, then the functions below):
//   • unchanged: the price it already pays. A pending change is canceled and
//     a subscription set to end is resumed;
//   • now_trial: during a Stripe trial, right away; nothing is billed or
//     prorated (proration_behavior 'none');
//   • now_upgrade: a higher price on the same billing interval, right away:
//     the difference for the rest of the period is invoiced and collected now
//     (proration_behavior 'always_invoice', payment_behavior
//     'error_if_incomplete': a declined card leaves the plan as it was), and
//     the included minutes follow what was paid
//     (lib/billing/plan-change-minutes.ts);
//   • at_renewal: anything else (a lower or equal price, or another billing
//     interval) starts when the paid period ends, through a subscription
//     schedule: the current price until the period ends, then the new one,
//     after which the schedule releases the subscription. Nothing is prorated
//     or refunded, and the organization keeps its current plan and minutes
//     until that renewal, whose invoice starts the new plan's period.
// The price ids involved are never logged (they can be the env-pinned
// STRIPE_*_PRICE_ID values).

import type Stripe from 'stripe'
import { isStripeMissingResource } from './client'
import type { BillingInterval } from '@/types'

/** Subscription statuses whose plan is switched in place rather than bought again. */
const SWITCHABLE_STATUSES: ReadonlySet<Stripe.Subscription.Status> = new Set(['active', 'trialing'])

/** Statuses of a plan subscription that still bills: its payment is due before any other plan is sold. */
const PAYMENT_DUE_STATUSES: ReadonlySet<Stripe.Subscription.Status> = new Set(['past_due', 'unpaid', 'incomplete', 'paused'])

/** Subscriptions read per page, and pages at most (a customer with more is not a real case). */
const LIST_PAGE_SIZE = 100
const LIST_MAX_PAGES = 10

export function customerIdOf(subscription: Stripe.Subscription): string {
  return typeof subscription.customer === 'string' ? subscription.customer : subscription.customer.id
}

function idOf(value: string | { id: string } | null | undefined): string | null {
  if (!value) return null
  return typeof value === 'string' ? value : value.id
}

/** A plan subscription of this organization: its customer's, not a phone number's, stamped for it (or not stamped). */
export function isPlanSubscriptionOf(subscription: Stripe.Subscription, orgId: string, customerId: string): boolean {
  if (subscription.metadata?.type === 'phone_number') return false
  if (customerIdOf(subscription) !== customerId) return false
  const stampedOrg = subscription.metadata?.org_id
  return !stampedOrg || stampedOrg === orgId
}

function isSwitchable(subscription: Stripe.Subscription): boolean {
  return SWITCHABLE_STATUSES.has(subscription.status) && (subscription.items?.data?.length ?? 0) > 0
}

export interface PlanSubscriptions {
  /** The live (active or trialing) plan subscription; the recorded one wins when there are several. */
  live: Stripe.Subscription | null
  /** A plan subscription whose payment is due (past_due, unpaid, incomplete, paused). */
  due: Stripe.Subscription | null
  /** The customer has had a plan subscription before (a trial included). */
  hadAny: boolean
}

/**
 * The organization's plan subscriptions as Stripe has them. Stripe failures
 * are thrown: answering "none" on an unanswered question could open a second
 * subscription.
 */
export async function findPlanSubscriptions(
  stripe: Stripe,
  ids: { orgId: string; customerId: string | null; recordedId: string | null },
): Promise<PlanSubscriptions> {
  const { orgId, customerId, recordedId } = ids
  if (!customerId) return { live: null, due: null, hadAny: false }

  if (recordedId) {
    let recorded: Stripe.Subscription | null = null
    try {
      recorded = await stripe.subscriptions.retrieve(recordedId)
    } catch (err) {
      if (!isStripeMissingResource(err)) throw err
    }
    if (recorded && isPlanSubscriptionOf(recorded, orgId, customerId) && isSwitchable(recorded)) {
      return { live: recorded, due: null, hadAny: true }
    }
  }

  const all: Stripe.Subscription[] = []
  let startingAfter: string | undefined
  for (let page = 0; page < LIST_MAX_PAGES; page++) {
    const res = await stripe.subscriptions.list({
      customer: customerId,
      status: 'all',
      limit: LIST_PAGE_SIZE,
      ...(startingAfter ? { starting_after: startingAfter } : {}),
    })
    const data = res.data ?? []
    all.push(...data)
    if (!res.has_more || data.length === 0) break
    startingAfter = data[data.length - 1].id
  }

  const plans = all.filter((s) => isPlanSubscriptionOf(s, orgId, customerId))
  const live = plans.filter(isSwitchable)
  const due = plans.filter((s) => PAYMENT_DUE_STATUSES.has(s.status))
  return {
    live: live.find((s) => s.id === recordedId) ?? live[0] ?? null,
    due: due.find((s) => s.id === recordedId) ?? due[0] ?? null,
    hadAny: plans.some((s) => s.status !== 'incomplete_expired'),
  }
}

// ─── Plan change ──────────────────────────────────────────────────────────────

export type PlanChangeTiming = 'unchanged' | 'now_trial' | 'now_upgrade' | 'at_renewal'

export interface PlanTarget {
  priceId: string
  interval: BillingInterval
  /** What the new price bills per interval, in US cents (PLANS, which ensurePlanPriceId guarantees). */
  unitAmountCents: number
}

/** When a change from the live subscription to `target` takes effect (see the header). */
export function planChangeTiming(current: Stripe.Subscription, target: PlanTarget): PlanChangeTiming {
  const item = current.items.data[0]
  if (item.price.id === target.priceId) return 'unchanged'
  if (current.status === 'trialing') return 'now_trial'
  const recurring = item.price.recurring
  const sameInterval = recurring?.interval === target.interval && (recurring?.interval_count ?? 1) === 1
  const currentCents = typeof item.price.unit_amount === 'number' && item.price.currency === 'usd' ? item.price.unit_amount * (item.quantity ?? 1) : null
  if (sameInterval && currentCents !== null && target.unitAmountCents > currentCents) return 'now_upgrade'
  return 'at_renewal'
}

/**
 * The fields that keep a subscription that was set to end: choosing a paid
 * plan means keeping one. Empty when it was not set to end.
 */
export function resumeParams(subscription: Stripe.Subscription): Stripe.SubscriptionUpdateParams {
  if (subscription.cancel_at_period_end) return { cancel_at_period_end: false }
  if (subscription.cancel_at) return { cancel_at: '' }
  return {}
}

/**
 * Cancels a plan change scheduled for the renewal: the subscription's
 * schedule is released (the subscription keeps its current price). True when
 * one was pending.
 */
export async function releasePendingChange(stripe: Stripe, subscription: Stripe.Subscription): Promise<boolean> {
  const scheduleId = idOf(subscription.schedule)
  if (!scheduleId) return false
  const schedule = await stripe.subscriptionSchedules.retrieve(scheduleId)
  if (schedule.status !== 'active' && schedule.status !== 'not_started') return false
  await stripe.subscriptionSchedules.release(scheduleId)
  return true
}

/**
 * Schedules the new price for the end of the paid period (the subscription's
 * existing schedule is reused, so a second change replaces the first).
 * Returns when it takes effect (epoch seconds).
 */
export async function scheduleChangeAtRenewal(
  stripe: Stripe,
  subscription: Stripe.Subscription,
  target: { priceId: string; interval: BillingInterval; metadata: Record<string, string> },
): Promise<number> {
  const item = subscription.items.data[0]
  const existingId = idOf(subscription.schedule)
  const schedule = existingId
    ? await stripe.subscriptionSchedules.retrieve(existingId)
    : await stripe.subscriptionSchedules.create({ from_subscription: subscription.id })

  const currentStart = schedule.current_phase?.start_date ?? null
  const phase = schedule.phases.find((p) => currentStart !== null && p.start_date === currentStart) ?? null
  const start = phase?.start_date ?? item.current_period_start
  const end = phase?.end_date ?? item.current_period_end
  const currentItems = phase?.items.length
    ? phase.items.map((i) => ({ price: idOf(i.price) as string, quantity: i.quantity ?? 1 }))
    : [{ price: item.price.id, quantity: item.quantity ?? 1 }]

  await stripe.subscriptionSchedules.update(schedule.id, {
    end_behavior: 'release',
    proration_behavior: 'none',
    phases: [
      { items: currentItems, start_date: start, end_date: end, proration_behavior: 'none' },
      {
        items: [{ price: target.priceId, quantity: 1 }],
        duration: { interval: target.interval, interval_count: 1 },
        // Entering the phase stamps the plan on the subscription (the webhook's last-resort signal).
        metadata: target.metadata,
        proration_behavior: 'none',
      },
    ],
  })
  return end
}
