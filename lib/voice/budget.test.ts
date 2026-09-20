import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

// ─── Fakes ───────────────────────────────────────────────────────────────────

interface UsageRow {
  id: string
  provider: string
  kind: string
  quantity: number
  credits: number
  created_at: string
}

type DbError = { code: string; message: string } | null

const fake = vi.hoisted(() => {
  const state = {
    usageRows: [] as UsageRow[],
    usageError: null as DbError,
    runtime: null as { credits_exhausted_cycle: string | null; agent_exhausted_cycle: string | null } | null,
    runtimeError: null as DbError,
    upserts: [] as { table: string; row: Record<string, unknown>; options: unknown }[],
    upsertError: null as DbError,
    inserts: [] as { table: string; rows: Record<string, unknown>[] }[],
    insertErrors: [] as DbError[],
    usageQueries: [] as { range: [number, number] | null; count: boolean; filters: [string, string, unknown][] }[],
    kv: new Map<string, { value: unknown; ttl: number | undefined }>(),
    credits: vi.fn(async (_start: string, _end: string): Promise<number> => 0),
    agents: vi.fn(async (_start: string, _end: string) => ({ cents: 0, minutes: 0, calls: 0 })),
  }

  function query(table: string) {
    const q = {
      op: 'select' as 'select' | 'upsert' | 'insert',
      filters: [] as [string, string, unknown][],
      range: null as [number, number] | null,
      count: false,
    }
    const resolve = async (): Promise<Record<string, unknown>> => {
      if (q.op === 'upsert') return { error: state.upsertError }
      if (q.op === 'insert') return { error: state.insertErrors.shift() ?? null }
      if (table === 'voice_runtime_state') {
        return state.runtimeError ? { data: null, error: state.runtimeError } : { data: state.runtime, error: null }
      }
      if (table === 'provider_usage_events') {
        state.usageQueries.push({ range: q.range, count: q.count, filters: [...q.filters] })
        if (state.usageError) return { data: null, error: state.usageError, count: null }
        const matching = state.usageRows.filter((row) =>
          q.filters.every(([op, column, value]) => {
            const cell = row[column as keyof UsageRow]
            if (op === 'eq') return cell === value
            if (op === 'gte') return String(cell) >= String(value)
            if (op === 'lt') return String(cell) < String(value)
            return true
          })
        )
        const [from, to] = q.range ?? [0, matching.length - 1]
        return { data: matching.slice(from, to + 1), error: null, count: q.count ? matching.length : null }
      }
      throw new Error(`unexpected table ${table}`)
    }
    const builder = {
      select(_columns: string, options?: { count?: string }) {
        q.count = options?.count === 'exact'
        return builder
      },
      eq(column: string, value: unknown) {
        q.filters.push(['eq', column, value])
        return builder
      },
      gte(column: string, value: unknown) {
        q.filters.push(['gte', column, value])
        return builder
      },
      lt(column: string, value: unknown) {
        q.filters.push(['lt', column, value])
        return builder
      },
      order: () => builder,
      range(from: number, to: number) {
        q.range = [from, to]
        return builder
      },
      abortSignal: () => builder,
      maybeSingle: () => resolve(),
      upsert(row: Record<string, unknown>, options: unknown) {
        q.op = 'upsert'
        state.upserts.push({ table, row, options })
        return builder
      },
      insert(rows: Record<string, unknown>[]) {
        q.op = 'insert'
        state.inserts.push({ table, rows })
        return builder
      },
      then(onFulfilled: (value: Record<string, unknown>) => unknown, onRejected?: (reason: unknown) => unknown) {
        return resolve().then(onFulfilled, onRejected)
      },
    }
    return builder
  }

  return { state, query }
})

vi.mock('@/lib/supabase/admin', () => ({
  createAdminClient: () => ({ from: (table: string) => fake.query(table) }),
}))

vi.mock('@/lib/cartesia/client', () => ({
  cartesia: { usage: { credits: fake.state.credits, agents: fake.state.agents } },
}))

