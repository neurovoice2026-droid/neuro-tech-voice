import { beforeEach, describe, expect, it, vi } from 'vitest'
import { fakeDb, type FakeCall, type Handler } from '@/tests/helpers/fake-db'

const ORG = '11111111-1111-4111-8111-111111111111'

const state: {
  user: ReturnType<typeof fakeDb> | null
  admin: ReturnType<typeof fakeDb> | null
  org: Record<string, unknown>
  /** organizations.minutes_used as the service role reads it (the prorated-upgrade write). */
  minutesUsed: number
} = { user: null, admin: null, org: {}, minutesUsed: 0 }

vi.mock('@/lib/api/auth', () => ({
  requireOrg: async () => ({
    supabase: state.user,
    user: { id: 'u1', email: 'owner@example.com' },
    org: { id: ORG, name: 'Acme', timezone: 'UTC', plan: 'trial' },
  }),
}))
vi.mock('@/lib/supabase/admin', () => ({ createAdminClient: () => state.admin }))

const stripe = {
  configured: true,
  client: {
    customers: { create: vi.fn() },
    checkout: { sessions: { create: vi.fn() } },
    subscriptions: { list: vi.fn(), update: vi.fn(), retrieve: vi.fn() },
    subscriptionSchedules: { create: vi.fn(), retrieve: vi.fn(), update: vi.fn(), release: vi.fn() },
  },
}
vi.mock('@/lib/stripe/client', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/stripe/client')>()),
  getStripeClient: () => stripe.client,
  isStripeConfigured: () => stripe.configured,
}))
// Every self-serve plan's price comes from ensurePlanPriceId (env pin validated
// against PLANS, else found or created by lookup key: lib/stripe/store-prices.ts).
const ensurePlanPriceId = vi.fn()
vi.mock('@/lib/stripe/store-prices', () => ({ ensurePlanPriceId: (...a: unknown[]) => ensurePlanPriceId(...a) }))

import { POST } from '@/app/api/billing/checkout/route'

const handler: Handler = (c) => {
  if (c.table === 'organizations' && c.op === 'select') return { data: { stripe_customer_id: 'cus_1', ...state.org }, error: null }
  return { data: null, error: null }
}

/** The service role: reads minutes_used and answers the compare-and-set write as applied. */
const adminHandler: Handler = (c) => {
  if (c.table === 'organizations' && c.op === 'select') return { data: { minutes_used: state.minutesUsed }, error: null }
  if (c.table === 'organizations' && c.op === 'update') return { data: [{ id: ORG }], error: null }
  return { data: null, error: null }
}

const checkout = (body: unknown) =>
  POST(new Request('http://localhost/api/billing/checkout', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  }))

const sessionParams = () => stripe.client.checkout.sessions.create.mock.calls[0]?.[0] as Record<string, unknown> | undefined

const DAY = 86_400
/** The current period: 30 days, a quarter gone (7.5 days ago). */
const NOW_S = 1_800_000_000
const PERIOD = { start: NOW_S - 7.5 * DAY, end: NOW_S + 22.5 * DAY }

/** PLANS amounts in cents, as the price ensurePlanPriceId resolves bills them. */
const CENTS: Record<string, { month: number; year: number }> = {
  starter: { month: 4900, year: 49000 },
  growth: { month: 9900, year: 99000 },
  pro: { month: 24900, year: 249000 },
  business: { month: 49900, year: 499000 },
  scale: { month: 99000, year: 990000 },
  store_starter: { month: 10000, year: 100000 },
  store_scale: { month: 50000, year: 500000 },
}

/**
 * A Stripe subscription as retrieve/list return it: one item on the price of
 * `plan` for `interval` (price id `price_<plan>_<interval>`, the id the
 * ensurePlanPriceId mock resolves), in its current period.
 */
function subscription(id: string, overrides: Record<string, unknown> = {}, plan = 'pro', interval: 'month' | 'year' = 'month') {
  return {
    id,
    customer: 'cus_1',
    status: 'active',
    cancel_at_period_end: false,
    cancel_at: null,
    schedule: null,
    metadata: { org_id: ORG, ntv_plan: plan },
    items: {
      data: [{
        id: `si_${id}`,
        quantity: 1,
        current_period_start: PERIOD.start,
        current_period_end: PERIOD.end,
        price: { id: `price_${plan}_${interval}`, unit_amount: CENTS[plan]?.[interval] ?? null, currency: 'usd', recurring: { interval, interval_count: 1 } },
      }],
    },
    ...overrides,
  }
}

