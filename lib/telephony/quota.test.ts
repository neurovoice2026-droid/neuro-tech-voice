// Plan minutes at call start: the hard cap on every plan (included minutes
// left + purchased extra minutes), the minimum capped length, fail-open on
// billing data drift and the global switch.
import { describe, expect, it, vi } from 'vitest'
import { callAllowance, connectedCallCapSeconds, MIN_CAPPED_CALL_SECONDS, minuteCapEnforced } from './quota'

describe('callAllowance', () => {
  it('caps every paid plan to its included minutes left (no more unlimited overage)', () => {
    expect(callAllowance({ plan: 'starter', minutes_used: 100, minutes_limit: 150 })).toEqual({ allowed: true, capSeconds: 3000 })
    expect(callAllowance({ plan: 'starter', minutes_used: 150, minutes_limit: 150 })).toEqual({ allowed: false, capSeconds: 0 })
    expect(callAllowance({ plan: 'starter', minutes_used: 999, minutes_limit: 150 })).toEqual({ allowed: false, capSeconds: 0 })
    for (const plan of ['pro', 'business', 'custom', 'store_starter', 'store_growth', 'store_scale', 'store_enterprise']) {
      expect(callAllowance({ plan, minutes_used: 5000, minutes_limit: 4500, extra_minutes_balance: 0 }), plan).toEqual({ allowed: false, capSeconds: 0 })
      expect(callAllowance({ plan, minutes_used: 0, minutes_limit: 10 }).allowed, plan).toBe(true)
    }
  })

  it('adds the purchased minutes once the included ones are used', () => {
    expect(callAllowance({ plan: 'starter', minutes_used: 150, minutes_limit: 150, extra_minutes_balance: 20 })).toEqual({ allowed: true, capSeconds: 1200 })
    expect(callAllowance({ plan: 'starter', minutes_used: 400, minutes_limit: 150, extra_minutes_balance: 20 })).toEqual({ allowed: true, capSeconds: 1200 })
    expect(callAllowance({ plan: 'pro', minutes_used: 840, minutes_limit: 850, extra_minutes_balance: 500 })).toEqual({ allowed: true, capSeconds: 510 * 60 })
    expect(callAllowance({ plan: 'starter', minutes_used: 150, minutes_limit: 150, extra_minutes_balance: null })).toEqual({ allowed: false, capSeconds: 0 })
    expect(callAllowance({ plan: 'starter', minutes_used: 150, minutes_limit: 150, extra_minutes_balance: -3 })).toEqual({ allowed: false, capSeconds: 0 })
  })

  it('caps a trial the same way and refuses it once its minutes are used', () => {
    expect(callAllowance({ plan: 'trial', minutes_used: 10, minutes_limit: 30 })).toEqual({ allowed: true, capSeconds: 1200 })
    expect(callAllowance({ plan: 'trial', minutes_used: 30, minutes_limit: 30 })).toEqual({ allowed: false, capSeconds: 0 })
  })

  it('never caps a call below the minimum length', () => {
    expect(callAllowance({ plan: 'trial', minutes_used: 29.5, minutes_limit: 30 })).toEqual({ allowed: true, capSeconds: MIN_CAPPED_CALL_SECONDS })
    expect(callAllowance({ plan: 'starter', minutes_used: 150, minutes_limit: 150, extra_minutes_balance: 0.25 })).toEqual({ allowed: true, capSeconds: MIN_CAPPED_CALL_SECONDS })
    expect(MIN_CAPPED_CALL_SECONDS).toBe(60)
  })

  it('fails open on unknown plans and missing limits', () => {
    expect(callAllowance({ plan: 'free', minutes_used: 99, minutes_limit: 10 })).toEqual({ allowed: true, capSeconds: null })
    expect(callAllowance({ plan: '__proto__', minutes_used: 99, minutes_limit: 10 }).allowed).toBe(true)
    expect(callAllowance({ plan: null, minutes_used: 99, minutes_limit: 10 }).allowed).toBe(true)
    expect(callAllowance({ plan: 'trial', minutes_used: 99, minutes_limit: null })).toEqual({ allowed: true, capSeconds: null })
    expect(callAllowance({ plan: 'starter', minutes_used: 99, minutes_limit: 0, extra_minutes_balance: 0 }).allowed).toBe(true)
    expect(callAllowance(null)).toEqual({ allowed: true, capSeconds: null })
    expect(callAllowance(undefined)).toEqual({ allowed: true, capSeconds: null })
  })

  it('VOICE_TRIAL_MINUTES_ENFORCED=false turns the cap off on every plan', () => {
    expect(minuteCapEnforced()).toBe(true)
    vi.stubEnv('VOICE_TRIAL_MINUTES_ENFORCED', ' FALSE ')
    expect(minuteCapEnforced()).toBe(false)
    expect(callAllowance({ plan: 'trial', minutes_used: 30, minutes_limit: 30 })).toEqual({ allowed: true, capSeconds: null })
    expect(callAllowance({ plan: 'starter', minutes_used: 999, minutes_limit: 150 })).toEqual({ allowed: true, capSeconds: null })
    vi.stubEnv('VOICE_TRIAL_MINUTES_ENFORCED', 'true')
    expect(callAllowance({ plan: 'starter', minutes_used: 999, minutes_limit: 150 }).allowed).toBe(false)
  })
})

describe('connectedCallCapSeconds', () => {
  it('is the capacity left, the minimum length when none is left, and null without a cap', () => {
    expect(connectedCallCapSeconds({ plan: 'starter', minutes_used: 140, minutes_limit: 150, extra_minutes_balance: 5 })).toBe(900)
    expect(connectedCallCapSeconds({ plan: 'starter', minutes_used: 150, minutes_limit: 150 })).toBe(MIN_CAPPED_CALL_SECONDS)
    expect(connectedCallCapSeconds({ plan: 'free', minutes_used: 999, minutes_limit: 1 })).toBeNull()
    expect(connectedCallCapSeconds(null)).toBeNull()
  })
})