vi.mock('@/lib/kv', () => ({
  kvGet: async (key: string) => {
    const entry = fake.state.kv.get(key)
    return entry ? JSON.parse(JSON.stringify(entry.value)) : null
  },
  kvSet: async (key: string, value: unknown, ttl?: number) => {
    fake.state.kv.set(key, { value: JSON.parse(JSON.stringify(value)), ttl })
  },
  kvDel: async (key: string) => {
    fake.state.kv.delete(key)
  },
  kvIncr: async () => 1,
}))

import {
  billingCycle,
  budgetConfig,
  clearBudgetExhausted,
  computeBudgetState,
  creditsForBatchStt,
  creditsForStt,
  creditsForTts,
  cycleAnchorDay,
  getCartesiaBudget,
  markBudgetExhausted,
  recordProviderUsage,
  resetBudgetWarningsForTests,
  type BudgetConfig,
  type BudgetInputs,
  type ProviderUsageEvent,
} from './budget'

const db = fake.state
const ORG = '11111111-1111-4111-8111-111111111111'
const CALL = '22222222-2222-4222-8222-222222222222'

function utc(iso: string): Date {
  return new Date(iso)
}

function cycleOf(anchor: string | null, now: string) {
  const { start, end, key } = billingCycle(anchor, utc(now))
  return { start: start.toISOString(), end: end.toISOString(), key }
}

function stubEnv(values: Record<string, string>) {
  const defaults: Record<string, string> = {
    NEXT_PUBLIC_SUPABASE_URL: 'https://project.supabase.co',
    SUPABASE_SERVICE_ROLE_KEY: 'service-role-test-key',
    CARTESIA_ADMIN_API_KEY: 'sk_car_admin_test',
    CARTESIA_MONTHLY_CREDITS: '',
    CARTESIA_MONTHLY_AGENT_CENTS: '',
    CARTESIA_CREDIT_RESERVE: '',
    CARTESIA_AGENT_CENTS_RESERVE: '',
    CARTESIA_AGENT_OVERAGE: '',
    CARTESIA_BILLING_CYCLE_ANCHOR: '',
  }
  for (const [name, value] of Object.entries({ ...defaults, ...values })) vi.stubEnv(name, value)
}

// ─── Billing cycle ───────────────────────────────────────────────────────────

