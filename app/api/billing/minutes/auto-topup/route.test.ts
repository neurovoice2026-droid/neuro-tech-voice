import { beforeEach, describe, expect, it, vi } from 'vitest'
import { memoryDb, type MemoryDb } from '@/tests/helpers/memory-db'

const ORG = '11111111-1111-4111-8111-111111111111'

const state: { db: MemoryDb | null } = { db: null }
vi.mock('@/lib/api/auth', () => ({
  requireOrg: async () => ({
    supabase: state.db,
    user: { id: 'u1', email: 'owner@example.com' },
    org: { id: ORG, name: 'Acme', timezone: 'UTC', plan: 'pro' },
  }),
}))
// The tenant reads and the service-role write hit the same in-memory table.
vi.mock('@/lib/supabase/admin', () => ({ createAdminClient: () => state.db }))

const stripe = {
  configured: true,
  client: {
    subscriptions: { retrieve: vi.fn() },
    customers: { retrieve: vi.fn() },
  },
}
vi.mock('@/lib/stripe/client', () => ({ getStripeClient: () => stripe.client, isStripeConfigured: () => stripe.configured }))
const enforceRateLimit = vi.fn()
vi.mock('@/lib/security/rate-limit', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/security/rate-limit')>()),
  enforceRateLimit: (...a: unknown[]) => enforceRateLimit(...a),
}))

import { PUT } from '@/app/api/billing/minutes/auto-topup/route'
import { RATE_LIMITS } from '@/lib/security/rate-limit'

function org(over: Record<string, unknown> = {}) {
  return {
    id: ORG,
    plan: 'pro',
    minutes_used: 100,
    minutes_limit: 850,
    extra_minutes_balance: 0,
    usage_period_start: null,
    auto_topup_enabled: false,
    auto_topup_pack: null,
    auto_topup_threshold: null,
    auto_topup_failed_at: '2026-10-10T10:00:00Z',
    auto_topup_failure: 'Your card was declined.',
    stripe_customer_id: 'cus_1',
    stripe_subscription_id: 'sub_1',
    ...over,
  }
}

const put = (body: unknown, headers: Record<string, string> = {}) =>
  PUT(new Request('http://localhost/api/billing/minutes/auto-topup', {
    method: 'PUT',
    headers: { 'content-type': 'application/json', ...headers },
    body: JSON.stringify(body),
  }))

const row = () => state.db!.tables.organizations[0]

beforeEach(() => {
  state.db = memoryDb({ organizations: [org()] })
  stripe.configured = true
  stripe.client.subscriptions.retrieve.mockReset().mockResolvedValue({ id: 'sub_1', default_payment_method: 'pm_1' })
  stripe.client.customers.retrieve.mockReset().mockResolvedValue({ id: 'cus_1', invoice_settings: { default_payment_method: null } })
  enforceRateLimit.mockReset().mockResolvedValue(undefined)
})

