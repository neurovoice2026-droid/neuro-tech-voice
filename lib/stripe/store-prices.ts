import 'server-only'
// Stripe prices for every self-serve plan (the paid plans that are not
// contact_sales, service and store alike), without any manual Stripe setup,
// and never at an amount other than the one PLANS sets. (The file keeps the
// name it had when only the store plans used it.)
//
// A plan's price id comes, in order, from:
//   1. the env pin (STRIPE_<PLAN>[_ANNUAL]_PRICE_ID, PLANS[plan].stripe_price_id),
//      used only while Stripe reports it bills exactly what PLANS says (below)
//      AND it is tagged for the plan: metadata.ntv_plan = <plan> on the price
//      or, when the price carries no ntv_plan, on its product. The tag is the
//      operator's statement that the price (and the product name and
//      description Checkout shows) was made for this plan as PLANS sells it:
//      a pin created by hand for the old price list may bill the same amount
//      ($49, $249, $499) under a product that names the old minutes. A pin
//      that fails any check (an old amount, archived, another currency or
//      interval, gone, untagged or tagged for another plan) is ignored with a
//      warning that never names the id;
//   2. the Stripe price that carries the plan's lookup key (ntv_<plan>_<interval>);
//   3. a product + recurring USD price the app creates on first use.
// The product (one per plan, metadata ntv_plan, name and description from
// PLANS: "Pro", "3,000 minutes a month, extra minutes $0.20/min") is shared
// by the monthly and annual prices, and an app-owned product whose name or
// description no longer matches PLANS is brought in line when it is met, so
// Stripe Checkout and the invoices show what the homepage shows. A product
// the app did not create (an env pin's) is never edited. The created price
// carries the lookup key and metadata { ntv_plan, ntv_interval }, which is how
// the billing webhook maps it back to the plan (lib/stripe/client.ts
// resolvePlanFromPrice). Results are cached in-process: one or two Stripe
// round-trips per plan and interval per lambda.
//
// A price is only used while it bills what PLANS says: active, USD, the plan's
// unit amount for the interval, licensed, recurring every one month or year.
// A price found by lookup key that no longer matches (the list price in PLANS
// changed, or someone edited the price in Stripe) is replaced: a new price for
// the current amount takes the lookup key over (transfer_lookup_key), so a
// price change in PLANS reaches new checkouts without any Stripe setup.
// Subscriptions already on the old price keep it until they are switched.
// Stripe Checkout's colours and logo are not set here: they are the account's
// branding (Stripe Dashboard, Settings > Branding).
//
// The find-or-create is not atomic, and two cold lambdas (onboarding and
// checkout, or two customers) can both find nothing and both create. Each
// create therefore carries a Stripe idempotency key derived from what it
// creates (the plan, and the amount: a price key names the interval and unit
// amount, a product key the monthly amount and a fingerprint of the name and
// description), so identical concurrent creates return one product and one
// price: Stripe answers the second with the first's result (409 while the
// first is in flight, which the SDK retries). Because the key changes with
// the content, a new list price or wording never replays an old create (and
// never collides with one: Stripe keeps a key for 24 hours and refuses it with
// other parameters). A replayed create returns the price as it was created,
// so it is read back and checked again: one archived since gets a successor,
// under a key derived from it that racing callers share too. Within one
// process, concurrent calls share the in-flight promise instead.

import { createHash } from 'node:crypto'
import type Stripe from 'stripe'
import { createLogger } from '@/lib/observability/logger'
import { PLANS, isSelfServePlan, stripePriceId } from '@/types'
import type { BillingInterval, Plan, PlanConfig } from '@/types'
import { getStripeClient, isStripeMissingResource, planLookupKey } from './client'

/** How many creates a lookup may make when replays keep returning prices archived since (never more in practice). */
const MAX_PRICE_CREATES = 3

const cache = new Map<string, string>()
const inflight = new Map<string, Promise<string>>()

const log = () => createLogger({ component: 'stripe_plan_prices' })

/** For tests. */
export function resetPlanPriceCache(): void {
  cache.clear()
  inflight.clear()
}

/** "15000" → "15,000", the same in every runtime. */
const groupDigits = (n: number) => String(n).replace(/\B(?=(\d{3})+(?!\d))/g, ',')

