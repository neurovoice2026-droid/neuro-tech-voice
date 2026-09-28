import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { Agent, ProviderSyncState } from '@/types'

vi.mock('next/server', () => ({ after: (fn: () => unknown) => void fn() }))
vi.mock('@/lib/knowledge/providers', () => ({ attachAgentKnowledge: vi.fn(async () => ({ cartesia: false, elevenlabs: false })) }))

const kvStore = vi.hoisted(() => new Map<string, unknown>())
vi.mock('@/lib/kv', () => ({
  kvGet: async (key: string) => (kvStore.has(key) ? kvStore.get(key) : null),
  kvSet: async (key: string, value: unknown) => {
    kvStore.set(key, value)
  },
  kvDel: async (key: string) => {
    kvStore.delete(key)
  },
  kvIncr: async (key: string) => {
    const next = ((kvStore.get(key) as number | undefined) ?? 0) + 1
    kvStore.set(key, next)
    return next
  },
}))

const db = vi.hoisted(() => ({ updates: [] as { table: string; values: Record<string, unknown>; filters: [string, unknown][] }[] }))
vi.mock('@/lib/supabase/admin', () => ({
  createAdminClient: () => ({
    from(table: string) {
      return {
        update(values: Record<string, unknown>) {
          const entry = { table, values, filters: [] as [string, unknown][] }
          db.updates.push(entry)
          const chain = {
            eq(column: string, value: unknown) {
              entry.filters.push([column, value])
              return chain
            },
            then(resolve: (value: { error: null }) => unknown) {
              return Promise.resolve({ error: null }).then(resolve)
            },
          }
          return chain
        },
      }
    },
  }),
}))

const ORG_ROW = { id: 'org-1', name: 'Zenith', timezone: 'UTC', plan: 'starter', sms_enabled: true, onboarding_completed: true }
const store = vi.hoisted(() => ({ agent: null as Agent | null, loads: 0, page: [] as Agent[], orgOnboarded: true }))
vi.mock('./agent-store', () => ({
  loadAgentById: async (_admin: unknown, id: string) => {
    store.loads++
    return store.page.find((a) => a.id === id) ?? store.agent
  },
  loadSyncOrg: async () => ORG_ROW,
  loadAgentPage: async (_admin: unknown, offset: number) => (offset === 0 ? store.page : []),
  loadSyncOrgs: async () => new Map([['org-1', { ...ORG_ROW, onboarding_completed: store.orgOnboarded }]]),
}))

vi.mock('./context', () => ({
  loadSyncContexts: async (_admin: unknown, entries: { agent: Agent }[]) =>
    new Map(entries.map((e) => [e.agent.id, { capabilities: {}, services: [], contactsSummary: null }])),
}))

const voiceLookup = vi.hoisted(() => ({ fail: false }))
vi.mock('./voices', () => ({
  getVoiceFacts: async () => {
    if (voiceLookup.fail) throw new Error('Cartesia timed out')
    return { id: 'v', name: 'Nova', gender: 'masculine', is_pro: false, is_owner: false }
  },
}))

const providers = vi.hoisted(() => ({
  cartesia: vi.fn(),
  elevenlabs: vi.fn(),
  deleteCartesia: vi.fn(),
  deleteElevenLabs: vi.fn(),
}))
vi.mock('./cartesia-agent', () => ({
  syncCartesiaAgent: providers.cartesia,
  deleteCartesiaAgent: providers.deleteCartesia,
  cartesiaSyncHash: () => 'hash',
  isEntryCurrent: () => true,
}))
vi.mock('./elevenlabs-standby', () => ({
  syncElevenLabsStandby: providers.elevenlabs,
  deleteElevenLabsAgent: providers.deleteElevenLabs,
  elevenLabsSyncHash: () => 'hash',
}))

const { deleteAgentProviders, failedSyncState, isAgentStale, pendingSyncState, resyncStaleAgents, syncAgentProviders } = await import('./index')