type Sub = ReturnType<typeof subscription>

/** Stripe's subscriptions: list (newest first, paged by 100) and retrieve answer from it. */
function stripeHas(...subs: Sub[]) {
  stripe.client.subscriptions.list.mockImplementation(async (params: { starting_after?: string; limit?: number }) => {
    const from = params.starting_after ? subs.findIndex((s) => s.id === params.starting_after) + 1 : 0
    const limit = params.limit ?? 10
    const data = subs.slice(from, from + limit)
    return { data, has_more: from + limit < subs.length }
  })
  stripe.client.subscriptions.retrieve.mockImplementation(async (id: string) => {
    const found = subs.find((s) => s.id === id)
    if (!found) throw Object.assign(new Error('No such subscription'), { code: 'resource_missing', statusCode: 404 })
    return found
  })
}

/** The schedule from_subscription creates: one phase, the current price for the current period. */
function schedule(id: string, plan = 'pro', interval: 'month' | 'year' = 'month', status = 'active') {
  return {
    id,
    status,
    current_phase: { start_date: PERIOD.start, end_date: PERIOD.end },
    phases: [{ start_date: PERIOD.start, end_date: PERIOD.end, items: [{ price: `price_${plan}_${interval}`, quantity: 1 }] }],
  }
}

const adminUpdates = () => state.admin!.calls.filter((c: FakeCall) => c.table === 'organizations' && c.op === 'update')

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(NOW_S * 1000)
  state.user = fakeDb(handler)
  state.admin = fakeDb(adminHandler)
  state.org = { business_type: 'services', plan: 'trial', minutes_limit: 5, usage_period_start: null }
  state.minutesUsed = 0
  stripe.configured = true
  stripe.client.customers.create.mockReset().mockResolvedValue({ id: 'cus_new' })
  stripe.client.checkout.sessions.create.mockReset().mockResolvedValue({ url: 'https://checkout.stripe.test/s' })
  stripe.client.subscriptions.list.mockReset()
  stripe.client.subscriptions.retrieve.mockReset()
  stripeHas()
  stripe.client.subscriptions.update.mockReset().mockResolvedValue({ id: 'sub_1' })
  stripe.client.subscriptionSchedules.create.mockReset().mockImplementation(async () => schedule('sub_sched_new'))
  stripe.client.subscriptionSchedules.retrieve.mockReset()
  stripe.client.subscriptionSchedules.update.mockReset().mockResolvedValue({ id: 'sub_sched_new' })
  stripe.client.subscriptionSchedules.release.mockReset().mockResolvedValue({ id: 'sub_sched_old', status: 'released' })
  ensurePlanPriceId.mockReset().mockImplementation(async (plan: string, interval: string) => `price_${plan}_${interval}`)
})

