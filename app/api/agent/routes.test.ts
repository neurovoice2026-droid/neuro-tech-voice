import { beforeEach, describe, expect, it, vi } from 'vitest'
import { fakeDb, filterOf, type FakeCall, type Handler } from '@/tests/helpers/fake-db'
import { DEFAULT_CONVERSATION_SETTINGS } from '@/lib/voice-providers/types'

vi.hoisted(() => {
  // PLANS reads price ids at module load.
  process.env.STRIPE_PRO_PRICE_ID = 'price_pro'
  process.env.STRIPE_STARTER_PRICE_ID = 'price_starter'
})

const ORG = '11111111-1111-4111-8111-111111111111'
const AGENT = '22222222-2222-4222-8222-222222222222'

const state: {
  user: ReturnType<typeof fakeDb> | null
  admin: ReturnType<typeof fakeDb> | null
  deferred: Promise<unknown>[]
} = { user: null, admin: null, deferred: [] }

vi.mock('@/lib/api/auth', () => ({
  requireOrg: async () => ({
    supabase: state.user,
    user: { id: 'u1', email: 'o@example.com' },
    org: { id: ORG, name: 'Acme', timezone: 'UTC', plan: 'trial' },
  }),
}))
vi.mock('@/lib/supabase/admin', () => ({ createAdminClient: () => state.admin }))
vi.mock('@/lib/observability/telemetry', () => ({
  deferBackground: (p: Promise<unknown>) => state.deferred.push(p),
  emitProviderEvent: () => {},
}))

const ensureAgent = vi.fn()
const syncAgentProviders = vi.fn()
const hasExternalAgent = vi.fn()
vi.mock('@/lib/agents/ensure-agent', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/agents/ensure-agent')>()
  return {
    ...actual,
    ensureAgent: (...a: unknown[]) => ensureAgent(...a),
    syncAgentProviders: (...a: unknown[]) => syncAgentProviders(...a),
    hasExternalAgent: (...a: unknown[]) => hasExternalAgent(...a),
  }
})

const cartesiaConfigured = { value: false }
const voicesGet = vi.fn()
vi.mock('@/lib/cartesia/client', () => ({
  isConfigured: () => cartesiaConfigured.value,
  voices: { get: (...a: unknown[]) => voicesGet(...a) },
}))

const stripe = {
  customers: { create: vi.fn() },
  checkout: { sessions: { create: vi.fn() } },
  billingPortal: { sessions: { create: vi.fn() } },
}
const stripeConfigured = { value: true }
vi.mock('@/lib/stripe/client', () => ({
  getStripeClient: () => stripe,
  isStripeConfigured: () => stripeConfigured.value,
}))
const sendEmail = vi.fn()
vi.mock('@/lib/email/client', () => ({ sendEmail: (...a: unknown[]) => sendEmail(...a) }))

import { GET as getAgent, PATCH as patchAgent } from '@/app/api/agent/route'
import { POST as toggle } from '@/app/api/agent/toggle/route'
import { POST as onboardingVoice } from '@/app/api/onboarding/voice/route'
import { POST as onboardingAgent } from '@/app/api/onboarding/agent/route'
import { POST as onboardingCompany } from '@/app/api/onboarding/company/route'
import { POST as onboardingComplete } from '@/app/api/onboarding/complete/route'
import { POST as billingCheckout } from '@/app/api/billing/checkout/route'
import { POST as phoneCheckout } from '@/app/api/phone/checkout/route'

const baseAgent = {
  id: AGENT,
  org_id: ORG,
  name: 'Acme Agent',
  language: 'en',
  system_prompt: null,
  first_message: null,
  fallback_message: null,
  is_active: false,
  working_hours: {},
  metadata: { behavior_settings: { x: 1 }, personality: 'professional' },
  primary_provider: 'elevenlabs',
  fallback_provider: 'cartesia',
  fallback_voice_id: null,
  conversation_settings: {},
}

function req(url: string, method: string, body?: unknown, headers: Record<string, string> = {}) {
  return new Request(`http://localhost${url}`, {
    method,
    headers: { 'content-type': 'application/json', ...headers },
    body: body === undefined ? undefined : JSON.stringify(body),
  })
}