describe('billingCycle', () => {
  it('uses calendar months in UTC without an anchor', () => {
    expect(cycleOf(null, '2026-09-17T10:00:00Z')).toEqual({
      start: '2026-09-01T00:00:00.000Z',
      end: '2026-10-01T00:00:00.000Z',
      key: '2026-09-01',
    })
    expect(cycleOf(null, '2026-12-31T23:59:59Z').end).toBe('2027-01-01T00:00:00.000Z')
  })

  it('starts on the anchor day, this month or the previous one', () => {
    expect(cycleOf('2026-03-15', '2026-09-17T00:00:00Z')).toMatchObject({ key: '2026-09-15', end: '2026-10-15T00:00:00.000Z' })
    expect(cycleOf('2026-03-20', '2026-09-17T00:00:00Z')).toMatchObject({ key: '2026-08-20', end: '2026-09-20T00:00:00.000Z' })
    // The renewal instant belongs to the new cycle.
    expect(cycleOf('2026-03-17', '2026-09-17T00:00:00Z').key).toBe('2026-09-17')
  })

  it('clamps anchors on the 29th-31st to the end of shorter months', () => {
    expect(cycleOf('2026-01-31', '2026-02-15T00:00:00Z')).toMatchObject({ key: '2026-01-31', end: '2026-02-28T00:00:00.000Z' })
    expect(cycleOf('2026-01-31', '2026-03-01T00:00:00Z')).toMatchObject({ key: '2026-02-28', end: '2026-03-31T00:00:00.000Z' })
    expect(cycleOf('2026-01-31', '2026-03-31T00:00:00Z')).toMatchObject({ key: '2026-03-31', end: '2026-04-30T00:00:00.000Z' })
    expect(cycleOf('2026-01-31', '2026-05-10T00:00:00Z')).toMatchObject({ key: '2026-04-30', end: '2026-05-31T00:00:00.000Z' })
    expect(cycleOf('2025-12-29', '2028-02-29T12:00:00Z')).toMatchObject({ key: '2028-02-29', end: '2028-03-29T00:00:00.000Z' })
    expect(cycleOf('2025-12-30', '2027-02-28T12:00:00Z')).toMatchObject({ key: '2027-02-28', end: '2027-03-30T00:00:00.000Z' })
  })

  it('crosses year boundaries', () => {
    expect(cycleOf('2026-05-20', '2027-01-10T00:00:00Z')).toMatchObject({ key: '2026-12-20', end: '2027-01-20T00:00:00.000Z' })
  })

  it('projects a future anchor backwards', () => {
    expect(cycleOf('2027-04-05', '2026-09-17T08:00:00Z')).toMatchObject({ key: '2026-09-05', end: '2026-10-05T00:00:00.000Z' })
    expect(cycleOf('2027-04-25', '2026-09-17T08:00:00Z')).toMatchObject({ key: '2026-08-25', end: '2026-09-25T00:00:00.000Z' })
  })

  it('reads the UTC day of a timestamp anchor and ignores invalid anchors', () => {
    expect(cycleAnchorDay('2026-09-17T23:30:00-05:00')).toBe(18)
    expect(cycleAnchorDay('2026-02-30')).toBeNull()
    expect(cycleAnchorDay('next tuesday')).toBeNull()
    expect(cycleAnchorDay('  ')).toBeNull()
    expect(cycleOf('2026-02-30', '2026-09-17T00:00:00Z').key).toBe('2026-09-01')
  })
})

// ─── Pure math ───────────────────────────────────────────────────────────────

describe('credit rates', () => {
  it('prices STT per model, conservatively for unknown models', () => {
    expect(creditsForStt('ink-2', 10)).toBe(30)
    expect(creditsForStt('ink-preview', 10)).toBe(30)
    expect(creditsForStt('ink-whisper', 10)).toBe(10)
    expect(creditsForStt(null, 1.1)).toBe(3.3)
    expect(creditsForStt('ink-2', -4)).toBe(0)
    expect(creditsForStt('ink-2', Number.NaN)).toBe(0)
  })

  it('prices batch STT at one credit per two seconds', () => {
    expect(creditsForBatchStt(2.8)).toBe(1.4)
    expect(creditsForBatchStt(60)).toBe(30)
    expect(creditsForBatchStt(0)).toBe(0)
    expect(creditsForBatchStt(Number.NaN)).toBe(0)
  })

  it('prices TTS at one credit per character', () => {
    expect(creditsForTts(120)).toBe(120)
    expect(creditsForTts(0)).toBe(0)
    expect(creditsForTts(Number.POSITIVE_INFINITY)).toBe(0)
  })
})

describe('budgetConfig', () => {
  afterEach(() => vi.unstubAllEnvs())

  it('uses defaults for missing, non-numeric and negative values', () => {
    vi.spyOn(console, 'warn').mockImplementation(() => {})
    stubEnv({ CARTESIA_MONTHLY_CREDITS: 'lots', CARTESIA_CREDIT_RESERVE: '-5', CARTESIA_AGENT_OVERAGE: 'maybe' })
    expect(budgetConfig()).toEqual({
      creditsAllotment: 8_000_000,
      agentCentsAllotment: 30_000,
      creditReserve: 150_000,
      agentCentsReserve: 500,
      agentOverage: 'allow',
      anchor: null,
    })
    vi.restoreAllMocks()
  })

  it('reads configured values', () => {
    stubEnv({
      CARTESIA_MONTHLY_CREDITS: '1_250_000',
      CARTESIA_MONTHLY_AGENT_CENTS: '4900',
      CARTESIA_CREDIT_RESERVE: '0',
      CARTESIA_AGENT_CENTS_RESERVE: '100',
      CARTESIA_AGENT_OVERAGE: 'FALLBACK',
      CARTESIA_BILLING_CYCLE_ANCHOR: '2026-08-12',
    })
    expect(budgetConfig()).toEqual({
      creditsAllotment: 1_250_000,
      agentCentsAllotment: 4900,
      creditReserve: 0,
      agentCentsReserve: 100,
      agentOverage: 'fallback',
      anchor: '2026-08-12',
    })
  })
})

