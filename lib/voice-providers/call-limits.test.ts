import { describe, expect, it } from 'vitest'
import { DEFAULT_DAILY_CALL_LIMIT, PLAN_CONCURRENCY, burstingEnabled, callLimitsFor, dailyCallLimit, invalidCallLimitEnv, planConcurrency } from './call-limits'

describe('call limits from the plan', () => {
  it('maps every plan to its concurrency and defaults the daily limit and bursting', () => {
    expect(PLAN_CONCURRENCY).toEqual({ trial: 2, starter: 2, pro: 4, business: 6, custom: 10 })
    expect(callLimitsFor('pro', {})).toEqual({ concurrency: 4, daily: DEFAULT_DAILY_CALL_LIMIT, bursting: true })
    expect(DEFAULT_DAILY_CALL_LIMIT).toBe(500)
  })

  it('treats an unknown or missing plan as trial (never unlimited)', () => {
    expect(planConcurrency(null, {})).toBe(2)
    expect(planConcurrency('enterprise-hack', {})).toBe(2)
    expect(planConcurrency('__proto__', {})).toBe(2)
  })

  it('honours valid env overrides and ignores invalid ones', () => {
    const env = { ELEVENLABS_CONCURRENCY_PRO: '8', ELEVENLABS_CONCURRENCY_BUSINESS: '-1', ELEVENLABS_CONCURRENCY_TRIAL: '0', ELEVENLABS_DAILY_CALL_LIMIT: '1200', ELEVENLABS_BURSTING: 'false' }
    expect(planConcurrency('pro', env)).toBe(8)
    expect(planConcurrency('business', env)).toBe(-1)
    expect(planConcurrency('trial', env)).toBe(2)
    expect(dailyCallLimit(env)).toBe(1200)
    expect(burstingEnabled(env)).toBe(false)
    expect(dailyCallLimit({ ELEVENLABS_DAILY_CALL_LIMIT: '1e9' })).toBe(500)
    expect(invalidCallLimitEnv(env)).toEqual(['ELEVENLABS_CONCURRENCY_TRIAL'])
    expect(invalidCallLimitEnv({ ELEVENLABS_DAILY_CALL_LIMIT: 'lots', ELEVENLABS_BURSTING: 'maybe' })).toEqual(['ELEVENLABS_DAILY_CALL_LIMIT', 'ELEVENLABS_BURSTING'])
  })
})