const userHandler: Handler = (c) => {
  if (c.table === 'agents' && c.op === 'select') return { data: { ...baseAgent, name: 'fresh' }, error: null }
  if (c.table === 'organizations' && c.op === 'select')
    return { data: { id: ORG, name: 'Acme', industry: null, website: null, description: null, stripe_customer_id: null, timezone: 'UTC', voice_fallback_enabled: true }, error: null }
  if (c.op === 'update') return { data: c.table === 'agents' ? { ...baseAgent, ...(c.payload as object) } : null, error: null }
  return { data: null, error: null }
}

beforeEach(() => {
  state.user = fakeDb(userHandler)
  state.admin = fakeDb(() => ({ data: null, error: null }))
  state.deferred = []
  ensureAgent.mockReset().mockResolvedValue({ ...baseAgent })
  syncAgentProviders.mockReset().mockResolvedValue([
    { provider: 'elevenlabs', status: 'ready', error: null },
    { provider: 'cartesia', status: 'pending', error: null },
  ])
  hasExternalAgent.mockReset().mockResolvedValue(false)
  voicesGet.mockReset()
  cartesiaConfigured.value = false
  stripeConfigured.value = true
  stripe.customers.create.mockReset().mockResolvedValue({ id: 'cus_1' })
  stripe.checkout.sessions.create.mockReset().mockResolvedValue({ url: 'https://checkout.stripe.test/x' })
  sendEmail.mockReset().mockResolvedValue(true)
})

const updates = (db: ReturnType<typeof fakeDb>, table: string): FakeCall[] => db.calls.filter((c) => c.table === table && c.op === 'update')

describe('GET /api/agent', () => {
  it('returns ensureAgent result', async () => {
    const res = await getAgent(req('/api/agent', 'GET'))
    expect(res.status).toBe(200)
    expect((await res.json()).id).toBe(AGENT)
    expect(ensureAgent).toHaveBeenCalledWith(ORG, 'Acme Agent')
  })
})

