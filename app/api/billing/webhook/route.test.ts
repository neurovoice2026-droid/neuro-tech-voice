import { beforeEach, describe, expect, it, vi } from 'vitest'
import { fakeDb, type FakeCall } from '@/tests/helpers/fake-db'

vi.hoisted(() => {
  // PLANS reads the price ids at module load: Pro is pinned, the store plans are not.
  process.env.STRIPE_PRO_PRICE_ID = 'price_pro_month'
  delete process.env.STRIPE_STORE_STARTER_PRICE_ID
  delete process.env.STRIPE_STORE_GROWTH_PRICE_ID
})

const ORG = '11111111-1111-4111-8111-111111111111'

const stripe = {
  webhooks: { constructEvent: vi.fn() },
  subscriptions: { retrieve: vi.fn() },
  prices: { retrieve: vi.fn() },
}
// The real plan resolution (planFromPriceId, resolvePlanFromPrice) against a fake Stripe client.
vi.mock('@/lib/stripe/client', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/stripe/client')>()),
  getStripeClient: () => stripe,
}))

const state: { admin: ReturnType<typeof fakeDb> | null } = { admin: null }
vi.mock('@/lib/supabase/admin', () => ({ createAdminClient: () => state.admin }))
vi.mock('@/lib/smartbill/emit', () => ({ emitInvoiceForStripePayment: vi.fn() }))
vi.mock('@/lib/email/client', () => ({ sendEmail: vi.fn() }))
vi.mock('@/lib/phone/provision', () => ({ provisionPhoneNumber: vi.fn() }))

import { POST } from '@/app/api/billing/webhook/route'
import { emitInvoiceForStripePayment } from '@/lib/smartbill/emit'
import { sendEmail } from '@/lib/email/client'
import { STRIPE_TRIAL_MINUTES } from '@/lib/billing/stripe-trial'

type SubscriptionInput = {
  priceId: string
  status?: string
  metadata?: Record<string, string>
  /** The price's recurring interval; omitted, the price carries no recurring block. */
  interval?: string
}

function subscription({ priceId, status = 'active', metadata = { org_id: ORG }, interval }: SubscriptionInput) {
  const price = interval ? { id: priceId, recurring: { interval, interval_count: 1 } } : { id: priceId }
  return { id: 'sub_1', status, customer: 'cus_1', metadata, items: { data: [{ price }] } }
}

/** The object of the last delivered event: what subscriptions.retrieve answers by default (Stripe's current state). */
let delivered: { id?: unknown } | null = null

function deliver(type: string, object: unknown) {
  delivered = object as { id?: unknown }
  stripe.webhooks.constructEvent.mockReturnValue({ type, data: { object } })
  return POST(new Request('http://localhost/api/billing/webhook', {
    method: 'POST',
    headers: { 'stripe-signature': 'sig_test', 'content-type': 'application/json' },
    body: '{}',
  }))
}

/** The organizations update the handler wrote (plan, minutes, …), or undefined. */
const orgUpdate = () =>
  state.admin!.calls.find((c: FakeCall) => c.table === 'organizations' && c.op === 'update')?.payload as Record<string, unknown> | undefined

beforeEach(() => {
  vi.stubEnv('STRIPE_WEBHOOK_SECRET', 'whsec_test')
  state.admin = fakeDb(() => ({ data: null, error: null }))
  stripe.webhooks.constructEvent.mockReset()
  delivered = null
  stripe.subscriptions.retrieve.mockReset().mockImplementation(async (id: string) => {
    if (delivered && delivered.id === id) return delivered
    throw Object.assign(new Error('No such subscription'), { code: 'resource_missing', statusCode: 404 })
  })
  stripe.prices.retrieve.mockReset().mockRejectedValue(new Error('prices.retrieve must not be called'))
})

