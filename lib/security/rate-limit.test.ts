import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('@/lib/supabase/admin', () => ({ createAdminClient: vi.fn() }))

import { createAdminClient } from '@/lib/supabase/admin'
import { RATE_LIMITS, enforceRateLimit, rateLimit, rateLimitAll, type RateLimitRule } from './rate-limit'
import { RequestError, requestErrorResponse } from '@/lib/api/http'

type AdminClient = ReturnType<typeof createAdminClient>

// Aligned to a minute boundary so fixed windows start exactly here.
const T0 = Date.UTC(2026, 9, 5, 12, 0, 0)
const RULE: RateLimitRule = { name: 'unit_test', limit: 3, windowSeconds: 60 }

// The memory fallback is module state: give every test its own subject.
let seq = 0
function subject(): string {
  seq += 1
  return `org-${seq}-${Math.floor(T0 / 1000)}`
}

beforeEach(() => {
  vi.stubEnv('NODE_ENV', 'test')
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(T0)
  vi.spyOn(console, 'warn').mockImplementation(() => {})
  vi.spyOn(console, 'error').mockImplementation(() => {})
  vi.spyOn(console, 'log').mockImplementation(() => {})
})
afterEach(() => {
  vi.useRealTimers()
})

describe('rateLimit — memory fallback (test env)', () => {
  it('allows up to the limit within a window, then denies', async () => {
    const s = subject()
    const results = []
    for (let i = 0; i < 5; i++) results.push(await rateLimit(RULE, s, T0 + i * 1000))
    expect(results.map((r) => r.allowed)).toEqual([true, true, true, false, false])
    expect(results.map((r) => r.remaining)).toEqual([2, 1, 0, 0, 0])
    for (const r of results) expect(r.resetAt).toBe(T0 + 60_000)
    expect(createAdminClient).not.toHaveBeenCalled()
  })

  it('resets in the next window', async () => {
    const s = subject()
    for (let i = 0; i < 4; i++) await rateLimit(RULE, s, T0 + 10_000)
    expect((await rateLimit(RULE, s, T0 + 59_999)).allowed).toBe(false)
    const next = await rateLimit(RULE, s, T0 + 60_000)
    expect(next).toEqual({ allowed: true, remaining: 2, resetAt: T0 + 120_000 })
  })

  it('uses fixed windows (a burst at the end of one window does not carry over)', async () => {
    const s = subject()
    for (let i = 0; i < 3; i++) expect((await rateLimit(RULE, s, T0 + 59_000)).allowed).toBe(true)
    for (let i = 0; i < 3; i++) expect((await rateLimit(RULE, s, T0 + 61_000)).allowed).toBe(true)
    expect((await rateLimit(RULE, s, T0 + 61_000)).allowed).toBe(false)
  })

  it('keeps subjects and rules independent', async () => {
    const a = subject()
    const b = subject()
    for (let i = 0; i < 3; i++) await rateLimit(RULE, a, T0)
    expect((await rateLimit(RULE, a, T0)).allowed).toBe(false)
    expect((await rateLimit(RULE, b, T0)).allowed).toBe(true)
    expect((await rateLimit({ ...RULE, name: 'other_rule' }, a, T0)).allowed).toBe(true)
  })

  it('defaults now to the current clock', async () => {
    const s = subject()
    for (let i = 0; i < 3; i++) await rateLimit(RULE, s)
    expect((await rateLimit(RULE, s)).allowed).toBe(false)
    vi.setSystemTime(T0 + 60_000)
    expect((await rateLimit(RULE, s)).allowed).toBe(true)
  })
})