describe('POST /api/billing/checkout: a new subscription', () => {
  it('service organization + service plan → checkout on the price PLANS validates, plan stamped on the subscription', async () => {
    const res = await checkout({ plan: 'pro', interval: 'year' })
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ url: 'https://checkout.stripe.test/s' })
    expect(ensurePlanPriceId).toHaveBeenCalledWith('pro', 'year')
    expect(sessionParams()).toMatchObject({
      customer: 'cus_1',
      line_items: [{ price: 'price_pro_year', quantity: 1 }],
      metadata: { org_id: ORG, ntv_plan: 'pro' },
      subscription_data: { metadata: { org_id: ORG, ntv_plan: 'pro' } },
    })
  })

  it.each(['growth', 'scale'] as const)('the homepage rung %s is sold like every self-serve service plan', async (plan) => {
    const res = await checkout({ plan, interval: 'month' })
    expect(res.status).toBe(200)
    expect(ensurePlanPriceId).toHaveBeenCalledWith(plan, 'month')
    expect(sessionParams()).toMatchObject({
      line_items: [{ price: `price_${plan}_month`, quantity: 1 }],
      subscription_data: { metadata: { org_id: ORG, ntv_plan: plan } },
    })
  })

  it('online store + store plan → the price is found or created by lookup key, no env id needed', async () => {
    state.org = { business_type: 'ecommerce', stripe_customer_id: null }
    const res = await checkout({ plan: 'store_starter' })
    expect(res.status).toBe(200)
    expect(ensurePlanPriceId).toHaveBeenCalledWith('store_starter', 'month')
    expect(stripe.client.customers.create).toHaveBeenCalledWith(expect.objectContaining({ email: 'owner@example.com' }))
    expect(sessionParams()).toMatchObject({
      customer: 'cus_new',
      line_items: [{ price: 'price_store_starter_month', quantity: 1 }],
      subscription_data: { metadata: { org_id: ORG, ntv_plan: 'store_starter' } },
    })
    const customerWrite = adminUpdates()[0]
    expect(customerWrite?.payload).toEqual({ stripe_customer_id: 'cus_new' })
    // No customer yet, so no subscription to look for.
    expect(stripe.client.subscriptions.list).not.toHaveBeenCalled()
  })

  it('an organization without a live plan subscription gets a new Checkout after Stripe was asked (every status, every page)', async () => {
    const res = await checkout({ plan: 'pro' })
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ url: 'https://checkout.stripe.test/s' })
    expect(stripe.client.subscriptions.list).toHaveBeenCalledWith({ customer: 'cus_1', status: 'all', limit: 100 })
    expect(stripe.client.subscriptions.update).not.toHaveBeenCalled()
  })

  describe('subscriptions that are not a live plan subscription of this organization: a new Checkout', () => {
    it.each([
      ['a phone-number subscription', { metadata: { type: 'phone_number', org_id: ORG } }],
      ['a canceled plan subscription', { status: 'canceled' }],
      ['an expired, never-started plan subscription', { status: 'incomplete_expired' }],
      ['a subscription stamped for another organization', { metadata: { org_id: '99999999-9999-4999-8999-999999999999', ntv_plan: 'pro' } }],
      ['a subscription of another customer', { customer: { id: 'cus_other' } }],
      ['a subscription without items', { items: { data: [] } }],
    ])('%s', async (_label, overrides) => {
      stripeHas(subscription('sub_x', overrides, 'starter'))
      const res = await checkout({ plan: 'pro' })
      expect(await res.json()).toEqual({ url: 'https://checkout.stripe.test/s' })
      expect(stripe.client.subscriptions.update).not.toHaveBeenCalled()
      expect(sessionParams()).toMatchObject({ mode: 'subscription', line_items: [{ price: 'price_pro_month', quantity: 1 }] })
    })
  })
})

describe('POST /api/billing/checkout: a plan subscription with a payment due (no second subscription)', () => {
  it.each(['past_due', 'unpaid', 'incomplete', 'paused'])('%s → 409 subscription_payment_due, no Checkout, nothing changed', async (status) => {
    state.org = { business_type: 'services', plan: 'trial', stripe_subscription_id: 'sub_due' }
    stripeHas(subscription('sub_due', { status }, 'pro'))
    const res = await checkout({ plan: 'pro' })
    expect(res.status).toBe(409)
    expect(await res.json()).toMatchObject({
      code: 'precondition_failed',
      error: expect.stringContaining('payment due'),
      details: { reason: 'subscription_payment_due' },
    })
    expect(stripe.client.checkout.sessions.create).not.toHaveBeenCalled()
    expect(stripe.client.subscriptions.update).not.toHaveBeenCalled()
    expect(stripe.client.customers.create).not.toHaveBeenCalled()
  })
})