describe('billing webhook: which plan a subscription grants', () => {
  it('an env-pinned price id resolves without asking Stripe, with the plan\'s current allowance', async () => {
    // Even a pin checkout no longer charges (an old amount) keeps naming its plan for the subscriptions sold on it.
    const res = await deliver('customer.subscription.updated', subscription({ priceId: 'price_pro_month' }))
    expect(res.status).toBe(200)
    expect(orgUpdate()).toMatchObject({ plan: 'pro', minutes_limit: 3000, stripe_subscription_id: 'sub_1', onboarding_completed: true })
    expect(stripe.prices.retrieve).not.toHaveBeenCalled()
  })

  it.each([
    ['growth', 'ntv_growth_month', 1000],
    ['scale', 'ntv_scale_year', 15000],
    ['starter', 'ntv_starter_year', 400],
    ['business', 'ntv_business_month', 5000],
  ] as const)('a price the app created for %s resolves through its metadata or lookup key, with the homepage allowance', async (plan, lookupKey, minutes) => {
    stripe.prices.retrieve.mockResolvedValueOnce({ id: `price_${plan}`, metadata: { ntv_plan: plan, ntv_interval: 'month' }, lookup_key: lookupKey })
    await deliver('customer.subscription.updated', subscription({ priceId: `price_${plan}` }))
    expect(orgUpdate()).toMatchObject({ plan, minutes_limit: minutes })

    state.admin = fakeDb(() => ({ data: null, error: null }))
    stripe.prices.retrieve.mockResolvedValueOnce({ id: `price_${plan}_keyed`, metadata: {}, lookup_key: lookupKey })
    await deliver('customer.subscription.updated', subscription({ priceId: `price_${plan}_keyed` }))
    expect(orgUpdate()).toMatchObject({ plan, minutes_limit: minutes })
  })

  it('during the Stripe free days a paid plan grants at most STRIPE_TRIAL_MINUTES; the full allowance once it is active', async () => {
    stripe.prices.retrieve.mockResolvedValueOnce({ id: 'price_scale', metadata: { ntv_plan: 'scale' }, lookup_key: 'ntv_scale_month' })
    stripe.subscriptions.retrieve.mockResolvedValueOnce(subscription({ priceId: 'price_scale', status: 'trialing', interval: 'month' }))
    await deliver('checkout.session.completed', { id: 'cs_t', mode: 'subscription', subscription: 'sub_1', metadata: { org_id: ORG } })
    expect(orgUpdate()).toMatchObject({ plan: 'scale', minutes_limit: STRIPE_TRIAL_MINUTES, onboarding_completed: true })

    state.admin = fakeDb(() => ({ data: null, error: null }))
    stripe.prices.retrieve.mockResolvedValueOnce({ id: 'price_scale', metadata: { ntv_plan: 'scale' }, lookup_key: 'ntv_scale_month' })
    await deliver('customer.subscription.updated', subscription({ priceId: 'price_scale', status: 'active', interval: 'month' }))
    expect(orgUpdate()).toMatchObject({ plan: 'scale', minutes_limit: 15000 })
  })

  it('a sales-led Enterprise subscription (stamped custom) gets the allowance Enterprise starts from', async () => {
    stripe.prices.retrieve.mockResolvedValueOnce({ id: 'price_deal', metadata: {}, lookup_key: null })
    await deliver('customer.subscription.created', subscription({ priceId: 'price_deal', metadata: { org_id: ORG, ntv_plan: 'custom' } }))
    expect(orgUpdate()).toMatchObject({ plan: 'custom', minutes_limit: 15000 })
  })

  it('an unknown price is read before the ntv_plan stamped on the subscription, so a plan switch applies the new price', async () => {
    // Checkout stamped store_starter; the merchant then moved to Store Growth in the Customer Portal.
    stripe.prices.retrieve.mockResolvedValueOnce({ id: 'price_auto_1', metadata: { ntv_plan: 'store_growth' }, lookup_key: 'ntv_store_growth_month' })
    await deliver('customer.subscription.updated', subscription({ priceId: 'price_auto_1', metadata: { org_id: ORG, ntv_plan: 'store_starter' } }))
    expect(stripe.prices.retrieve).toHaveBeenCalledWith('price_auto_1')
    expect(orgUpdate()).toMatchObject({ plan: 'store_growth', minutes_limit: 950 })
  })

  it('the subscription ntv_plan is the last resort, for a price that carries no plan of its own', async () => {
    stripe.prices.retrieve.mockResolvedValueOnce({ id: 'price_untagged', metadata: {}, lookup_key: null })
    await deliver('customer.subscription.created', subscription({ priceId: 'price_untagged', metadata: { org_id: ORG, ntv_plan: 'store_growth' } }))
    expect(stripe.prices.retrieve).toHaveBeenCalledWith('price_untagged')
    expect(orgUpdate()).toMatchObject({ plan: 'store_growth', minutes_limit: 950 })
  })

  it('without subscription metadata the price itself is read (metadata ntv_plan, then the lookup key)', async () => {
    stripe.prices.retrieve.mockResolvedValueOnce({ id: 'price_auto_2', metadata: { ntv_plan: 'store_starter' }, lookup_key: 'ntv_store_starter_month' })
    await deliver('customer.subscription.updated', subscription({ priceId: 'price_auto_2' }))
    expect(stripe.prices.retrieve).toHaveBeenCalledWith('price_auto_2')
    expect(orgUpdate()).toMatchObject({ plan: 'store_starter', minutes_limit: 350 })

    state.admin = fakeDb(() => ({ data: null, error: null }))
    stripe.prices.retrieve.mockResolvedValueOnce({ id: 'price_auto_3', metadata: {}, lookup_key: 'ntv_store_scale_year' })
    await deliver('customer.subscription.updated', subscription({ priceId: 'price_auto_3' }))
    expect(orgUpdate()).toMatchObject({ plan: 'store_scale', minutes_limit: 2000 })
  })

  it('a price nobody tagged, or a bogus ntv_plan, keeps the previous behaviour: back to the trial', async () => {
    stripe.prices.retrieve.mockResolvedValueOnce({ id: 'price_foreign', metadata: {}, lookup_key: null })
    await deliver('customer.subscription.updated', subscription({ priceId: 'price_foreign', metadata: { org_id: ORG, ntv_plan: 'enterprise-hack' } }))
    expect(orgUpdate()).toMatchObject({ plan: 'trial', minutes_limit: 5 })

    state.admin = fakeDb(() => ({ data: null, error: null }))
    stripe.prices.retrieve.mockRejectedValueOnce(Object.assign(new Error('No such price'), { code: 'resource_missing', statusCode: 404 }))
    await deliver('customer.subscription.updated', subscription({ priceId: 'price_gone' }))
    expect(orgUpdate()).toMatchObject({ plan: 'trial' })
  })

  it('a Stripe outage while reading the price answers 500 (Stripe retries) instead of downgrading', async () => {
    stripe.prices.retrieve.mockRejectedValueOnce(Object.assign(new Error('Stripe is down'), { statusCode: 503 }))
    const res = await deliver('customer.subscription.updated', subscription({ priceId: 'price_auto_4' }))
    expect(res.status).toBe(500)
    expect(orgUpdate()).toBeUndefined()
  })

  it('an inactive subscription resets to the trial whatever its price says; phone-number subscriptions are not plans', async () => {
    await deliver('customer.subscription.updated', subscription({ priceId: 'price_pro_month', status: 'canceled' }))
    expect(orgUpdate()).toMatchObject({ plan: 'trial', minutes_limit: 5 })

    state.admin = fakeDb(() => ({ data: null, error: null }))
    await deliver('customer.subscription.updated', subscription({ priceId: 'price_pro_month', metadata: { org_id: ORG, type: 'phone_number' } }))
    expect(orgUpdate()).toBeUndefined()
  })

  it('checkout.session.completed retrieves the subscription and applies the same resolution', async () => {
    stripe.prices.retrieve.mockResolvedValueOnce({ id: 'price_auto_5', metadata: { ntv_plan: 'store_scale' }, lookup_key: 'ntv_store_scale_month' })
    stripe.subscriptions.retrieve.mockResolvedValueOnce(subscription({ priceId: 'price_auto_5', metadata: { ntv_plan: 'store_scale' } }))
    await deliver('checkout.session.completed', { id: 'cs_1', mode: 'subscription', subscription: 'sub_1', metadata: { org_id: ORG, ntv_plan: 'store_scale' } })
    expect(stripe.subscriptions.retrieve).toHaveBeenCalledWith('sub_1')
    const update = state.admin!.calls.find((c: FakeCall) => c.table === 'organizations' && c.op === 'update')
    expect(update?.payload).toMatchObject({ plan: 'store_scale', minutes_limit: 2000 })
    expect(update?.filters).toEqual([['eq', 'id', ORG]])
  })

  it('rejects deliveries without a signature or without the webhook secret', async () => {
    const unsigned = await POST(new Request('http://localhost/api/billing/webhook', { method: 'POST', body: '{}' }))
    expect(unsigned.status).toBe(400)
    vi.stubEnv('STRIPE_WEBHOOK_SECRET', '')
    const unconfigured = await deliver('customer.subscription.updated', subscription({ priceId: 'price_pro_month' }))
    expect(unconfigured.status).toBe(503)
  })
})