function agent(overrides: Partial<Agent> = {}): Agent {
  return {
    id: 'agent-1',
    org_id: 'org-1',
    elevenlabs_agent_id: null,
    cartesia_agent_id: null,
    name: 'Mara',
    voice_id: null,
    voice_name: null,
    cartesia_voice_id: 'voice-1',
    cartesia_voice_name: 'Nova',
    language: 'en',
    system_prompt: null,
    first_message: null,
    is_active: true,
    working_hours: {},
    fallback_message: null,
    tone: 'professional',
    voice_speed: null,
    voice_emotion: null,
    keyterms: [],
    lead_fields: [],
    recording_notice: false,
    pipeline_mode_override: null,
    provider_sync: {},
    metadata: {},
    created_at: '2026-09-01T00:00:00Z',
    updated_at: '2026-09-01T00:00:00Z',
    ...overrides,
  }
}

const SYNCED = { status: 'synced' as const, synced_at: '2026-09-17T00:00:00Z', error: null, hash: 'hash', version_id: null }

beforeEach(() => {
  kvStore.clear()
  db.updates.length = 0
  store.agent = agent()
  store.loads = 0
  store.page = []
  store.orgOnboarded = true
  voiceLookup.fail = false
  for (const fn of Object.values(providers)) fn.mockReset()
  vi.stubEnv('NEXT_PUBLIC_SUPABASE_URL', 'https://example.supabase.co')
  vi.stubEnv('SUPABASE_SERVICE_ROLE_KEY', 'service-role')
  vi.stubEnv('CARTESIA_API_KEY', 'sk_car_test')
  vi.stubEnv('ELEVENLABS_API_KEY', 'el-test')
})

afterEach(() => {
  vi.unstubAllEnvs()
})

describe('pendingSyncState', () => {
  it('marks configured providers pending and keeps the last successful hash', () => {
    vi.stubEnv('ELEVENLABS_API_KEY', '')
    const state = pendingSyncState({ cartesia: { ...SYNCED, version_id: 'av_1' } })
    expect(state.cartesia).toEqual({ ...SYNCED, status: 'pending', version_id: 'av_1' })
    expect(state.elevenlabs).toMatchObject({ status: 'disabled', error: null })
  })
})

describe('isAgentStale', () => {
  const org = { id: 'org-1', name: 'Zenith', timezone: 'UTC', plan: 'starter' as const, sms_enabled: true, onboarding_completed: true }
  const ctx = { capabilities: {} as never, services: [], contactsSummary: null }

  it('flags missing provider agents and syncs that never finished', () => {
    const linked = { cartesia_agent_id: 'agent_c', elevenlabs_agent_id: 'el_1' }
    expect(isAgentStale(agent({ ...linked, provider_sync: { cartesia: SYNCED, elevenlabs: SYNCED } }), org, ctx)).toBe(false)
    expect(isAgentStale(agent({ ...linked, provider_sync: { cartesia: { ...SYNCED, status: 'pending' }, elevenlabs: SYNCED } }), org, ctx)).toBe(true)
    expect(isAgentStale(agent({ cartesia_agent_id: 'agent_c', provider_sync: { cartesia: SYNCED, elevenlabs: SYNCED } }), org, ctx)).toBe(true)

    vi.stubEnv('ELEVENLABS_API_KEY', '')
    expect(isAgentStale(agent({ cartesia_agent_id: 'agent_c', provider_sync: { cartesia: SYNCED } }), org, ctx)).toBe(false)
  })
})

describe('failedSyncState', () => {
  it('turns only pending entries into errors and keeps the last good hash', () => {
    const state = failedSyncState({
      cartesia: { ...SYNCED, status: 'pending' },
      elevenlabs: { ...SYNCED, status: 'error', error: 'Backup failed' },
    })
    expect(state.cartesia).toMatchObject({ status: 'error', hash: 'hash', synced_at: SYNCED.synced_at })
    expect(state.elevenlabs).toEqual({ ...SYNCED, status: 'error', error: 'Backup failed' })
    expect(failedSyncState(undefined)).toEqual({})
  })
})

