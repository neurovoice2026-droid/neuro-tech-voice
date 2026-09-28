import { beforeEach, describe, expect, it, vi } from 'vitest'

const counts = new Map<string, number>()
const rateLimit = vi.fn(async (policy: { name: string; limit: number }, identifier: string) => {
  const key = `${policy.name}:${identifier}`
  const count = (counts.get(key) ?? 0) + 1
  counts.set(key, count)
  return { ok: count <= policy.limit, remaining: Math.max(0, policy.limit - count), resetSeconds: 60 }
})

vi.mock('@/lib/security/rate-limit', async (importOriginal) => ({
  clientIpFromHeaders: (await importOriginal<typeof import('@/lib/security/rate-limit')>()).clientIpFromHeaders,
  RATE_LIMITS: { auth: { name: 'auth', limit: 3, windowSeconds: 600 }, authFailures: { name: 'authFailures', limit: 5, windowSeconds: 600 } },
  rateLimit: (policy: { name: string; limit: number }, identifier: string) => rateLimit(policy, identifier),
  peekRateLimit: async (policy: { name: string; limit: number }, identifier: string) => {
    const count = counts.get(`${policy.name}:${identifier}`) ?? 0
    return { ok: count < policy.limit, count }
  },
}))

const { allowAccountSignIn, allowAuthAttempt, ipFromHeaders, recordFailedSignIn } = await import('./throttle')

beforeEach(() => {
  counts.clear()
  rateLimit.mockClear()
  vi.spyOn(console, 'warn').mockImplementation(() => {})
})

describe('allowAuthAttempt', () => {
  it('counts the IP and a hashed email, never the raw address', async () => {
    await allowAuthAttempt('sign_in', { ip: '203.0.113.9', email: 'owner@example.com' })
    const identifiers = rateLimit.mock.calls.map((call) => call[1])
    expect(identifiers[0]).toBe('sign_in:ip:203.0.113.9')
    expect(identifiers[1]).toMatch(/^sign_in:email:[0-9a-f]{32}$/)
    expect(identifiers.join(' ')).not.toContain('owner@example.com')
  })

  it('blocks once the IP bucket is used up, without counting the email', async () => {
    for (let i = 0; i < 3; i++) {
      expect(await allowAuthAttempt('sign_in', { ip: '1.1.1.1', email: `u${i}@example.com` })).toBe(true)
    }
    rateLimit.mockClear()
    expect(await allowAuthAttempt('sign_in', { ip: '1.1.1.1', email: 'fresh@example.com' })).toBe(false)
    expect(rateLimit).toHaveBeenCalledTimes(1)
  })

  it('blocks an account targeted from many IPs', async () => {
    for (let i = 0; i < 3; i++) {
      expect(await allowAuthAttempt('sign_in', { ip: `10.0.0.${i}`, email: 'target@example.com' })).toBe(true)
    }
    expect(await allowAuthAttempt('sign_in', { ip: '10.0.0.99', email: 'target@example.com' })).toBe(false)
  })

  it('keeps separate buckets per action', async () => {
    for (let i = 0; i < 3; i++) await allowAuthAttempt('sign_in', { ip: '2.2.2.2' })
    expect(await allowAuthAttempt('sign_in', { ip: '2.2.2.2' })).toBe(false)
    expect(await allowAuthAttempt('password_reset', { ip: '2.2.2.2', email: 'me@example.com' })).toBe(true)
  })

  it('can check the account alone when the IP was already counted for this attempt', async () => {
    await allowAuthAttempt('password_update', { ip: null, userId: 'user-2' })
    expect(rateLimit.mock.calls.map((call) => call[1])).toEqual(['password_update:user:user-2'])
  })

  it('also limits by user id when one is known', async () => {
    await allowAuthAttempt('password_update', { ip: '3.3.3.3', userId: 'user-1' })
    expect(rateLimit.mock.calls.map((call) => call[1])).toEqual(['password_update:ip:3.3.3.3', 'password_update:user:user-1'])
  })
})

describe('per-account sign-in failures (SEC-08)', () => {
  it('checks without counting, and only failed attempts use up the account’s allowance', async () => {
    for (let i = 0; i < 10; i++) expect(await allowAccountSignIn('owner@example.com')).toBe(true)
    for (let i = 0; i < 4; i++) await recordFailedSignIn('owner@example.com')
    expect(await allowAccountSignIn('owner@example.com')).toBe(true)
    await recordFailedSignIn('owner@example.com')
    expect(await allowAccountSignIn('owner@example.com')).toBe(false)
    // Other accounts are unaffected, and the raw address is never a key.
    expect(await allowAccountSignIn('someone@example.com')).toBe(true)
    expect([...counts.keys()].join(' ')).not.toContain('owner@example.com')
  })
})

describe('ipFromHeaders', () => {
  it('reads the first forwarded hop, then x-real-ip', () => {
    expect(ipFromHeaders(new Headers({ 'x-forwarded-for': '198.51.100.1, 10.0.0.1' }))).toBe('198.51.100.1')
    expect(ipFromHeaders(new Headers({ 'x-real-ip': '198.51.100.2' }))).toBe('198.51.100.2')
    expect(ipFromHeaders(new Headers())).toBe('unknown')
  })
})
