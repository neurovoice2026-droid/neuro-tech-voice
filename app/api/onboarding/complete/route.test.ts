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
vi.mock('@/lib/stripe/client', () => ({ getStripeClient: () => ({}), isStripeConfigured: () => false }))
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

const sameAgent = { name: 'Ana', language: 'en', system_prompt: '', first_message: 'Hello there!' }

beforeEach(() => {
  state.user = fakeDb(handler)
  state.admin = fakeDb(() => ({ data: null, error: null }))
  state.org = { name: 'Acme', industry: null, website: null, description: null, stripe_customer_id: null, onboarding_completed: false }
  ensureAgent.mockReset().mockResolvedValue({ ...baseAgent })
  syncAgentProviders.mockReset().mockResolvedValue([{ provider: 'elevenlabs', status: 'ready', error: null }])
  enforceRateLimit.mockReset().mockResolvedValue(undefined)
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
})