/** The Stripe product's name for a plan: the plan's own name, as every card prints it ("Pro", "Store Growth"). */
export function planProductName(cfg: Pick<PlanConfig, 'name'>): string {
  return cfg.name
}

/** The Stripe product's description for a plan: "3,000 minutes a month, extra minutes $0.20/min". */
export function planProductDescription(cfg: Pick<PlanConfig, 'minutes_limit' | 'overage_per_min'>): string {
  return `${groupDigits(cfg.minutes_limit)} minutes a month, extra minutes $${cfg.overage_per_min.toFixed(2)}/min`
}

/**
 * Stripe idempotency key of the product created for a plan: one product per
 * plan and content, however many callers race (the monthly and annual prices
 * share it). It names the monthly amount (cents) and a fingerprint of the
 * product's name and description, so changed wording or prices create anew.
 */
export function productIdempotencyKey(plan: Plan, cfg: PlanConfig = PLANS[plan]): string {
  const fingerprint = createHash('sha256')
    .update(`${planProductName(cfg)}\n${planProductDescription(cfg)}`)
    .digest('hex')
    .slice(0, 12)
  return `ntv_product_${plan}_${planAmountCents(cfg, 'month')}_${fingerprint}`
}

/**
 * Stripe idempotency key of the price created for a plan, interval and unit
 * amount (cents): a new list price is a new key, never a replay of the old one.
 */
export function priceIdempotencyKey(plan: Plan, interval: BillingInterval, amountCents: number): string {
  return `ntv_price_${plan}_${interval}_${amountCents}`
}

/** The unit amount (USD cents) PLANS sets for a plan and interval. */
export function planAmountCents(cfg: Pick<PlanConfig, 'price_monthly' | 'price_annual'>, interval: BillingInterval): number {
  return Math.round((interval === 'year' ? cfg.price_annual : cfg.price_monthly) * 100)
}

type PriceShape = Pick<Stripe.Price, 'active' | 'currency' | 'unit_amount' | 'recurring'>

/** Why a Stripe price does not bill exactly what PLANS says, or null when it does. */
export function priceMismatch(price: PriceShape, amountCents: number, interval: BillingInterval): string | null {
  const recurring = price.recurring
  if (price.active !== true) return 'inactive'
  if (price.currency !== 'usd') return 'currency'
  if (price.unit_amount !== amountCents) return 'amount'
  if (!recurring || recurring.interval !== interval || (recurring.interval_count ?? 1) !== 1) return 'interval'
  if ((recurring.usage_type ?? 'licensed') !== 'licensed') return 'usage_type'
  return null
}

/**
 * Whether a Stripe price bills exactly what PLANS says: active, USD, this
 * unit amount per unit, licensed (not metered), recurring every one interval.
 */
export function priceMatchesPlan(price: PriceShape, amountCents: number, interval: BillingInterval): boolean {
  return priceMismatch(price, amountCents, interval) === null
}

/** True when Stripe answered a create from its idempotency cache (the object as first created, maybe stale since). */
function isIdempotentReplay(created: Stripe.Price | Stripe.Product): boolean {
  const headers = (created as Partial<Stripe.Response<Stripe.Price | Stripe.Product>>).lastResponse?.headers
  return headers?.['idempotent-replayed'] === 'true'
}

type ProductRef = Stripe.Price['product']

/** The product a price can share: its id, or null when it is deleted or archived (a price cannot be sold on it). */
function usableProductId(product: ProductRef): string | null {
  if (typeof product === 'string') return product
  if ('deleted' in product && product.deleted) return null
  return (product as Stripe.Product).active === false ? null : product.id
}

/**
 * Brings an app-owned product's name and description in line with PLANS.
 * Only a product that was read (expanded) and that the app created for this
 * plan (metadata.ntv_plan) is edited: an env pin's product is the operator's.
 * A failure is logged and does not stop the checkout (the price is right;
 * only the label is stale until the next attempt).
 */