describe('PATCH /api/agent', () => {
  it('rejects voice_id', async () => {
    const res = await patchAgent(req('/api/agent', 'PATCH', { voice_id: 'abc' }))
    expect(res.status).toBe(400)
    expect(updates(state.user!, 'agents')).toHaveLength(0)
  })

  it('rejects unknown metadata keys and bad language/timezone', async () => {
    for (const body of [
      { metadata: { personality: 'friendly', behavior_settings: {} } },
      { language: 'xx' },
      { organization: { timezone: 'Mars/Base' } },
      { name: '' },
      { first_message: 'x'.repeat(1001) },
      { fallback_message: 'x'.repeat(501) },
      { conversation_settings: { allow_interruptions: true } },
    ]) {
      const res = await patchAgent(req('/api/agent', 'PATCH', body))
      expect(res.status, JSON.stringify(body)).toBe(400)
    }
  })

  it('rejects cross-site requests', async () => {
    const res = await patchAgent(req('/api/agent', 'PATCH', { name: 'x' }, { origin: 'https://evil.example' }))
    expect(res.status).toBe(403)
  })

  it('saves a provider field, bumps + syncs, returns {agent, sync}', async () => {
    const res = await patchAgent(req('/api/agent', 'PATCH', { name: 'New name', first_message: '  ' }))
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.sync).toHaveLength(2)
    expect(body.agent.name).toBe('fresh')
    const [u] = updates(state.user!, 'agents')
    expect(u.payload).toEqual({ name: 'New name', first_message: null })
    expect(filterOf(u, 'org_id')).toBe(ORG)
    expect(syncAgentProviders).toHaveBeenCalledWith(expect.objectContaining({ bump: true, primary: true, fallback: true, agentId: AGENT, orgId: ORG }))
  })

  it('local-only fields do not sync; metadata is merged', async () => {
    const res = await patchAgent(req('/api/agent', 'PATCH', { working_hours: { monday: { start: '09:00', end: '17:00', enabled: true } }, metadata: { personality: 'friendly' } }))
    expect(res.status).toBe(200)
    expect((await res.json()).sync).toEqual([])
    const [u] = updates(state.user!, 'agents')
    expect(u.payload).toMatchObject({ metadata: { behavior_settings: { x: 1 }, personality: 'friendly' } })
    expect(syncAgentProviders).not.toHaveBeenCalled()
  })

  it('unchanged provider value does not sync', async () => {
    const res = await patchAgent(req('/api/agent', 'PATCH', { name: 'Acme Agent', language: 'en' }))
    expect(res.status).toBe(200)
    expect(syncAgentProviders).not.toHaveBeenCalled()
  })

  it('org timezone change writes org + bumps; fallback turned on defers fallback only', async () => {
    state.user = fakeDb((c) =>
      c.table === 'organizations' && c.op === 'select'
        ? { data: { timezone: 'UTC', voice_fallback_enabled: false }, error: null }
        : userHandler(c),
    )
    let res = await patchAgent(req('/api/agent', 'PATCH', { organization: { timezone: 'Europe/Bucharest' } }))
    expect(res.status).toBe(200)
    expect(updates(state.user!, 'organizations')[0].payload).toEqual({ timezone: 'Europe/Bucharest' })
    expect(syncAgentProviders).toHaveBeenLastCalledWith(expect.objectContaining({ bump: true, primary: true }))

    res = await patchAgent(req('/api/agent', 'PATCH', { organization: { voice_fallback_enabled: true } }))
    expect(res.status).toBe(200)
    expect(syncAgentProviders).toHaveBeenLastCalledWith(expect.objectContaining({ bump: false, primary: false, fallback: true }))
  })

  it('fallback voice: not_found at Cartesia → 400, private unregistered → 400, public → ok', async () => {
    cartesiaConfigured.value = true
    const { ProviderError } = await import('@/lib/voice-providers/errors')
    voicesGet.mockRejectedValueOnce(new ProviderError({ system: 'cartesia', operation: 'voices.get', code: 'not_found' }))
    let res = await patchAgent(req('/api/agent', 'PATCH', { fallback_voice_id: '34acfaee-c556-41ee-a5f6-c687fb20357c' }))
    expect(res.status).toBe(400)

    voicesGet.mockResolvedValueOnce({ id: '34acfaee-c556-41ee-a5f6-c687fb20357c', name: 'x', is_owner: true, status: 'active' })
    res = await patchAgent(req('/api/agent', 'PATCH', { fallback_voice_id: '34acfaee-c556-41ee-a5f6-c687fb20357c' }))
    expect(res.status).toBe(400)

    voicesGet.mockResolvedValueOnce({ id: '34acfaee-c556-41ee-a5f6-c687fb20357c', name: 'x', is_owner: false, status: 'active' })
    res = await patchAgent(req('/api/agent', 'PATCH', { fallback_voice_id: '34acfaee-c556-41ee-a5f6-c687fb20357c' }))
    expect(res.status).toBe(200)
    // Platform-managed column: written with the service role after the eligibility check, never with the tenant client.
    expect(updates(state.admin!, 'agents')[0].payload).toEqual({ fallback_voice_id: '34acfaee-c556-41ee-a5f6-c687fb20357c' })
    expect(updates(state.user!, 'agents')).toHaveLength(0)
  })

  it('provider errors other than not_found are safe 5xx without upstream body', async () => {
    cartesiaConfigured.value = true
    const { ProviderError } = await import('@/lib/voice-providers/errors')
    voicesGet.mockRejectedValueOnce(new ProviderError({ system: 'cartesia', operation: 'voices.get', code: 'upstream', detail: 'SECRET BODY' }))
    const res = await patchAgent(req('/api/agent', 'PATCH', { fallback_voice_id: '34acfaee-c556-41ee-a5f6-c687fb20357c' }))
    expect(res.status).toBe(502)
    expect(await res.text()).not.toContain('SECRET')
  })

  it('conversation behaviour settings: validated, saved and synced; voice tuning reset to default saved as null', async () => {
    const conversation = {
      ...DEFAULT_CONVERSATION_SETTINGS,
      additional_languages: ['ro', 'de'],
      asr_keywords: ['  Dr.  Ionescu ', 'Str. Eminescu'],
      soft_timeout_fillers: false,
      ignore_backchannels: true,
      skip_turn: false,
      background_voice_detection: true,
    }
    const res = await patchAgent(req('/api/agent', 'PATCH', { conversation_settings: conversation, voice_settings: { stability: 0.4, similarity_boost: null, speed: 1.1 } }))
    expect(res.status).toBe(200)
    const [u] = updates(state.user!, 'agents')
    expect(u.payload).toMatchObject({
      conversation_settings: { additional_languages: ['ro', 'de'], asr_keywords: ['Dr. Ionescu', 'Str. Eminescu'], background_voice_detection: true },
      voice_settings: { stability: 0.4, similarity_boost: null, speed: 1.1 },
    })
    expect(syncAgentProviders).toHaveBeenCalledWith(expect.objectContaining({ bump: true, primary: true }))
  })

  it('rejects invalid conversation behaviour settings and out-of-range voice tuning', async () => {
    for (const body of [
      { conversation_settings: { ...DEFAULT_CONVERSATION_SETTINGS, additional_languages: ['ro', 'de', 'fr', 'it'] } },
      { conversation_settings: { ...DEFAULT_CONVERSATION_SETTINGS, additional_languages: ['tlh'] } },
      { conversation_settings: { ...DEFAULT_CONVERSATION_SETTINGS, asr_keywords: Array.from({ length: 31 }, (_, i) => `k${i}`) } },
      { conversation_settings: { ...DEFAULT_CONVERSATION_SETTINGS, asr_keywords: ['{{secret__x}}'] } },
      { voice_settings: { stability: 2, similarity_boost: null, speed: null } },
      { voice_settings: { stability: null, similarity_boost: null, speed: 1.5 } },
    ]) {
      const res = await patchAgent(req('/api/agent', 'PATCH', body))
      expect(res.status, JSON.stringify(body).slice(0, 120)).toBe(400)
    }
    expect(updates(state.user!, 'agents')).toHaveLength(0)
    expect(syncAgentProviders).not.toHaveBeenCalled()
  })

  it('db error → generic 500', async () => {
    state.user = fakeDb((c) => (c.op === 'update' ? { data: null, error: { message: 'relation secret_table' } } : userHandler(c)))
    const res = await patchAgent(req('/api/agent', 'PATCH', { name: 'x' }))
    expect(res.status).toBe(500)
    expect(await res.text()).not.toContain('secret_table')
  })
})

