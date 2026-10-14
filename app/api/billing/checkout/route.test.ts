import { beforeEach, describe, expect, it, vi } from 'vitest'
import { fakeDb, type FakeCall, type Handler } from '@/tests/helpers/fake-db'

vi.hoisted(() => {
  // PLANS reads the price ids at module load: service plans are pinned, store plans are not.
  process.env.STRIPE_PRO_PRICE_ID = 'price_pro_month'
  process.env.STRIPE_PRO_ANNUAL_PRICE_ID = 'price_pro_year'
  delete process.env.STRIPE_STORE_STARTER_PRICE_ID
  delete process.env.STRIPE_STORE_STARTER_ANNUAL_PRICE_ID
})

const ORG = '11111111-1111-4111-8111-111111111111'

const state: {
  user: ReturnType<typeof fakeDb> | null
  admin: ReturnType<typeof fakeDb> | null
  org: Record<string, unknown>
} = { user: null, admin: null, org: {} }

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
  },
}
vi.mock('@/lib/stripe/client', () => ({ getStripeClient: () => stripe.client, isStripeConfigured: () => stripe.configured }))
const ensurePlanPriceId = vi.fn()
vi.mock('@/lib/stripe/store-prices', () => ({ ensurePlanPriceId: (...a: unknown[]) => ensurePlanPriceId(...a) }))

import { POST } from '@/app/api/billing/checkout/route'

const handler: Handler = (c) => {
  if (c.table === 'organizations' && c.op === 'select') return { data: { stripe_customer_id: 'cus_1', ...state.org }, error: null }
  return { data: null, error: null }
}

const checkout = (body: unknown) =>
  POST(new Request('http://localhost/api/billing/checkout', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  }))

const sessionParams = () => stripe.client.checkout.sessions.create.mock.calls[0]?.[0] as Record<string, unknown> | undefined

beforeEach(() => {
  state.user = fakeDb(handler)
  state.admin = fakeDb(() => ({ data: null, error: null }))
  state.org = { business_type: 'services' }
  stripe.configured = true
  stripe.client.customers.create.mockReset().mockResolvedValue({ id: 'cus_new' })
  stripe.client.checkout.sessions.create.mockReset().mockResolvedValue({ url: 'https://checkout.stripe.test/s' })
  ensurePlanPriceId.mockReset().mockResolvedValue('price_auto_store')
})

describe('POST /api/billing/checkout', () => {
  it('service organization + service plan → checkout on the env price, plan stamped on the subscription', async () => {
    const res = await checkout({ plan: 'pro', interval: 'year' })
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ url: 'https://checkout.stripe.test/s' })
    expect(sessionParams()).toMatchObject({
      customer: 'cus_1',
      line_items: [{ price: 'price_pro_year', quantity: 1 }],
      metadata: { org_id: ORG, ntv_plan: 'pro' },
      subscription_data: { metadata: { org_id: ORG, ntv_plan: 'pro' } },
    })
    expect(ensurePlanPriceId).not.toHaveBeenCalled()
  })

  it('online store + store plan → the price is found or created by lookup key, no env id needed', async () => {
    state.org = { business_type: 'ecommerce', stripe_customer_id: null }
    const res = await checkout({ plan: 'store_starter' })
    expect(res.status).toBe(200)
    expect(ensurePlanPriceId).toHaveBeenCalledWith('store_starter', 'month')
    expect(stripe.client.customers.create).toHaveBeenCalledWith(expect.objectContaining({ email: 'owner@example.com' }))
    expect(sessionParams()).toMatchObject({
      customer: 'cus_new',
      line_items: [{ price: 'price_auto_store', quantity: 1 }],
      subscription_data: { metadata: { org_id: ORG, ntv_plan: 'store_starter' } },
    })
    const customerWrite = state.admin!.calls.find((c: FakeCall) => c.table === 'organizations' && c.op === 'update')
    expect(customerWrite?.payload).toEqual({ stripe_customer_id: 'cus_new' })
  })

  describe('plan family enforcement (409 plan_not_available)', () => {
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
      expect(ensurePlanPriceId).not.toHaveBeenCalled()
    })

    it('a service plan is refused to an online store', async () => {
      state.org = { business_type: 'ecommerce' }
      const res = await checkout({ plan: 'business' })
      expect(res.status).toBe(409)
      expect(await res.json()).toMatchObject({ code: 'plan_not_available' })
      expect(stripe.client.checkout.sessions.create).not.toHaveBeenCalled()
    })
  })

  it('a store price that cannot be resolved answers 500 and opens no session', async () => {
    state.org = { business_type: 'ecommerce' }
    ensurePlanPriceId.mockRejectedValue(new Error('Stripe is down'))
    const res = await checkout({ plan: 'store_scale' })
    expect(res.status).toBe(500)
    expect(await res.json()).toMatchObject({ code: 'internal' })
    expect(stripe.client.checkout.sessions.create).not.toHaveBeenCalled()
  })

  it('a service plan without an env price id is a 400, never a free upgrade', async () => {
    const res = await checkout({ plan: 'starter' })
    expect(res.status).toBe(400)
    expect(await res.json()).toMatchObject({ code: 'invalid_request' })
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
