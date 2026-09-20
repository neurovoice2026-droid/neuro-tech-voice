import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type Stripe from 'stripe'
import {
  basePlanItem,
  isOverageBillingConfigured,
  isPaidSubscriptionStatus,
  isSelfServePlan,
  meteredItems,
  overagePriceLookupKey,
  planFromPriceId,
  planIntervalFromPriceId,
  priceIdFor,
  stripeId,
  subscriptionEndAction,
} from './client'

const PRICES = {
  STRIPE_STARTER_PRICE_ID: 'price_starter_month',
  STRIPE_STARTER_ANNUAL_PRICE_ID: 'price_starter_year',
  STRIPE_PRO_PRICE_ID: 'price_pro_month',
  STRIPE_PRO_ANNUAL_PRICE_ID: 'price_pro_year',
  STRIPE_BUSINESS_PRICE_ID: 'price_business_month',
  STRIPE_BUSINESS_ANNUAL_PRICE_ID: 'price_business_year',
}

beforeEach(() => {
  for (const [name, value] of Object.entries(PRICES)) vi.stubEnv(name, value)
})

afterEach(() => {
  vi.unstubAllEnvs()
})

function item(priceId: string, opts: { metered?: boolean; interval?: 'month' | 'year' } = {}): Stripe.SubscriptionItem {
  return {
    id: `si_${priceId}`,
    price: {
      id: priceId,
      recurring: { interval: opts.interval ?? 'month', usage_type: opts.metered ? 'metered' : 'licensed' },
    },
    current_period_start: 0,
    current_period_end: 0,
  } as unknown as Stripe.SubscriptionItem
}

function subscription(items: Stripe.SubscriptionItem[]): Pick<Stripe.Subscription, 'items'> {
  return { items: { data: items } } as unknown as Pick<Stripe.Subscription, 'items'>
}

describe('planFromPriceId', () => {
  it('maps monthly prices to their plan', () => {
    expect(planFromPriceId('price_starter_month')).toBe('starter')
    expect(planFromPriceId('price_pro_month')).toBe('pro')
    expect(planFromPriceId('price_business_month')).toBe('business')
  })

  it('maps annual prices to their plan (they used to resolve to trial)', () => {
    expect(planFromPriceId('price_starter_year')).toBe('starter')
    expect(planFromPriceId('price_pro_year')).toBe('pro')
    expect(planFromPriceId('price_business_year')).toBe('business')
  })

  it('returns null for unknown, empty and missing ids', () => {
    expect(planFromPriceId('price_unknown')).toBeNull()
    expect(planFromPriceId('')).toBeNull()
    expect(planFromPriceId(null)).toBeNull()
    expect(planFromPriceId(undefined)).toBeNull()
  })

  it('never matches an unset price variable to an empty or placeholder id', () => {
    vi.stubEnv('STRIPE_PRO_ANNUAL_PRICE_ID', '')
    vi.stubEnv('STRIPE_BUSINESS_ANNUAL_PRICE_ID', 'your-business-annual-price-id')
    expect(planFromPriceId('')).toBeNull()
    expect(planFromPriceId('your-business-annual-price-id')).toBeNull()
  })
})

describe('planIntervalFromPriceId', () => {
  it('reports the billing interval', () => {
    expect(planIntervalFromPriceId('price_pro_month')).toEqual({ plan: 'pro', interval: 'month' })
    expect(planIntervalFromPriceId('price_pro_year')).toEqual({ plan: 'pro', interval: 'year' })
  })
})

describe('priceIdFor', () => {
  it('returns the configured price per plan and interval', () => {
    expect(priceIdFor('starter', 'month')).toBe('price_starter_month')
    expect(priceIdFor('business', 'year')).toBe('price_business_year')
  })

  it('has no price for trial and custom, or when a price is not configured', () => {
    expect(priceIdFor('trial', 'month')).toBeNull()
    expect(priceIdFor('custom', 'year')).toBeNull()
    vi.stubEnv('STRIPE_PRO_ANNUAL_PRICE_ID', '')
    expect(priceIdFor('pro', 'year')).toBeNull()
  })
})