describe('POST /api/billing/checkout: finding the live plan subscription', () => {
  it('the recorded subscription is retrieved directly and switched, without listing', async () => {
    state.org = { business_type: 'services', plan: 'starter', minutes_limit: 400, stripe_subscription_id: 'sub_1' }
    stripeHas(subscription('sub_1', {}, 'starter'))
    expect(await (await checkout({ plan: 'pro' })).json()).toMatchObject({ updated: true, plan: 'pro', effective: 'now' })
    expect(stripe.client.subscriptions.retrieve).toHaveBeenCalledWith('sub_1')
    expect(stripe.client.subscriptions.list).not.toHaveBeenCalled()
    expect(stripe.client.checkout.sessions.create).not.toHaveBeenCalled()
  })

  it('a plan subscription behind 150 phone-number subscriptions is still found (every page is read)', async () => {
    state.org = { business_type: 'services', plan: 'starter', minutes_limit: 400, stripe_subscription_id: null }
    const phones = Array.from({ length: 150 }, (_, i) => subscription(`sub_phone_${i}`, { metadata: { type: 'phone_number', org_id: ORG } }, 'starter'))
    stripeHas(...phones, subscription('sub_plan', {}, 'starter'))
    expect(await (await checkout({ plan: 'pro' })).json()).toMatchObject({ updated: true, plan: 'pro' })
    expect(stripe.client.subscriptions.list).toHaveBeenCalledTimes(2)
    expect(stripe.client.subscriptions.list.mock.calls[1][0]).toMatchObject({ starting_after: 'sub_phone_99' })
    expect(stripe.client.subscriptions.update).toHaveBeenCalledWith('sub_plan', expect.anything())
    expect(stripe.client.checkout.sessions.create).not.toHaveBeenCalled()
  })

  it('a subscription the webhook has not recorded yet is still found by customer and switched', async () => {
    state.org = { business_type: 'services', plan: 'trial', minutes_limit: 5, stripe_subscription_id: null }
    stripeHas(subscription('sub_fresh', {}, 'starter'))
    expect(await (await checkout({ plan: 'pro' })).json()).toMatchObject({ updated: true, plan: 'pro' })
    expect(stripe.client.subscriptions.update).toHaveBeenCalledWith('sub_fresh', expect.anything())
  })

  it('the recorded subscription wins over another live one', async () => {
    state.org = { business_type: 'services', plan: 'starter', minutes_limit: 400, stripe_subscription_id: 'sub_recorded' }
    stripeHas(subscription('sub_other', {}, 'starter'), subscription('sub_recorded', {}, 'starter'))
    await checkout({ plan: 'pro' })
    expect(stripe.client.subscriptions.update).toHaveBeenCalledWith('sub_recorded', expect.anything())
  })

  it('a recorded subscription Stripe no longer has falls back to the customer\'s list', async () => {
    state.org = { business_type: 'services', plan: 'starter', minutes_limit: 400, stripe_subscription_id: 'sub_gone' }
    stripeHas(subscription('sub_live', {}, 'starter'))
    await checkout({ plan: 'pro' })
    expect(stripe.client.subscriptions.update).toHaveBeenCalledWith('sub_live', expect.anything())
  })

  it('when Stripe cannot say whether a subscription exists, nothing is opened (500)', async () => {
    stripe.client.subscriptions.list.mockRejectedValue(new Error('Stripe is down'))
    const res = await checkout({ plan: 'pro' })
    expect(res.status).toBe(500)
    expect(stripe.client.subscriptions.update).not.toHaveBeenCalled()
    expect(stripe.client.checkout.sessions.create).not.toHaveBeenCalled()
  })
})

