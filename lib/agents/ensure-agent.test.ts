import { beforeEach, describe, expect, it, vi } from 'vitest'
import { fakeDb, filterOf, type Handler } from '@/tests/helpers/fake-db'

const state: { admin: ReturnType<typeof fakeDb> | null; deferred: Promise<unknown>[] } = { admin: null, deferred: [] }

vi.mock('@/lib/supabase/admin', () => ({ createAdminClient: () => state.admin }))
vi.mock('@/lib/observability/telemetry', () => ({
  deferBackground: (p: Promise<unknown>) => state.deferred.push(p),
  emitProviderEvent: () => {},
}))
const syncAgent = vi.fn()
const bumpRevision = vi.fn()
const providersFor = vi.fn()
vi.mock('@/lib/voice-providers/agent-sync', () => ({
  syncAgent: (...a: unknown[]) => syncAgent(...a),
  bumpRevision: (...a: unknown[]) => bumpRevision(...a),
  providersFor: (...a: unknown[]) => providersFor(...a),
}))
const applyNumberRouting = vi.fn()
vi.mock('@/lib/telephony/binding', () => ({ applyNumberRouting: (...a: unknown[]) => applyNumberRouting(...a) }))
const configured: Record<string, boolean> = { elevenlabs: true, cartesia: true }
vi.mock('@/lib/voice-providers/adapters', () => ({
  lifecycleFor: (p: string) => ({ isConfigured: () => configured[p] }),
}))

import {
  WebsiteSchema,
  blankToNull,
  buildAgentStatusView,
  defaultAgentName,
  ensureAgent,
  mergeMetadata,
  OnboardingAgentSchema,
  syncAgentProviders,
} from '@/lib/agents/ensure-agent'
import { createLogger } from '@/lib/observability/logger'

const log = createLogger({ test: true })
const ORG = '11111111-1111-4111-8111-111111111111'
const AGENT = '22222222-2222-4222-8222-222222222222'

beforeEach(() => {
  state.deferred = []
  syncAgent.mockReset()
  bumpRevision.mockReset()
  providersFor.mockReset()
  applyNumberRouting.mockReset()
})

describe('ensureAgent', () => {
  it('returns the existing (oldest) agent, scoped by org', async () => {
    state.admin = fakeDb(() => ({ data: { id: AGENT, org_id: ORG, name: 'A' }, error: null }))
    const a = await ensureAgent(ORG, 'X Agent')
    expect(a.id).toBe(AGENT)
    expect(state.admin.calls).toHaveLength(1)
    expect(filterOf(state.admin.calls[0], 'org_id')).toBe(ORG)
  })

  it('inserts when missing with voice_sync_status pending', async () => {
    let n = 0
    state.admin = fakeDb((c) => {
      n++
      if (c.op === 'select') return { data: null, error: null }
      return { data: { id: AGENT, org_id: ORG, name: (c.payload as { name: string }).name }, error: null }
    })
    const a = await ensureAgent(ORG, '  Acme Agent ')
    expect(a.name).toBe('Acme Agent')
    expect(state.admin.calls[1].payload).toEqual({ org_id: ORG, name: 'Acme Agent', voice_sync_status: 'pending' })
    expect(n).toBe(2)
  })

  it('re-selects on unique violation (lost race)', async () => {
    let selects = 0
    state.admin = fakeDb((c) => {
      if (c.op === 'insert') return { data: null, error: { message: 'duplicate', code: '23505' } }
      selects++
      return selects === 1 ? { data: null, error: null } : { data: { id: AGENT, org_id: ORG, name: 'Winner' }, error: null }
    })
    const a = await ensureAgent(ORG, 'Mine')
    expect(a.name).toBe('Winner')
  })

  it('throws on other insert errors', async () => {
    state.admin = fakeDb((c) => (c.op === 'insert' ? { data: null, error: { message: 'boom', code: '42501' } } : { data: null, error: null }))
    await expect(ensureAgent(ORG, 'Mine')).rejects.toThrow(/agents insert failed: boom/)
  })

  it('defaultAgentName', () => {
    expect(defaultAgentName('Acme')).toBe('Acme Agent')
    expect(defaultAgentName('  ')).toBe('My Agent')
    expect(defaultAgentName(null)).toBe('My Agent')
    expect(defaultAgentName('x'.repeat(200))).toHaveLength(100)
  })
})

