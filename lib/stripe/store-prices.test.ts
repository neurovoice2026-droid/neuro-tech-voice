import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.hoisted(() => {
  // PLANS reads the price pins at module load: Store Scale and Pro (monthly)
  // are pinned, the others are not.
  process.env.STRIPE_STORE_SCALE_PRICE_ID = 'price_scale_pinned'
  process.env.STRIPE_PRO_PRICE_ID = 'price_pro_pinned'
  delete process.env.STRIPE_PRO_ANNUAL_PRICE_ID
  delete process.env.STRIPE_STORE_STARTER_PRICE_ID
  delete process.env.STRIPE_STORE_STARTER_ANNUAL_PRICE_ID
  delete process.env.STRIPE_STORE_GROWTH_PRICE_ID
  delete process.env.STRIPE_GROWTH_PRICE_ID
  delete process.env.STRIPE_GROWTH_ANNUAL_PRICE_ID
})

const stripe = {
  prices: { list: vi.fn(), create: vi.fn(), retrieve: vi.fn() },
  products: { create: vi.fn(), update: vi.fn(), retrieve: vi.fn() },
}
vi.mock('./client', async (importOriginal) => ({
  ...(await importOriginal<typeof import('./client')>()),
  getStripeClient: () => stripe,
}))

const logs = vi.hoisted(() => ({ warn: [] as Array<[string, Record<string, unknown> | undefined]>, info: [] as string[] }))
vi.mock('@/lib/observability/logger', () => {
  const logger = {
    debug: () => {},
    info: (event: string) => logs.info.push(event),
    warn: (event: string, fields?: Record<string, unknown>) => logs.warn.push([event, fields]),
    error: () => {},
    child: () => logger,
    context: {},
  }
  return { createLogger: () => logger }
})

import {
  ensurePlanPriceId,
  pinnedPlanTagMismatch,
  planAmountCents,
  planProductDescription,
  planProductName,
  priceIdempotencyKey,
  priceMatchesPlan,
  priceMismatch,
  productIdempotencyKey,
  resetPlanPriceCache,
} from './store-prices'
import { PLANS, SELF_SERVE_PLANS, isPlan, type Plan } from '@/types'

/** The unit amount PLANS sets for one of our lookup keys (ntv_<plan>_<interval>). */
function listAmount(lookupKey: string): number {
  const m = lookupKey.match(/^ntv_(.+)_(month|year)$/)
  if (!m || !isPlan(m[1])) throw new Error(`not a plan lookup key: ${lookupKey}`)
  return planAmountCents(PLANS[m[1]], m[2] as 'month' | 'year')
}

/** A Stripe price as prices.list returns it, billing exactly what PLANS says unless `fields` change it. */
const price = (id: string, lookup_key: string, product: unknown = 'prod_existing', fields: Record<string, unknown> = {}) => ({
  id,
  lookup_key,
  product,
  active: true,
  currency: 'usd',
  unit_amount: listAmount(lookup_key),
  recurring: { interval: lookup_key.endsWith('_year') ? 'year' : 'month', interval_count: 1, usage_type: 'licensed' },
  ...fields,
})

/** A product as an expanded price carries it: created by the app for `plan` unless `fields` say otherwise. */
const product = (id: string, plan: Plan, fields: Record<string, unknown> = {}) => ({
  id,
  object: 'product',
  active: true,
  name: planProductName(PLANS[plan]),
  description: planProductDescription(PLANS[plan]),
  metadata: { ntv_plan: plan },
  ...fields,
})

/**
 * A pinned env price as prices.retrieve returns it (product expanded), for
 * `plan` and `interval`: the operator's product, the price tagged
 * metadata.ntv_plan = plan (the tag a pin needs) unless `fields` say otherwise.
 */
const pinned = (id: string, plan: Plan, interval: 'month' | 'year', fields: Record<string, unknown> = {}) => ({
  ...price(id, `ntv_${plan}_${interval}`, { id: 'prod_owner', object: 'product', active: true, name: 'Owner made this', metadata: {} }),
  lookup_key: null,
  metadata: { ntv_plan: plan },
  ...fields,
})

const REPLAYED = { lastResponse: { headers: { 'idempotent-replayed': 'true' } } }

interface PriceParams {
  product: string
  lookup_key: string
  currency: string
  unit_amount: number
  recurring: { interval: string }
}