async function syncProductLabel(stripe: Stripe, product: ProductRef, plan: Plan, cfg: PlanConfig): Promise<void> {
  if (typeof product === 'string' || ('deleted' in product && product.deleted)) return
  const current = product as Stripe.Product
  if (current.metadata?.ntv_plan !== plan) return
  const name = planProductName(cfg)
  const description = planProductDescription(cfg)
  if (current.name === name && current.description === description) return
  try {
    await stripe.products.update(current.id, { name, description })
    log().info('billing.plan_product_relabeled', { plan, productId: current.id })
  } catch (err) {
    log().warn('billing.plan_product_relabel_failed', { plan, productId: current.id, error: err instanceof Error ? err.message : 'unknown' })
  }
}

/**
 * The Stripe price id to put in a checkout session (or a plan switch) for a
 * self-serve plan and interval. Throws for plans with no self-serve price (the
 * trial, contact-sales tiers) and propagates Stripe API failures: the caller
 * decides what the customer sees. Never returns a price whose amount differs
 * from PLANS.
 */
export async function ensurePlanPriceId(plan: Plan, interval: BillingInterval): Promise<string> {
  if (!isSelfServePlan(plan)) {
    throw new Error(`Plan ${plan} has no self-serve Stripe price`)
  }
  const cfg = PLANS[plan]

  const cacheKey = `${plan}:${interval}`
  const cached = cache.get(cacheKey)
  if (cached) return cached

  const pending = inflight.get(cacheKey)
  if (pending) return pending
  const lookup = resolvePlanPrice(plan, interval, cfg).finally(() => inflight.delete(cacheKey))
  inflight.set(cacheKey, lookup)
  const id = await lookup
  cache.set(cacheKey, id)
  return id
}

async function resolvePlanPrice(plan: Plan, interval: BillingInterval, cfg: PlanConfig): Promise<string> {
  const stripe = getStripeClient()
  const amountCents = planAmountCents(cfg, interval)
  const pinned = await usablePinnedPrice(stripe, plan, interval, amountCents)
  return pinned ?? findOrCreatePrice(stripe, plan, interval, cfg, amountCents)
}

/**
 * Why an env-pinned price is not tagged for `plan`, or null when it is: its
 * own metadata.ntv_plan, else (only when the price carries none) its expanded
 * product's, must name the plan.
 */
export function pinnedPlanTagMismatch(price: Pick<Stripe.Price, 'metadata' | 'product'>, plan: Plan): 'untagged' | 'tagged_other_plan' | null {
  const own = price.metadata?.ntv_plan
  let tag = typeof own === 'string' && own !== '' ? own : null
  if (tag === null) {
    const product = price.product
    if (typeof product !== 'string' && !('deleted' in product && product.deleted)) {
      const fromProduct = (product as Stripe.Product).metadata?.ntv_plan
      tag = typeof fromProduct === 'string' && fromProduct !== '' ? fromProduct : null
    }
  }
  if (tag === null) return 'untagged'
  return tag === plan ? null : 'tagged_other_plan'
}

/**
 * The env-pinned price, when one is set, Stripe reports it bills exactly
 * what PLANS says (and its product is live) and it is tagged for the plan
 * (pinnedPlanTagMismatch); else null, with a warning that carries the reason
 * and never the id. Other Stripe failures propagate.
 */
async function usablePinnedPrice(stripe: Stripe, plan: Plan, interval: BillingInterval, amountCents: number): Promise<string | null> {
  const pinned = stripePriceId(plan, interval)
  if (!pinned) return null
  let price: Stripe.Price
  try {
    price = await stripe.prices.retrieve(pinned, { expand: ['product'] })
  } catch (err) {
    if (!isStripeMissingResource(err)) throw err
    log().warn('billing.pinned_price_ignored', { plan, interval, reason: 'missing' })
    return null
  }
  const reason =
    priceMismatch(price, amountCents, interval) ??
    (usableProductId(price.product) ? null : 'product_inactive') ??
    pinnedPlanTagMismatch(price, plan)
  if (reason) {
    log().warn('billing.pinned_price_ignored', { plan, interval, reason, expectedAmountCents: amountCents })
    return null
  }
  return pinned
}

/**
 * Creates the plan's product (one per plan and content, idempotency key
 * productIdempotencyKey). A replayed create returns the product as it was
 * first created, which may have been archived since (an owner tidying the
 * Stripe Dashboard within the key's 24 hours): it is read back, and an
 * archived or deleted one gets a successor under a key derived from it, which
 * racing callers share too. `successor` says the product is such a successor.
 */
