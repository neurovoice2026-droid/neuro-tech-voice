import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.hoisted(() => {
  // PLANS reads the price ids at module load: Store Scale is pinned, the others are not.
  process.env.STRIPE_STORE_SCALE_PRICE_ID = 'price_scale_pinned'
  delete process.env.STRIPE_STORE_STARTER_PRICE_ID
  delete process.env.STRIPE_STORE_STARTER_ANNUAL_PRICE_ID
  delete process.env.STRIPE_STORE_GROWTH_PRICE_ID
})

const stripe = {
  prices: { list: vi.fn(), create: vi.fn() },
  products: { create: vi.fn() },
}
vi.mock('./client', async (importOriginal) => ({
  ...(await importOriginal<typeof import('./client')>()),
  getStripeClient: () => stripe,
}))

import { ensurePlanPriceId, priceIdempotencyKey, productIdempotencyKey, resetPlanPriceCache } from './store-prices'

const price = (id: string, lookup_key: string, product: unknown = 'prod_existing') => ({ id, lookup_key, product, active: true })

beforeEach(() => {
  resetPlanPriceCache()
  stripe.prices.list.mockReset().mockResolvedValue({ data: [] })
  stripe.prices.create.mockReset().mockImplementation(async (params: { lookup_key: string }) => ({ id: `price_new_${params.lookup_key}` }))
  stripe.products.create.mockReset().mockResolvedValue({ id: 'prod_new' })
})

/**
 * Stripe's idempotency, as the fake: a create whose idempotency key was seen
 * before returns the first result, else it makes a fresh object. Returns the
 * objects created, so a test can count them.
 */
function idempotentCreates() {
  const products = new Map<string, { id: string }>()
  const prices = new Map<string, { id: string }>()
  stripe.products.create.mockImplementation(async (_params: unknown, opts: { idempotencyKey: string }) => {
    const seen = products.get(opts.idempotencyKey)
    if (seen) return seen
    const created = { id: `prod_${products.size + 1}` }
    products.set(opts.idempotencyKey, created)
    return created
  })
  stripe.prices.create.mockImplementation(async (params: { product: string }, opts: { idempotencyKey: string }) => {
    const seen = prices.get(opts.idempotencyKey)
    if (seen) return seen
    const created = { id: `price_${prices.size + 1}_${params.product}` }
    prices.set(opts.idempotencyKey, created)
    return created
  })
  return { products, prices }
}

describe('ensurePlanPriceId', () => {
  it('returns the env-configured id without touching Stripe', async () => {
    expect(await ensurePlanPriceId('store_scale', 'month')).toBe('price_scale_pinned')
    expect(stripe.prices.list).not.toHaveBeenCalled()
  })

  it('finds the price by its lookup key and caches it', async () => {
    stripe.prices.list.mockResolvedValue({ data: [price('price_found', 'ntv_store_starter_month')] })
    expect(await ensurePlanPriceId('store_starter', 'month')).toBe('price_found')
    expect(stripe.prices.list).toHaveBeenCalledWith(expect.objectContaining({ lookup_keys: ['ntv_store_starter_month', 'ntv_store_starter_year'], active: true }))
    expect(stripe.prices.create).not.toHaveBeenCalled()
    expect(await ensurePlanPriceId('store_starter', 'month')).toBe('price_found')
    expect(stripe.prices.list).toHaveBeenCalledTimes(1)
  })

  it('creates the product and a recurring USD price with lookup key, plan metadata and idempotency keys when nothing exists', async () => {
    expect(await ensurePlanPriceId('store_starter', 'year')).toBe('price_new_ntv_store_starter_year')
    expect(stripe.products.create).toHaveBeenCalledWith(
      { name: 'Store Starter', metadata: { ntv_plan: 'store_starter' } },
      { idempotencyKey: 'ntv_product_store_starter' },
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
      { idempotencyKey: 'ntv_price_store_starter_year' },
    )
  })

  it('idempotency keys name the plan (product) and the plan and interval (price)', () => {
    expect(productIdempotencyKey('store_growth')).toBe('ntv_product_store_growth')
    expect(priceIdempotencyKey('store_growth', 'month')).toBe('ntv_price_store_growth_month')
    expect(priceIdempotencyKey('store_growth', 'year')).not.toBe(priceIdempotencyKey('store_growth', 'month'))
  })

  it('reuses the product of the other interval instead of creating a second one', async () => {
    stripe.prices.list.mockResolvedValue({ data: [price('price_month', 'ntv_store_growth_month', { id: 'prod_growth', object: 'product' })] })
    expect(await ensurePlanPriceId('store_growth', 'year')).toBe('price_new_ntv_store_growth_year')
    expect(stripe.products.create).not.toHaveBeenCalled()
    expect(stripe.prices.create).toHaveBeenCalledWith(
      expect.objectContaining({ product: 'prod_growth', unit_amount: 250_000, recurring: { interval: 'year' } }),
      { idempotencyKey: 'ntv_price_store_growth_year' },
    )
  })

  it('creates a fresh product when the sibling price points at a deleted one', async () => {
    stripe.prices.list.mockResolvedValue({ data: [price('price_month', 'ntv_store_growth_month', { id: 'prod_old', deleted: true })] })
    await ensurePlanPriceId('store_growth', 'year')
    expect(stripe.products.create).toHaveBeenCalledTimes(1)
    expect(stripe.prices.create).toHaveBeenCalledWith(expect.objectContaining({ product: 'prod_new' }), expect.objectContaining({ idempotencyKey: 'ntv_price_store_growth_year' }))
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
    expect(stripe.prices.create).toHaveBeenLastCalledWith(expect.objectContaining({ product: 'prod_1' }), { idempotencyKey: 'ntv_price_store_starter_month' })
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

  it('refuses plans without a self-serve price and propagates Stripe failures uncached', async () => {
    await expect(ensurePlanPriceId('store_enterprise', 'month')).rejects.toThrow(/no self-serve Stripe price/)
    await expect(ensurePlanPriceId('trial', 'month')).rejects.toThrow(/no self-serve Stripe price/)
    stripe.prices.list.mockRejectedValueOnce(new Error('Stripe is down'))
    await expect(ensurePlanPriceId('store_growth', 'month')).rejects.toThrow('Stripe is down')
    stripe.prices.list.mockResolvedValueOnce({ data: [price('price_month', 'ntv_store_growth_month')] })
    expect(await ensurePlanPriceId('store_growth', 'month')).toBe('price_month')
  })
})