describe('rateLimitAll', () => {
  it('returns the first denying rule', async () => {
    const s = subject()
    const tight: RateLimitRule = { name: 'tight', limit: 1, windowSeconds: 60 }
    const loose: RateLimitRule = { name: 'loose', limit: 100, windowSeconds: 3600 }
    expect(await rateLimitAll([loose, tight], s)).toMatchObject({ allowed: true })
    const denied = await rateLimitAll([loose, tight], s)
    expect(denied).toMatchObject({ allowed: false, rule: 'tight', resetAt: T0 + 60_000 })
  })

  it('reports the last rule’s remaining count when everything allows', async () => {
    const s = subject()
    const res = await rateLimitAll([{ name: 'a', limit: 10, windowSeconds: 60 }, { name: 'b', limit: 5, windowSeconds: 60 }], s)
    expect(res).toMatchObject({ allowed: true, remaining: 4 })
    expect(res.rule).toBeUndefined()
  })
})

describe('enforceRateLimit', () => {
  it('passes while under the limit', async () => {
    const s = subject()
    await expect(enforceRateLimit(RULE, s)).resolves.toBeUndefined()
  })

  it('throws a 429 RequestError with Retry-After once the limit is hit', async () => {
    const s = subject()
    vi.setSystemTime(T0 + 15_000)
    for (let i = 0; i < 3; i++) await enforceRateLimit(RULE, s)
    const err = await enforceRateLimit(RULE, s, 'Too many previews.').then(() => null, (e: unknown) => e)
    expect(err).toBeInstanceOf(RequestError)
    const re = err as RequestError
    expect(re).toMatchObject({ status: 429, code: 'rate_limited', message: 'Too many previews.' })
    expect(re.headers).toEqual({ 'Retry-After': '45' })
    const res = requestErrorResponse(re, 'req_123456')
    expect(res.status).toBe(429)
    expect(res.headers.get('retry-after')).toBe('45')
  })

  it('accepts several rules (the platform presets included)', async () => {
    const s = subject()
    const rules = [RATE_LIMITS.voiceClone, RATE_LIMITS.voiceProvision]
    for (let i = 0; i < RATE_LIMITS.voiceClone.limit; i++) await enforceRateLimit(rules, s)
    await expect(enforceRateLimit(rules, s)).rejects.toMatchObject({ status: 429 })
  })
})

describe('rateLimit — database path', () => {
  beforeEach(() => {
    vi.stubEnv('NODE_ENV', 'production')
    vi.stubEnv('SUPABASE_SERVICE_ROLE_KEY', 'service-role-key-for-tests')
  })

  function adminWithRpc(rpc: (fn: string, args: Record<string, unknown>) => Promise<{ data: unknown; error: { message: string } | null }>) {
    const spy = vi.fn(rpc)
    vi.mocked(createAdminClient).mockReturnValue({ rpc: spy } as unknown as AdminClient)
    return spy
  }

  it('uses the atomic rate_limit_hit RPC when available', async () => {
    const rpc = adminWithRpc(async () => ({ data: [{ allowed: false, remaining: 0, reset_at: '2026-10-05T12:01:00.000Z' }], error: null }))
    const s = subject()
    const res = await rateLimit(RULE, s)
    expect(res).toEqual({ allowed: false, remaining: 0, resetAt: Date.parse('2026-10-05T12:01:00.000Z') })
    expect(rpc).toHaveBeenCalledWith('rate_limit_hit', { p_key: `unit_test:${s}`, p_limit: 3, p_window_seconds: 60 })
  })

  it('falls back to the memory window when the RPC fails (degraded, never wide open)', async () => {
    adminWithRpc(async () => ({ data: null, error: { message: 'function rate_limit_hit does not exist' } }))
    const s = subject()
    const results = []
    for (let i = 0; i < 4; i++) results.push((await rateLimit(RULE, s)).allowed)
    expect(results).toEqual([true, true, true, false])
  })

  it('falls back when the RPC returns no row', async () => {
    adminWithRpc(async () => ({ data: [], error: null }))
    const res = await rateLimit(RULE, subject())
    expect(res).toEqual({ allowed: true, remaining: 2, resetAt: T0 + 60_000 })
  })
})