describe('POST /api/agent/toggle', () => {
  it('activating without external agent triggers sync', async () => {
    const res = await toggle(req('/api/agent/toggle', 'POST', { is_active: true }))
    expect(res.status).toBe(200)
    expect(syncAgentProviders).toHaveBeenCalledWith(expect.objectContaining({ bump: false, primary: true }))
    const body = await res.json()
    expect(body.agent).toBeTruthy()
    expect(body.sync).toHaveLength(2)
  })
  it('deactivating does not sync; bad body 400', async () => {
    let res = await toggle(req('/api/agent/toggle', 'POST', { is_active: false }))
    expect(res.status).toBe(200)
    expect(syncAgentProviders).not.toHaveBeenCalled()
    res = await toggle(req('/api/agent/toggle', 'POST', { is_active: 'yes' }))
    expect(res.status).toBe(400)
  })
})

describe('onboarding', () => {
  it('voice route never writes voice fields', async () => {
    const res = await onboardingVoice(req('/api/onboarding/voice', 'POST', { voice_id: 'v', voice_name: 'n' }))
    expect(res.status).toBe(200)
    expect(updates(state.user!, 'agents')).toHaveLength(0)
    expect(updates(state.user!, 'organizations')[0].payload).toEqual({ onboarding_step: 4 })
  })

  it('agent route validates and makes no sync', async () => {
    let res = await onboardingAgent(req('/api/onboarding/agent', 'POST', { name: 'Ana', language: 'ro', system_prompt: '', first_message: 'Bună ziua', personality: 'friendly' }))
    expect(res.status).toBe(200)
    expect(updates(state.user!, 'agents')[0].payload).toEqual({
      name: 'Ana',
      language: 'ro',
      system_prompt: null,
      first_message: 'Bună ziua',
      metadata: { behavior_settings: { x: 1 }, personality: 'friendly' },
    })
    expect(syncAgentProviders).not.toHaveBeenCalled()
    res = await onboardingAgent(req('/api/onboarding/agent', 'POST', { name: 'Ana', language: 'klingon' }))
    expect(res.status).toBe(400)
  })

  it('company route normalizes website and ensures agent', async () => {
    const res = await onboardingCompany(req('/api/onboarding/company', 'POST', { name: 'Acme SRL', industry: 'technology', website: 'acme.ro', description: 'We do things for people.' }))
    expect(res.status).toBe(200)
    expect(updates(state.user!, 'organizations')[0].payload).toMatchObject({ name: 'Acme SRL', website: 'https://acme.ro', onboarding_step: 2 })
    expect(ensureAgent).toHaveBeenCalledWith(ORG, 'Acme SRL Agent')
  })

  it('complete: paid plan → admin writes plan + customer, voice ignored, sync awaited', async () => {
    vi.stubEnv('STRIPE_PRO_PRICE_ID', 'price_pro')
    // PLANS reads env at module load; use whatever price is configured, else checkout is skipped.
    const res = await onboardingComplete(
      req('/api/onboarding/complete', 'POST', {
        plan: 'pro',
        annual: false,
        company: { name: 'Acme', industry: 'technology', website: '', description: 'desc' },
        agent: { name: 'Ana', language: 'en', system_prompt: '', first_message: 'Hello there!' },
        voice: { voice_id: 'evil', voice_name: 'x' },
      }),
    )
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.success).toBe(true)
    const agentUpdates = updates(state.user!, 'agents')
    for (const u of agentUpdates) expect(u.payload).not.toHaveProperty('voice_id')
    expect(agentUpdates[0].payload).toEqual({ name: 'Ana', language: 'en', system_prompt: null, first_message: 'Hello there!' })
    // primary ready → activated
    expect(agentUpdates.some((u) => (u.payload as { is_active?: boolean }).is_active === true)).toBe(true)
    expect(syncAgentProviders).toHaveBeenCalledWith(expect.objectContaining({ bump: true, primary: true, fallback: true }))
    // plan fields only through the admin client, scoped by org id
    const adminOrgUpdates = updates(state.admin!, 'organizations')
    expect(adminOrgUpdates.length).toBeGreaterThanOrEqual(1)
    for (const u of adminOrgUpdates) expect(filterOf(u, 'id')).toBe(ORG)
    for (const u of updates(state.user!, 'organizations')) {
      expect(u.payload).not.toHaveProperty('plan')
      expect(u.payload).not.toHaveProperty('minutes_limit')
      expect(u.payload).not.toHaveProperty('stripe_customer_id')
    }
    expect(state.deferred.length).toBe(1) // welcome email
  })

  it('complete: bad plan → 400', async () => {
    const res = await onboardingComplete(req('/api/onboarding/complete', 'POST', { plan: 'gold' }))
    expect(res.status).toBe(400)
  })
})