/** The price Stripe would return for a create (what was sent, active). */
const priceFrom = (id: string, params: PriceParams) => ({
  id,
  lookup_key: params.lookup_key,
  product: params.product,
  active: true,
  currency: params.currency,
  unit_amount: params.unit_amount,
  recurring: { interval: params.recurring.interval, interval_count: 1, usage_type: 'licensed' },
})

beforeEach(() => {
  resetPlanPriceCache()
  logs.warn.length = 0
  logs.info.length = 0
  stripe.prices.list.mockReset().mockResolvedValue({ data: [] })
  stripe.prices.create.mockReset().mockImplementation(async (params: PriceParams) => priceFrom(`price_new_${params.lookup_key}`, params))
  stripe.prices.retrieve.mockReset()
  stripe.products.create.mockReset().mockResolvedValue({ id: 'prod_new' })
  stripe.products.update.mockReset().mockResolvedValue({ id: 'prod_updated' })
  stripe.products.retrieve.mockReset().mockImplementation(async (id: string) => ({ id, active: true }))
})

/**
 * Stripe's idempotency, as the fake: a create whose idempotency key was seen
 * before returns the first result (flagged Idempotent-Replayed, as Stripe
 * does), else it makes a fresh object; retrieve reads the live price, which a
 * test may archive. Returns the objects created, so a test can count them.
 */
function idempotentCreates() {
  const products = new Map<string, { id: string }>()
  const liveProducts = new Map<string, { id: string; active: boolean }>()
  const prices = new Map<string, ReturnType<typeof priceFrom>>()
  const live = new Map<string, ReturnType<typeof priceFrom>>()
  stripe.products.create.mockImplementation(async (_params: unknown, opts: { idempotencyKey: string }) => {
    const seen = products.get(opts.idempotencyKey)
    if (seen) return { ...seen, ...REPLAYED }
    const created = { id: `prod_${products.size + 1}` }
    products.set(opts.idempotencyKey, created)
    liveProducts.set(created.id, { ...created, active: true })
    return created
  })
  stripe.products.retrieve.mockImplementation(async (id: string) => liveProducts.get(id))
  stripe.prices.create.mockImplementation(async (params: PriceParams, opts: { idempotencyKey: string }) => {
    const seen = prices.get(opts.idempotencyKey)
    if (seen) return { ...seen, ...REPLAYED }
    const created = priceFrom(`price_${prices.size + 1}_${params.product}`, params)
    prices.set(opts.idempotencyKey, created)
    live.set(created.id, { ...created })
    return created
  })
  stripe.prices.retrieve.mockImplementation(async (id: string) => live.get(id))
  return { products, liveProducts, prices, live }
}

