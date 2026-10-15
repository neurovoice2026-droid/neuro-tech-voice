import { beforeEach, describe, expect, it, vi } from 'vitest'
import { fakeDb, type FakeCall, type Handler } from '@/tests/helpers/fake-db'

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
    org: { id: ORG, name: 'Acme', timezone: 'UTC', plan: 'pro' },
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
const enforceRateLimit = vi.fn()
vi.mock('@/lib/security/rate-limit', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/security/rate-limit')>()),
  enforceRateLimit: (...a: unknown[]) => enforceRateLimit(...a),
}))

import { POST } from '@/app/api/billing/minutes/checkout/route'
import { RATE_LIMITS } from '@/lib/security/rate-limit'
import { rateLimitedError } from '@/lib/api/http'

const handler: Handler = (c) => {
  if (c.table === 'organizations' && c.op === 'select') return { data: { ...state.org }, error: null }
  return { data: null, error: null }
}

const checkout = (body: unknown, headers: Record<string, string> = {}) =>
  POST(new Request('http://localhost/api/billing/minutes/checkout', {
    method: 'POST',
    headers: { 'content-type': 'application/json', ...headers },
    body: JSON.stringify(body),
  }))

const sessionParams = () => stripe.client.checkout.sessions.create.mock.calls[0]?.[0] as Record<string, unknown> | undefined

beforeEach(() => {
  vi.stubEnv('NEXT_PUBLIC_APP_URL', 'https://app.example.com')
  state.user = fakeDb(handler)
  state.admin = fakeDb(() => ({ data: null, error: null }))
  state.org = { plan: 'store_growth', stripe_customer_id: 'cus_1' }
  stripe.configured = true
  enforceRateLimit.mockReset().mockResolvedValue(undefined)
  stripe.client.customers.create.mockReset().mockResolvedValue({ id: 'cus_new' })
  stripe.client.checkout.sessions.create.mockReset().mockResolvedValue({ url: 'https://checkout.stripe.test/m' })
})

describe('POST /api/billing/minutes/checkout', () => {
  it('opens a one-time Checkout for the pack at the plan price, with the pack on every metadata', async () => {
    const res = await checkout({ minutes: 1000 })
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ url: 'https://checkout.stripe.test/m' })
    // Store Growth: $0.22/min, 8% off the 1,000-minute pack.
    const metadata = { type: 'minute_pack', org_id: ORG, minutes: '1000', plan: 'store_growth' }
    expect(sessionParams()).toMatchObject({
      mode: 'payment',
      customer: 'cus_1',
      line_items: [{ quantity: 1, price_data: { currency: 'usd', unit_amount: 20240, product_data: { name: '1,000 extra minutes' } } }],
      invoice_creation: { enabled: true, invoice_data: { metadata } },
      metadata,
      payment_intent_data: { metadata },
      success_url: 'https://app.example.com/billing?minutes=success#minutes',
      cancel_url: 'https://app.example.com/billing?minutes=canceled#minutes',
      // The site's look, with the wordmark and the brand square served from the app origin.
      branding_settings: {
        button_color: '#551a89',
        logo: { type: 'url', url: 'https://app.example.com/brand/checkout-logo.png' },
        icon: { type: 'url', url: 'https://app.example.com/brand/checkout-icon.png' },
      },
    })
    expect(sessionParams()).not.toHaveProperty('subscription_data')
    expect(stripe.client.customers.create).not.toHaveBeenCalled()
  })

  it('prices every pack from the stored plan, never from the request', async () => {
    state.org = { plan: 'pro', stripe_customer_id: 'cus_1' }
    await checkout({ minutes: 100, amount_cents: 1, plan: 'custom' })
    expect(stripe.client.checkout.sessions.create).not.toHaveBeenCalled()

    await checkout({ minutes: 2500 })
    // Pro: $0.20 a minute, 12% off the 2,500-minute pack.
    expect((sessionParams()!.line_items as Array<{ price_data: { unit_amount: number } }>)[0].price_data.unit_amount).toBe(44000)
  })

  it('the trial cannot buy minutes: 409 minutes_not_available', async () => {
    state.org = { plan: 'trial', stripe_customer_id: null }
    const res = await checkout({ minutes: 100 })
    expect(res.status).toBe(409)
    expect(await res.json()).toMatchObject({
      code: 'minutes_not_available',
      error: 'Extra minutes are available on paid plans. Choose a plan first, then buy minutes.',
      details: { reason: 'minutes_not_available', plan: 'trial' },
    })
    expect(stripe.client.checkout.sessions.create).not.toHaveBeenCalled()
  })

  it('sales-led plans can buy; a missing Stripe customer is created and saved', async () => {
    state.org = { plan: 'custom', stripe_customer_id: null }
    const res = await checkout({ minutes: 500 })
    expect(res.status).toBe(200)
    expect(stripe.client.customers.create).toHaveBeenCalledWith({ email: 'owner@example.com', metadata: { org_id: ORG, user_id: 'u1' } })
    // Enterprise: $0.20 a minute, 4% off the 500-minute pack.
    expect(sessionParams()).toMatchObject({ customer: 'cus_new', line_items: [{ price_data: { unit_amount: 9600 } }] })
    const write = state.admin!.calls.find((c: FakeCall) => c.table === 'organizations' && c.op === 'update')
    expect(write?.payload).toEqual({ stripe_customer_id: 'cus_new' })
    expect(write?.filters).toEqual([['eq', 'id', ORG]])
  })

  it('only the four pack sizes are accepted', async () => {
    for (const minutes of [0, 50, 101, 5000, '100', null]) {
      expect((await checkout({ minutes })).status, String(minutes)).toBe(400)
    }
    expect(stripe.client.checkout.sessions.create).not.toHaveBeenCalled()
  })

  it('rejects cross-site requests, and answers 503 without Stripe', async () => {
    expect((await checkout({ minutes: 100 }, { origin: 'https://evil.example' })).status).toBe(403)
    stripe.configured = false
    expect((await checkout({ minutes: 100 })).status).toBe(503)
  })

  it('is rate limited per organization (429 before anything reaches Stripe)', async () => {
    enforceRateLimit.mockRejectedValue(rateLimitedError(Date.now() + 60_000))
    const res = await checkout({ minutes: 100 })
    expect(res.status).toBe(429)
    expect(enforceRateLimit).toHaveBeenCalledWith(RATE_LIMITS.billingMinutesCheckout, ORG, expect.any(String))
    expect(stripe.client.checkout.sessions.create).not.toHaveBeenCalled()
  })

  it('a Stripe failure is a 500 without details', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
    stripe.client.checkout.sessions.create.mockRejectedValue(new Error('Invalid API Key provided'))
    const res = await checkout({ minutes: 100 })
    expect(res.status).toBe(500)
    expect(await res.json()).toMatchObject({ code: 'internal', error: 'Failed to create checkout session' })
  })
})