describe('POST /api/billing/checkout: an upgrade on the same billing interval takes effect now, paid now', () => {
  beforeEach(() => {
    state.org = { business_type: 'services', plan: 'starter', minutes_limit: 400, usage_period_start: new Date(PERIOD.start * 1000).toISOString(), stripe_subscription_id: 'sub_1' }
    stripeHas(subscription('sub_1', {}, 'starter'))
  })

  it('the difference for the rest of the period is invoiced and collected at once (a declined card changes nothing)', async () => {
    const res = await checkout({ plan: 'pro' })
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ updated: true, plan: 'pro', effective: 'now', effective_at: null })
    expect(stripe.client.subscriptions.update).toHaveBeenCalledTimes(1)
    expect(stripe.client.subscriptions.update).toHaveBeenCalledWith('sub_1', {
      items: [{ id: 'si_sub_1', price: 'price_pro_month' }],
      proration_behavior: 'always_invoice',
      payment_behavior: 'error_if_incomplete',
      metadata: { org_id: ORG, ntv_plan: 'pro' },
    })
    expect(stripe.client.subscriptionSchedules.create).not.toHaveBeenCalled()
    expect(stripe.client.checkout.sessions.create).not.toHaveBeenCalled()
  })

  it('the included minutes follow what was paid: the old allowance plus the new minutes for the share of the period left', async () => {
    // Starter (400) → Pro (3,000) a quarter into the period, 100 minutes used:
    // 300 Starter minutes left + 3/4 of the 2,600 extra = 2,250 left, so 750 count as used.
    state.minutesUsed = 100
    await checkout({ plan: 'pro' })
    const write = adminUpdates()[0]
    expect(write?.payload).toEqual({ minutes_used: 750, minutes_limit: 3000 })
    // A compare-and-set on the minutes read, so a call's usage recorded meanwhile is never lost.
    expect(write?.filters).toEqual([['eq', 'id', ORG], ['eq', 'minutes_used', 100]])
  })

  it('Scenario A: upgrading on the last days of the period buys only those days\' minutes', async () => {
    vi.setSystemTime((PERIOD.end - 2 * DAY) * 1000)
    state.minutesUsed = 400
    await checkout({ plan: 'scale' })
    // 2 of 30 days left: 400 + 14,600 × 28/30 = 14,027 counted as used, so 973 left (not 14,600).
    expect(adminUpdates()[0]?.payload).toEqual({ minutes_used: 14027, minutes_limit: 15000 })
  })

  it('a pending change at the renewal is replaced: its schedule is released first', async () => {
    stripeHas(subscription('sub_1', { schedule: 'sub_sched_old' }, 'starter'))
    stripe.client.subscriptionSchedules.retrieve.mockResolvedValue(schedule('sub_sched_old', 'starter'))
    await checkout({ plan: 'pro' })
    expect(stripe.client.subscriptionSchedules.release).toHaveBeenCalledWith('sub_sched_old')
    expect(stripe.client.subscriptionSchedules.release.mock.invocationCallOrder[0]).toBeLessThan(stripe.client.subscriptions.update.mock.invocationCallOrder[0])
  })

  it('a subscription set to end is resumed by the upgrade', async () => {
    stripeHas(subscription('sub_1', { cancel_at_period_end: true, cancel_at: 1_900_000_000 }, 'starter'))
    await checkout({ plan: 'pro' })
    expect(stripe.client.subscriptions.update).toHaveBeenCalledWith('sub_1', expect.objectContaining({ cancel_at_period_end: false }))
    expect(stripe.client.subscriptions.update.mock.calls[0][1]).not.toHaveProperty('cancel_at')
  })

  it('a scheduled cancellation date is cleared too', async () => {
    stripeHas(subscription('sub_1', { cancel_at: 1_900_000_000 }, 'starter'))
    await checkout({ plan: 'pro' })
    expect(stripe.client.subscriptions.update).toHaveBeenCalledWith('sub_1', expect.objectContaining({ cancel_at: '' }))
  })

  it('a declined card answers 402: no plan change, no minutes written, no Checkout', async () => {
    stripe.client.subscriptions.update.mockRejectedValue(Object.assign(new Error('Your card was declined.'), { type: 'StripeCardError', statusCode: 402 }))
    const res = await checkout({ plan: 'pro' })
    expect(res.status).toBe(402)
    expect(await res.json()).toMatchObject({ code: 'precondition_failed', details: { reason: 'payment_declined' }, error: expect.stringContaining('was not changed') })
    expect(adminUpdates()).toEqual([])
    expect(stripe.client.checkout.sessions.create).not.toHaveBeenCalled()
  })

  it('any other Stripe failure of the switch is a 500, never a fallback Checkout', async () => {
    stripe.client.subscriptions.update.mockRejectedValue(new Error('Stripe is down'))
    const res = await checkout({ plan: 'pro' })
    expect(res.status).toBe(500)
    expect(adminUpdates()).toEqual([])
    expect(stripe.client.checkout.sessions.create).not.toHaveBeenCalled()
  })

  it('an annual upgrade prorates the minutes over the current month of the year', async () => {
    // Starter annual → Pro annual, 10 days into the third month of the year (usage period started then).
    const monthStart = Date.UTC(2027, 2, 1)
    vi.setSystemTime(monthStart + 10 * DAY * 1000)
    state.org = { ...state.org, usage_period_start: new Date(monthStart).toISOString() }
    stripeHas(subscription('sub_1', {
      items: { data: [{ id: 'si_sub_1', quantity: 1, current_period_start: Date.UTC(2027, 0, 1) / 1000, current_period_end: Date.UTC(2028, 0, 1) / 1000, price: { id: 'price_starter_year', unit_amount: 49000, currency: 'usd', recurring: { interval: 'year', interval_count: 1 } } }] },
    }, 'starter', 'year'))
    state.minutesUsed = 0
    const res = await checkout({ plan: 'pro', interval: 'year' })
    expect(await res.json()).toMatchObject({ effective: 'now' })
    expect(stripe.client.subscriptions.update).toHaveBeenCalledWith('sub_1', expect.objectContaining({ items: [{ id: 'si_sub_1', price: 'price_pro_year' }], proration_behavior: 'always_invoice' }))
    // March has 31 days: 10/31 of the 2,600 extra minutes are gone.
    expect(adminUpdates()[0]?.payload).toEqual({ minutes_used: Math.round(2600 * (10 / 31)), minutes_limit: 3000 })
  })
})