describe('schemas/helpers', () => {
  it('WebsiteSchema normalizes', () => {
    expect(WebsiteSchema.parse('')).toBeNull()
    expect(WebsiteSchema.parse(null)).toBeNull()
    expect(WebsiteSchema.parse('www.site.com')).toBe('https://www.site.com')
    expect(WebsiteSchema.parse('http://site.com/x')).toBe('http://site.com/x')
    expect(WebsiteSchema.safeParse('javascript:alert(1)').success).toBe(false)
    expect(WebsiteSchema.safeParse('ftp://site.com').success).toBe(false)
  })
  it('OnboardingAgentSchema validates language', () => {
    expect(OnboardingAgentSchema.safeParse({ name: 'A', language: 'ro' }).success).toBe(true)
    expect(OnboardingAgentSchema.safeParse({ name: 'A', language: 'xx' }).success).toBe(false)
    expect(OnboardingAgentSchema.safeParse({ name: ' ', language: 'en' }).success).toBe(false)
  })
  it('mergeMetadata / blankToNull', () => {
    expect(mergeMetadata({ a: 1, personality: 'x' }, { personality: 'friendly' })).toEqual({ a: 1, personality: 'friendly' })
    expect(mergeMetadata(null, { personality: 'friendly' })).toEqual({ personality: 'friendly' })
    expect(mergeMetadata([1], { p: 1 })).toEqual({ p: 1 })
    expect(blankToNull('  ')).toBeNull()
    expect(blankToNull(' hi ')).toBe(' hi ')
  })
})

describe('syncAgentProviders', () => {
  const baseHandler: Handler = (c) => {
    if (c.table === 'agent_provider_resources') return { data: [{ provider: 'elevenlabs', external_id: null }], error: null }
    if (c.table === 'phone_numbers') return { data: [], error: null }
    return { data: null, error: null }
  }

  it('bumps, syncs primary now, defers fallback (reported pending)', async () => {
    state.admin = fakeDb(baseHandler)
    providersFor.mockResolvedValue(['elevenlabs', 'cartesia'])
    syncAgent.mockImplementation(async (_id: string, o: { providers: string[] }) =>
      o.providers.map((p) => ({ provider: p, status: 'ready', externalId: 'ext_' + p, appliedVoiceId: null, errorCode: null, error: null })),
    )
    const res = await syncAgentProviders({ supabase: {} as never, orgId: ORG, agentId: AGENT, primaryProvider: 'elevenlabs', bump: true, primary: true, fallback: true, log })
    expect(bumpRevision).toHaveBeenCalledWith(AGENT)
    expect(res).toEqual([
      { provider: 'elevenlabs', status: 'ready', error: null },
      { provider: 'cartesia', status: 'pending', error: null },
    ])
    // Primary awaited first; the fallback sync starts afterwards and is not awaited by the caller.
    expect(syncAgent.mock.calls[0][1].providers).toEqual(['elevenlabs'])
    expect(state.deferred).toHaveLength(1)
    await Promise.all(state.deferred)
    expect(syncAgent).toHaveBeenCalledTimes(2)
    expect(syncAgent.mock.calls[1][1].providers).toEqual(['cartesia'])
  })

  it('reports a provider failure without throwing', async () => {
    state.admin = fakeDb(baseHandler)
    providersFor.mockResolvedValue(['elevenlabs'])
    syncAgent.mockResolvedValue([{ provider: 'elevenlabs', status: 'failed', externalId: null, appliedVoiceId: null, errorCode: 'validation', error: 'The voice provider rejected this configuration.' }])
    const res = await syncAgentProviders({ supabase: {} as never, orgId: ORG, agentId: AGENT, primaryProvider: 'elevenlabs', bump: false, primary: true, fallback: true, log })
    expect(res).toEqual([{ provider: 'elevenlabs', status: 'failed', error: 'The voice provider rejected this configuration.' }])
    expect(bumpRevision).not.toHaveBeenCalled()
  })

  it('an unexpected sync error becomes a failed report', async () => {
    state.admin = fakeDb(baseHandler)
    providersFor.mockResolvedValue(['elevenlabs'])
    syncAgent.mockRejectedValue(new Error('db down'))
    const res = await syncAgentProviders({ supabase: {} as never, orgId: ORG, agentId: AGENT, primaryProvider: 'elevenlabs', bump: false, primary: true, fallback: false, log })
    expect(res[0]).toMatchObject({ provider: 'elevenlabs', status: 'failed' })
    expect(res[0].error).not.toMatch(/db down/)
  })

  it('skipped not_configured gets a safe message', async () => {
    state.admin = fakeDb(baseHandler)
    providersFor.mockResolvedValue(['elevenlabs'])
    syncAgent.mockResolvedValue([{ provider: 'elevenlabs', status: 'skipped', externalId: null, appliedVoiceId: null, errorCode: 'not_configured', error: null }])
    const res = await syncAgentProviders({ supabase: {} as never, orgId: ORG, agentId: AGENT, primaryProvider: 'elevenlabs', bump: false, primary: true, fallback: false, log })
    expect(res[0].status).toBe('skipped')
    expect(res[0].error).toMatch(/not configured/)
  })

  it('rebinds stale numbers after an external agent was created', async () => {
    let resourceReads = 0
    state.admin = fakeDb((c) => {
      if (c.table === 'agent_provider_resources') {
        resourceReads++
        return resourceReads === 1
          ? { data: [], error: null }
          : { data: [{ provider: 'elevenlabs', external_id: 'el1' }, { provider: 'cartesia', external_id: 'ct1' }], error: null }
      }
      if (c.table === 'phone_numbers') {
        expect(filterOf(c, 'org_id')).toBe(ORG)
        return {
          data: [
            { id: 'n-ready', twilio_sid: 'PN1', agent_id: AGENT, routing_mode: 'app_routed', routing_status: 'ready', cartesia_phone_number_id: 'cpn', elevenlabs_phone_number_id: null },
            { id: 'n-mock', twilio_sid: 'mock_1', agent_id: null, routing_mode: 'app_routed', routing_status: 'pending', cartesia_phone_number_id: null, elevenlabs_phone_number_id: null },
            { id: 'n-unbound', twilio_sid: 'PN2', agent_id: null, routing_mode: 'app_routed', routing_status: 'ready', cartesia_phone_number_id: null, elevenlabs_phone_number_id: null },
          ],
          error: null,
        }
      }
      return { data: null, error: null }
    })
    providersFor.mockResolvedValue(['elevenlabs', 'cartesia'])
    syncAgent.mockImplementation(async (_id: string, o: { providers: string[] }) =>
      o.providers.map((p) => ({ provider: p, status: 'ready', externalId: 'x', appliedVoiceId: null, errorCode: null, error: null })),
    )
    applyNumberRouting.mockResolvedValue({ status: 'ready', steps: [] })
    await syncAgentProviders({ supabase: {} as never, orgId: ORG, agentId: AGENT, primaryProvider: 'elevenlabs', bump: true, primary: true, fallback: true, log })
    await Promise.all(state.deferred)
    // n-ready is rebound too because the cartesia agent was (re)created.
    expect(applyNumberRouting.mock.calls.map((c) => c[0]).sort()).toEqual(['n-ready', 'n-unbound'])
  })
})

