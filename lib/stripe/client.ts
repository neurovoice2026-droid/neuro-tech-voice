import Stripe from 'stripe'
import { PLANS, isPlan } from '@/types'
import type { BillingInterval, Plan } from '@/types'

let _stripe: Stripe | null = null

export function getStripeClient(): Stripe {
  if (!_stripe) {
    _stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
      apiVersion: '2026-03-25.dahlia',
    })
  }
  return _stripe
}

/** True when a real Stripe secret key is configured (i.e. not the placeholder). */
export function isStripeConfigured(): boolean {
  const key = process.env.STRIPE_SECRET_KEY
  return !!key && key.startsWith('sk_')
}

/** Map a Stripe price ID (monthly or annual, from the env) back to our internal plan tier. */
export function planFromPriceId(priceId: string | null | undefined): Plan | null {
  if (!priceId) return null
  const entries = Object.entries(PLANS) as [Plan, { stripe_price_id: string; stripe_price_id_annual: string }][]
  for (const [plan, cfg] of entries) {
    if (cfg.stripe_price_id && cfg.stripe_price_id === priceId) return plan
    if (cfg.stripe_price_id_annual && cfg.stripe_price_id_annual === priceId) return plan
  }
  return null
}

/** The lookup key of a price the app created itself (lib/stripe/store-prices.ts): ntv_<plan>_<interval>. */
export function planLookupKey(plan: Plan, interval: BillingInterval): string {
  return `ntv_${plan}_${interval}`
}

/** The plan named by one of our lookup keys (ntv_<plan>_<month|year>), else null. */
export function planFromLookupKey(lookupKey: string | null | undefined): Plan | null {
  const m = lookupKey?.match(/^ntv_(.+)_(month|year)$/)
  return m && isPlan(m[1]) ? m[1] : null
}

/** The plan a Stripe price carries in its own data: metadata.ntv_plan first, then the lookup key. */
export function planFromPrice(price: Pick<Stripe.Price, 'metadata' | 'lookup_key'> | null | undefined): Plan | null {
  if (!price) return null
  const tagged = price.metadata?.ntv_plan
  if (isPlan(tagged)) return tagged
  return planFromLookupKey(price.lookup_key)
}

function isMissingResource(err: unknown): boolean {
  const e = err as { code?: unknown; statusCode?: unknown } | null
  return !!e && (e.code === 'resource_missing' || e.statusCode === 404)
}

/**
 * Resolve a subscription's plan from its price: the env-configured price ids
 * first (no API call), otherwise the price is fetched and read (metadata
 * ntv_plan, then the ntv_<plan>_<interval> lookup key), which covers the
 * prices the app creates itself for store plans. A price Stripe no longer
 * knows is unknown (null, today's behaviour); any other API failure is thrown
 * so a webhook answers 500 and Stripe retries instead of downgrading the
 * organization on a transient error.
 */
export async function resolvePlanFromPrice(stripe: Stripe, priceId: string | null | undefined): Promise<Plan | null> {
  if (!priceId) return null
  const mapped = planFromPriceId(priceId)
  if (mapped) return mapped
  try {
    return planFromPrice(await stripe.prices.retrieve(priceId))
  } catch (err) {
    if (isMissingResource(err)) return null
    throw err
  }
}