describe('subscription items', () => {
  it('picks the plan item even when the metered overage item comes first', () => {
    const sub = subscription([item('price_overage', { metered: true }), item('price_pro_year', { interval: 'year' })])
    expect(basePlanItem(sub)?.price.id).toBe('price_pro_year')
    expect(meteredItems(sub).map((i) => i.price.id)).toEqual(['price_overage'])
  })

  it('falls back to the first licensed item for an unknown price', () => {
    const sub = subscription([item('price_overage', { metered: true }), item('price_legacy')])
    expect(basePlanItem(sub)?.price.id).toBe('price_legacy')
  })

  it('returns null without items', () => {
    expect(basePlanItem(subscription([]))).toBeNull()
  })
})

describe('helpers', () => {
  it('recognises self-serve plans', () => {
    expect(isSelfServePlan('pro')).toBe(true)
    expect(isSelfServePlan('custom')).toBe(false)
    expect(isSelfServePlan('trial')).toBe(false)
    expect(isSelfServePlan(42)).toBe(false)
  })

  it('treats past_due as still paying and canceled/unpaid as not', () => {
    expect(isPaidSubscriptionStatus('active')).toBe(true)
    expect(isPaidSubscriptionStatus('trialing')).toBe(true)
    expect(isPaidSubscriptionStatus('past_due')).toBe(true)
    expect(isPaidSubscriptionStatus('canceled')).toBe(false)
    expect(isPaidSubscriptionStatus('unpaid')).toBe(false)
    expect(isPaidSubscriptionStatus('incomplete')).toBe(false)
  })

  it('reads ids from strings and expanded objects', () => {
    expect(stripeId('sub_1')).toBe('sub_1')
    expect(stripeId({ id: 'sub_2' })).toBe('sub_2')
    expect(stripeId(null)).toBeNull()
  })

  it('builds overage lookup keys per plan and interval', () => {
    expect(overagePriceLookupKey('business', 'year')).toBe('ntv_overage_business_year')
  })

  it('reports overage billing as configured only with a secret key and a meter event name', () => {
    vi.stubEnv('STRIPE_SECRET_KEY', 'sk_test_123')
    vi.stubEnv('STRIPE_OVERAGE_METER_EVENT', '')
    expect(isOverageBillingConfigured()).toBe(false)
    vi.stubEnv('STRIPE_OVERAGE_METER_EVENT', 'ntv_overage_minutes')
    expect(isOverageBillingConfigured()).toBe(true)
    vi.stubEnv('STRIPE_SECRET_KEY', 'pk_test_123')
    expect(isOverageBillingConfigured()).toBe(false)
  })
})

describe('subscriptionEndAction', () => {
  it('downgrades when the org’s current plan subscription ends', () => {
    expect(subscriptionEndAction({ plan: 'pro', stripe_subscription_id: 'sub_1' }, 'sub_1')).toBe('downgrade')
    expect(subscriptionEndAction({ plan: 'custom', stripe_subscription_id: 'sub_1' }, 'sub_1')).toBe('downgrade')
  })

  it('downgrades a paid self-serve org that never had its subscription id stored', () => {
    expect(subscriptionEndAction({ plan: 'starter', stripe_subscription_id: null }, 'sub_1')).toBe('downgrade')
  })

  it('ignores a replaced subscription and never touches a custom plan without one', () => {
    expect(subscriptionEndAction({ plan: 'business', stripe_subscription_id: 'sub_new' }, 'sub_old')).toBe('ignore')
    expect(subscriptionEndAction({ plan: 'custom', stripe_subscription_id: null }, 'sub_1')).toBe('ignore')
  })

  it('never expires a free trial because an upgrade attempt failed', () => {
    expect(subscriptionEndAction({ plan: 'trial', stripe_subscription_id: null }, 'sub_incomplete')).toBe('ignore')
    expect(subscriptionEndAction({ plan: 'trial', stripe_subscription_id: 'sub_other' }, 'sub_incomplete')).toBe('ignore')
  })

  it('only clears the pointer when a trial org still references the ended subscription', () => {
    expect(subscriptionEndAction({ plan: 'trial', stripe_subscription_id: 'sub_1' }, 'sub_1')).toBe('clear')
  })
})