describe('computeBudgetState', () => {
  const config: BudgetConfig = {
    creditsAllotment: 1_000_000,
    agentCentsAllotment: 10_000,
    creditReserve: 150_000,
    agentCentsReserve: 500,
    agentOverage: 'allow',
    anchor: null,
  }
  const now = utc('2026-09-17T12:00:00Z')
  const base: BudgetInputs = {
    cycle: billingCycle(null, now),
    config,
    now,
    adminCredits: null,
    adminAgentCents: null,
    local: null,
    flags: { creditsExhaustedCycle: null, agentExhaustedCycle: null },
  }

  it('takes the larger of both sources and says which were available', () => {
    const both = computeBudgetState({ ...base, adminCredits: 400_000, local: { credits: 450_000.5, agentSeconds: 0 } })
    expect(both).toMatchObject({ credits_used: 450_000.5, credits_remaining: 549_999.5, credits_source: 'both', credits_exhausted: false })

    expect(computeBudgetState({ ...base, adminCredits: 500 })).toMatchObject({ credits_used: 500, credits_source: 'admin_api' })
    expect(computeBudgetState({ ...base, local: { credits: 700, agentSeconds: 0 } })).toMatchObject({
      credits_used: 700,
      credits_source: 'local_metering',
    })
    expect(computeBudgetState(base)).toMatchObject({ credits_used: 0, credits_source: 'local_metering' })
  })

  it('ignores unusable admin numbers', () => {
    const state = computeBudgetState({ ...base, adminCredits: Number.NaN, local: { credits: 10, agentSeconds: 0 } })
    expect(state).toMatchObject({ credits_used: 10, credits_source: 'local_metering' })
  })

  it('is exhausted at the reserve', () => {
    expect(computeBudgetState({ ...base, adminCredits: 849_999 }).credits_exhausted).toBe(false)
    expect(computeBudgetState({ ...base, adminCredits: 850_000 }).credits_exhausted).toBe(true)
    expect(computeBudgetState({ ...base, adminCredits: 2_000_000 })).toMatchObject({ credits_remaining: -1_000_000, credits_exhausted: true })
  })

  it('honours a quota flag only for the current cycle', () => {
    const current = computeBudgetState({ ...base, flags: { creditsExhaustedCycle: '2026-09-01', agentExhaustedCycle: '2026-09-01' } })
    expect(current).toMatchObject({ credits_exhausted: true, agent_exhausted: true })
    const stale = computeBudgetState({ ...base, flags: { creditsExhaustedCycle: '2026-08-01', agentExhaustedCycle: '2026-08-01' } })
    expect(stale).toMatchObject({ credits_exhausted: false, agent_exhausted: false })
  })

  it('estimates agent cents from metered seconds and keeps the larger source', () => {
    const local = computeBudgetState({ ...base, local: { credits: 0, agentSeconds: 600 } })
    expect(local).toMatchObject({ agent_cents_used: 60, agent_cents_remaining: 9940 })
    const admin = computeBudgetState({ ...base, adminAgentCents: 75, local: { credits: 0, agentSeconds: 600 } })
    expect(admin.agent_cents_used).toBe(75)
  })

  it('ignores prepaid agent dollars with overage allowed, falls back when configured', () => {
    const spent = { ...base, adminAgentCents: 9_800 }
    expect(computeBudgetState(spent).agent_exhausted).toBe(false)
    const fallback = { ...spent, config: { ...config, agentOverage: 'fallback' as const } }
    expect(computeBudgetState(fallback)).toMatchObject({ agent_cents_remaining: 200, agent_exhausted: true })
    expect(computeBudgetState({ ...fallback, adminAgentCents: 9_000 }).agent_exhausted).toBe(false)
  })

  it('reports the cycle', () => {
    expect(computeBudgetState(base)).toMatchObject({
      cycle_key: '2026-09-01',
      cycle_start: '2026-09-01T00:00:00.000Z',
      cycle_end: '2026-10-01T00:00:00.000Z',
      credits_allotment: 1_000_000,
      agent_cents_allotment: 10_000,
      checked_at: '2026-09-17T12:00:00.000Z',
    })
  })
})

