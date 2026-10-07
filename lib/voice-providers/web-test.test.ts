import { beforeEach, describe, expect, it, vi } from 'vitest'
import { memoryDb, type MemoryDb } from '@/tests/helpers/memory-db'
import { PLATFORM_AGENT_CONFIG_VERSION } from '@/lib/elevenlabs/agent-config'

// Browser test sessions (slice G): server-side ids only, rate limits, the
// trial lifetime cap, the pre-created test row, no secret in logs, and the
// finalizer for rows whose result never arrived.

const state: { db: MemoryDb | null; usage: Map<string, number>; rpcError: boolean } = { db: null, usage: new Map(), rpcError: false }
vi.mock('@/lib/supabase/admin', () => ({ createAdminClient: () => state.db }))
vi.mock('@/lib/elevenlabs/client', () => ({ isConfigured: () => true }))
const tokenMock = vi.fn()
vi.mock('@/lib/elevenlabs/api/conversation-token', () => ({ conversationToken: (...a: unknown[]) => tokenMock(...a) }))
const limits = vi.hoisted(() => ({ calls: [] as Array<{ rules: unknown; subject: string }>, deny: null as string | null }))
vi.mock('@/lib/security/rate-limit', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/security/rate-limit')>()
  return {
    ...actual,
    enforceRateLimit: async (rules: unknown, subject: string, message?: string) => {
      limits.calls.push({ rules, subject })
      if (limits.deny && subject === limits.deny) {
        const { rateLimitedError } = await import('@/lib/api/http')
        throw rateLimitedError(Date.now() + 60_000, message)
      }
    },
  }
})

import { RequestError } from '@/lib/api/http'
import { ProviderError } from './errors'
import { MAX_ATTEMPTS } from './conversation-reconcile'
import { WEB_TEST_RECONCILE_ATTEMPTS_USED, clientIpKey, finalizeStaleWebTests, isPaidPlan, participantName, sdkServerLocation, startWebTestSession, webTestAvailability } from './web-test'

const ORG = '11111111-1111-4111-8111-111111111111'
const OTHER_ORG = '22222222-2222-4222-8222-222222222222'
const AGENT = 'a1111111-1111-4111-8111-111111111111'
const OTHER_AGENT = 'a2222222-2222-4222-8222-222222222222'
const USER = 'u1111111-1111-4111-8111-111111111111'
const TOKEN = 'lk_secret_token_value_123'

type LogCall = { level: string; args: unknown[] }
function logger() {
  const calls: LogCall[] = []
  const make = (): Record<string, unknown> => ({
    info: (...args: unknown[]) => calls.push({ level: 'info', args }),
    warn: (...args: unknown[]) => calls.push({ level: 'warn', args }),
    error: (...args: unknown[]) => calls.push({ level: 'error', args }),
    debug: () => {},
    child: () => make(),
  })
  return { log: make() as unknown as import('@/lib/observability/logger').Logger, calls }
}

function overridesDetail(paths: string[]) {
  return { platform_version: PLATFORM_AGENT_CONFIG_VERSION, client_overrides: { version: PLATFORM_AGENT_CONFIG_VERSION, paths } }
}