describe('buildAgentStatusView', () => {
  it('maps providers, voice, numbers and sanitizes errors', async () => {
    const user = fakeDb((c) => {
      if (c.table === 'agents') return { data: { primary_provider: 'elevenlabs', fallback_provider: 'cartesia', voice_sync_status: 'failed', voice_sync_error: 'bad key sk_abcdefghijklmnopqrstuvwxyz123456 for +40712345678' }, error: null }
      if (c.table === 'organizations') return { data: { voice_fallback_enabled: false }, error: null }
      if (c.table === 'agent_provider_resources') return { data: [{ provider: 'elevenlabs', status: 'ready', last_synced_at: '2026-01-01', last_error: 'old' }], error: null }
      if (c.table === 'phone_numbers') return { data: [{ id: 'n1', number: '+40712345678', routing_mode: 'app_routed', routing_status: 'degraded', routing_error: 'Call +40712345678 failed' }], error: null }
      return { data: null, error: null }
    })
    providersFor.mockResolvedValue(['elevenlabs'])
    configured.cartesia = true
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const view = await buildAgentStatusView(user as any, ORG, AGENT)
    expect(view.providers).toEqual([
      { provider: 'elevenlabs', role: 'primary', enabled: true, configured: true, status: 'ready', last_synced_at: '2026-01-01', last_error: null },
      { provider: 'cartesia', role: 'fallback', enabled: false, configured: true, status: 'disabled', last_synced_at: null, last_error: null },
    ])
    expect(view.fallback_enabled).toBe(false)
    expect(view.voice.status).toBe('failed')
    expect(view.voice.error).not.toContain('+40712345678')
    expect(view.numbers[0].routing_error).not.toContain('+40712345678')
    expect(view.numbers[0].number).toBe('+40712345678')
  })
})