// ─── I/O ─────────────────────────────────────────────────────────────────────

function usageRow(i: number, kind: string, quantity: number, credits: number, createdAt: string, provider = 'cartesia'): UsageRow {
  return { id: `row-${String(i).padStart(5, '0')}`, provider, kind, quantity, credits, created_at: createdAt }
}

describe('Cartesia budget with sources', () => {
  beforeEach(() => {
    db.usageRows = []
    db.usageError = null
    db.runtime = null
    db.runtimeError = null
    db.upserts = []
    db.upsertError = null
    db.inserts = []
    db.insertErrors = []
    db.usageQueries = []
    db.kv.clear()
    db.credits.mockReset()
    db.agents.mockReset()
    db.credits.mockResolvedValue(0)
    db.agents.mockResolvedValue({ cents: 0, minutes: 0, calls: 0 })
    resetBudgetWarningsForTests()
    stubEnv({ CARTESIA_MONTHLY_CREDITS: '1000000', CARTESIA_BILLING_CYCLE_ANCHOR: '2026-07-10' })
    vi.useFakeTimers({ toFake: ['Date'] })
    vi.setSystemTime(utc('2026-09-17T12:00:00Z'))
    vi.spyOn(console, 'warn').mockImplementation(() => {})
  })

  afterEach(() => {
    vi.useRealTimers()
    vi.unstubAllEnvs()
    vi.restoreAllMocks()
  })

  it('combines the admin API and local metering for the current cycle', async () => {
    db.credits.mockResolvedValue(300_000)
    db.agents.mockResolvedValue({ cents: 1200, minutes: 200, calls: 40 })
    db.usageRows = [
      usageRow(1, 'tts_characters', 1000, 350_000, '2026-09-11T08:00:00.000Z'),
      usageRow(2, 'stt_seconds', 100, 300, '2026-09-12T08:00:00.000Z'),
      usageRow(3, 'agent_seconds', 30_000, 0, '2026-09-13T08:00:00.000Z'),
      // Previous cycle and other providers don't count.
      usageRow(4, 'tts_characters', 1, 999_999, '2026-09-09T23:59:59.000Z'),
      usageRow(5, 'llm_tokens', 1, 999_999, '2026-09-12T08:00:00.000Z', 'openai'),
    ]

    const budget = await getCartesiaBudget()
    expect(db.credits).toHaveBeenCalledWith('2026-09-10T00:00:00.000Z', '2026-09-17T12:00:00.000Z')
    expect(budget).toMatchObject({
      cycle_key: '2026-09-10',
      credits_used: 350_300,
      credits_remaining: 649_700,
      credits_source: 'both',
      credits_exhausted: false,
      agent_cents_used: 3000,
      agent_exhausted: false,
    })
  })

  it('pages through local metering', async () => {
    vi.stubEnv('CARTESIA_ADMIN_API_KEY', '')
    db.usageRows = Array.from({ length: 2345 }, (_, i) => usageRow(i, 'tts_characters', 1, 2, '2026-09-15T00:00:00.000Z'))
    const budget = await getCartesiaBudget()
    expect(budget).toMatchObject({ credits_used: 4690, credits_source: 'local_metering' })
    expect(db.usageQueries.map((q) => q.range)).toEqual([
      [0, 999],
      [1000, 1999],
      [2000, 2999],
    ])
    expect(db.credits).not.toHaveBeenCalled()
  })

  it('falls back to local metering when the admin API fails', async () => {
    db.credits.mockRejectedValue(Object.assign(new Error('Service unavailable'), { status: 503 }))
    db.agents.mockRejectedValue(new Error('down'))
    db.usageRows = [usageRow(1, 'tts_characters', 10, 10, '2026-09-15T00:00:00.000Z')]
    expect(await getCartesiaBudget()).toMatchObject({ credits_used: 10, credits_source: 'local_metering' })
  })

  it('uses the admin API alone when the metering table is missing', async () => {
    db.usageError = { code: 'PGRST205', message: "Could not find the table 'public.provider_usage_events'" }
    db.runtimeError = { code: '42P01', message: 'relation does not exist' }
    db.credits.mockResolvedValue(900_000)
    const budget = await getCartesiaBudget()
    expect(budget).toMatchObject({ credits_used: 900_000, credits_source: 'admin_api', credits_exhausted: true })
  })

  it('counts nothing when no source is available', async () => {
    vi.stubEnv('CARTESIA_ADMIN_API_KEY', '')
    vi.stubEnv('SUPABASE_SERVICE_ROLE_KEY', '')
    expect(await getCartesiaBudget()).toMatchObject({ credits_used: 0, credits_source: 'local_metering', credits_exhausted: false })
  })

  it('caches for 60 s and bypasses the cache with fresh', async () => {
    db.credits.mockResolvedValue(100)
    await getCartesiaBudget()
    expect(db.kv.get('voice:budget:cartesia')?.ttl).toBe(60)
    db.credits.mockResolvedValue(200)
    expect((await getCartesiaBudget()).credits_used).toBe(100)
    expect(db.credits).toHaveBeenCalledTimes(1)
    expect((await getCartesiaBudget({ fresh: true })).credits_used).toBe(200)
    expect(db.credits).toHaveBeenCalledTimes(2)
  })

  it('ignores a cached budget from another cycle', async () => {
    db.kv.set('voice:budget:cartesia', {
      value: { cycle_key: '2026-08-10', credits_exhausted: true, agent_exhausted: true, credits_remaining: 0, agent_cents_remaining: 0 },
      ttl: 60,
    })
    const budget = await getCartesiaBudget()
    expect(budget).toMatchObject({ cycle_key: '2026-09-10', credits_exhausted: false })
  })

  it('marks a budget exhausted in voice_runtime_state and busts the cache', async () => {
    await getCartesiaBudget()
    expect(db.kv.has('voice:budget:cartesia')).toBe(true)

    await markBudgetExhausted('model_credits')
    expect(db.upserts).toHaveLength(1)
    expect(db.upserts[0]).toMatchObject({
      table: 'voice_runtime_state',
      row: { id: true, credits_exhausted_cycle: '2026-09-10' },
      options: { onConflict: 'id' },
    })
    expect(db.upserts[0].row).not.toHaveProperty('agent_exhausted_cycle')
    expect(db.kv.has('voice:budget:cartesia')).toBe(false)
    expect(db.kv.has('voice:budget:exhausted:model_credits')).toBe(false)

    db.runtime = { credits_exhausted_cycle: '2026-09-10', agent_exhausted_cycle: null }
    expect(await getCartesiaBudget()).toMatchObject({ credits_exhausted: true, agent_exhausted: false })
  })

  it('keeps the flag in KV until the cycle ends when the database write fails', async () => {
    db.upsertError = { code: 'PGRST205', message: 'missing table' }
    db.runtimeError = { code: 'PGRST205', message: 'missing table' }
    await markBudgetExhausted('agent_dollars')
    const flag = db.kv.get('voice:budget:exhausted:agent_dollars')
    expect(flag?.value).toBe('2026-09-10')
    // 2026-09-17T12:00Z → 2026-10-10T00:00Z
    expect(flag?.ttl).toBe(22.5 * 24 * 3600)
    expect(await getCartesiaBudget()).toMatchObject({ agent_exhausted: true, credits_exhausted: false })

    await clearBudgetExhausted('agent_dollars')
    expect(db.kv.has('voice:budget:exhausted:agent_dollars')).toBe(false)
    expect(await getCartesiaBudget()).toMatchObject({ agent_exhausted: false })
  })

  it('never throws from markBudgetExhausted', async () => {
    vi.stubEnv('SUPABASE_SERVICE_ROLE_KEY', '')
    await expect(markBudgetExhausted('model_credits')).resolves.toBeUndefined()
    expect(db.kv.get('voice:budget:exhausted:model_credits')?.value).toBe('2026-09-10')
  })
})