function seed(over: { agent?: Record<string, unknown>; resource?: Record<string, unknown> | null; calls?: Record<string, unknown>[] } = {}) {
  const db = memoryDb({
    agents: [
      { id: AGENT, org_id: ORG, name: 'Ana', language: 'ro', is_active: true, working_hours: {}, after_hours: {}, conversation_settings: {}, privacy_settings: { record_audio: true, retention_days: 30 }, metadata: {}, created_at: '2026-01-01T00:00:00Z', ...over.agent },
      { id: OTHER_AGENT, org_id: OTHER_ORG, name: 'Other', language: 'en', is_active: true, created_at: '2025-01-01T00:00:00Z' },
    ],
    agent_provider_resources: [
      ...(over.resource === null ? [] : [{ id: 'r1', org_id: ORG, agent_id: AGENT, provider: 'elevenlabs', external_id: 'agent_el_1', status: 'ready', details: overridesDetail(['agent.first_message', 'conversation.max_duration_seconds', 'conversation.text_only']), ...over.resource }]),
      { id: 'r2', org_id: OTHER_ORG, agent_id: OTHER_AGENT, provider: 'elevenlabs', external_id: 'agent_el_other', status: 'ready', details: {} },
    ],
    calls: over.calls ?? [],
    web_test_usage: [],
  })
  // claim_web_test_session / release_web_test_session semantics (migration 020).
  db.rpc = (fn: string, args: unknown) => {
    db.rpcCalls.push({ fn, args })
    const a = args as { p_org_id: string; p_limit?: number | null }
    if (state.rpcError) return Promise.resolve({ data: null, error: { message: 'function does not exist' } }) as never
    const used = state.usage.get(a.p_org_id) ?? 0
    if (fn === 'claim_web_test_session') {
      if (a.p_limit !== null && a.p_limit !== undefined && used >= a.p_limit) return Promise.resolve({ data: [{ allowed: false, used }], error: null }) as never
      state.usage.set(a.p_org_id, used + 1)
      return Promise.resolve({ data: [{ allowed: true, used: used + 1 }], error: null }) as never
    }
    if (fn === 'release_web_test_session') {
      state.usage.set(a.p_org_id, Math.max(0, used - 1))
      return Promise.resolve({ data: Math.max(0, used - 1), error: null }) as never
    }
    return Promise.resolve({ data: null, error: { message: 'unknown rpc' } }) as never
  }
  state.db = db
  return db
}

const trialOrg = { id: ORG, name: 'Acme Dental', timezone: 'Europe/Bucharest', plan: 'trial' }
const proOrg = { ...trialOrg, plan: 'pro' }

beforeEach(() => {
  state.usage = new Map()
  state.rpcError = false
  limits.calls = []
  limits.deny = null
  tokenMock.mockReset()
  tokenMock.mockResolvedValue({ token: TOKEN, conversation_id: 'conv_web_1' })
  vi.stubEnv('VOICE_TOKEN_SECRET', 'x'.repeat(40))
  vi.stubEnv('WEB_TEST_TRIAL_SESSIONS', '')
  vi.stubEnv('WEB_TEST_MAX_SECONDS', '')
})

describe('helpers', () => {
  it('participant names are opaque, stable and never contain the user id', () => {
    const a = participantName(USER)
    expect(a).toMatch(/^ntv-web-[0-9a-f]{20}$/)
    expect(a).toBe(participantName(USER))
    expect(a).not.toContain(USER.slice(0, 8))
    expect(participantName('someone-else')).not.toBe(a)
  })

  it('paid plans are the known non-trial plans', () => {
    expect(isPaidPlan('pro')).toBe(true)
    expect(isPaidPlan('custom')).toBe(true)
    expect(isPaidPlan('trial')).toBe(false)
    expect(isPaidPlan(null)).toBe(false)
    expect(isPaidPlan('free')).toBe(false)
  })

  it('matches the SDK server location to the platform environment (data residency)', () => {
    vi.stubEnv('ELEVENLABS_API_BASE_URL', '')
    expect(sdkServerLocation()).toBe('us')
    vi.stubEnv('ELEVENLABS_API_BASE_URL', 'https://api.eu.residency.elevenlabs.io/')
    expect(sdkServerLocation()).toBe('eu-residency')
    vi.stubEnv('ELEVENLABS_API_BASE_URL', 'https://api.in.residency.elevenlabs.io')
    expect(sdkServerLocation()).toBe('in-residency')
    vi.stubEnv('ELEVENLABS_API_BASE_URL', 'not a url')
    expect(sdkServerLocation()).toBe('us')
  })

  it('test rows leave the lost-webhook recovery only two look-ups', () => {
    expect(MAX_ATTEMPTS - WEB_TEST_RECONCILE_ATTEMPTS_USED).toBe(2)
  })

  it('hashes the first forwarded IP (never stores it raw)', () => {
    const key = clientIpKey(new Headers({ 'x-forwarded-for': '203.0.113.9, 10.0.0.1' }))
    expect(key).toMatch(/^[0-9a-f]{32}$/)
    expect(key).toBe(clientIpKey(new Headers({ 'x-forwarded-for': '203.0.113.9' })))
    expect(clientIpKey(new Headers())).toBeNull()
  })
})