describe('PUT /api/billing/minutes/auto-topup', () => {
  it('turns auto top-up on with a saved card, clears the last failure and answers the settings', async () => {
    const res = await put({ enabled: true, pack: 500, threshold: 60 })
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ enabled: true, pack: 500, threshold: 60, available: true, last_failed_at: null, failure: null })
    expect(row()).toMatchObject({ auto_topup_enabled: true, auto_topup_pack: 500, auto_topup_threshold: 60, auto_topup_failed_at: null, auto_topup_failure: null })
    expect(stripe.client.subscriptions.retrieve).toHaveBeenCalledWith('sub_1')
    expect(enforceRateLimit).toHaveBeenCalledWith(RATE_LIMITS.billingMinutesAutoTopUp, ORG, expect.any(String))
  })

  it("accepts the customer's invoice default when the subscription has no card of its own", async () => {
    stripe.client.subscriptions.retrieve.mockResolvedValue({ id: 'sub_1', default_payment_method: null })
    stripe.client.customers.retrieve.mockResolvedValue({ id: 'cus_1', invoice_settings: { default_payment_method: { id: 'pm_2' } } })
    expect((await put({ enabled: true, pack: 100, threshold: 10 })).status).toBe(200)
    expect(row()).toMatchObject({ auto_topup_enabled: true })
  })

  it('409 no_payment_method when there is no saved card, no subscription, or no paid plan', async () => {
    stripe.client.subscriptions.retrieve.mockResolvedValue({ id: 'sub_1', default_payment_method: null })
    const noCard = await put({ enabled: true, pack: 500, threshold: 50 })
    expect(noCard.status).toBe(409)
    expect(await noCard.json()).toMatchObject({ code: 'no_payment_method', details: { reason: 'payment_method_required' }, error: 'Add a card in the billing portal to turn on auto top-up.' })

    state.db = memoryDb({ organizations: [org({ plan: 'custom', stripe_subscription_id: null })] })
    const noSubscription = await put({ enabled: true, pack: 500, threshold: 50 })
    expect(noSubscription.status).toBe(409)
    expect(await noSubscription.json()).toMatchObject({ code: 'no_payment_method', details: { reason: 'subscription_required' } })

    state.db = memoryDb({ organizations: [org({ plan: 'trial', stripe_customer_id: null, stripe_subscription_id: null })] })
    const trial = await put({ enabled: true, pack: 500, threshold: 50 })
    expect(trial.status).toBe(409)
    expect(await trial.json()).toMatchObject({ code: 'no_payment_method', details: { reason: 'plan_required' } })
    expect(row()).toMatchObject({ auto_topup_enabled: false })
  })

  it('turning it off is always allowed, never asks Stripe and keeps the last failure on record', async () => {
    state.db = memoryDb({ organizations: [org({ plan: 'trial', auto_topup_enabled: true, stripe_subscription_id: null })] })
    stripe.configured = false
    const res = await put({ enabled: false, pack: 1000, threshold: 100 })
    expect(res.status).toBe(200)
    expect(await res.json()).toMatchObject({ enabled: false, pack: 1000, threshold: 100, available: false, failure: 'Your card was declined.' })
    expect(stripe.client.subscriptions.retrieve).not.toHaveBeenCalled()
  })

  it('validates the pack and the threshold range', async () => {
    for (const body of [
      { enabled: true, pack: 300, threshold: 50 },
      { enabled: true, pack: 500, threshold: 9 },
      { enabled: true, pack: 500, threshold: 1001 },
      { enabled: true, pack: 500, threshold: 50.5 },
      { enabled: 'yes', pack: 500, threshold: 50 },
      { enabled: true, pack: 500 },
      { enabled: true, pack: 500, threshold: 50, auto_topup_last_attempt_at: null },
    ]) {
      expect((await put(body)).status, JSON.stringify(body)).toBe(400)
    }
    expect(row()).toMatchObject({ auto_topup_enabled: false, auto_topup_pack: null })
  })

  it('refuses a threshold above the pack (one pack must clear it, never a charge every cooldown) and saves nothing', async () => {
    const res = await put({ enabled: true, pack: 100, threshold: 1000 })
    expect(res.status).toBe(400)
    expect(await res.json()).toMatchObject({
      code: 'invalid_request',
      error: expect.stringContaining('cannot be larger than the pack'),
      details: { reason: 'threshold_above_pack' },
    })
    expect(row()).toMatchObject({ auto_topup_enabled: false, auto_topup_pack: null, auto_topup_threshold: null })
    expect(stripe.client.subscriptions.retrieve).not.toHaveBeenCalled()
    // The pack size itself is a valid threshold.
    expect((await put({ enabled: true, pack: 100, threshold: 100 })).status).toBe(200)
  })

  it('a Stripe error while checking the card is a 502 and saves nothing; cross-site requests are refused', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
    stripe.client.subscriptions.retrieve.mockRejectedValue(new Error('Stripe is down'))
    const res = await put({ enabled: true, pack: 500, threshold: 50 })
    expect(res.status).toBe(502)
    expect(await res.json()).toMatchObject({ code: 'provider_error' })
    expect(row()).toMatchObject({ auto_topup_enabled: false })

    expect((await put({ enabled: false, pack: 500, threshold: 50 }, { origin: 'https://evil.example' })).status).toBe(403)
  })
})