describe('recordProviderUsage', () => {
  beforeEach(() => {
    db.inserts = []
    db.insertErrors = []
    resetBudgetWarningsForTests()
    stubEnv({})
    vi.spyOn(console, 'warn').mockImplementation(() => {})
  })

  afterEach(() => {
    vi.unstubAllEnvs()
    vi.restoreAllMocks()
  })

  const event = (overrides: Partial<ProviderUsageEvent> = {}): ProviderUsageEvent => ({
    provider: 'cartesia',
    kind: 'tts_characters',
    quantity: 120,
    credits: 120,
    org_id: ORG,
    call_id: CALL,
    ...overrides,
  })

  it('inserts in batches of 500', async () => {
    await recordProviderUsage(Array.from({ length: 1200 }, () => event()))
    expect(db.inserts.map((i) => i.rows.length)).toEqual([500, 500, 200])
    expect(db.inserts[0].table).toBe('provider_usage_events')
    expect(db.inserts[0].rows[0]).toEqual({
      provider: 'cartesia',
      kind: 'tts_characters',
      quantity: 120,
      credits: 120,
      cost_cents: null,
      org_id: ORG,
      call_id: CALL,
      meta: {},
    })
  })

  it('drops invalid events and unparseable ids', async () => {
    await recordProviderUsage([
      event({ provider: 'aws' as ProviderUsageEvent['provider'] }),
      event({ kind: '  ' }),
      event({ quantity: Number.NaN }),
      event({ quantity: -1 }),
      event({ quantity: 0, credits: 0 }),
      event({ org_id: 'not-a-uuid', call_id: null, credits: Number.NaN, cost_cents: 12.5, meta: { model: 'sonic' } }),
    ])
    expect(db.inserts).toHaveLength(1)
    expect(db.inserts[0].rows).toEqual([
      {
        provider: 'cartesia',
        kind: 'tts_characters',
        quantity: 120,
        credits: 0,
        cost_cents: 12.5,
        org_id: null,
        call_id: null,
        meta: { model: 'sonic' },
      },
    ])
  })

  it('retries a batch without references after a foreign key violation', async () => {
    db.insertErrors = [{ code: '23503', message: 'violates foreign key constraint' }, null]
    await recordProviderUsage([event()])
    expect(db.inserts).toHaveLength(2)
    expect(db.inserts[1].rows[0]).toMatchObject({ org_id: null, call_id: null, credits: 120 })
  })

  it('never throws', async () => {
    db.insertErrors = [{ code: 'XX000', message: 'boom' }]
    await expect(recordProviderUsage([event()])).resolves.toBeUndefined()
    expect(console.warn).toHaveBeenCalled()

    db.insertErrors = [{ code: '42P01', message: 'relation does not exist' }]
    await expect(recordProviderUsage([event(), event()])).resolves.toBeUndefined()

    await expect(recordProviderUsage(null as unknown as ProviderUsageEvent[])).resolves.toBeUndefined()
    vi.stubEnv('SUPABASE_SERVICE_ROLE_KEY', '')
    db.inserts = []
    await expect(recordProviderUsage([event()])).resolves.toBeUndefined()
    expect(db.inserts).toHaveLength(0)
  })
})