describe('POST /api/billing/checkout: a downgrade or a billing-interval change starts at the renewal', () => {
  beforeEach(() => {
    state.org = { business_type: 'services', plan: 'scale', minutes_limit: 15000, stripe_subscription_id: 'sub_1' }
    stripeHas(subscription('sub_1', {}, 'scale'))
    stripe.client.subscriptionSchedules.create.mockImplementation(async () => schedule('sub_sched_new', 'scale'))
  })

  it('Scenario B: a downgrade is scheduled for the period end, nothing refunded, the current plan and its minutes kept until then', async () => {
    const res = await checkout({ plan: 'starter' })
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ updated: true, plan: 'starter', effective: 'renewal', effective_at: new Date(PERIOD.end * 1000).toISOString() })
    expect(stripe.client.subscriptions.update).not.toHaveBeenCalled()
    expect(stripe.client.subscriptionSchedules.create).toHaveBeenCalledWith({ from_subscription: 'sub_1' })
    expect(stripe.client.subscriptionSchedules.update).toHaveBeenCalledWith('sub_sched_new', {
      end_behavior: 'release',
      proration_behavior: 'none',
      phases: [
        { items: [{ price: 'price_scale_month', quantity: 1 }], start_date: PERIOD.start, end_date: PERIOD.end, proration_behavior: 'none' },
        { items: [{ price: 'price_starter_month', quantity: 1 }], duration: { interval: 'month', interval_count: 1 }, metadata: { org_id: ORG, ntv_plan: 'starter' }, proration_behavior: 'none' },
      ],
    })
    expect(adminUpdates()).toEqual([])
  })

  it('a second downgrade replaces the pending one on the same schedule', async () => {
    stripeHas(subscription('sub_1', { schedule: 'sub_sched_1' }, 'scale'))
    stripe.client.subscriptionSchedules.retrieve.mockResolvedValue(schedule('sub_sched_1', 'scale'))
    await checkout({ plan: 'growth' })
    expect(stripe.client.subscriptionSchedules.create).not.toHaveBeenCalled()
    expect(stripe.client.subscriptionSchedules.update).toHaveBeenCalledWith('sub_sched_1', expect.objectContaining({
      phases: [expect.objectContaining({ items: [{ price: 'price_scale_month', quantity: 1 }] }), expect.objectContaining({ items: [{ price: 'price_growth_month', quantity: 1 }] })],
    }))
  })

  it('a subscription set to end is resumed before the change is scheduled', async () => {
    stripeHas(subscription('sub_1', { cancel_at_period_end: true }, 'scale'))
    await checkout({ plan: 'starter' })
    expect(stripe.client.subscriptions.update).toHaveBeenCalledWith('sub_1', { cancel_at_period_end: false })
    expect(stripe.client.subscriptions.update.mock.invocationCallOrder[0]).toBeLessThan(stripe.client.subscriptionSchedules.create.mock.invocationCallOrder[0])
  })

  it.each([
    ['monthly → annual, same plan', 'scale', 'year'],
    ['monthly → annual, a higher plan', 'scale', 'year'],
  ] as const)('a billing-interval change (%s) waits for the renewal too', async (_label, plan, interval) => {
    state.org = { business_type: 'services', plan: 'starter', minutes_limit: 400, stripe_subscription_id: 'sub_1' }
    stripeHas(subscription('sub_1', {}, 'starter'))
    const res = await checkout({ plan, interval })
    expect(await res.json()).toMatchObject({ effective: 'renewal' })
    expect(stripe.client.subscriptions.update).not.toHaveBeenCalled()
    expect(stripe.client.subscriptionSchedules.update.mock.calls[0][1].phases[1]).toMatchObject({ items: [{ price: `price_${plan}_${interval}`, quantity: 1 }], duration: { interval, interval_count: 1 } })
  })

  it('an annual subscriber choosing a monthly price of a lower plan waits for the end of the year', async () => {
    stripeHas(subscription('sub_1', {}, 'scale', 'year'))
    expect(await (await checkout({ plan: 'pro', interval: 'month' })).json()).toMatchObject({ effective: 'renewal' })
  })

  it('a plan switch to a rung whose stale env price was replaced moves at the renewal (its old amount is unknown)', async () => {
    stripeHas(subscription('sub_1', {
      metadata: { org_id: ORG, ntv_plan: 'starter' },
      items: { data: [{ id: 'si_sub_1', quantity: 1, current_period_start: PERIOD.start, current_period_end: PERIOD.end, price: { id: 'price_starter_pinned_old', unit_amount: null, currency: 'usd', recurring: { interval: 'month', interval_count: 1 } } }] },
    }))
    const res = await checkout({ plan: 'starter' })
    expect(await res.json()).toMatchObject({ updated: true, plan: 'starter', effective: 'renewal' })
    expect(stripe.client.subscriptionSchedules.update.mock.calls[0][1].phases[1]).toMatchObject({ items: [{ price: 'price_starter_month', quantity: 1 }] })
  })

  it('a Stripe failure while scheduling is a 500, never a fallback Checkout', async () => {
    stripe.client.subscriptionSchedules.update.mockRejectedValue(new Error('Stripe is down'))
    expect((await checkout({ plan: 'starter' })).status).toBe(500)
    expect(stripe.client.checkout.sessions.create).not.toHaveBeenCalled()
  })
})

