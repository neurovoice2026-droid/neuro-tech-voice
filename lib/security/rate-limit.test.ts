import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const kv = vi.hoisted(() => ({ counts: new Map<string, number>(), ttls: new Map<string, number>() }))

vi.mock('@/lib/kv', () => ({
  kvIncr: vi.fn(async (key: string, ttlSeconds: number) => {
    const next = (kv.counts.get(key) ?? 0) + 1
    kv.counts.set(key, next)
    kv.ttls.set(key, ttlSeconds)
    return next
  }),
}))

import { ApiError } from '@/lib/api/http'
import { clientIp, enforceRateLimit, RATE_LIMITS, rateLimit, rateLimitKey, type RateLimitPolicy } from './rate-limit'

const policy: RateLimitPolicy = { name: 'test', limit: 3, windowSeconds: 60 }

beforeEach(() => {
  kv.counts.clear()
  kv.ttls.clear()
  vi.useFakeTimers()
  vi.setSystemTime(new Date('2026-09-17T10:00:15Z'))
})

afterEach(() => {
  vi.useRealTimers()
})

describe('RATE_LIMITS', () => {
  it('matches the contract', () => {
    const summary = Object.fromEntries(
      Object.entries(RATE_LIMITS).map(([key, p]) => [key, [p.limit, p.windowSeconds]])
    )
    expect(summary).toEqual({
      auth: [10, 600],
      authFailures: [20, 600],
      apiWrite: [60, 60],
      voicePreview: [20, 600],
      ttsTool: [30, 600],
      sttTool: [10, 600],
      voiceLabUpload: [20, 600],
      voiceClone: [5, 86400],
      testCall: [10, 86400],
      outboundCall: [30, 3600],
      knowledgeWrite: [30, 3600],
      checkout: [10, 3600],
      phoneSearch: [30, 600],
      publicWebhook: [600, 60],
      gatewayInternal: [3000, 60],
    })
    const names = Object.values(RATE_LIMITS).map((p) => p.name)
    expect(new Set(names).size).toBe(names.length)
  })
})

describe('rateLimit', () => {
  it('counts in a fixed window keyed by policy, identifier and window start', async () => {
    const windowStart = Math.floor(Date.parse('2026-09-17T10:00:00Z') / 1000)
    expect(await rateLimit(policy, 'user-1')).toEqual({ ok: true, remaining: 2, resetSeconds: 45 })
    expect(kv.counts.has(`rl:test:user-1:${windowStart}`)).toBe(true)
    expect(kv.ttls.get(`rl:test:user-1:${windowStart}`)).toBe(60)
    await rateLimit(policy, 'user-1')
    expect(await rateLimit(policy, 'user-1')).toMatchObject({ ok: true, remaining: 0 })
    expect(await rateLimit(policy, 'user-1')).toMatchObject({ ok: false, remaining: 0 })
    // Other identifiers are independent.
    expect(await rateLimit(policy, 'user-2')).toMatchObject({ ok: true, remaining: 2 })
  })

  it('starts a new window when the old one ends', async () => {
    for (let i = 0; i < 4; i++) await rateLimit(policy, 'user-1')
    expect((await rateLimit(policy, 'user-1')).ok).toBe(false)
    vi.setSystemTime(new Date('2026-09-17T10:01:00Z'))
    expect(await rateLimit(policy, 'user-1')).toEqual({ ok: true, remaining: 2, resetSeconds: 60 })
  })

  it('normalises empty and oversized identifiers', () => {
    expect(rateLimitKey(policy, '', 0)).toBe('rl:test:unknown:0')
    expect(rateLimitKey(policy, '  ', 0)).toBe('rl:test:unknown:0')
    expect(rateLimitKey(policy, 'x'.repeat(500), 0)).toHaveLength('rl:test::0'.length + 200)
  })
})

describe('enforceRateLimit', () => {
  it('passes under the limit', async () => {
    await expect(enforceRateLimit(policy, 'org-1')).resolves.toBeUndefined()
  })

  it('throws 429 rate_limited with Retry-After', async () => {
    for (let i = 0; i < 3; i++) await enforceRateLimit(policy, 'org-1')
    const error = await enforceRateLimit(policy, 'org-1').catch((e: unknown) => e)
    expect(error).toBeInstanceOf(ApiError)
    expect(error).toMatchObject({ status: 429, code: 'rate_limited', headers: { 'Retry-After': '45' } })
    expect((error as ApiError).message).toMatch(/try again in 45 seconds/)
  })

  it('phrases long waits in minutes or hours', async () => {
    const daily: RateLimitPolicy = { name: 'daily', limit: 0, windowSeconds: 86400 }
    const error = (await enforceRateLimit(daily, 'org-1').catch((e: unknown) => e)) as ApiError
    expect(error.message).toMatch(/in about 14 hours/)
    const tenMin: RateLimitPolicy = { name: 'ten', limit: 0, windowSeconds: 600 }
    const error2 = (await enforceRateLimit(tenMin, 'org-1').catch((e: unknown) => e)) as ApiError
    expect(error2.message).toMatch(/in 10 minutes/)
  })
})

describe('clientIp', () => {
  const req = (headers: Record<string, string>) => new Request('https://app.example.com', { headers })

  it('takes the first x-forwarded-for hop', () => {
    expect(clientIp(req({ 'x-forwarded-for': ' 203.0.113.9 , 10.0.0.1', 'x-real-ip': '198.51.100.1' }))).toBe('203.0.113.9')
  })

  it('falls back to x-real-ip, then unknown', () => {
    expect(clientIp(req({ 'x-real-ip': '198.51.100.1' }))).toBe('198.51.100.1')
    expect(clientIp(req({ 'x-forwarded-for': ' ' }))).toBe('unknown')
    expect(clientIp(req({}))).toBe('unknown')
  })
})