describe('billing webhook: the current subscription, and only the recorded one takes the plan away', () => {
  const orFilter = () => state.admin!.calls.find((c: FakeCall) => c.table === 'organizations' && c.op === 'update')?.filters.find(([op]) => op === 'or')?.[2]

  it('applies the subscription as Stripe has it now, not the event snapshot (out-of-order deliveries after quick switches)', async () => {
    // The event says Starter, but the subscription has since moved to Pro (the later event arrived first).
    stripe.subscriptions.retrieve.mockResolvedValueOnce(subscription({ priceId: 'price_pro_month', interval: 'month' }))
    stripe.prices.retrieve.mockResolvedValueOnce({ id: 'price_starter', metadata: { ntv_plan: 'starter' }, lookup_key: 'ntv_starter_month' })
    await deliver('customer.subscription.updated', subscription({ priceId: 'price_starter', interval: 'month' }))
    expect(stripe.subscriptions.retrieve).toHaveBeenCalledWith('sub_1')
    expect(orgUpdate()).toMatchObject({ plan: 'pro', minutes_limit: 3000 })
  })

  it('a subscription Stripe no longer has is acknowledged without a write; a Stripe outage answers 500', async () => {
    stripe.subscriptions.retrieve.mockRejectedValueOnce(Object.assign(new Error('No such subscription'), { code: 'resource_missing', statusCode: 404 }))
    expect((await deliver('customer.subscription.updated', subscription({ priceId: 'price_pro_month' }))).status).toBe(200)
    expect(orgUpdate()).toBeUndefined()

    vi.spyOn(console, 'error').mockImplementation(() => {})
    stripe.subscriptions.retrieve.mockRejectedValueOnce(Object.assign(new Error('Stripe is down'), { statusCode: 503 }))
    expect((await deliver('customer.subscription.updated', subscription({ priceId: 'price_pro_month' }))).status).toBe(500)
    expect(orgUpdate()).toBeUndefined()
  })

  it('a phone-number subscription event is not even retrieved', async () => {
    await deliver('customer.subscription.updated', subscription({ priceId: 'price_pro_month', metadata: { org_id: ORG, type: 'phone_number' } }))
    expect(stripe.subscriptions.retrieve).not.toHaveBeenCalled()
  })

  it('an active plan subscription is applied unconditionally (a new subscription replaces the recorded one)', async () => {
    await deliver('customer.subscription.updated', subscription({ priceId: 'price_pro_month' }))
    expect(orgUpdate()).toMatchObject({ plan: 'pro', stripe_subscription_id: 'sub_1' })
    expect(orFilter()).toBeUndefined()
  })

  it.each(['past_due', 'unpaid', 'canceled', 'incomplete_expired'])('a %s subscription moves the organization to the trial only while it is the recorded one (or none is)', async (status) => {
    await deliver('customer.subscription.updated', subscription({ priceId: 'price_pro_month', status }))
    expect(orgUpdate()).toMatchObject({ plan: 'trial', minutes_limit: 5 })
    expect(orFilter()).toBe('stripe_subscription_id.is.null,stripe_subscription_id.eq.sub_1')
  })

  it('an old subscription ending never downgrades the organization that pays for a newer one', async () => {
    await deliver('customer.subscription.deleted', { ...subscription({ priceId: 'price_pro_month', status: 'canceled' }), id: 'sub_old' })
    expect(orgUpdate()).toMatchObject({ plan: 'trial', stripe_subscription_id: null })
    // The write applies only where the organization still records sub_old (or nothing).
    expect(orFilter()).toBe('stripe_subscription_id.is.null,stripe_subscription_id.eq.sub_old')
  })

  it('a subscription id of an unexpected shape changes nothing', async () => {
    vi.spyOn(console, 'warn').mockImplementation(() => {})
    await deliver('customer.subscription.deleted', { ...subscription({ priceId: 'price_pro_month', status: 'canceled' }), id: 'sub_1,plan.eq.pro' })
    expect(orgUpdate()).toBeUndefined()
  })
})