describe('POST /api/billing/checkout: during a Stripe trial, and the plan it already pays for', () => {
  it('a trialing subscription changes right away, nothing billed or prorated, minutes untouched', async () => {
    state.org = { business_type: 'ecommerce', plan: 'store_scale', minutes_limit: 2000, stripe_subscription_id: 'sub_store' }
    stripeHas(subscription('sub_store', { status: 'trialing' }, 'store_scale'))
    const res = await checkout({ plan: 'store_starter' })
    expect(await res.json()).toEqual({ updated: true, plan: 'store_starter', effective: 'now', effective_at: null })
    expect(ensurePlanPriceId).toHaveBeenCalledWith('store_starter', 'month')
    expect(stripe.client.subscriptions.update).toHaveBeenCalledWith('sub_store', {
      items: [{ id: 'si_sub_store', price: 'price_store_starter_month' }],
      proration_behavior: 'none',
      metadata: { org_id: ORG, ntv_plan: 'store_starter' },
    })
    expect(adminUpdates()).toEqual([])
  })

  it('the plan it already pays for is a no-op: nothing is updated', async () => {
    state.org = { business_type: 'services', plan: 'pro', minutes_limit: 3000, stripe_subscription_id: 'sub_1' }
    stripeHas(subscription('sub_1', {}, 'pro'))
    const res = await checkout({ plan: 'pro' })
    expect(await res.json()).toEqual({ updated: true, plan: 'pro', effective: 'now', effective_at: null })
    expect(stripe.client.subscriptions.update).not.toHaveBeenCalled()
    expect(stripe.client.subscriptionSchedules.release).not.toHaveBeenCalled()
    expect(stripe.client.checkout.sessions.create).not.toHaveBeenCalled()
  })

  it('choosing the current plan again cancels a pending change at the renewal', async () => {
    state.org = { business_type: 'services', plan: 'pro', minutes_limit: 3000, stripe_subscription_id: 'sub_1' }
    stripeHas(subscription('sub_1', { schedule: 'sub_sched_1' }, 'pro'))
    stripe.client.subscriptionSchedules.retrieve.mockResolvedValue(schedule('sub_sched_1', 'pro'))
    await checkout({ plan: 'pro' })
    expect(stripe.client.subscriptionSchedules.release).toHaveBeenCalledWith('sub_sched_1')
    expect(stripe.client.subscriptions.update).not.toHaveBeenCalled()
  })

  it('a schedule that is no longer active is left alone', async () => {
    state.org = { business_type: 'services', plan: 'pro', minutes_limit: 3000, stripe_subscription_id: 'sub_1' }
    stripeHas(subscription('sub_1', { schedule: 'sub_sched_done' }, 'pro'))
    stripe.client.subscriptionSchedules.retrieve.mockResolvedValue(schedule('sub_sched_done', 'pro', 'month', 'released'))
    await checkout({ plan: 'pro' })
    expect(stripe.client.subscriptionSchedules.release).not.toHaveBeenCalled()
  })
})

