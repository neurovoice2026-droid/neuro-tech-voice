import { afterEach, describe, expect, it, vi } from 'vitest'

// PLANS reads the Stripe price ids from the environment when types/index.ts
// loads, so each case stubs the environment and imports a fresh module graph.
async function load(prices: Record<string, string> = {}) {
  vi.resetModules()
  for (const name of [
    'STRIPE_STARTER_PRICE_ID',
    'STRIPE_STARTER_ANNUAL_PRICE_ID',
    'STRIPE_PRO_PRICE_ID',
    'STRIPE_PRO_ANNUAL_PRICE_ID',
    'STRIPE_BUSINESS_PRICE_ID',
    'STRIPE_BUSINESS_ANNUAL_PRICE_ID',
  ]) {
    vi.stubEnv(name, prices[name] ?? '')
  }
  return import('./onboarding')
}

afterEach(() => {
  vi.unstubAllEnvs()
})

describe('resolveOnboardingPlan', () => {
  it('never checks out the trial', async () => {
    const { resolveOnboardingPlan } = await load({ STRIPE_PRO_PRICE_ID: 'price_pro' })
    expect(resolveOnboardingPlan({ plan: 'trial', annual: false, stripeConfigured: true })).toEqual({
      priceId: '',
      willCheckout: false,
      effectivePlan: 'trial',
      priceMissing: false,
    })
  })

  it('keeps paid plans on trial until Stripe confirms payment', async () => {
    const { resolveOnboardingPlan } = await load({ STRIPE_PRO_PRICE_ID: 'price_pro', STRIPE_PRO_ANNUAL_PRICE_ID: 'price_pro_year' })
    expect(resolveOnboardingPlan({ plan: 'pro', annual: false, stripeConfigured: true })).toEqual({
      priceId: 'price_pro',
      willCheckout: true,
      effectivePlan: 'trial',
      priceMissing: false,
    })
    expect(resolveOnboardingPlan({ plan: 'pro', annual: true, stripeConfigured: true }).priceId).toBe('price_pro_year')
  })

  it('falls back to the monthly price when no annual price is configured', async () => {
    const { resolveOnboardingPlan } = await load({ STRIPE_STARTER_PRICE_ID: 'price_starter' })
    expect(resolveOnboardingPlan({ plan: 'starter', annual: true, stripeConfigured: true }).priceId).toBe('price_starter')
  })

  it('never grants a paid tier for free when Stripe is set up but the price id is missing', async () => {
    const { resolveOnboardingPlan } = await load({ STRIPE_STARTER_PRICE_ID: 'price_starter' })
    expect(resolveOnboardingPlan({ plan: 'business', annual: false, stripeConfigured: true })).toEqual({
      priceId: '',
      willCheckout: false,
      effectivePlan: 'trial',
      priceMissing: true,
    })
    expect(resolveOnboardingPlan({ plan: 'custom', annual: false, stripeConfigured: true }).priceMissing).toBe(false)
  })

  it('grants the plan directly when Stripe is not configured, but never the custom tier', async () => {
    const { resolveOnboardingPlan } = await load({ STRIPE_BUSINESS_PRICE_ID: 'price_business' })
    expect(resolveOnboardingPlan({ plan: 'business', annual: false, stripeConfigured: false })).toMatchObject({
      willCheckout: false,
      effectivePlan: 'business',
    })
    expect(resolveOnboardingPlan({ plan: 'custom', annual: false, stripeConfigured: true })).toMatchObject({
      willCheckout: false,
      effectivePlan: 'trial',
    })
  })

  it('never grants a paid plan without Stripe in production', async () => {
    const { resolveOnboardingPlan } = await load({})
    expect(resolveOnboardingPlan({ plan: 'business', annual: false, stripeConfigured: false, production: true })).toMatchObject({
      willCheckout: false,
      effectivePlan: 'trial',
      priceMissing: true,
    })
    expect(resolveOnboardingPlan({ plan: 'trial', annual: false, stripeConfigured: false, production: true }).priceMissing).toBe(false)
  })
})

describe('trialEndsAtFor', () => {
  const now = new Date('2026-09-17T10:00:00Z')

  it('starts a 14-day trial when setup finishes', async () => {
    const { trialEndsAtFor } = await load()
    expect(trialEndsAtFor({ onboarding_completed: false }, 'trial', now)).toBe('2026-10-01T10:00:00.000Z')
  })

  it('never extends a trial on a repeated submission and ignores paid plans', async () => {
    const { trialEndsAtFor } = await load()
    expect(trialEndsAtFor({ onboarding_completed: true }, 'trial', now)).toBeUndefined()
    expect(trialEndsAtFor({ onboarding_completed: false }, 'starter', now)).toBeUndefined()
  })

  it('starts the trial from setup when the signup default is still running, but never restarts an expired one', async () => {
    const { trialEndsAtFor } = await load()
    expect(trialEndsAtFor({ onboarding_completed: false, trial_ends_at: '2026-09-25T00:00:00Z' }, 'trial', now)).toBe('2026-10-01T10:00:00.000Z')
    expect(trialEndsAtFor({ onboarding_completed: false, trial_ends_at: '2026-09-01T00:00:00Z' }, 'trial', now)).toBeUndefined()
    expect(trialEndsAtFor({ onboarding_completed: false, trial_ends_at: null }, 'trial', now)).toBe('2026-10-01T10:00:00.000Z')
  })
})

describe('onboardingAgentFields', () => {
  const input = {
    company: { name: 'Zenith Dental', industry: 'healthcare', website: null, description: 'Family dental clinic.', timezone: null },
    agent: { name: 'Mara', language: 'en', system_prompt: null, first_message: null, tone: 'friendly' as const },
  }

  it('writes the industry template when the prompt was left empty and keeps greeting null', async () => {
    const { onboardingAgentFields } = await load()
    const fields = onboardingAgentFields(input, null)
    expect(fields.system_prompt).toContain('medical receptionist for Zenith Dental')
    expect(fields.system_prompt).toContain('Family dental clinic.')
    expect(fields.first_message).toBeNull()
    expect(fields).toMatchObject({ name: 'Mara', language: 'en', tone: 'friendly', cartesia_voice_id: null, cartesia_voice_name: null, is_active: true })
  })

  it('keeps the owner’s own prompt and greeting, and the verified voice', async () => {
    const { onboardingAgentFields } = await load()
    const fields = onboardingAgentFields(
      { ...input, agent: { ...input.agent, system_prompt: 'Custom prompt.', first_message: 'Hello!' } },
      { id: 'voice-1', name: 'Skylar' }
    )
    expect(fields).toMatchObject({ system_prompt: 'Custom prompt.', first_message: 'Hello!', cartesia_voice_id: 'voice-1', cartesia_voice_name: 'Skylar' })
  })

  it('is deterministic, so a repeated submission writes the same row', async () => {
    const { onboardingAgentFields } = await load()
    expect(onboardingAgentFields(input, null)).toEqual(onboardingAgentFields(input, null))
  })

  it('maps onto legacy columns before migration 010, keeping other metadata', async () => {
    const { legacyAgentFields, onboardingAgentFields } = await load()
    const legacy = legacyAgentFields(onboardingAgentFields(input, { id: 'voice-1', name: 'Skylar' }), { behavior_settings: { record_calls: false } })
    expect(legacy).not.toHaveProperty('tone')
    expect(legacy).not.toHaveProperty('cartesia_voice_id')
    expect(legacy.metadata).toEqual({ behavior_settings: { record_calls: false }, personality: 'friendly' })
  })
})