async function createPlanProduct(stripe: Stripe, plan: Plan, cfg: PlanConfig): Promise<{ id: string; successor: boolean }> {
  const baseKey = productIdempotencyKey(plan, cfg)
  let idempotencyKey = baseKey
  for (let attempt = 0; attempt < MAX_PRICE_CREATES; attempt++) {
    const product = await stripe.products.create(
      { name: planProductName(cfg), description: planProductDescription(cfg), metadata: { ntv_plan: plan } },
      { idempotencyKey },
    )
    if (!isIdempotentReplay(product)) return { id: product.id, successor: attempt > 0 }
    const live = await stripe.products.retrieve(product.id)
    if (usableProductId(live)) return { id: live.id, successor: attempt > 0 }
    log().warn('billing.plan_product_archived', { plan, productId: product.id })
    idempotencyKey = `${baseKey}_after_${product.id}`
  }
  throw new Error(`No usable Stripe product for ${plan}`)
}

async function findOrCreatePrice(
  stripe: Stripe,
  plan: Plan,
  interval: BillingInterval,
  cfg: PlanConfig,
  amountCents: number,
): Promise<string> {
  const lookupKey = planLookupKey(plan, interval)
  const siblingKey = planLookupKey(plan, interval === 'year' ? 'month' : 'year')
  // One call finds the wanted price and, failing that, the other interval's
  // price of the same plan, whose product the new price joins. The products
  // come expanded, so their labels can be checked without another call.
  const found = await stripe.prices.list({ lookup_keys: [lookupKey, siblingKey], active: true, limit: 2, expand: ['data.product'] })
  const existing = found.data.find((p) => p.lookup_key === lookupKey)
  if (existing && priceMatchesPlan(existing, amountCents, interval) && usableProductId(existing.product)) {
    await syncProductLabel(stripe, existing.product, plan, cfg)
    return existing.id
  }

  const sibling = found.data.find((p) => p.lookup_key === siblingKey)
  // The plan's product: the outdated price's, else the other interval's, else a new one.
  const reused = [existing, sibling].find((p) => p && usableProductId(p.product))
  let productId: string
  // A product created to replace one archived since its create was first
  // made (see createPlanProduct): its prices take keys of their own.
  let successorProduct = false
  if (reused) {
    productId = usableProductId(reused.product)!
    await syncProductLabel(stripe, reused.product, plan, cfg)
  } else {
    const created = await createPlanProduct(stripe, plan, cfg)
    productId = created.id
    successorProduct = created.successor
  }

  const params: Stripe.PriceCreateParams = {
    product: productId,
    currency: 'usd',
    unit_amount: amountCents,
    recurring: { interval },
    nickname: `${cfg.name} (${interval === 'year' ? 'annual' : 'monthly'})`,
    lookup_key: lookupKey,
    // Lookup keys are unique in Stripe: an outdated or archived price that
    // still holds this key hands it over instead of failing the checkout. A
    // concurrent create of the same price replays this one (idempotency key)
    // rather than taking the key off it.
    transfer_lookup_key: true,
    metadata: { ntv_plan: plan, ntv_interval: interval },
  }

  // The price key names the amount; on a successor product it names the
  // product too, since Stripe refuses a key replayed with other parameters
  // (the original key was first used with the archived product).
  const baseKey = successorProduct ? `${priceIdempotencyKey(plan, interval, amountCents)}_${productId}` : priceIdempotencyKey(plan, interval, amountCents)
  let idempotencyKey = baseKey
  for (let attempt = 0; attempt < MAX_PRICE_CREATES; attempt++) {
    const created = await stripe.prices.create(params, { idempotencyKey })
    // A fresh create is built from PLANS above; a replay is read back, since
    // the price may have been archived after it was first created.
    const replayed = isIdempotentReplay(created)
    const price = replayed ? await stripe.prices.retrieve(created.id) : created
    if (!replayed || priceMatchesPlan(price, amountCents, interval)) {
      if (existing) {
        log().info('billing.plan_price_replaced', {
          plan,
          interval,
          previousPriceId: existing.id,
          priceId: price.id,
          amountCents,
        })
      }
      return price.id
    }
    idempotencyKey = `${baseKey}_after_${created.id}`
  }
  throw new Error(`No usable Stripe price for ${plan} (${interval})`)
}