describe('billing webhook: the billing interval of the plan subscription', () => {
  it.each(['month', 'year'] as const)('an active subscription stores its price\'s interval (%s) with the plan', async (interval) => {
    await deliver('customer.subscription.updated', subscription({ priceId: 'price_pro_month', interval }))
    expect(orgUpdate()).toMatchObject({ plan: 'pro', minutes_limit: 3000, billing_interval: interval })
  })

  it('checkout.session.completed stores it too (an annual Store Growth subscription)', async () => {
    stripe.prices.retrieve.mockResolvedValueOnce({ id: 'price_sg_year', metadata: { ntv_plan: 'store_growth' }, lookup_key: 'ntv_store_growth_year' })
    stripe.subscriptions.retrieve.mockResolvedValueOnce(subscription({ priceId: 'price_sg_year', interval: 'year' }))
    await deliver('checkout.session.completed', { id: 'cs_y', mode: 'subscription', subscription: 'sub_1', metadata: { org_id: ORG } })
    expect(orgUpdate()).toMatchObject({ plan: 'store_growth', billing_interval: 'year' })
  })

  it('is cleared when the subscription stops granting a plan: inactive, untagged, or deleted', async () => {
    await deliver('customer.subscription.updated', subscription({ priceId: 'price_pro_month', status: 'past_due', interval: 'year' }))
    expect(orgUpdate()).toMatchObject({ plan: 'trial', billing_interval: null })

    state.admin = fakeDb(() => ({ data: null, error: null }))
    stripe.prices.retrieve.mockResolvedValueOnce({ id: 'price_foreign', metadata: {}, lookup_key: null })
    await deliver('customer.subscription.updated', subscription({ priceId: 'price_foreign', interval: 'year' }))
    expect(orgUpdate()).toMatchObject({ plan: 'trial', billing_interval: null })

    state.admin = fakeDb(() => ({ data: null, error: null }))
    await deliver('customer.subscription.deleted', subscription({ priceId: 'price_pro_month', status: 'canceled', interval: 'year' }))
    expect(orgUpdate()).toMatchObject({ plan: 'trial', billing_interval: null, stripe_subscription_id: null })
  })

  it('a price without a monthly or yearly recurring interval stores null (the column only takes month or year)', async () => {
    await deliver('customer.subscription.updated', subscription({ priceId: 'price_pro_month' }))
    expect(orgUpdate()).toMatchObject({ plan: 'pro', billing_interval: null })

    state.admin = fakeDb(() => ({ data: null, error: null }))
    await deliver('customer.subscription.updated', subscription({ priceId: 'price_pro_month', interval: 'week' }))
    expect(orgUpdate()).toMatchObject({ plan: 'pro', billing_interval: null })
  })

  it('a phone-number subscription never touches it', async () => {
    await deliver('customer.subscription.updated', subscription({ priceId: 'price_pro_month', metadata: { org_id: ORG, type: 'phone_number' }, interval: 'month' }))
    expect(orgUpdate()).toBeUndefined()
  })

  it('before migration 028 the plan still applies: the update is retried without the column, once', async () => {
    vi.spyOn(console, 'warn').mockImplementation(() => {})
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
    state.admin = fakeDb((c) =>
      c.table === 'organizations' && c.op === 'update' && Object.hasOwn(c.payload as object, 'billing_interval')
        ? { data: null, error: { code: 'PGRST204', message: "Could not find the 'billing_interval' column of 'organizations' in the schema cache" } }
        : { data: null, error: null },
    )
    const res = await deliver('customer.subscription.updated', subscription({ priceId: 'price_pro_month', interval: 'year' }))
    expect(res.status).toBe(200)
    const updates = state.admin.calls.filter((c: FakeCall) => c.table === 'organizations' && c.op === 'update')
    expect(updates).toHaveLength(2)
    expect(updates[1].payload).toEqual({ plan: 'pro', minutes_limit: 3000, stripe_customer_id: 'cus_1', stripe_subscription_id: 'sub_1', onboarding_completed: true })
    expect(updates[1].filters).toEqual([['eq', 'id', ORG]])
    expect(errorSpy).not.toHaveBeenCalled()
  })

  it('any other update error answers 500, so Stripe retries the delivery instead of billing a plan never granted', async () => {
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
    // Growth before migration 028: organizations_plan_check (026) refuses the plan id.
    state.admin = fakeDb((c) => (c.op === 'update' ? { data: null, error: { code: '23514', message: 'violates check constraint "organizations_plan_check"' } } : { data: null, error: null }))
    stripe.prices.retrieve.mockResolvedValueOnce({ id: 'price_growth', metadata: { ntv_plan: 'growth' }, lookup_key: 'ntv_growth_month' })
    const res = await deliver('customer.subscription.updated', subscription({ priceId: 'price_growth', interval: 'month' }))
    expect(res.status).toBe(500)
    // Not retried within the delivery; the retry is Stripe's.
    expect(state.admin.calls.filter((c: FakeCall) => c.op === 'update')).toHaveLength(1)
    expect(errorSpy).toHaveBeenCalledWith(
      'Stripe webhook handler error (customer.subscription.updated):',
      expect.objectContaining({ message: expect.stringContaining('organizations_plan_check') }),
    )
  })

  it('a refused write answers 500 for a new checkout and for a deletion too', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
    const refuse = () => fakeDb((c) => (c.op === 'update' ? { data: null, error: { code: '23514', message: 'violates check constraint "organizations_plan_check"' } } : { data: null, error: null }))

    state.admin = refuse()
    stripe.prices.retrieve.mockResolvedValueOnce({ id: 'price_scale', metadata: { ntv_plan: 'scale' }, lookup_key: 'ntv_scale_month' })
    stripe.subscriptions.retrieve.mockResolvedValueOnce(subscription({ priceId: 'price_scale', interval: 'month' }))
    const checkout = await deliver('checkout.session.completed', { id: 'cs_s', mode: 'subscription', subscription: 'sub_1', metadata: { org_id: ORG } })
    expect(checkout.status).toBe(500)

    state.admin = refuse()
    const deleted = await deliver('customer.subscription.deleted', subscription({ priceId: 'price_pro_month', status: 'canceled' }))
    expect(deleted.status).toBe(500)
  })
})