describe('startWebTestSession', () => {
  it('mints a token for the org\'s own agent and pre-creates a test row (never billed)', async () => {
    const db = seed()
    const { log, calls } = logger()
    const res = await startWebTestSession({ org: trialOrg, userId: USER, mode: 'voice', ipKey: 'ip1' }, log)

    expect(tokenMock).toHaveBeenCalledTimes(1)
    const [agentId, opts] = tokenMock.mock.calls[0] as [string, { participantName: string; ctx: Record<string, unknown> }]
    expect(agentId).toBe('agent_el_1')
    expect(opts.participantName).toMatch(/^ntv-web-/)
    expect(opts.ctx).toEqual({ orgId: ORG, agentId: AGENT })

    const row = db.tables.calls[0]
    expect(row).toMatchObject({
      org_id: ORG,
      agent_id: AGENT,
      channel: 'web',
      is_test: true,
      provider: 'elevenlabs',
      direction: 'inbound',
      status: 'in-progress',
      elevenlabs_conversation_id: 'conv_web_1',
      provider_call_id: 'conv_web_1',
      routing: { mode: 'web_test', test_mode: 'voice', source: 'web_session' },
      reconcile_attempts: WEB_TEST_RECONCILE_ATTEMPTS_USED,
    })
    expect(res).toMatchObject({ conversation_token: TOKEN, conversation_id: 'conv_web_1', call_id: row.id, mode: 'voice', connection_type: 'webrtc', server_location: 'us', sessions_left: 19, privacy: { record_audio: true, retention_days: 30 } })
    expect(res.max_session_seconds).toBe(300)
    // Only the session's own values; never a call id or a token (the agent keeps its placeholders).
    expect(res.dynamic_variables).toEqual({ ntv_routing_mode: 'web', ntv_call_direction: 'inbound', after_hours: 'false', business_name: 'Acme Dental' })
    expect(db.rpcCalls).toEqual([{ fn: 'claim_web_test_session', args: { p_org_id: ORG, p_limit: 20 } }])
    // Per org (+ day) and per client IP.
    expect(limits.calls.map((c) => c.subject)).toEqual([ORG, 'ip1'])
    // The bearer token never reaches a log line.
    expect(JSON.stringify(calls)).not.toContain(TOKEN)
  })

  it('paid organisations are only counted (no lifetime cap)', async () => {
    const db = seed()
    const res = await startWebTestSession({ org: proOrg, userId: USER, mode: 'voice', ipKey: null }, logger().log)
    expect(db.rpcCalls[0]).toEqual({ fn: 'claim_web_test_session', args: { p_org_id: ORG, p_limit: null } })
    expect(res.sessions_left).toBeNull()
    expect(limits.calls.map((c) => c.subject)).toEqual([ORG])
  })

  it('refuses a trial organisation that used all its tests, before minting anything', async () => {
    seed()
    state.usage.set(ORG, 20)
    const err = await startWebTestSession({ org: trialOrg, userId: USER, mode: 'voice', ipKey: null }, logger().log).catch((e: unknown) => e)
    expect(err).toBeInstanceOf(RequestError)
    expect(err).toMatchObject({ status: 403, details: { reason: 'trial_limit' } })
    expect(tokenMock).not.toHaveBeenCalled()
  })

  it('fails closed for a trial when the counter cannot be used', async () => {
    seed()
    state.rpcError = true
    const err = await startWebTestSession({ org: trialOrg, userId: USER, mode: 'voice', ipKey: null }, logger().log).catch((e: unknown) => e)
    expect(err).toMatchObject({ status: 503 })
    expect(tokenMock).not.toHaveBeenCalled()
  })

  it('a paid organisation is not blocked by a counter outage', async () => {
    seed()
    state.rpcError = true
    const res = await startWebTestSession({ org: proOrg, userId: USER, mode: 'voice', ipKey: null }, logger().log)
    expect(res.conversation_token).toBe(TOKEN)
  })

  it('gives the session back when the provider refuses to mint the token', async () => {
    const db = seed()
    tokenMock.mockRejectedValue(new ProviderError({ system: 'elevenlabs', operation: 'conversation.token', code: 'upstream', status: 503 }))
    await expect(startWebTestSession({ org: trialOrg, userId: USER, mode: 'voice', ipKey: null }, logger().log)).rejects.toBeInstanceOf(ProviderError)
    expect(db.rpcCalls.map((c) => c.fn)).toEqual(['claim_web_test_session', 'release_web_test_session'])
    expect(state.usage.get(ORG)).toBe(0)
    expect(db.tables.calls).toHaveLength(0)
  })

  it('rate limits per org and per IP before claiming a session', async () => {
    const db = seed()
    limits.deny = 'ip-abuser'
    await expect(startWebTestSession({ org: trialOrg, userId: USER, mode: 'voice', ipKey: 'ip-abuser' }, logger().log)).rejects.toMatchObject({ status: 429 })
    expect(db.rpcCalls).toHaveLength(0)
    expect(tokenMock).not.toHaveBeenCalled()
  })

  it('never tests a switched-off agent, an agent not synced yet, or creates one', async () => {
    seed({ agent: { is_active: false } })
    await expect(startWebTestSession({ org: trialOrg, userId: USER, mode: 'voice', ipKey: null }, logger().log)).rejects.toMatchObject({ status: 409, details: { reason: 'agent_inactive' } })
    seed({ resource: { status: 'pending', external_id: null } })
    await expect(startWebTestSession({ org: trialOrg, userId: USER, mode: 'voice', ipKey: null }, logger().log)).rejects.toMatchObject({ status: 409, details: { reason: 'agent_not_ready' } })
    seed({ resource: { status: 'failed' } })
    await expect(startWebTestSession({ org: trialOrg, userId: USER, mode: 'voice', ipKey: null }, logger().log)).rejects.toMatchObject({ status: 409, details: { reason: 'agent_not_ready' } })
    seed({ resource: null })
    await expect(startWebTestSession({ org: trialOrg, userId: USER, mode: 'voice', ipKey: null }, logger().log)).rejects.toMatchObject({ status: 409 })
    expect(tokenMock).not.toHaveBeenCalled()
    expect(limits.calls).toHaveLength(0)
  })

  it('only uses the caller org\'s rows (never another tenant\'s agent)', async () => {
    seed()
    await expect(
      startWebTestSession({ org: { id: '33333333-3333-4333-8333-333333333333', name: 'X', timezone: 'UTC', plan: 'pro' }, userId: USER, mode: 'voice', ipKey: null }, logger().log),
    ).rejects.toMatchObject({ status: 404 })
    expect(tokenMock).not.toHaveBeenCalled()
  })

  it('a degraded agent (config applied, a tool missing) can be tested', async () => {
    seed({ resource: { status: 'degraded' } })
    const res = await startWebTestSession({ org: proOrg, userId: USER, mode: 'voice', ipKey: null }, logger().log)
    expect(res.conversation_token).toBe(TOKEN)
  })

  it('chat mode needs the text_only override in force at the provider', async () => {
    seed({ resource: { details: overridesDetail(['agent.first_message', 'conversation.max_duration_seconds']) } })
    await expect(startWebTestSession({ org: proOrg, userId: USER, mode: 'text', ipKey: null }, logger().log)).rejects.toMatchObject({ status: 409, details: { reason: 'text_unavailable' } })
    // A stale allow-list (older platform version) reads as first message only.
    seed({ resource: { details: { platform_version: 1, client_overrides: { version: 0, paths: ['conversation.text_only'] } } } })
    await expect(startWebTestSession({ org: proOrg, userId: USER, mode: 'text', ipKey: null }, logger().log)).rejects.toMatchObject({ status: 409 })
    const db = seed()
    const res = await startWebTestSession({ org: proOrg, userId: USER, mode: 'text', ipKey: null }, logger().log)
    expect(res.mode).toBe('text')
    expect(db.tables.calls[0].routing).toMatchObject({ test_mode: 'text' })
  })

  it('passes the real after-hours state and caps the session by the agent\'s own maximum', async () => {
    const closedAllWeek = Object.fromEntries(['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'].map((d) => [d, { enabled: false, start: '09:00', end: '17:00' }]))
    seed({ agent: { working_hours: closedAllWeek, after_hours: { enabled: true, mode: 'ai' }, conversation_settings: { max_call_duration_minutes: 2 } } })
    const res = await startWebTestSession({ org: proOrg, userId: USER, mode: 'voice', ipKey: null }, logger().log)
    expect(res.dynamic_variables.after_hours).toBe('true')
    expect(res.max_session_seconds).toBe(120)
  })

  it('without a conversation id, no row is pre-created (nothing could match it)', async () => {
    const db = seed()
    tokenMock.mockResolvedValue({ token: TOKEN, conversation_id: '' })
    const res = await startWebTestSession({ org: proOrg, userId: USER, mode: 'voice', ipKey: null }, logger().log)
    expect(res).toMatchObject({ conversation_token: TOKEN, conversation_id: null, call_id: null })
    expect(db.tables.calls).toHaveLength(0)
  })

  it('still returns the session when the test row cannot be written (the webhook classifies it)', async () => {
    const db = seed()
    const orig = db.from.bind(db)
    db.from = ((t: string) => {
      const q = orig(t)
      if (t === 'calls') (q as unknown as { insert: () => unknown }).insert = () => ({ select: () => ({ single: async () => ({ data: null, error: { message: 'boom', code: 'XX000' } }) }) })
      return q
    }) as typeof db.from
    const { log, calls } = logger()
    const res = await startWebTestSession({ org: proOrg, userId: USER, mode: 'voice', ipKey: null }, log)
    expect(res.call_id).toBeNull()
    expect(res.conversation_token).toBe(TOKEN)
    expect(calls.some((c) => c.level === 'error' && c.args[0] === 'web_test.call_row_failed')).toBe(true)
  })
})