describe('ensurePlanPriceId', () => {
  it('every self-serve plan has one, service and store alike; the trial and the sales-led tiers do not', async () => {
    expect([...SELF_SERVE_PLANS]).toEqual(['starter', 'growth', 'pro', 'business', 'scale', 'store_starter', 'store_growth', 'store_scale'])
    for (const plan of ['trial', 'custom', 'store_enterprise'] as const) {
      await expect(ensurePlanPriceId(plan, 'month')).rejects.toThrow(/no self-serve Stripe price/)
    }
    expect(stripe.prices.list).not.toHaveBeenCalled()
  })

  it('finds the price by its lookup key and caches it', async () => {
    stripe.prices.list.mockResolvedValue({ data: [price('price_found', 'ntv_store_starter_month')] })
    expect(await ensurePlanPriceId('store_starter', 'month')).toBe('price_found')
    expect(stripe.prices.list).toHaveBeenCalledWith(expect.objectContaining({
      lookup_keys: ['ntv_store_starter_month', 'ntv_store_starter_year'],
      active: true,
      expand: ['data.product'],
    }))
    expect(stripe.prices.create).not.toHaveBeenCalled()
    expect(await ensurePlanPriceId('store_starter', 'month')).toBe('price_found')
    expect(stripe.prices.list).toHaveBeenCalledTimes(1)
  })

  it('creates the product (named and described from PLANS) and a recurring USD price with lookup key, plan metadata and idempotency keys', async () => {
    expect(await ensurePlanPriceId('store_starter', 'year')).toBe('price_new_ntv_store_starter_year')
    expect(stripe.products.create).toHaveBeenCalledWith(
      { name: 'Store Starter', description: '350 minutes a month, extra minutes $0.25/min', metadata: { ntv_plan: 'store_starter' } },
      { idempotencyKey: productIdempotencyKey('store_starter') },
    )
    expect(stripe.prices.create).toHaveBeenCalledWith(
      expect.objectContaining({
        product: 'prod_new',
        currency: 'usd',
        unit_amount: 100_000,
        recurring: { interval: 'year' },
        lookup_key: 'ntv_store_starter_year',
        transfer_lookup_key: true,
        metadata: { ntv_plan: 'store_starter', ntv_interval: 'year' },
      }),
      { idempotencyKey: 'ntv_price_store_starter_year_100000' },
    )
    // A fresh create is trusted as sent: nothing is read back.
    expect(stripe.prices.retrieve).not.toHaveBeenCalled()
  })

  it('service plans need no env pin either: Growth is created at the homepage price, monthly and annual', async () => {
    expect(await ensurePlanPriceId('growth', 'month')).toBe('price_new_ntv_growth_month')
    expect(stripe.products.create).toHaveBeenCalledWith(
      { name: 'Growth', description: '1,000 minutes a month, extra minutes $0.20/min', metadata: { ntv_plan: 'growth' } },
      { idempotencyKey: productIdempotencyKey('growth') },
    )
    expect(stripe.prices.create).toHaveBeenLastCalledWith(
      expect.objectContaining({ unit_amount: 9_900, recurring: { interval: 'month' }, lookup_key: 'ntv_growth_month', metadata: { ntv_plan: 'growth', ntv_interval: 'month' } }),
      { idempotencyKey: 'ntv_price_growth_month_9900' },
    )
    expect(await ensurePlanPriceId('scale', 'year')).toBe('price_new_ntv_scale_year')
    expect(stripe.prices.create).toHaveBeenLastCalledWith(
      expect.objectContaining({ unit_amount: 990_000, recurring: { interval: 'year' }, lookup_key: 'ntv_scale_year' }),
      { idempotencyKey: 'ntv_price_scale_year_990000' },
    )
  })

  it('product name and description come from PLANS, for every self-serve plan', () => {
    expect(planProductName(PLANS.pro)).toBe('Pro')
    expect(planProductDescription(PLANS.pro)).toBe('3,000 minutes a month, extra minutes $0.20/min')
    expect(planProductDescription(PLANS.scale)).toBe('15,000 minutes a month, extra minutes $0.20/min')
    expect(planProductDescription(PLANS.store_growth)).toBe('950 minutes a month, extra minutes $0.22/min')
    for (const plan of SELF_SERVE_PLANS) {
      expect(planProductName(PLANS[plan])).toBe(PLANS[plan].name)
      expect(planProductDescription(PLANS[plan])).toContain(`$${PLANS[plan].overage_per_min.toFixed(2)}/min`)
    }
  })

  it('idempotency keys name the plan and the amount (product: monthly amount and a fingerprint of the label; price: interval and amount)', () => {
    expect(productIdempotencyKey('store_growth')).toMatch(/^ntv_product_store_growth_25000_[0-9a-f]{12}$/)
    expect(productIdempotencyKey('growth')).toMatch(/^ntv_product_growth_9900_[0-9a-f]{12}$/)
    // Changed wording or a new price is a new product key: never a replay that Stripe would refuse.
    expect(productIdempotencyKey('growth', { ...PLANS.growth, minutes_limit: 1200 })).not.toBe(productIdempotencyKey('growth'))
    expect(productIdempotencyKey('growth', { ...PLANS.growth, price_monthly: 109 })).not.toBe(productIdempotencyKey('growth'))
    expect(productIdempotencyKey('growth')).toBe(productIdempotencyKey('growth'))
    expect(priceIdempotencyKey('store_growth', 'month', 25_000)).toBe('ntv_price_store_growth_month_25000')
    expect(priceIdempotencyKey('store_growth', 'year', 250_000)).not.toBe(priceIdempotencyKey('store_growth', 'month', 25_000))
    // A new list price is a new key: never a replay of the old price's create.
    expect(priceIdempotencyKey('store_growth', 'month', 27_500)).not.toBe(priceIdempotencyKey('store_growth', 'month', 25_000))
  })

  it('the amounts come from PLANS: monthly and annual, in cents', () => {
    expect(planAmountCents(PLANS.store_starter, 'month')).toBe(10_000)
    expect(planAmountCents(PLANS.store_scale, 'year')).toBe(500_000)
    expect(planAmountCents(PLANS.starter, 'month')).toBe(4_900)
    expect(planAmountCents(PLANS.pro, 'year')).toBe(249_000)
  })

  it('reuses the product of the other interval instead of creating a second one', async () => {
    stripe.prices.list.mockResolvedValue({ data: [price('price_month', 'ntv_store_growth_month', product('prod_growth', 'store_growth'))] })
    expect(await ensurePlanPriceId('store_growth', 'year')).toBe('price_new_ntv_store_growth_year')
    expect(stripe.products.create).not.toHaveBeenCalled()
    expect(stripe.products.update).not.toHaveBeenCalled()
    expect(stripe.prices.create).toHaveBeenCalledWith(
      expect.objectContaining({ product: 'prod_growth', unit_amount: 250_000, recurring: { interval: 'year' } }),
      { idempotencyKey: 'ntv_price_store_growth_year_250000' },
    )
  })

  it('creates a fresh product when the sibling price points at a deleted or archived one', async () => {
    for (const gone of [{ id: 'prod_old', deleted: true }, product('prod_archived', 'store_growth', { active: false })]) {
      resetPlanPriceCache()
      stripe.products.create.mockClear()
      stripe.prices.list.mockResolvedValue({ data: [price('price_month', 'ntv_store_growth_month', gone)] })
      await ensurePlanPriceId('store_growth', 'year')
      expect(stripe.products.create).toHaveBeenCalledTimes(1)
      expect(stripe.prices.create).toHaveBeenLastCalledWith(expect.objectContaining({ product: 'prod_new' }), expect.objectContaining({ idempotencyKey: 'ntv_price_store_growth_year_250000' }))
    }
  })

  describe('the product label follows PLANS', () => {
    it('an app-owned product whose name or description is stale is relabeled from PLANS, and the price is still used', async () => {
      const stale = product('prod_store', 'store_starter', { description: null })
      stripe.prices.list.mockResolvedValue({ data: [price('price_found', 'ntv_store_starter_month', stale)] })
      expect(await ensurePlanPriceId('store_starter', 'month')).toBe('price_found')
      expect(stripe.products.update).toHaveBeenCalledWith('prod_store', {
        name: 'Store Starter',
        description: '350 minutes a month, extra minutes $0.25/min',
      })
      expect(logs.info).toContain('billing.plan_product_relabeled')
    })

    it('a product already in line is not touched', async () => {
      stripe.prices.list.mockResolvedValue({ data: [price('price_found', 'ntv_pro_year', product('prod_pro', 'pro'))] })
      expect(await ensurePlanPriceId('pro', 'year')).toBe('price_found')
      expect(stripe.products.update).not.toHaveBeenCalled()
    })

    it('a product the app did not create (no ntv_plan of this plan) is never edited', async () => {
      const foreign = product('prod_foreign', 'store_starter', { name: 'Something else', metadata: {} })
      stripe.prices.list.mockResolvedValue({ data: [price('price_found', 'ntv_store_starter_month', foreign)] })
      expect(await ensurePlanPriceId('store_starter', 'month')).toBe('price_found')
      expect(stripe.products.update).not.toHaveBeenCalled()
    })

    it('a failed relabel is logged and does not stop the checkout', async () => {
      stripe.products.update.mockRejectedValue(new Error('Stripe is down'))
      stripe.prices.list.mockResolvedValue({ data: [price('price_found', 'ntv_growth_month', product('prod_g', 'growth', { name: 'Old name' }))] })
      expect(await ensurePlanPriceId('growth', 'month')).toBe('price_found')
      expect(logs.warn.map(([event]) => event)).toContain('billing.plan_product_relabel_failed')
    })

    it('a new price that joins an existing product relabels it too', async () => {
      const old = product('prod_g', 'growth', { description: '800 minutes a month, extra minutes $0.25/min' })
      stripe.prices.list.mockResolvedValue({ data: [price('price_old', 'ntv_growth_month', old, { unit_amount: 7_900 })] })
      expect(await ensurePlanPriceId('growth', 'month')).toBe('price_new_ntv_growth_month')
      expect(stripe.products.update).toHaveBeenCalledWith('prod_g', expect.objectContaining({ description: '1,000 minutes a month, extra minutes $0.20/min' }))
      expect(stripe.prices.create).toHaveBeenCalledWith(expect.objectContaining({ product: 'prod_g', unit_amount: 9_900 }), { idempotencyKey: 'ntv_price_growth_month_9900' })
    })
  })

  describe('an env pin is used only while it bills exactly what PLANS says', () => {
    it('a pin that matches PLANS is used without a lookup', async () => {
      stripe.prices.retrieve.mockResolvedValue(pinned('price_scale_pinned', 'store_scale', 'month'))
      expect(await ensurePlanPriceId('store_scale', 'month')).toBe('price_scale_pinned')
      expect(stripe.prices.retrieve).toHaveBeenCalledWith('price_scale_pinned', { expand: ['product'] })
      expect(stripe.prices.list).not.toHaveBeenCalled()
      // The operator's product is the operator's: its label is never edited.
      expect(stripe.products.update).not.toHaveBeenCalled()
      // Cached: one retrieve per plan and interval per process.
      expect(await ensurePlanPriceId('store_scale', 'month')).toBe('price_scale_pinned')
      expect(stripe.prices.retrieve).toHaveBeenCalledTimes(1)
    })

    it.each([
      ['an old amount', { unit_amount: 4_900 }, 'amount'],
      ['archived', { active: false }, 'inactive'],
      ['another currency', { currency: 'eur' }, 'currency'],
      ['another interval', { recurring: { interval: 'year', interval_count: 1, usage_type: 'licensed' } }, 'interval'],
      ['metered', { recurring: { interval: 'month', interval_count: 1, usage_type: 'metered' } }, 'usage_type'],
      ['an archived product', { product: { id: 'prod_owner', object: 'product', active: false, metadata: {} } }, 'product_inactive'],
    ])('a pin billed at %s is ignored (warning without the id) and the app price is used', async (_label, fields, reason) => {
      stripe.prices.retrieve.mockResolvedValue(pinned('price_pro_pinned', 'pro', 'month', fields))
      expect(await ensurePlanPriceId('pro', 'month')).toBe('price_new_ntv_pro_month')
      expect(stripe.prices.create).toHaveBeenCalledWith(
        expect.objectContaining({ unit_amount: 24_900, lookup_key: 'ntv_pro_month', metadata: { ntv_plan: 'pro', ntv_interval: 'month' } }),
        { idempotencyKey: 'ntv_price_pro_month_24900' },
      )
      expect(logs.warn).toEqual([['billing.pinned_price_ignored', expect.objectContaining({ plan: 'pro', interval: 'month', reason })]])
      expect(JSON.stringify(logs.warn)).not.toContain('price_pro_pinned')
    })

    describe('a pin must be tagged for its plan (metadata.ntv_plan on the price, else on its product)', () => {
      it.each([
        ['neither the price nor its product is tagged (a July 2026 price at today\'s amount)', { metadata: {} }, 'untagged'],
        ['the price is tagged for another plan', { metadata: { ntv_plan: 'starter' } }, 'tagged_other_plan'],
        [
          'the price is tagged for another plan, whatever its product says',
          { metadata: { ntv_plan: 'business' }, product: { id: 'prod_owner', object: 'product', active: true, metadata: { ntv_plan: 'pro' } } },
          'tagged_other_plan',
        ],
        [
          'only its product is tagged, for another plan',
          { metadata: {}, product: { id: 'prod_owner', object: 'product', active: true, metadata: { ntv_plan: 'growth' } } },
          'tagged_other_plan',
        ],
      ])('ignored when %s: the app price is charged, the warning names the reason, never the id', async (_label, fields, reason) => {
        // The amount, currency, interval and product all match PLANS: only the tag is wrong.
        stripe.prices.retrieve.mockResolvedValue(pinned('price_pro_pinned', 'pro', 'month', fields))
        expect(await ensurePlanPriceId('pro', 'month')).toBe('price_new_ntv_pro_month')
        expect(stripe.prices.create).toHaveBeenCalledWith(expect.objectContaining({ unit_amount: 24_900, lookup_key: 'ntv_pro_month' }), { idempotencyKey: 'ntv_price_pro_month_24900' })
        expect(logs.warn).toEqual([['billing.pinned_price_ignored', expect.objectContaining({ plan: 'pro', interval: 'month', reason })]])
        expect(JSON.stringify(logs.warn)).not.toContain('price_pro_pinned')
        expect(stripe.products.update).not.toHaveBeenCalled()
      })

      it('used when only its product carries the tag (the price has none)', async () => {
        stripe.prices.retrieve.mockResolvedValue(
          pinned('price_pro_pinned', 'pro', 'month', { metadata: {}, product: { id: 'prod_owner', object: 'product', active: true, name: 'Pro', metadata: { ntv_plan: 'pro' } } }),
        )
        expect(await ensurePlanPriceId('pro', 'month')).toBe('price_pro_pinned')
        expect(stripe.prices.create).not.toHaveBeenCalled()
        expect(logs.warn).toEqual([])
        // Tagged or not, the operator's product is never relabeled.
        expect(stripe.products.update).not.toHaveBeenCalled()
      })

      it('pinnedPlanTagMismatch reads the price first, then a live product, never a deleted one', () => {
        const product = (metadata: Record<string, string>) => ({ id: 'prod_x', object: 'product', active: true, metadata }) as never
        expect(pinnedPlanTagMismatch({ metadata: { ntv_plan: 'pro' }, product: 'prod_x' }, 'pro')).toBeNull()
        expect(pinnedPlanTagMismatch({ metadata: {}, product: product({ ntv_plan: 'pro' }) }, 'pro')).toBeNull()
        expect(pinnedPlanTagMismatch({ metadata: { ntv_plan: '' }, product: product({ ntv_plan: 'pro' }) }, 'pro')).toBeNull()
        expect(pinnedPlanTagMismatch({ metadata: {}, product: 'prod_x' }, 'pro')).toBe('untagged')
        expect(pinnedPlanTagMismatch({ metadata: {}, product: { id: 'prod_x', object: 'product', deleted: true } as never }, 'pro')).toBe('untagged')
        expect(pinnedPlanTagMismatch({ metadata: { ntv_plan: 'store_scale' }, product: product({ ntv_plan: 'pro' }) }, 'pro')).toBe('tagged_other_plan')
      })
    })

    it('a pin Stripe no longer knows is ignored the same way', async () => {
      stripe.prices.retrieve.mockRejectedValue(Object.assign(new Error('No such price'), { code: 'resource_missing', statusCode: 404 }))
      stripe.prices.list.mockResolvedValue({ data: [price('price_found', 'ntv_pro_month')] })
      expect(await ensurePlanPriceId('pro', 'month')).toBe('price_found')
      expect(logs.warn).toEqual([['billing.pinned_price_ignored', expect.objectContaining({ reason: 'missing' })]])
      expect(JSON.stringify(logs.warn)).not.toContain('price_pro_pinned')
    })

    it('any other failure to read the pin propagates, uncached (never a guess)', async () => {
      stripe.prices.retrieve.mockRejectedValueOnce(Object.assign(new Error('Stripe is down'), { statusCode: 503 }))
      await expect(ensurePlanPriceId('pro', 'month')).rejects.toThrow('Stripe is down')
      expect(stripe.prices.create).not.toHaveBeenCalled()
      stripe.prices.retrieve.mockResolvedValueOnce(pinned('price_pro_pinned', 'pro', 'month'))
      expect(await ensurePlanPriceId('pro', 'month')).toBe('price_pro_pinned')
    })

    it('an interval without a pin goes straight to the lookup (the annual Pro price here)', async () => {
      expect(await ensurePlanPriceId('pro', 'year')).toBe('price_new_ntv_pro_year')
      expect(stripe.prices.retrieve).not.toHaveBeenCalled()
    })
  })

  it('a replayed product create whose product was archived since gets a successor, and the price is created on it', async () => {
    const catalog = idempotentCreates()
    // The first run creates the Growth product and its monthly price.
    const first = await ensurePlanPriceId('growth', 'month')
    expect(stripe.prices.create).toHaveBeenLastCalledWith(expect.objectContaining({ product: 'prod_1' }), { idempotencyKey: 'ntv_price_growth_month_9900' })
    // The owner archives that product in the Stripe Dashboard (within the key's 24 hours).
    catalog.liveProducts.set('prod_1', { id: 'prod_1', active: false })
    resetPlanPriceCache()
    // A cold lambda finds no usable price (its product is archived), and the product create replays the archived one.
    const second = await ensurePlanPriceId('growth', 'month')
    expect(stripe.products.retrieve).toHaveBeenCalledWith('prod_1')
    expect(stripe.products.create).toHaveBeenLastCalledWith(expect.anything(), { idempotencyKey: `${productIdempotencyKey('growth')}_after_prod_1` })
    // The successor's price takes a key naming the product (the original key was used with the archived one).
    expect(stripe.prices.create).toHaveBeenLastCalledWith(expect.objectContaining({ product: 'prod_2' }), { idempotencyKey: 'ntv_price_growth_month_9900_prod_2' })
    expect(second).not.toBe(first)
    expect(catalog.live.get(second)?.product).toBe('prod_2')
    expect(logs.warn.map(([event]) => event)).toContain('billing.plan_product_archived')
  })

  it('two cold callers racing on the same plan and interval end up with one product and one price', async () => {
    const catalog = idempotentCreates()
    // Both callers list before either has created anything: the race the keys exist for.
    // Each call runs in its own "process" (cache reset between), as two lambdas would.
    const first = ensurePlanPriceId('store_starter', 'month')
    resetPlanPriceCache()
    const second = ensurePlanPriceId('store_starter', 'month')
    const [a, b] = await Promise.all([first, second])
    expect(a).toBe(b)
    expect(stripe.products.create).toHaveBeenCalledTimes(2)
    expect(stripe.prices.create).toHaveBeenCalledTimes(2)
    expect(catalog.products.size).toBe(1)
    expect(catalog.prices.size).toBe(1)
    expect(stripe.prices.create).toHaveBeenLastCalledWith(expect.objectContaining({ product: 'prod_1' }), { idempotencyKey: 'ntv_price_store_starter_month_10000' })
    // The replayed create was read back and found live before it was used.
    expect(stripe.prices.retrieve).toHaveBeenCalledWith(a)
  })

  it('concurrent calls in one process share the in-flight lookup and the monthly and annual prices share the product', async () => {
    const catalog = idempotentCreates()
    const [a, b] = await Promise.all([ensurePlanPriceId('store_growth', 'month'), ensurePlanPriceId('store_growth', 'month')])
    expect(a).toBe(b)
    expect(stripe.prices.list).toHaveBeenCalledTimes(1)
    expect(stripe.prices.create).toHaveBeenCalledTimes(1)
    // The annual price created in the same race joins the plan's product by its idempotency key.
    await ensurePlanPriceId('store_growth', 'year')
    expect(catalog.products.size).toBe(1)
    expect(catalog.prices.size).toBe(2)
  })

  describe('a price must bill what PLANS says', () => {
    it('a price found by lookup key with an outdated amount is replaced: current amount, lookup key transferred, amount in the key', async () => {
      stripe.prices.list.mockResolvedValue({ data: [price('price_old', 'ntv_store_starter_month', 'prod_starter', { unit_amount: 9_900 })] })
      expect(await ensurePlanPriceId('store_starter', 'month')).toBe('price_new_ntv_store_starter_month')
      // The new price joins the outdated price's product.
      expect(stripe.products.create).not.toHaveBeenCalled()
      expect(stripe.prices.create).toHaveBeenCalledWith(
        expect.objectContaining({
          product: 'prod_starter',
          currency: 'usd',
          unit_amount: 10_000,
          recurring: { interval: 'month' },
          lookup_key: 'ntv_store_starter_month',
          transfer_lookup_key: true,
        }),
        { idempotencyKey: 'ntv_price_store_starter_month_10000' },
      )
      expect(logs.info).toContain('billing.plan_price_replaced')
    })

    it.each([
      ['another currency', { currency: 'eur' }],
      ['another interval', { recurring: { interval: 'year', interval_count: 1, usage_type: 'licensed' } }],
      ['every three months', { recurring: { interval: 'month', interval_count: 3, usage_type: 'licensed' } }],
      ['metered', { recurring: { interval: 'month', interval_count: 1, usage_type: 'metered' } }],
      ['tiered (no unit amount)', { unit_amount: null }],
      ['archived', { active: false }],
    ])('a found price billed %s is not used', async (_label, fields) => {
      stripe.prices.list.mockResolvedValue({ data: [price('price_odd', 'ntv_store_growth_month', 'prod_growth', fields)] })
      expect(await ensurePlanPriceId('store_growth', 'month')).toBe('price_new_ntv_store_growth_month')
      expect(stripe.prices.create).toHaveBeenCalledWith(
        expect.objectContaining({ product: 'prod_growth', unit_amount: 25_000, transfer_lookup_key: true }),
        { idempotencyKey: 'ntv_price_store_growth_month_25000' },
      )
    })

    it('a found price on an archived product is not used: a new product and price take the lookup key', async () => {
      stripe.prices.list.mockResolvedValue({ data: [price('price_found', 'ntv_store_growth_month', product('prod_off', 'store_growth', { active: false }))] })
      expect(await ensurePlanPriceId('store_growth', 'month')).toBe('price_new_ntv_store_growth_month')
      expect(stripe.products.create).toHaveBeenCalledTimes(1)
      expect(stripe.prices.create).toHaveBeenCalledWith(expect.objectContaining({ product: 'prod_new', transfer_lookup_key: true }), expect.anything())
    })

    it('priceMatchesPlan checks active, USD, amount, interval, interval count and licensed usage', () => {
      const ok = price('p', 'ntv_store_scale_year')
      expect(priceMatchesPlan(ok as never, 500_000, 'year')).toBe(true)
      expect(priceMatchesPlan(ok as never, 499_900, 'year')).toBe(false)
      expect(priceMatchesPlan(ok as never, 500_000, 'month')).toBe(false)
      expect(priceMatchesPlan({ ...ok, recurring: null } as never, 500_000, 'year')).toBe(false)
      expect(priceMismatch(ok as never, 499_900, 'year')).toBe('amount')
      expect(priceMismatch({ ...ok, active: false } as never, 500_000, 'year')).toBe('inactive')
      expect(priceMismatch(ok as never, 500_000, 'year')).toBeNull()
    })

    it('a replayed create is read back and used while it still matches', async () => {
      stripe.prices.create.mockImplementation(async (params: PriceParams) => ({ ...priceFrom('price_replayed', params), ...REPLAYED }))
      stripe.prices.retrieve.mockResolvedValue(price('price_replayed', 'ntv_store_growth_month'))
      expect(await ensurePlanPriceId('store_growth', 'month')).toBe('price_replayed')
      expect(stripe.prices.retrieve).toHaveBeenCalledWith('price_replayed')
      expect(stripe.prices.create).toHaveBeenCalledTimes(1)
    })

    it('a replayed create of a price archived since gets a successor under a key derived from it', async () => {
      const catalog = idempotentCreates()
      // A first lambda created the price, then an operator archived it (it no longer lists as active).
      const first = await ensurePlanPriceId('store_growth', 'month')
      catalog.live.get(first)!.active = false
      resetPlanPriceCache()
      const second = await ensurePlanPriceId('store_growth', 'month')
      expect(second).not.toBe(first)
      expect(stripe.prices.create).toHaveBeenLastCalledWith(expect.objectContaining({ unit_amount: 25_000 }), {
        idempotencyKey: `ntv_price_store_growth_month_25000_after_${first}`,
      })
      expect(catalog.live.get(second)?.active).toBe(true)
    })

    it('gives up (throws, nothing cached) when every replay is a price archived since', async () => {
      stripe.prices.create.mockImplementation(async (params: PriceParams, opts: { idempotencyKey: string }) => ({
        ...priceFrom(`price_${opts.idempotencyKey}`, params),
        ...REPLAYED,
      }))
      stripe.prices.retrieve.mockImplementation(async (id: string) => price(id, 'ntv_store_growth_month', 'prod_growth', { active: false }))
      await expect(ensurePlanPriceId('store_growth', 'month')).rejects.toThrow(/No usable Stripe price/)
      expect(stripe.prices.create).toHaveBeenCalledTimes(3)
    })
  })

  it('propagates Stripe failures uncached', async () => {
    stripe.prices.list.mockRejectedValueOnce(new Error('Stripe is down'))
    await expect(ensurePlanPriceId('store_growth', 'month')).rejects.toThrow('Stripe is down')
    stripe.prices.list.mockResolvedValueOnce({ data: [price('price_month', 'ntv_store_growth_month')] })
    expect(await ensurePlanPriceId('store_growth', 'month')).toBe('price_month')
  })
})