// ─── Extra-minute packs and usage periods ─────────────────────────────────────

type Rpc = { fn: string; args: Record<string, unknown> }

/** Answers the RPCs the handler calls (credit_minute_purchase, start_usage_period) and records them. */
function withRpc(answer: (fn: string) => { data: unknown; error: { message: string } | null } = () => ({ data: null, error: null })): Rpc[] {
  const calls: Rpc[] = []
  ;(state.admin as unknown as { rpc: unknown }).rpc = (fn: string, args: Record<string, unknown>) => {
    calls.push({ fn, args })
    return Promise.resolve(answer(fn))
  }
  return calls
}

const T_PERIOD = 1_791_000_000 // a period start (epoch seconds)

function invoice(over: Record<string, unknown> = {}) {
  return {
    id: 'in_1',
    customer: 'cus_1',
    customer_email: 'owner@example.com',
    amount_paid: 12000,
    currency: 'usd',
    billing_reason: 'manual',
    metadata: {},
    parent: null,
    lines: { data: [] },
    period_start: T_PERIOD - 30 * 86_400,
    period_end: T_PERIOD,
    ...over,
  }
}

function subscriptionInvoice(over: Record<string, unknown> = {}, meta: Record<string, string> = { org_id: ORG, ntv_plan: 'pro' }) {
  return invoice({
    billing_reason: 'subscription_cycle',
    parent: { type: 'subscription_details', subscription_details: { subscription: 'sub_1', metadata: meta } },
    lines: {
      data: [
        // A proration left over from a mid-period plan switch, then the new period's line.
        { period: { start: T_PERIOD - 10 * 86_400, end: T_PERIOD }, parent: { type: 'subscription_item_details', subscription_item_details: { proration: true } } },
        { period: { start: T_PERIOD, end: T_PERIOD + 30 * 86_400 }, parent: { type: 'subscription_item_details', subscription_item_details: { proration: false } } },
      ],
    },
    ...over,
  })
}

