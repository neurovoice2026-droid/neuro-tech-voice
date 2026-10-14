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

type SubscriptionInput = {
  priceId: string
  status?: string
  metadata?: Record<string, string>
}

function subscription({ priceId, status = 'active', metadata = { org_id: ORG } }: SubscriptionInput) {
  return { id: 'sub_1', status, customer: 'cus_1', metadata, items: { data: [{ price: { id: priceId } }] } }
}

function deliver(type: string, object: unknown) {
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
  stripe.subscriptions.retrieve.mockReset()
  stripe.prices.retrieve.mockReset().mockRejectedValue(new Error('prices.retrieve must not be called'))
})

describe('billing webhook: which plan a subscription grants', () => {
  it('an env-configured price id resolves without asking Stripe', async () => {
    const res = await deliver('customer.subscription.updated', subscription({ priceId: 'price_pro_month' }))
    expect(res.status).toBe(200)
    expect(orgUpdate()).toMatchObject({ plan: 'pro', minutes_limit: 850, stripe_subscription_id: 'sub_1', onboarding_completed: true })
    expect(stripe.prices.retrieve).not.toHaveBeenCalled()
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
    await deliver('checkout.session.completed', { id: 'cs_1', subscription: 'sub_1', metadata: { org_id: ORG, ntv_plan: 'store_scale' } })
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