describe('webTestAvailability', () => {
  it('reports why a test is not possible, without any provider call', async () => {
    seed({ agent: { is_active: false } })
    expect(await webTestAvailability(trialOrg, logger().log)).toMatchObject({ available: false, reason: 'agent_inactive', sessions_left: 20 })
    seed({ resource: { status: 'pending', external_id: null } })
    expect(await webTestAvailability(trialOrg, logger().log)).toMatchObject({ available: false, reason: 'agent_not_ready', text_available: false })
    seed()
    state.usage.set(ORG, 0)
    const ok = await webTestAvailability(proOrg, logger().log)
    expect(ok).toMatchObject({ available: true, reason: null, text_available: true, sessions_left: null, privacy: { record_audio: true, retention_days: 30 } })
    expect(await webTestAvailability({ ...trialOrg, id: '33333333-3333-4333-8333-333333333333' }, logger().log)).toMatchObject({ available: false, reason: 'agent_missing' })
    expect(tokenMock).not.toHaveBeenCalled()
  })

  it('counts the trial sessions already used', async () => {
    const db = seed()
    db.tables.web_test_usage.push({ org_id: ORG, sessions_started: 7 })
    expect((await webTestAvailability(trialOrg, logger().log)).sessions_left).toBe(13)
  })
})