function orgRow(row: Record<string, unknown> | null) {
  state.admin = fakeDb((c) => (c.table === 'organizations' && c.op === 'select' ? { data: row, error: null } : { data: null, error: null }))
}

describe('billing webhook: extra-minute packs bought through Checkout', () => {
  const session = (over: Record<string, unknown> = {}) => ({
    id: 'cs_pack',
    mode: 'payment',
    payment_status: 'paid',
    amount_total: 20240,
    currency: 'usd',
    invoice: 'in_pack',
    payment_intent: 'pi_pack',
    subscription: null,
    metadata: { type: 'minute_pack', org_id: ORG, minutes: '1000', plan: 'store_growth' },
    ...over,
  })

  it('a paid session credits the pack once, keyed on the session, and never touches the plan', async () => {
    const rpc = withRpc(() => ({ data: [{ credited: true, balance_after: 1000 }], error: null }))
    const res = await deliver('checkout.session.completed', session())
    expect(res.status).toBe(200)
    expect(rpc).toEqual([
      {
        fn: 'credit_minute_purchase',
        args: {
          p_org_id: ORG,
          p_minutes: 1000,
          p_amount_cents: 20240,
          p_currency: 'usd',
          p_source: 'checkout',
          p_checkout_session_id: 'cs_pack',
          p_invoice_id: 'in_pack',
          p_payment_intent_id: 'pi_pack',
        },
      },
    ])
    expect(stripe.subscriptions.retrieve).not.toHaveBeenCalled()
    expect(orgUpdate()).toBeUndefined()
  })

  it('an asynchronous payment is credited when it succeeds, not when the session completes', async () => {
    const rpc = withRpc()
    await deliver('checkout.session.completed', session({ payment_status: 'unpaid' }))
    expect(rpc).toHaveLength(0)
    await deliver('checkout.session.async_payment_succeeded', session())
    expect(rpc.map((c) => [c.fn, c.args.p_checkout_session_id])).toEqual([['credit_minute_purchase', 'cs_pack']])
  })

  it('metadata that is not a valid pack is logged and acknowledged, never credited', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
    const rpc = withRpc()
    for (const metadata of [{ type: 'minute_pack', org_id: ORG, minutes: '750' }, { type: 'minute_pack', minutes: '100' }]) {
      expect((await deliver('checkout.session.completed', session({ metadata }))).status).toBe(200)
    }
    expect(rpc).toHaveLength(0)
  })

  it('a failed credit write answers 500 so Stripe retries the delivery', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
    withRpc(() => ({ data: null, error: { message: 'connection reset' } }))
    expect((await deliver('checkout.session.completed', session())).status).toBe(500)
  })

  it('a one-time payment session is never treated as a plan subscription', async () => {
    const rpc = withRpc()
    await deliver('checkout.session.completed', { id: 'cs_other', mode: 'payment', payment_status: 'paid', subscription: 'sub_x', metadata: { org_id: ORG } })
    expect(stripe.subscriptions.retrieve).not.toHaveBeenCalled()
    expect(orgUpdate()).toBeUndefined()
    expect(rpc).toHaveLength(0)
    // async_payment_succeeded only ever concerns minute packs.
    await deliver('checkout.session.async_payment_succeeded', { id: 'cs_sub', mode: 'subscription', subscription: 'sub_1', metadata: { org_id: ORG } })
    expect(stripe.subscriptions.retrieve).not.toHaveBeenCalled()
  })
})