describe('syncAgentProviders', () => {
  it('runs both providers and writes one combined result scoped to the org', async () => {
    providers.cartesia.mockResolvedValue({ entry: SYNCED, cartesiaAgentId: 'agent_c' })
    providers.elevenlabs.mockResolvedValue({ entry: { ...SYNCED, status: 'error', error: 'Backup failed' }, elevenLabsAgentId: null })

    const state = await syncAgentProviders('agent-1')
    expect(state).toEqual({ cartesia: SYNCED, elevenlabs: { ...SYNCED, status: 'error', error: 'Backup failed' } })
    expect(providers.elevenlabs.mock.calls[0][0].voiceGender).toBe('masculine')
    expect(db.updates).toHaveLength(1)
    expect(db.updates[0].values).toEqual({ provider_sync: state, cartesia_agent_id: 'agent_c' })
    expect(db.updates[0].filters).toEqual([['id', 'agent-1'], ['org_id', 'org-1']])
    expect(kvStore.has('lock:agent-sync:agent-1')).toBe(false)
  })

  it('collapses concurrent syncs: the second flags the running one and returns the stored state', async () => {
    const stored: ProviderSyncState = { cartesia: { ...SYNCED, status: 'pending' } }
    store.agent = agent({ provider_sync: stored })
    kvStore.set('lock:agent-sync:agent-1', 1)

    const state = await syncAgentProviders('agent-1')
    expect(state).toEqual(stored)
    expect(providers.cartesia).not.toHaveBeenCalled()
    expect(kvStore.get('agent-sync:dirty:agent-1')).toBe(true)
  })

  it('runs one more pass when a save arrived during the sync', async () => {
    providers.cartesia.mockImplementation(async () => {
      if (providers.cartesia.mock.calls.length === 1) kvStore.set('agent-sync:dirty:agent-1', true)
      return { entry: SYNCED, cartesiaAgentId: null }
    })
    providers.elevenlabs.mockResolvedValue({ entry: SYNCED, elevenLabsAgentId: null })

    await syncAgentProviders('agent-1', { force: true })
    expect(providers.cartesia).toHaveBeenCalledTimes(2)
    expect(providers.cartesia.mock.calls[0][0].force).toBe(true)
    expect(store.loads).toBe(2)
  })

  it('forces only the first pass', async () => {
    providers.cartesia.mockImplementation(async () => {
      if (providers.cartesia.mock.calls.length === 1) kvStore.set('agent-sync:dirty:agent-1', true)
      return { entry: SYNCED, cartesiaAgentId: null }
    })
    providers.elevenlabs.mockResolvedValue({ entry: SYNCED, elevenLabsAgentId: null })
    await syncAgentProviders('agent-1', { force: true })
    expect(providers.cartesia.mock.calls.map((call) => call[0].force)).toEqual([true, false])
  })

  it('stops after a bounded number of passes when saves keep arriving', async () => {
    providers.cartesia.mockImplementation(async () => {
      kvStore.set('agent-sync:dirty:agent-1', true)
      return { entry: SYNCED, cartesiaAgentId: null }
    })
    providers.elevenlabs.mockResolvedValue({ entry: SYNCED, elevenLabsAgentId: null })
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined)
    await syncAgentProviders('agent-1')
    expect(providers.cartesia).toHaveBeenCalledTimes(4)
    expect(kvStore.has('lock:agent-sync:agent-1')).toBe(false)
    warn.mockRestore()
  })

  it('passes a failed voice lookup through instead of looking it up again', async () => {
    voiceLookup.fail = true
    providers.cartesia.mockResolvedValue({ entry: SYNCED, cartesiaAgentId: null })
    providers.elevenlabs.mockResolvedValue({ entry: SYNCED, elevenLabsAgentId: null })
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined)
    await syncAgentProviders('agent-1')
    const cartesiaInput = providers.cartesia.mock.calls[0][0]
    expect('voice' in cartesiaInput && cartesiaInput.voice === undefined).toBe(true)
    expect(providers.elevenlabs.mock.calls[0][0]).toMatchObject({ voiceGender: null, voiceGenderResolved: false })
    warn.mockRestore()
  })

  it('turns pending entries into a readable error when the sync can’t finish', async () => {
    store.agent = agent({ provider_sync: { cartesia: { ...SYNCED, status: 'pending' }, elevenlabs: { ...SYNCED, status: 'disabled' } } })
    providers.cartesia.mockRejectedValue(new Error('database down'))
    providers.elevenlabs.mockResolvedValue({ entry: SYNCED, elevenLabsAgentId: null })

    await expect(syncAgentProviders('agent-1')).rejects.toThrow('database down')
    expect(db.updates).toHaveLength(1)
    const written = db.updates[0].values.provider_sync as ProviderSyncState
    expect(written.cartesia).toMatchObject({ status: 'error', hash: 'hash' })
    expect(written.cartesia?.error).toMatch(/try again automatically/)
    expect(written.elevenlabs?.status).toBe('disabled')
    expect(db.updates[0].filters).toEqual([['id', 'agent-1'], ['org_id', 'org-1']])
    expect(kvStore.has('lock:agent-sync:agent-1')).toBe(false)
  })

  it('refuses to run without the service role key', async () => {
    vi.stubEnv('SUPABASE_SERVICE_ROLE_KEY', '')
    await expect(syncAgentProviders('agent-1')).rejects.toMatchObject({ code: 'not_configured' })
  })
})

