import { describe, expect, it, vi } from 'vitest'
import type Stripe from 'stripe'
import { findPlanSubscriptions, isPlanSubscriptionOf, planChangeTiming, resumeParams } from './plan-subscription'

const ORG = 'org-1'

function sub(id: string, over: Record<string, unknown> = {}, price: Record<string, unknown> = {}): Stripe.Subscription {
  return {
    id,
    customer: 'cus_1',
    status: 'active',
    cancel_at_period_end: false,
    cancel_at: null,
    schedule: null,
    metadata: { org_id: ORG },
    items: { data: [{ id: `si_${id}`, quantity: 1, price: { id: 'price_starter_month', unit_amount: 4900, currency: 'usd', recurring: { interval: 'month', interval_count: 1 }, ...price } }] },
    ...over,
  } as unknown as Stripe.Subscription
}

function stripeWith(subs: Stripe.Subscription[]) {
  return {
    subscriptions: {
      retrieve: vi.fn(async (id: string) => {
        const s = subs.find((x) => x.id === id)
        if (!s) throw Object.assign(new Error('No such subscription'), { code: 'resource_missing', statusCode: 404 })
        return s
      }),
      list: vi.fn(async () => ({ data: subs, has_more: false })),
    },
  } as unknown as Stripe
}

describe('planChangeTiming', () => {
  const target = (priceId: string, interval: 'month' | 'year', unitAmountCents: number) => ({ priceId, interval, unitAmountCents })

  it('the same price is unchanged; any change during a trial is immediate', () => {
    expect(planChangeTiming(sub('s'), target('price_starter_month', 'month', 4900))).toBe('unchanged')
    expect(planChangeTiming(sub('s', { status: 'trialing' }), target('price_scale_year', 'year', 990000))).toBe('now_trial')
  })

  it('a higher price on the same interval is an upgrade now; lower, equal or another interval waits for the renewal', () => {
    expect(planChangeTiming(sub('s'), target('price_pro_month', 'month', 24900))).toBe('now_upgrade')
    expect(planChangeTiming(sub('s', {}, { id: 'price_pro_month', unit_amount: 24900 }), target('price_starter_month', 'month', 4900))).toBe('at_renewal')
    expect(planChangeTiming(sub('s'), target('price_starter_month_new', 'month', 4900))).toBe('at_renewal')
    expect(planChangeTiming(sub('s'), target('price_pro_year', 'year', 249000))).toBe('at_renewal')
    // An unknown current amount (tiered, another currency) is never treated as an upgrade.
    expect(planChangeTiming(sub('s', {}, { unit_amount: null }), target('price_pro_month', 'month', 24900))).toBe('at_renewal')
    expect(planChangeTiming(sub('s', {}, { currency: 'eur' }), target('price_pro_month', 'month', 24900))).toBe('at_renewal')
  })
})

describe('resumeParams', () => {
  it('clears a cancellation at period end or a cancellation date, nothing otherwise', () => {
    expect(resumeParams(sub('s', { cancel_at_period_end: true, cancel_at: 1 }))).toEqual({ cancel_at_period_end: false })
    expect(resumeParams(sub('s', { cancel_at: 1 }))).toEqual({ cancel_at: '' })
    expect(resumeParams(sub('s'))).toEqual({})
  })
})

describe('findPlanSubscriptions', () => {
  it('reports a live, a due and a past plan subscription, ignoring phone numbers and other organizations', async () => {
    const stripe = stripeWith([
      sub('sub_phone', { metadata: { type: 'phone_number', org_id: ORG } }),
      sub('sub_other_org', { metadata: { org_id: 'org-2' } }),
      sub('sub_due', { status: 'past_due' }),
      sub('sub_old', { status: 'canceled' }),
    ])
    expect(await findPlanSubscriptions(stripe, { orgId: ORG, customerId: 'cus_1', recordedId: null })).toMatchObject({
      live: null,
      due: { id: 'sub_due' },
      hadAny: true,
    })
  })

  it('a customer whose only plan subscription never started has had none (a first trial is still possible)', async () => {
    const stripe = stripeWith([sub('sub_x', { status: 'incomplete_expired' }), sub('sub_phone', { metadata: { type: 'phone_number' } })])
    expect(await findPlanSubscriptions(stripe, { orgId: ORG, customerId: 'cus_1', recordedId: null })).toEqual({ live: null, due: null, hadAny: false })
  })

  it('no customer: nothing to ask', async () => {
    const stripe = stripeWith([])
    expect(await findPlanSubscriptions(stripe, { orgId: ORG, customerId: null, recordedId: 'sub_1' })).toEqual({ live: null, due: null, hadAny: false })
    expect(stripe.subscriptions.retrieve).not.toHaveBeenCalled()
  })

  it('a Stripe error is thrown, never read as "no subscription"', async () => {
    const stripe = stripeWith([])
    vi.mocked(stripe.subscriptions.list).mockRejectedValue(new Error('Stripe is down'))
    await expect(findPlanSubscriptions(stripe, { orgId: ORG, customerId: 'cus_1', recordedId: null })).rejects.toThrow('Stripe is down')
  })

  it('isPlanSubscriptionOf: the customer\'s, not a phone number\'s, stamped for this organization or unstamped', () => {
    expect(isPlanSubscriptionOf(sub('s', { metadata: {} }), ORG, 'cus_1')).toBe(true)
    expect(isPlanSubscriptionOf(sub('s', { customer: { id: 'cus_2' } }), ORG, 'cus_1')).toBe(false)
  })
})