describe('billing webhook: paid invoices', () => {
  beforeEach(() => {
    vi.mocked(emitInvoiceForStripePayment).mockReset()
    vi.mocked(sendEmail).mockReset()
  })

  it('an auto top-up invoice is credited on its invoice id; the fiscal invoice and the receipt still go out', async () => {
    const rpc = withRpc(() => ({ data: [{ credited: false, balance_after: 500 }], error: null }))
    const paid = invoice({ metadata: { type: 'minute_pack', source: 'auto_topup', org_id: ORG, minutes: '500', plan: 'pro' } })
    expect((await deliver('invoice.paid', paid)).status).toBe(200)
    expect(rpc).toEqual([
      {
        fn: 'credit_minute_purchase',
        args: {
          p_org_id: ORG,
          p_minutes: 500,
          p_amount_cents: 12000,
          p_currency: 'usd',
          p_source: 'auto_topup',
          p_checkout_session_id: null,
          p_invoice_id: 'in_1',
          p_payment_intent_id: null,
        },
      },
    ])
    expect(emitInvoiceForStripePayment).toHaveBeenCalledWith(state.admin, paid)
    const mail = vi.mocked(sendEmail).mock.calls[0]?.[0]
    expect(mail?.to).toBe('owner@example.com')
    expect(mail?.html).toContain('for <strong>500 extra minutes</strong>')
    expect(stripe.prices.retrieve).not.toHaveBeenCalled()
  })

  it('the invoice Checkout issues for a pack is not credited again (its session was)', async () => {
    const rpc = withRpc()
    await deliver('invoice.paid', invoice({ metadata: { type: 'minute_pack', org_id: ORG, minutes: '100', plan: 'pro' } }))
    expect(rpc).toHaveLength(0)
    expect(emitInvoiceForStripePayment).toHaveBeenCalledTimes(1)
    expect(vi.mocked(sendEmail).mock.calls[0]?.[0].html).toContain('100 extra minutes')
  })

  it('a renewal starts a new usage period at the new line period, after the fiscal invoice path', async () => {
    orgRow({ id: ORG, stripe_subscription_id: 'sub_1' })
    const rpc = withRpc(() => ({ data: true, error: null }))
    const paid = subscriptionInvoice()
    expect((await deliver('invoice.paid', paid)).status).toBe(200)
    expect(rpc).toEqual([{ fn: 'start_usage_period', args: { p_org_id: ORG, p_period_start: new Date(T_PERIOD * 1000).toISOString() } }])
    const read = state.admin!.calls.find((c: FakeCall) => c.table === 'organizations' && c.op === 'select')
    expect(read?.filters).toEqual([['eq', 'id', ORG]])
    expect(emitInvoiceForStripePayment).toHaveBeenCalledWith(state.admin, paid)
  })

  it('the first invoice of a new subscription starts a period even before customer.subscription.created lands', async () => {
    orgRow({ id: ORG, stripe_subscription_id: null })
    const rpc = withRpc(() => ({ data: true, error: null }))
    await deliver('invoice.paid', subscriptionInvoice({ billing_reason: 'subscription_create', lines: { data: [] }, period_start: T_PERIOD, period_end: T_PERIOD }))
    expect(rpc.map((c) => c.args)).toEqual([{ p_org_id: ORG, p_period_start: new Date(T_PERIOD * 1000).toISOString() }])
  })

  it('the organization is found by its Stripe customer when the subscription carries no org_id', async () => {
    orgRow({ id: ORG, stripe_subscription_id: 'sub_1' })
    const rpc = withRpc(() => ({ data: false, error: null }))
    await deliver('invoice.paid', subscriptionInvoice({}, {}))
    const read = state.admin!.calls.find((c: FakeCall) => c.table === 'organizations' && c.op === 'select')
    expect(read?.filters).toEqual([['eq', 'stripe_customer_id', 'cus_1']])
    expect(rpc).toHaveLength(1)
  })

  it('phone numbers, other subscriptions and mid-period invoices never reset the minutes', async () => {
    orgRow({ id: ORG, stripe_subscription_id: 'sub_plan' })
    const rpc = withRpc()
    await deliver('invoice.paid', subscriptionInvoice({}, { org_id: ORG, type: 'phone_number' }))
    await deliver('invoice.paid', subscriptionInvoice({}, { org_id: ORG }))
    await deliver('invoice.paid', subscriptionInvoice({ billing_reason: 'subscription_update' }))
    await deliver('invoice.paid', invoice({ billing_reason: 'manual' }))
    // A second plan subscription's renewal (stamped ntv_plan, but not the recorded one) resets nothing.
    await deliver('invoice.paid', subscriptionInvoice())
    expect(rpc).toHaveLength(0)
    expect(emitInvoiceForStripePayment).toHaveBeenCalledTimes(5)
  })

  it('a new subscription\'s first invoice still starts its period while an older one is recorded', async () => {
    orgRow({ id: ORG, stripe_subscription_id: 'sub_expired' })
    const rpc = withRpc(() => ({ data: true, error: null }))
    await deliver('invoice.paid', subscriptionInvoice({ billing_reason: 'subscription_create' }))
    expect(rpc.map((c) => c.fn)).toEqual(['start_usage_period'])
  })

  it('a plan change scheduled for the renewal starts the period with its subscription_update invoice; a prorated upgrade invoice does not', async () => {
    orgRow({ id: ORG, stripe_subscription_id: 'sub_1' })
    const rpc = withRpc(() => ({ data: true, error: null }))
    // The schedule's next phase: a full new-period line on the recorded subscription.
    await deliver('invoice.paid', subscriptionInvoice({ billing_reason: 'subscription_update' }))
    expect(rpc).toEqual([{ fn: 'start_usage_period', args: { p_org_id: ORG, p_period_start: new Date(T_PERIOD * 1000).toISOString() } }])
    // An immediate upgrade's invoice carries only proration lines: the period goes on.
    const prorationOnly = {
      data: [
        { period: { start: T_PERIOD - 10 * 86_400, end: T_PERIOD }, parent: { type: 'subscription_item_details', subscription_item_details: { proration: true } } },
      ],
    }
    await deliver('invoice.paid', subscriptionInvoice({ billing_reason: 'subscription_update', lines: prorationOnly }))
    expect(rpc).toHaveLength(1)
  })

  it('a failed period reset answers 500 so Stripe retries', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
    orgRow({ id: ORG, stripe_subscription_id: 'sub_1' })
    withRpc(() => ({ data: null, error: { message: 'function start_usage_period does not exist' } }))
    expect((await deliver('invoice.paid', subscriptionInvoice())).status).toBe(500)
  })

  it('a failed auto top-up charge has its own e-mail; a failed plan payment keeps the usual one', async () => {
    await deliver('invoice.payment_failed', invoice({ amount_due: 12000, metadata: { type: 'minute_pack', source: 'auto_topup', org_id: ORG, minutes: '500' } }))
    expect(sendEmail).not.toHaveBeenCalled()
    await deliver('invoice.payment_failed', subscriptionInvoice({ amount_due: 24900 }))
    expect(vi.mocked(sendEmail).mock.calls[0]?.[0].subject).toBe('Action needed: your payment failed')
  })
})
