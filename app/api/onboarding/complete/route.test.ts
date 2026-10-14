import { beforeEach, describe, expect, it, vi } from 'vitest'
import { fakeDb, type FakeCall, type Handler } from '@/tests/helpers/fake-db'

const ORG = '11111111-1111-4111-8111-111111111111'
const AGENT = '22222222-2222-4222-8222-222222222222'

const state: {
  user: ReturnType<typeof fakeDb> | null
  admin: ReturnType<typeof fakeDb> | null
  org: Record<string, unknown>
} = { user: null, admin: null, org: {} }

vi.mock('@/lib/api/auth', () => ({
  requireOrg: async () => ({
    supabase: state.user,
    user: { id: 'u1', email: null },
    org: { id: ORG, name: 'Acme', timezone: 'UTC', plan: 'trial' },
  }),
}))
vi.mock('@/lib/supabase/admin', () => ({ createAdminClient: () => state.admin }))
vi.mock('@/lib/observability/telemetry', () => ({ deferBackground: () => {}, emitProviderEvent: () => {} }))
// Stripe is off by default; a test switches it on to exercise the checkout path.
const stripe = {
  configured: false,
  client: {
    customers: { create: vi.fn() },
    checkout: { sessions: { create: vi.fn() } },
  },
}
vi.mock('@/lib/stripe/client', () => ({ getStripeClient: () => stripe.client, isStripeConfigured: () => stripe.configured }))
// Store plans resolve their Stripe price by lookup key (lib/stripe/store-prices.ts).
const ensurePlanPriceId = vi.fn()
vi.mock('@/lib/stripe/store-prices', () => ({ ensurePlanPriceId: (...a: unknown[]) => ensurePlanPriceId(...a) }))
vi.mock('@/lib/email/client', () => ({ sendEmail: vi.fn() }))

const enforceRateLimit = vi.fn()
vi.mock('@/lib/security/rate-limit', () => ({
  RATE_LIMITS: { agentSync: { name: 'agent_sync', limit: 30, windowSeconds: 600 } },
  enforceRateLimit: (...a: unknown[]) => enforceRateLimit(...a),
}))

const ensureAgent = vi.fn()
const syncAgentProviders = vi.fn()
vi.mock('@/lib/agents/ensure-agent', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/agents/ensure-agent')>()
  return {
    ...actual,
    ensureAgent: (...a: unknown[]) => ensureAgent(...a),
    syncAgentProviders: (...a: unknown[]) => syncAgentProviders(...a),
  }
})

import { POST } from '@/app/api/onboarding/complete/route'
import { RequestError } from '@/lib/api/http'
import { PLANS } from '@/types'

const baseAgent = {
  id: AGENT,
  org_id: ORG,
  name: 'Ana',
  language: 'en',
  system_prompt: null,
  first_message: 'Hello there!',
  is_active: false,
  metadata: {},
  primary_provider: 'elevenlabs',
}

const handler: Handler = (c) => {
  if (c.table === 'organizations' && c.op === 'select') return { data: { id: ORG, ...state.org }, error: null }
  return { data: null, error: null }
}

const complete = (body: unknown) =>
  POST(new Request('http://localhost/api/onboarding/complete', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  }))

const activations = () =>
  state.user!.calls.filter((c: FakeCall) => c.table === 'agents' && c.op === 'update' && (c.payload as { is_active?: boolean }).is_active === true)

/** The service-role organizations update that records plan + onboarding position. */
const orgUpdates = () =>
  state.admin!.calls.filter((c: FakeCall) => c.table === 'organizations' && c.op === 'update').map((c) => c.payload as Record<string, unknown>)

const sameAgent = { name: 'Ana', language: 'en', system_prompt: '', first_message: 'Hello there!' }

beforeEach(() => {
  state.user = fakeDb(handler)
  state.admin = fakeDb(() => ({ data: null, error: null }))
  state.org = { name: 'Acme', industry: null, website: null, description: null, stripe_customer_id: null, onboarding_completed: false }
  ensureAgent.mockReset().mockResolvedValue({ ...baseAgent })
  syncAgentProviders.mockReset().mockResolvedValue([{ provider: 'elevenlabs', status: 'ready', error: null }])
  enforceRateLimit.mockReset().mockResolvedValue(undefined)
  stripe.configured = false
  stripe.client.customers.create.mockReset().mockResolvedValue({ id: 'cus_test' })
  stripe.client.checkout.sessions.create.mockReset().mockResolvedValue({ url: 'https://checkout.stripe.test/s' })
  ensurePlanPriceId.mockReset().mockResolvedValue('price_store_starter_month')
})