describe('POST /api/billing/checkout: logs', () => {
  it('never print a price id (they can be the env-pinned STRIPE_*_PRICE_ID values)', async () => {
    vi.stubEnv('LOG_LEVEL', 'debug')
    const lines: string[] = []
    const capture = (...args: unknown[]) => {
      lines.push(String(args[0]))
    }
    vi.spyOn(console, 'log').mockImplementation(capture)
    vi.spyOn(console, 'warn').mockImplementation(capture)
    vi.spyOn(console, 'error').mockImplementation(capture)
    state.org = { business_type: 'services', plan: 'starter', minutes_limit: 400, stripe_subscription_id: 'sub_1' }
    stripeHas(subscription('sub_1', {}, 'starter'))
    await checkout({ plan: 'pro' })
    stripeHas(subscription('sub_1', {}, 'pro'))
    await checkout({ plan: 'starter' })
    stripe.client.subscriptions.update.mockRejectedValue(new Error('Stripe is down'))
    stripeHas(subscription('sub_1', {}, 'starter'))
    await checkout({ plan: 'pro' })
    const switched = lines.find((l) => l.includes('"billing.plan_switched"'))
    expect(switched).toBeDefined()
    expect(JSON.parse(switched!)).toMatchObject({ fromPlan: 'starter', toPlan: 'pro', fromInterval: 'month', toInterval: 'month', timing: 'now_upgrade' })
    expect(lines.some((l) => l.includes('"billing.plan_change_scheduled"'))).toBe(true)
    expect(lines.length).toBeGreaterThan(2)
    for (const line of lines) expect(line).not.toMatch(/price_/)
  })
})

describe('POST /api/billing/checkout: refusals', () => {
  it('a store plan is refused to a service organization, explicit or legacy NULL business type', async () => {
    for (const businessType of ['services', null]) {
      state.org = { business_type: businessType }
      const res = await checkout({ plan: 'store_growth' })
      expect(res.status).toBe(409)
      expect(await res.json()).toMatchObject({
        code: 'plan_not_available',
        error: 'This plan is not available for your type of business.',
        details: { reason: 'plan_not_available', plan: 'store_growth', business_type: businessType },
      })
    }
    expect(stripe.client.checkout.sessions.create).not.toHaveBeenCalled()
    expect(stripe.client.subscriptions.list).not.toHaveBeenCalled()
    expect(ensurePlanPriceId).not.toHaveBeenCalled()
  })

  it('a service plan is refused to an online store', async () => {
    state.org = { business_type: 'ecommerce' }
    const res = await checkout({ plan: 'business' })
    expect(res.status).toBe(409)
    expect(await res.json()).toMatchObject({ code: 'plan_not_available' })
    expect(stripe.client.checkout.sessions.create).not.toHaveBeenCalled()
  })

  it('a store price that cannot be resolved answers 500 and opens no session', async () => {
    state.org = { business_type: 'ecommerce' }
    ensurePlanPriceId.mockRejectedValue(new Error('Stripe is down'))
    const res = await checkout({ plan: 'store_scale' })
    expect(res.status).toBe(500)
    expect(await res.json()).toMatchObject({ code: 'internal' })
    expect(stripe.client.checkout.sessions.create).not.toHaveBeenCalled()
    expect(stripe.client.subscriptions.update).not.toHaveBeenCalled()
  })

  it('a service plan price that cannot be resolved answers 500 and opens nothing, never a free upgrade', async () => {
    ensurePlanPriceId.mockRejectedValue(new Error('No usable Stripe price for starter (month)'))
    const res = await checkout({ plan: 'starter' })
    expect(res.status).toBe(500)
    expect(await res.json()).toMatchObject({ code: 'internal' })
    expect(stripe.client.checkout.sessions.create).not.toHaveBeenCalled()
    expect(stripe.client.subscriptions.list).not.toHaveBeenCalled()
  })

  it('only self-serve tiers are accepted: the trial and the sales-led tiers are 400', async () => {
    for (const plan of ['trial', 'custom', 'store_enterprise', 'enterprise-hack']) {
      expect((await checkout({ plan })).status, plan).toBe(400)
    }
    expect(stripe.client.checkout.sessions.create).not.toHaveBeenCalled()
  })

  it('without Stripe configured the route answers 503', async () => {
    stripe.configured = false
    expect((await checkout({ plan: 'pro' })).status).toBe(503)
  })
})
