import { afterEach, describe, expect, it, vi } from 'vitest'

vi.hoisted(() => {
  // PLANS reads the price ids at module load.
  process.env.STRIPE_PRO_PRICE_ID = 'price_pro_month'
  process.env.STRIPE_PRO_ANNUAL_PRICE_ID = 'price_pro_year'
  process.env.STRIPE_STORE_GROWTH_PRICE_ID = 'price_store_growth_month'
})

import { planFromLookupKey, planFromPrice, planFromPriceId, planLookupKey, resolvePlanFromPrice } from './client'

afterEach(() => {
  vi.restoreAllMocks()
})

const stripeWith = (retrieve: (id: string) => Promise<unknown>) =>
  ({ prices: { retrieve: vi.fn(retrieve) } }) as unknown as import('stripe').default

describe('planFromPriceId', () => {
  it('maps the env-configured monthly and annual ids of any family, nothing else', () => {
    expect(planFromPriceId('price_pro_month')).toBe('pro')
    expect(planFromPriceId('price_pro_year')).toBe('pro')
    expect(planFromPriceId('price_store_growth_month')).toBe('store_growth')
    expect(planFromPriceId('price_unknown')).toBeNull()
    expect(planFromPriceId('')).toBeNull()
    expect(planFromPriceId(null)).toBeNull()
  })
})

describe('lookup keys and price metadata', () => {
  it('round-trips ntv_<plan>_<interval>, plans with underscores included', () => {
    expect(planLookupKey('store_starter', 'year')).toBe('ntv_store_starter_year')
    expect(planFromLookupKey('ntv_store_starter_year')).toBe('store_starter')
    expect(planFromLookupKey('ntv_pro_month')).toBe('pro')
    expect(planFromLookupKey('ntv_enterprise_month')).toBeNull()
    expect(planFromLookupKey('store_starter_month')).toBeNull()
    expect(planFromLookupKey(null)).toBeNull()
  })

  it('reads metadata.ntv_plan first, then the lookup key, and ignores values that are not plans', () => {
    expect(planFromPrice({ metadata: { ntv_plan: 'store_scale' }, lookup_key: 'ntv_pro_month' })).toBe('store_scale')
    expect(planFromPrice({ metadata: { ntv_plan: 'whatever' }, lookup_key: 'ntv_store_growth_month' })).toBe('store_growth')
    expect(planFromPrice({ metadata: {}, lookup_key: null })).toBeNull()
    expect(planFromPrice(null)).toBeNull()
  })
})

describe('resolvePlanFromPrice', () => {
  it('answers from the env map without calling Stripe', async () => {
    const stripe = stripeWith(() => Promise.reject(new Error('must not be called')))
    expect(await resolvePlanFromPrice(stripe, 'price_pro_year')).toBe('pro')
    expect(await resolvePlanFromPrice(stripe, null)).toBeNull()
    expect(stripe.prices.retrieve).not.toHaveBeenCalled()
  })

  it('fetches an unknown price and reads the plan the app stamped on it', async () => {
    const stripe = stripeWith(async (id) => ({ id, metadata: { ntv_plan: 'store_starter', ntv_interval: 'month' }, lookup_key: 'ntv_store_starter_month' }))
    expect(await resolvePlanFromPrice(stripe, 'price_auto')).toBe('store_starter')
    expect(stripe.prices.retrieve).toHaveBeenCalledWith('price_auto')
    const byKeyOnly = stripeWith(async (id) => ({ id, metadata: {}, lookup_key: 'ntv_store_scale_year' }))
    expect(await resolvePlanFromPrice(byKeyOnly, 'price_auto')).toBe('store_scale')
  })

  it('treats a price Stripe no longer knows as unknown, but surfaces other API failures', async () => {
    const missing = Object.assign(new Error('No such price'), { code: 'resource_missing', statusCode: 404 })
    expect(await resolvePlanFromPrice(stripeWith(() => Promise.reject(missing)), 'price_gone')).toBeNull()
    const foreign = stripeWith(async (id) => ({ id, metadata: {}, lookup_key: null }))
    expect(await resolvePlanFromPrice(foreign, 'price_foreign')).toBeNull()
    const outage = Object.assign(new Error('Stripe is down'), { statusCode: 503 })
    await expect(resolvePlanFromPrice(stripeWith(() => Promise.reject(outage)), 'price_x')).rejects.toBe(outage)
  })
})