describe('POST /api/onboarding/complete', () => {
  it('primary ready → activates and reports activated', async () => {
    const body = await (await complete({ plan: 'trial', agent: sameAgent })).json()
    expect(body).toMatchObject({ success: true, activated: true, warning: null })
    expect(activations()).toHaveLength(1)
    expect(enforceRateLimit).toHaveBeenCalledWith(expect.objectContaining({ name: 'agent_sync' }), ORG, expect.any(String))
  })

  it('primary failed → not activated, warning from the primary provider', async () => {
    syncAgentProviders.mockResolvedValue([
      { provider: 'elevenlabs', status: 'failed', error: 'Synchronisation with the voice provider failed. Please try again.' },
      { provider: 'cartesia', status: 'pending', error: null },
    ])
    const body = await (await complete({ plan: 'trial', agent: sameAgent })).json()
    expect(body).toMatchObject({ activated: false, primary_provider: 'elevenlabs', warning: expect.stringContaining('failed') })
    expect(activations()).toHaveLength(0)
  })

  it('uses the actual primary provider (cartesia)', async () => {
    ensureAgent.mockResolvedValue({ ...baseAgent, primary_provider: 'cartesia' })
    syncAgentProviders.mockResolvedValue([{ provider: 'cartesia', status: 'skipped', error: 'Not configured.' }])
    const body = await (await complete({ plan: 'trial', agent: sameAgent })).json()
    expect(body).toMatchObject({ activated: false, primary_provider: 'cartesia', warning: 'Not configured.' })
    expect(syncAgentProviders).toHaveBeenCalledWith(expect.objectContaining({ primaryProvider: 'cartesia' }))
  })

  it('already onboarded and nothing provider-relevant changed → no bump/sync, no rate-limit hit', async () => {
    state.org.onboarding_completed = true
    ensureAgent.mockResolvedValue({ ...baseAgent, is_active: true })
    const body = await (await complete({ plan: 'trial', company: { name: 'Acme' }, agent: { ...sameAgent, personality: 'friendly' } })).json()
    expect(body).toMatchObject({ success: true, activated: true, sync: [] })
    expect(syncAgentProviders).not.toHaveBeenCalled()
    expect(enforceRateLimit).not.toHaveBeenCalled()
  })

  it('already onboarded but the agent changed → syncs again', async () => {
    state.org.onboarding_completed = true
    await complete({ plan: 'trial', agent: { ...sameAgent, name: 'Maria' } })
    expect(syncAgentProviders).toHaveBeenCalledWith(expect.objectContaining({ bump: true }))
  })

  it('agent and company names may not reference platform variables (400, nothing written)', async () => {
    for (const body of [
      { plan: 'trial', agent: { ...sameAgent, name: 'Ana {{secret__ntv_call_token}}' } },
      { plan: 'trial', company: { name: 'Acme {{ntv_call_id}}' }, agent: sameAgent },
    ]) {
      expect((await complete(body)).status).toBe(400)
    }
    expect(state.user!.calls.filter((c: FakeCall) => c.op === 'update')).toHaveLength(0)
    expect(syncAgentProviders).not.toHaveBeenCalled()
  })

  it('rate limited → 429 before anything is written', async () => {
    enforceRateLimit.mockRejectedValue(new RequestError('rate_limited', 'Too many launch attempts.', 429))
    const res = await complete({ plan: 'trial', company: { name: 'Other' }, agent: sameAgent })
    expect(res.status).toBe(429)
    expect(state.user!.calls.filter((c: FakeCall) => c.op === 'update')).toHaveLength(0)
    expect(syncAgentProviders).not.toHaveBeenCalled()
  })

  // The route is shared by both onboardings: the resume position it records
  // must be the launch step of the flow the org is actually in.
  describe('onboarding_step per business type', () => {
    it('service org (explicit or legacy backfill) → the service launch step (4)', async () => {
      for (const businessType of ['services', undefined]) {
        state.admin = fakeDb(() => ({ data: null, error: null }))
        state.org = { ...state.org, business_type: businessType }
        expect((await complete({ plan: 'trial', agent: sameAgent })).status).toBe(200)
        expect(orgUpdates()).toEqual([expect.objectContaining({ onboarding_step: 4, onboarding_completed: true, plan: 'trial' })])
      }
    })

    it('e-commerce org on a paid store plan → stays on the store launch step (6) until the billing webhook completes it', async () => {
      state.org.business_type = 'ecommerce'
      stripe.configured = true
      const body = await (await complete({ plan: 'store_starter', agent: sameAgent })).json()
      expect(body).toMatchObject({ success: true, checkout_url: 'https://checkout.stripe.test/s' })
      // The cancel_url is /onboarding: with step 4 the store flow would reopen the automations step.
      expect(orgUpdates()[0]).toEqual(expect.objectContaining({ onboarding_step: 6, onboarding_completed: false, plan: 'trial' }))
      expect(orgUpdates().some((p) => p.onboarding_completed === true)).toBe(false)
      // The price needs no env id: found or created by lookup key, and the plan is stamped on the subscription.
      expect(ensurePlanPriceId).toHaveBeenCalledWith('store_starter', 'month')
      expect(stripe.client.checkout.sessions.create).toHaveBeenCalledWith(expect.objectContaining({
        line_items: [{ price: 'price_store_starter_month', quantity: 1 }],
        subscription_data: expect.objectContaining({ metadata: { org_id: ORG, ntv_plan: 'store_starter' } }),
      }))
    })

    it('service org on a paid service plan → the env price id, the plan stamped on the subscription', async () => {
      stripe.configured = true
      const priceId = PLANS.pro.stripe_price_id_annual
      PLANS.pro.stripe_price_id_annual = 'price_pro_year'
      try {
        const body = await (await complete({ plan: 'pro', annual: true, agent: sameAgent })).json()
        expect(body).toMatchObject({ success: true, checkout_url: 'https://checkout.stripe.test/s' })
      } finally {
        PLANS.pro.stripe_price_id_annual = priceId
      }
      expect(ensurePlanPriceId).not.toHaveBeenCalled()
      expect(stripe.client.checkout.sessions.create).toHaveBeenCalledWith(expect.objectContaining({
        line_items: [{ price: 'price_pro_year', quantity: 1 }],
        subscription_data: expect.objectContaining({ metadata: { org_id: ORG, ntv_plan: 'pro' } }),
      }))
    })

    it('e-commerce org on the trial plan → completed at the store launch step (6)', async () => {
      state.org.business_type = 'ecommerce'
      expect((await complete({ plan: 'trial', agent: sameAgent })).status).toBe(200)
      expect(orgUpdates()).toEqual([expect.objectContaining({ onboarding_step: 6, onboarding_completed: true })])
    })
  })

  // An online store may only launch on the trial or a store plan, every other
  // organization only on the trial or a service plan.
  describe('plan family (409 plan_not_available)', () => {
    it('a store plan is refused to a service org (explicit or legacy NULL) before anything is written', async () => {
      for (const businessType of ['services', undefined]) {
        state.user = fakeDb(handler)
        state.org = { ...state.org, business_type: businessType }
        const res = await complete({ plan: 'store_growth', company: { name: 'Other' }, agent: sameAgent })
        expect(res.status).toBe(409)
        expect(await res.json()).toMatchObject({
          code: 'plan_not_available',
          error: 'This plan is not available for your type of business.',
          details: { reason: 'plan_not_available', plan: 'store_growth', business_type: businessType ?? null },
        })
        expect(state.user!.calls.filter((c: FakeCall) => c.op === 'update')).toHaveLength(0)
      }
      expect(ensureAgent).not.toHaveBeenCalled()
      expect(syncAgentProviders).not.toHaveBeenCalled()
      expect(orgUpdates()).toEqual([])
    })

    it('a service plan is refused to an e-commerce org', async () => {
      state.org.business_type = 'ecommerce'
      for (const plan of ['starter', 'pro', 'business', 'custom']) {
        const res = await complete({ plan, agent: sameAgent })
        expect(res.status, plan).toBe(409)
        expect(await res.json()).toMatchObject({ code: 'plan_not_available' })
      }
      expect(syncAgentProviders).not.toHaveBeenCalled()
      expect(orgUpdates()).toEqual([])
    })

    it('a plan id outside the catalogue is a 400', async () => {
      expect((await complete({ plan: 'enterprise-hack', agent: sameAgent })).status).toBe(400)
    })
  })

  describe('store plans and Stripe', () => {
    it('a store price that cannot be resolved falls back to the trial instead of granting the plan for free', async () => {
      state.org.business_type = 'ecommerce'
      stripe.configured = true
      ensurePlanPriceId.mockRejectedValue(new Error('Stripe is down'))
      const body = await (await complete({ plan: 'store_scale', agent: sameAgent })).json()
      expect(body).toMatchObject({ success: true, redirect: expect.stringContaining('/dashboard') })
      expect(body.checkout_url).toBeUndefined()
      expect(orgUpdates()).toEqual([expect.objectContaining({ plan: 'trial', minutes_limit: PLANS.trial.minutes_limit, onboarding_completed: true, onboarding_step: 6 })])
      expect(stripe.client.checkout.sessions.create).not.toHaveBeenCalled()
    })

    it('the sales-led Store Enterprise lands on the trial without touching Stripe', async () => {
      state.org.business_type = 'ecommerce'
      stripe.configured = true
      expect((await complete({ plan: 'store_enterprise', agent: sameAgent })).status).toBe(200)
      expect(ensurePlanPriceId).not.toHaveBeenCalled()
      expect(orgUpdates()).toEqual([expect.objectContaining({ plan: 'trial', onboarding_completed: true })])
    })

    it('without Stripe (demo mode) the store plan is granted directly with its minutes', async () => {
      state.org.business_type = 'ecommerce'
      expect((await complete({ plan: 'store_growth', agent: sameAgent })).status).toBe(200)
      expect(ensurePlanPriceId).not.toHaveBeenCalled()
      expect(orgUpdates()).toEqual([expect.objectContaining({ plan: 'store_growth', minutes_limit: PLANS.store_growth.minutes_limit, onboarding_completed: true })])
    })
  })
})
