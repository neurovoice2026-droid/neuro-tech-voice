import 'server-only'
import Stripe from 'stripe'
import { ApiError } from '@/lib/api/http'
import { env, isStripeConfigured as isStripeKeyConfigured, type EnvName } from '@/lib/env'
import type { BillingInterval, Plan } from '@/types'

// One Stripe client for the app, plus the mapping between Stripe prices and
// our plans. Configuration is read lazily through lib/env.ts so a missing key
// becomes a 503 not_configured instead of a crash at import time.

/** Pinned API version. Since 2025-03-31 the billing period lives on subscription items, not the subscription. */
export const STRIPE_API_VERSION = '2026-03-25.dahlia' as const

let client: Stripe | null = null
let clientKey: string | null = null

/** True when a real secret (sk_) or restricted (rk_) key is configured. */
export function isStripeConfigured(): boolean {
  return isStripeKeyConfigured()
}

export function isStripeWebhookConfigured(): boolean {
  return isStripeKeyConfigured() && !!env.STRIPE_WEBHOOK_SECRET
}

/** Throws ApiError 503 not_configured when Stripe isn't set up. */
export function getStripeClient(): Stripe {
  const key = env.STRIPE_SECRET_KEY
  if (!key || !isStripeKeyConfigured()) {
    throw new ApiError(503, 'not_configured', 'Online payments are not set up yet. Please contact support to change your plan.')
  }
  if (!client || clientKey !== key) {
    client = new Stripe(key, {
      apiVersion: STRIPE_API_VERSION,
      // Stripe adds idempotency keys to retried POSTs itself.
      maxNetworkRetries: 1,
      timeout: 20_000,
    })
    clientKey = key
  }
  return client
}

// ─── Plans ↔ prices ──────────────────────────────────────────────────────────

/** Plans a customer can buy without talking to sales. */
export type SelfServePlan = 'starter' | 'pro' | 'business'

export const SELF_SERVE_PLANS: readonly SelfServePlan[] = ['starter', 'pro', 'business'] as const

const PRICE_ENV: Record<SelfServePlan, Record<BillingInterval, EnvName>> = {
  starter: { month: 'STRIPE_STARTER_PRICE_ID', year: 'STRIPE_STARTER_ANNUAL_PRICE_ID' },
  pro: { month: 'STRIPE_PRO_PRICE_ID', year: 'STRIPE_PRO_ANNUAL_PRICE_ID' },
  business: { month: 'STRIPE_BUSINESS_PRICE_ID', year: 'STRIPE_BUSINESS_ANNUAL_PRICE_ID' },
}

export function isSelfServePlan(plan: unknown): plan is SelfServePlan {
  return typeof plan === 'string' && (SELF_SERVE_PLANS as readonly string[]).includes(plan)
}

/** Configured Stripe price for a plan and interval, or null (trial, custom, or not set up). */
export function priceIdFor(plan: Plan, interval: BillingInterval): string | null {
  if (!isSelfServePlan(plan)) return null
  return env[PRICE_ENV[plan][interval]] ?? null
}

/** Plan and interval a price belongs to; matches monthly and annual prices. */
export function planIntervalFromPriceId(
  priceId: string | null | undefined
): { plan: SelfServePlan; interval: BillingInterval } | null {
  if (!priceId) return null
  for (const plan of SELF_SERVE_PLANS) {
    for (const interval of ['month', 'year'] as const) {
      if (env[PRICE_ENV[plan][interval]] === priceId) return { plan, interval }
    }
  }
  return null
}

/** Map a Stripe price id (monthly or annual) back to our plan tier. */
export function planFromPriceId(priceId: string | null | undefined): Plan | null {
  return planIntervalFromPriceId(priceId)?.plan ?? null
}

// ─── Subscriptions ───────────────────────────────────────────────────────────

/** Statuses where the customer keeps the paid plan (past_due: Stripe is still retrying the card). */
export const PAID_SUBSCRIPTION_STATUSES: readonly Stripe.Subscription.Status[] = ['active', 'trialing', 'past_due']

export function isPaidSubscriptionStatus(status: Stripe.Subscription.Status): boolean {
  return PAID_SUBSCRIPTION_STATUSES.includes(status)
}