describe('finalizeStaleWebTests', () => {
  it('closes browser test rows with no result after 2 hours, and nothing else', async () => {
    const now = Date.parse('2026-10-07T12:00:00Z')
    const old = '2026-10-07T09:00:00Z'
    const recent = '2026-10-07T11:30:00Z'
    const db = seed({
      calls: [
        { id: 'old-web', org_id: ORG, channel: 'web', is_test: true, status: 'in-progress', lifecycle_rank: 20, created_at: old, started_at: old },
        { id: 'recent-web', org_id: ORG, channel: 'web', is_test: true, status: 'in-progress', lifecycle_rank: 20, created_at: recent, started_at: recent },
        { id: 'done-web', org_id: ORG, channel: 'web', is_test: true, status: 'completed', lifecycle_rank: 50, created_at: old },
        { id: 'old-phone', org_id: ORG, channel: 'phone', is_test: false, status: 'in-progress', lifecycle_rank: 20, created_at: old },
      ],
    })
    const res = await finalizeStaleWebTests(100, logger().log, now)
    expect(res).toEqual({ scanned: 1, finalized: 1 })
    const byId = Object.fromEntries(db.tables.calls.map((c) => [c.id, c]))
    expect(byId['old-web']).toMatchObject({ status: 'canceled', lifecycle_rank: 40, ended_at: old })
    expect(byId['recent-web']).toMatchObject({ status: 'in-progress', lifecycle_rank: 20 })
    expect(byId['done-web']).toMatchObject({ status: 'completed' })
    expect(byId['old-phone']).toMatchObject({ status: 'in-progress' })
    // Never billed.
    expect(db.rpcCalls).toHaveLength(0)
  })
})