describe('resyncStaleAgents', () => {
  it('syncs agents of onboarded organisations that have no provider agents yet', async () => {
    store.page = [agent({ id: 'agent-1' }), agent({ id: 'agent-2', cartesia_agent_id: 'agent_c', elevenlabs_agent_id: 'el_2', provider_sync: { cartesia: SYNCED, elevenlabs: SYNCED } })]
    providers.cartesia.mockResolvedValue({ entry: SYNCED, cartesiaAgentId: 'agent_c1' })
    providers.elevenlabs.mockResolvedValue({ entry: SYNCED, elevenLabsAgentId: 'el_1' })

    expect(await resyncStaleAgents()).toEqual({ synced: 1, failed: 0, deferred: 0 })
    expect(providers.cartesia).toHaveBeenCalledTimes(1)
    expect(providers.cartesia.mock.calls[0][0].agent.id).toBe('agent-1')

    store.orgOnboarded = false
    providers.cartesia.mockClear()
    expect(await resyncStaleAgents()).toEqual({ synced: 0, failed: 0, deferred: 0 })
    expect(providers.cartesia).not.toHaveBeenCalled()
  })

  it('starts no sync after the deadline and reports what was left', async () => {
    store.page = [agent({ id: 'agent-1' }), agent({ id: 'agent-2' }), agent({ id: 'agent-3' })]
    const deadline = 1_000_000
    let clock = deadline - 5_000
    const now = vi.spyOn(Date, 'now').mockImplementation(() => clock)
    providers.cartesia.mockImplementation(async () => {
      clock = deadline + 1 // the first sync runs past the budget
      return { entry: SYNCED, cartesiaAgentId: 'agent_c' }
    })
    providers.elevenlabs.mockResolvedValue({ entry: SYNCED, elevenLabsAgentId: 'el_1' })
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined)

    expect(await resyncStaleAgents({ deadline })).toEqual({ synced: 1, failed: 0, deferred: 2 })
    expect(providers.cartesia).toHaveBeenCalledTimes(1)
    warn.mockRestore()
    now.mockRestore()
  })
})

describe('deleteAgentProviders', () => {
  it('attempts both deletions and reports which failed', async () => {
    providers.deleteCartesia.mockRejectedValue(new Error('boom'))
    providers.deleteElevenLabs.mockResolvedValue(undefined)
    const error = vi.spyOn(console, 'error').mockImplementation(() => undefined)
    await expect(deleteAgentProviders(agent({ cartesia_agent_id: 'agent_c', elevenlabs_agent_id: 'el_1' }))).rejects.toThrow('cartesia')
    expect(providers.deleteElevenLabs).toHaveBeenCalledWith('el_1')
    error.mockRestore()
  })

  it('does nothing for an agent without provider agents', async () => {
    await expect(deleteAgentProviders(agent())).resolves.toBeUndefined()
    expect(providers.deleteCartesia).not.toHaveBeenCalled()
  })
})