export function stripeId(value: string | { id: string } | null | undefined): string | null {
  if (!value) return null
  return typeof value === 'string' ? value : value.id
}

function isMeteredItem(item: Stripe.SubscriptionItem): boolean {
  return item.price.recurring?.usage_type === 'metered'
}

/**
 * The item that carries the plan fee: the one whose price maps to a plan,
 * else the first licensed (non-metered) item.
 */
export function basePlanItem(subscription: Pick<Stripe.Subscription, 'items'>): Stripe.SubscriptionItem | null {
  const items = subscription.items?.data ?? []
  return (
    items.find((item) => planFromPriceId(item.price.id) !== null) ??
    items.find((item) => !isMeteredItem(item)) ??
    null
  )
}

export function meteredItems(subscription: Pick<Stripe.Subscription, 'items'>): Stripe.SubscriptionItem[] {
  return (subscription.items?.data ?? []).filter(isMeteredItem)
}

/**
 * What a plan subscription that stopped paying (deleted, unpaid, expired
 * before its first payment) does to the org:
 * - downgrade: it is the org's current subscription, or a paid self-serve org
 *   that never had its subscription id stored (older rows);
 * - clear: the org is already on the trial and only points at it;
 * - ignore: someone else's or a replaced subscription, or a checkout that never
 *   became current. Expiring an active free trial because an upgrade attempt
 *   failed would stop the owner's agent for no reason.
 */
export function subscriptionEndAction(
  org: { plan: Plan; stripe_subscription_id: string | null },
  subscriptionId: string
): 'downgrade' | 'clear' | 'ignore' {
  const isCurrent = org.stripe_subscription_id === subscriptionId
  if (org.plan === 'trial') return isCurrent ? 'clear' : 'ignore'
  if (isCurrent) return 'downgrade'
  return !org.stripe_subscription_id && isSelfServePlan(org.plan) ? 'downgrade' : 'ignore'
}

// ─── Overage ─────────────────────────────────────────────────────────────────

/**
 * Lookup key of the metered overage price for a plan. The owner creates one
 * metered price per plan and interval on the Billing Meter named by
 * STRIPE_OVERAGE_METER_EVENT (unit amount = the plan's overage rate) and gives
 * it this lookup key; checkout then adds it to the subscription.
 */
export function overagePriceLookupKey(plan: SelfServePlan, interval: BillingInterval): string {
  return `ntv_overage_${plan}_${interval}`
}

export function overageMeterEventName(): string | null {
  return env.STRIPE_OVERAGE_METER_EVENT ?? null
}

/** True when overage minutes are sent to Stripe automatically (and so reach the invoice). */
export function isOverageBillingConfigured(): boolean {
  return isStripeKeyConfigured() && !!overageMeterEventName()
}

/** Metered overage price for a plan, or null when overage billing isn't set up for it. */
export async function findOveragePrice(plan: Plan, interval: BillingInterval): Promise<Stripe.Price | null> {
  if (!overageMeterEventName() || !isSelfServePlan(plan)) return null
  const lookupKey = overagePriceLookupKey(plan, interval)
  try {
    const prices = await getStripeClient().prices.list({ lookup_keys: [lookupKey], active: true, limit: 1 })
    const price = prices.data[0]
    if (!price) {
      console.warn('[billing]', `no active price with lookup key ${lookupKey}; overage minutes on this plan will not be invoiced`)
      return null
    }
    if (price.recurring?.usage_type !== 'metered') {
      console.warn('[billing]', `price ${price.id} (${lookupKey}) is not metered; ignoring it for overage`)
      return null
    }
    return price
  } catch (error) {
    // Overage is a second line on the invoice; failing to find it must not block a purchase.
    console.error('[billing] overage price lookup failed', lookupKey, error instanceof Error ? error.message : error)
    return null
  }
}

/** Line items for a new plan subscription: the plan fee plus the metered overage price when configured. */
export async function planLineItems(
  plan: SelfServePlan,
  interval: BillingInterval
): Promise<NonNullable<Stripe.Checkout.SessionCreateParams['line_items']> | null> {
  const priceId = priceIdFor(plan, interval)
  if (!priceId) return null
  const overage = await findOveragePrice(plan, interval)
  return [{ price: priceId, quantity: 1 }, ...(overage ? [{ price: overage.id }] : [])]
}
