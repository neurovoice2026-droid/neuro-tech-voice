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
    subscriptions: { list: vi.fn(), retrieve: vi.fn() },
  },
}
vi.mock('@/lib/stripe/client', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/stripe/client')>()),
  getStripeClient: () => stripe.client,
  isStripeConfigured: () => stripe.configured,
}))
// Every self-serve plan resolves its Stripe price through ensurePlanPriceId
// (an env pin validated against PLANS, else by lookup key: lib/stripe/store-prices.ts).
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
  stripe.client.subscriptions.list.mockReset().mockResolvedValue({ data: [], has_more: false })
  stripe.client.subscriptions.retrieve.mockReset().mockRejectedValue(Object.assign(new Error('No such subscription'), { code: 'resource_missing', statusCode: 404 }))
  ensurePlanPriceId.mockReset().mockImplementation(async (plan: string, interval: string) => `price_${plan}_${interval}`)
})

describe('POST /api/onboarding/complete', () => {
  it('primary ready → activates and reports activated', async () => {
    const body = await (await complete({ plan: 'trial', agent: sameAgent })).json()
    expect(body).toMatchObject({ success: true, activated: true, warning: null, plan_notice: null })
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

  // Steps 1-3 save the agent on the server; the wizard's store is the page's only. After a reload,
  // or the return from a cancelled Checkout (cancel_url /onboarding, which reopens the launch step),
  // the store is at its defaults: the launch must push the saved agent, never those defaults.
  describe('a launch from a wizard at its defaults keeps the saved agent', () => {
    const savedAgent = { ...baseAgent, language: 'ro', system_prompt: 'Ești recepționera clinicii.', first_message: 'Bună ziua!', metadata: { personality: 'friendly' } }
    /** What an earlier client sent from a store at its defaults. */
    const defaultsAgent = { name: '', language: 'en', system_prompt: '', first_message: '' }
    const company = { name: 'Acme', industry: 'healthcare', website: '', description: 'A clinic.' }
    /** Every agents write but the activation. */
    const agentEdits = () =>
      state.user!.calls.filter((c: FakeCall) => c.table === 'agents' && c.op === 'update' && !('is_active' in (c.payload as object)))

    beforeEach(() => {
      ensureAgent.mockResolvedValue({ ...savedAgent })
    })

    it.each([
      ['without agent fields (the wizard now)', { plan: 'trial', annual: false, company }],
      ['with the store defaults (an earlier wizard)', { plan: 'trial', annual: false, company, agent: defaultsAgent }],
    ])('reload, then launch on the trial %s: prompt, greeting, language and personality untouched', async (_label, body) => {
      const res = await (await complete(body)).json()
      expect(res).toMatchObject({ success: true, activated: true })
      expect(agentEdits()).toEqual([])
      // Onboarding is not complete: the saved agent is still pushed and switched on.
      expect(syncAgentProviders).toHaveBeenCalledWith(expect.objectContaining({ agentId: AGENT, bump: true }))
      expect(activations()).toHaveLength(1)
    })

    it.each([
      ['without agent fields (the wizard now)', { plan: 'pro', annual: false, company }],
      ['with the store defaults (an earlier wizard)', { plan: 'pro', annual: false, company, agent: defaultsAgent }],
    ])('back from a cancelled Checkout, launch again %s: the saved agent is pushed and Checkout reopens', async (_label, body) => {
      // The first launch created the customer and left onboarding open at the launch step.
      stripe.configured = true
      state.org = { ...state.org, stripe_customer_id: 'cus_1', stripe_subscription_id: null, onboarding_completed: false }
      const res = await (await complete(body)).json()
      expect(res).toMatchObject({ success: true, checkout_url: 'https://checkout.stripe.test/s' })
      expect(agentEdits()).toEqual([])
      expect(syncAgentProviders).toHaveBeenCalledWith(expect.objectContaining({ agentId: AGENT, bump: true }))
      expect(orgUpdates()[0]).toEqual(expect.objectContaining({ onboarding_completed: false, onboarding_step: 4 }))
      expect(stripe.client.customers.create).not.toHaveBeenCalled()
    })

    it('an agent the client does hold (it has a name) is still saved as sent', async () => {
      await complete({ plan: 'trial', agent: { name: 'Maria', language: 'es', system_prompt: '', first_message: 'Hola!' } })
      expect(agentEdits().map((c) => c.payload)).toEqual([{ name: 'Maria', language: 'es', system_prompt: null, first_message: 'Hola!' }])
    })
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

    it('service org on a paid service plan → the price PLANS validates for the chosen interval, the plan stamped on the subscription', async () => {
      stripe.configured = true
      const body = await (await complete({ plan: 'pro', annual: true, agent: sameAgent })).json()
      expect(body).toMatchObject({ success: true, checkout_url: 'https://checkout.stripe.test/s' })
      // The annual price, never the monthly one in its place.
      expect(ensurePlanPriceId).toHaveBeenCalledWith('pro', 'year')
      expect(stripe.client.checkout.sessions.create).toHaveBeenCalledWith(expect.objectContaining({
        line_items: [{ price: 'price_pro_year', quantity: 1 }],
        subscription_data: expect.objectContaining({ metadata: { org_id: ORG, ntv_plan: 'pro' } }),
      }))
    })

    it.each(['growth', 'scale'] as const)('the homepage rung %s launches through checkout like every self-serve service plan', async (plan) => {
      stripe.configured = true
      const body = await (await complete({ plan, agent: sameAgent })).json()
      expect(body).toMatchObject({ success: true, checkout_url: 'https://checkout.stripe.test/s' })
      expect(ensurePlanPriceId).toHaveBeenCalledWith(plan, 'month')
      expect(orgUpdates()[0]).toEqual(expect.objectContaining({ plan: 'trial', onboarding_completed: false, onboarding_step: 4 }))
      expect(stripe.client.checkout.sessions.create).toHaveBeenCalledWith(expect.objectContaining({
        line_items: [{ price: `price_${plan}_month`, quantity: 1 }],
        subscription_data: expect.objectContaining({ metadata: { org_id: ORG, ntv_plan: plan } }),
      }))
    })

    it('without Stripe (demo mode) Growth and Scale are granted directly with their own minutes', async () => {
      for (const plan of ['growth', 'scale'] as const) {
        state.admin = fakeDb(() => ({ data: null, error: null }))
        expect((await complete({ plan, agent: sameAgent })).status).toBe(200)
        expect(orgUpdates()).toEqual([expect.objectContaining({ plan, minutes_limit: PLANS[plan].minutes_limit, onboarding_completed: true })])
      }
      expect(PLANS.growth.minutes_limit).toBe(1000)
      expect(PLANS.scale.minutes_limit).toBe(15000)
      expect(ensurePlanPriceId).not.toHaveBeenCalled()
    })

    it('Enterprise (custom) is sales-led: the trial, no Stripe, no notice', async () => {
      stripe.configured = true
      const body = await (await complete({ plan: 'custom', agent: sameAgent })).json()
      expect(body.plan_notice).toBeNull()
      expect(ensurePlanPriceId).not.toHaveBeenCalled()
      expect(orgUpdates()).toEqual([expect.objectContaining({ plan: 'trial', onboarding_completed: true })])
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
      for (const plan of ['starter', 'growth', 'pro', 'business', 'scale', 'custom']) {
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
      // The launch goes ahead on the trial, and the client is told the paid plan was not started.
      expect(body).toMatchObject({ success: true, redirect: expect.stringContaining('/dashboard'), plan_notice: 'price_unavailable' })
      expect(body.checkout_url).toBeUndefined()
      expect(orgUpdates()).toEqual([expect.objectContaining({ plan: 'trial', minutes_limit: PLANS.trial.minutes_limit, onboarding_completed: true, onboarding_step: 6 })])
      expect(stripe.client.checkout.sessions.create).not.toHaveBeenCalled()
    })

    it('the sales-led Store Enterprise lands on the trial without touching Stripe (no notice: sales sets it up)', async () => {
      state.org.business_type = 'ecommerce'
      stripe.configured = true
      const res = await complete({ plan: 'store_enterprise', agent: sameAgent })
      expect(res.status).toBe(200)
      expect((await res.json()).plan_notice).toBeNull()
      expect(ensurePlanPriceId).not.toHaveBeenCalled()
      expect(orgUpdates()).toEqual([expect.objectContaining({ plan: 'trial', onboarding_completed: true })])
    })

    it('without Stripe (demo mode) the store plan is granted directly with its minutes', async () => {
      state.org.business_type = 'ecommerce'
      const res = await complete({ plan: 'store_growth', agent: sameAgent })
      expect(res.status).toBe(200)
      expect((await res.json()).plan_notice).toBeNull()
      expect(ensurePlanPriceId).not.toHaveBeenCalled()
      expect(orgUpdates()).toEqual([expect.objectContaining({ plan: 'store_growth', minutes_limit: PLANS.store_growth.minutes_limit, onboarding_completed: true })])
    })
  })
  describe('plan_notice: a paid plan that could not be started', () => {
    it('a service plan whose Stripe price cannot be resolved → trial, price_unavailable', async () => {
      stripe.configured = true
      ensurePlanPriceId.mockRejectedValue(new Error('No usable Stripe price for starter (month)'))
      const body = await (await complete({ plan: 'starter', agent: sameAgent })).json()
      expect(body).toMatchObject({ success: true, plan_notice: 'price_unavailable' })
      expect(body.checkout_url).toBeUndefined()
      expect(orgUpdates()).toEqual([expect.objectContaining({ plan: 'trial', minutes_limit: PLANS.trial.minutes_limit, onboarding_completed: true })])
      expect(stripe.client.checkout.sessions.create).not.toHaveBeenCalled()
    })

    it('a checkout that cannot be opened → trial, checkout_unavailable', async () => {
      state.org.business_type = 'ecommerce'
      stripe.configured = true
      stripe.client.checkout.sessions.create.mockRejectedValue(new Error('Stripe is down'))
      const body = await (await complete({ plan: 'store_starter', agent: sameAgent })).json()
      expect(body).toMatchObject({ success: true, redirect: expect.stringContaining('/dashboard'), plan_notice: 'checkout_unavailable' })
      expect(body.checkout_url).toBeUndefined()
      expect(orgUpdates().at(-1)).toEqual(expect.objectContaining({ plan: 'trial', onboarding_completed: true }))
    })

    it('a checkout that opens carries no notice', async () => {
      state.org.business_type = 'ecommerce'
      stripe.configured = true
      const body = await (await complete({ plan: 'store_starter', agent: sameAgent })).json()
      expect(body.checkout_url).toBe('https://checkout.stripe.test/s')
      expect(body.plan_notice).toBeUndefined()
    })
  })

  describe('an organization that already has a plan subscription keeps it (stale Launch tab, Checkout done elsewhere)', () => {
    /** A Stripe plan subscription of this organization's customer. */
    const planSub = (id: string, status: string) => ({
      id,
      status,
      customer: 'cus_1',
      metadata: { org_id: ORG, ntv_plan: 'scale' },
      items: { data: [{ id: `si_${id}`, price: { id: 'price_scale_month' } }] },
    })

    beforeEach(() => {
      stripe.configured = true
      state.org = { ...state.org, stripe_customer_id: 'cus_1', stripe_subscription_id: 'sub_paid', onboarding_completed: false }
    })

    it.each(['trial', 'starter', 'scale'] as const)('a live subscription: choosing %s rewrites no plan or minutes and opens no Checkout', async (plan) => {
      stripe.client.subscriptions.retrieve.mockResolvedValue(planSub('sub_paid', 'active'))
      const body = await (await complete({ plan, agent: sameAgent })).json()
      expect(body).toMatchObject({ success: true, redirect: expect.stringContaining('/dashboard'), plan_notice: 'subscription_exists' })
      expect(body.checkout_url).toBeUndefined()
      expect(orgUpdates()).toEqual([{ onboarding_completed: true, onboarding_step: 4 }])
      expect(stripe.client.checkout.sessions.create).not.toHaveBeenCalled()
      expect(ensurePlanPriceId).not.toHaveBeenCalled()
      // The agent is still saved and launched.
      expect(activations()).toHaveLength(1)
    })

    it('a subscription with a payment due: no second subscription, the owner is told', async () => {
      state.org = { ...state.org, stripe_subscription_id: null }
      stripe.client.subscriptions.list.mockResolvedValue({ data: [planSub('sub_due', 'past_due')], has_more: false })
      const body = await (await complete({ plan: 'pro', agent: sameAgent })).json()
      expect(body.plan_notice).toBe('payment_due')
      expect(orgUpdates()).toEqual([{ onboarding_completed: true, onboarding_step: 4 }])
      expect(stripe.client.checkout.sessions.create).not.toHaveBeenCalled()
    })

    it('when Stripe cannot say, the plan is left as it is and no Checkout is opened', async () => {
      vi.spyOn(console, 'error').mockImplementation(() => {})
      stripe.client.subscriptions.retrieve.mockRejectedValue(Object.assign(new Error('Stripe is down'), { statusCode: 503 }))
      const body = await (await complete({ plan: 'pro', agent: sameAgent })).json()
      expect(body.plan_notice).toBe('checkout_unavailable')
      expect(orgUpdates()).toEqual([{ onboarding_completed: true, onboarding_step: 4 }])
      expect(stripe.client.checkout.sessions.create).not.toHaveBeenCalled()
    })

    it('a customer whose earlier plan subscription ended gets a Checkout without a second free trial', async () => {
      state.org = { ...state.org, stripe_subscription_id: null }
      stripe.client.subscriptions.list.mockResolvedValue({ data: [planSub('sub_old', 'canceled')], has_more: false })
      const body = await (await complete({ plan: 'pro', agent: sameAgent })).json()
      expect(body.checkout_url).toBe('https://checkout.stripe.test/s')
      const params = stripe.client.checkout.sessions.create.mock.calls[0][0] as { subscription_data: Record<string, unknown> }
      expect(params.subscription_data).not.toHaveProperty('trial_period_days')
      expect(params.subscription_data.metadata).toEqual({ org_id: ORG, ntv_plan: 'pro' })
    })

    it('a customer that never had a plan subscription still gets the 14 free days', async () => {
      state.org = { ...state.org, stripe_subscription_id: null }
      await complete({ plan: 'pro', agent: sameAgent })
      expect(stripe.client.checkout.sessions.create).toHaveBeenCalledWith(expect.objectContaining({
        subscription_data: expect.objectContaining({ trial_period_days: 14 }),
      }))
    })
  })
})
