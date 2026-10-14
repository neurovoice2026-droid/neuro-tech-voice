import 'server-only'
// Stripe prices for the store plans without any manual Stripe setup.
//
// A store plan's price id comes, in order, from the env (STRIPE_STORE_*_PRICE_ID,
// an operator pin), from the Stripe price that carries the plan's lookup key
// (ntv_<plan>_<interval>), or from a product + recurring USD price the app
// creates on first use. The product (one per plan, metadata ntv_plan) is
// shared by the monthly and annual prices. The created price carries the
// lookup key and metadata { ntv_plan, ntv_interval }, which is how the billing
// webhook maps it back to the plan (lib/stripe/client.ts resolvePlanFromPrice).
// Results are cached in-process: one Stripe round-trip per plan and interval
// per lambda, none at all once the env ids are set.
//
// The find-or-create is not atomic, and two cold lambdas (onboarding and
// checkout, or two merchants) can both find nothing and both create. Each
// create therefore carries a Stripe idempotency key derived from the plan (and
// interval), so identical concurrent creates return one product and one price:
// Stripe answers the second with the first's result (409 while the first is in
// flight, which the SDK retries). Within one process, concurrent calls share
// the in-flight promise instead.

import type Stripe from 'stripe'
import { PLANS, stripePriceId } from '@/types'
import type { BillingInterval, Plan, PlanConfig } from '@/types'
import { getStripeClient, planLookupKey } from './client'

const cache = new Map<string, string>()
const inflight = new Map<string, Promise<string>>()

/** For tests. */
export function resetPlanPriceCache(): void {
  cache.clear()
  inflight.clear()
}

/** Stripe idempotency key of the product created for a plan: one product per plan, however many callers race. */
export function productIdempotencyKey(plan: Plan): string {
  return `ntv_product_${plan}`
}

/** Stripe idempotency key of the price created for a plan and interval. */
export function priceIdempotencyKey(plan: Plan, interval: BillingInterval): string {
  return `ntv_price_${plan}_${interval}`
}

function productIdOf(price: Stripe.Price): string | null {
  const product = price.product
  if (typeof product === 'string') return product
  return 'deleted' in product && product.deleted ? null : product.id
}

/**
 * The Stripe price id to put in a checkout session for a self-serve plan and
 * interval. Throws for plans with no self-serve price (the trial, contact-sales
 * tiers) and propagates Stripe API failures: the caller decides what the
 * customer sees.
 */
export async function ensurePlanPriceId(plan: Plan, interval: BillingInterval): Promise<string> {
  const cfg = PLANS[plan]
  if (!cfg || cfg.contact_sales || cfg.price_monthly <= 0) {
    throw new Error(`Plan ${plan} has no self-serve Stripe price`)
  }
  const configured = stripePriceId(plan, interval)
  if (configured) return configured

  const cacheKey = `${plan}:${interval}`
  const cached = cache.get(cacheKey)
  if (cached) return cached

  const pending = inflight.get(cacheKey)
  if (pending) return pending
  const lookup = findOrCreatePrice(plan, interval, cfg).finally(() => inflight.delete(cacheKey))
  inflight.set(cacheKey, lookup)
  const id = await lookup
  cache.set(cacheKey, id)
  return id
}

async function findOrCreatePrice(plan: Plan, interval: BillingInterval, cfg: PlanConfig): Promise<string> {
  const stripe = getStripeClient()
  const lookupKey = planLookupKey(plan, interval)
  const siblingKey = planLookupKey(plan, interval === 'year' ? 'month' : 'year')
  // One call finds the wanted price and, failing that, the other interval's
  // price of the same plan, whose product the new price joins.
  const found = await stripe.prices.list({ lookup_keys: [lookupKey, siblingKey], active: true, limit: 2 })
  const existing = found.data.find((p) => p.lookup_key === lookupKey)
  if (existing) return existing.id

  const sibling = found.data.find((p) => p.lookup_key === siblingKey)
  const productId =
    (sibling && productIdOf(sibling)) ??
    (await stripe.products.create({ name: cfg.name, metadata: { ntv_plan: plan } }, { idempotencyKey: productIdempotencyKey(plan) })).id

  const amount = interval === 'year' ? cfg.price_annual : cfg.price_monthly
  const price = await stripe.prices.create(
    {
      product: productId,
      currency: 'usd',
      unit_amount: Math.round(amount * 100),
      recurring: { interval },
      nickname: `${cfg.name} (${interval === 'year' ? 'annual' : 'monthly'})`,
      lookup_key: lookupKey,
      // Lookup keys are unique in Stripe: an archived price that still holds this
      // key (an operator retired it) hands it over instead of failing the checkout.
      // A concurrent create of the same price replays this one (idempotency key)
      // rather than taking the key off it.
      transfer_lookup_key: true,
      metadata: { ntv_plan: plan, ntv_interval: interval },
    },
    { idempotencyKey: priceIdempotencyKey(plan, interval) },
  )
  return price.id
}