describe('billing', () => {
  it('checkout writes stripe_customer_id via admin scoped by org', async () => {
    vi.stubEnv('STRIPE_STARTER_PRICE_ID', 'price_starter')
    const { PLANS } = await import('@/types')
    const configuredPlan = (['starter', 'pro', 'business'] as const).find((p) => PLANS[p].stripe_price_id)
    if (!configuredPlan) {
      const res = await billingCheckout(req('/api/billing/checkout', 'POST', { plan: 'starter' }))
      expect(res.status).toBe(400) // no price configured in this env
      return
    }
    const res = await billingCheckout(req('/api/billing/checkout', 'POST', { plan: configuredPlan }))
    expect(res.status).toBe(200)
    const [u] = updates(state.admin!, 'organizations')
    expect(u.payload).toEqual({ stripe_customer_id: 'cus_1' })
    expect(filterOf(u, 'id')).toBe(ORG)
  })

  it('checkout rejects invalid plan / cross-site', async () => {
    let res = await billingCheckout(req('/api/billing/checkout', 'POST', { plan: 'custom' }))
    expect(res.status).toBe(400)
    res = await billingCheckout(req('/api/billing/checkout', 'POST', { plan: 'pro' }, { origin: 'https://evil.example' }))
    expect(res.status).toBe(403)
  })

  it('phone checkout: validates number, writes customer via admin, checks agent ownership', async () => {
    let res = await phoneCheckout(req('/api/phone/checkout', 'POST', { number: '0712345678', country: 'RO' }))
    expect(res.status).toBe(400)
    res = await phoneCheckout(req('/api/phone/checkout', 'POST', { number: '+40 712 345 678', country: 'RO' }))
    expect(res.status).toBe(200)
    const [u] = updates(state.admin!, 'organizations')
    expect(u.payload).toEqual({ stripe_customer_id: 'cus_1' })
    const sessionArgs = stripe.checkout.sessions.create.mock.calls[0][0]
    expect(sessionArgs.metadata).toEqual({ type: 'phone_number', org_id: ORG, number: '+40712345678', country: 'RO' })

    state.user = fakeDb((c) => (c.table === 'agents' ? { data: null, error: null } : userHandler(c)))
    res = await phoneCheckout(req('/api/phone/checkout', 'POST', { number: '+40712345678', agent_id: '33333333-3333-4333-8333-333333333333' }))
    expect(res.status).toBe(404)
  })
})
