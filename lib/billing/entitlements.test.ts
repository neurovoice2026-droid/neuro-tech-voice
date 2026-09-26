import { describe, expect, it } from 'vitest'
import type { Organization, Plan } from '@/types'
import { PLAN_ORDER, callBlockReason, entitlementsFor, isTrialExpired, requiredPlanFor, type Entitlements } from './entitlements'

type OrgInput = Pick<Organization, 'plan' | 'minutes_used' | 'minutes_limit' | 'trial_ends_at' | 'onboarding_completed'>

const NOW = new Date('2026-09-17T10:00:00Z')

function org(overrides: Partial<OrgInput> = {}): OrgInput {
  return {
    plan: 'starter',
    minutes_used: 10,
    minutes_limit: 150,
    trial_ends_at: null,
    onboarding_completed: true,
    ...overrides,
  }
}

describe('entitlementsFor', () => {
  it('trial: basic analytics, no recordings, no Google, no SMS, no outbound, no overage', () => {
    expect(entitlementsFor('trial')).toEqual({
      recordings: false,
      googleIntegrations: false,
      advancedAnalytics: false,
      fullAnalytics: false,
      allIntegrations: false,
      voiceCloning: false,
      smsConfirmations: false,
      outboundCalls: false,
      overageAllowed: false,
      ttsCharactersPerMonth: 2_000,
      sttSecondsPerMonth: 300,
      testCallsPerDay: 5,
    })
  })

  it('starter: SMS, outbound and overage, still no recordings or Google', () => {
    expect(entitlementsFor('starter')).toEqual({
      recordings: false,
      googleIntegrations: false,
      advancedAnalytics: false,
      fullAnalytics: false,
      allIntegrations: false,
      voiceCloning: false,
      smsConfirmations: true,
      outboundCalls: true,
      overageAllowed: true,
      ttsCharactersPerMonth: 20_000,
      sttSecondsPerMonth: 3_600,
      testCallsPerDay: 10,
    })
  })

  it('pro: recordings, Google, advanced analytics and cloning, not the full suite', () => {
    expect(entitlementsFor('pro')).toEqual({
      recordings: true,
      googleIntegrations: true,
      advancedAnalytics: true,
      fullAnalytics: false,
      allIntegrations: false,
      voiceCloning: true,
      smsConfirmations: true,
      outboundCalls: true,
      overageAllowed: true,
      ttsCharactersPerMonth: 100_000,
      sttSecondsPerMonth: 18_000,
      testCallsPerDay: 20,
    })
  })

  it.each<[Plan, number, number, number]>([
    ['business', 300_000, 60_000, 30],
    ['custom', 1_000_000, 200_000, 50],
  ])('%s: everything unlocked with its quotas', (plan, tts, stt, tests) => {
    const e = entitlementsFor(plan)
    for (const [key, value] of Object.entries(e)) {
      if (typeof value === 'boolean') expect(value, key).toBe(true)
    }
    expect(e.ttsCharactersPerMonth).toBe(tts)
    expect(e.sttSecondsPerMonth).toBe(stt)
    expect(e.testCallsPerDay).toBe(tests)
  })

  it('quotas never shrink on a more expensive plan', () => {
    const numeric: (keyof Entitlements)[] = ['ttsCharactersPerMonth', 'sttSecondsPerMonth', 'testCallsPerDay']
    for (let i = 1; i < PLAN_ORDER.length; i++) {
      for (const key of numeric) {
        expect(entitlementsFor(PLAN_ORDER[i])[key]).toBeGreaterThanOrEqual(entitlementsFor(PLAN_ORDER[i - 1])[key] as number)
      }
    }
  })

  it('gives trial limits to an unknown plan and returns a copy', () => {
    expect(entitlementsFor('enterprise' as Plan)).toEqual(entitlementsFor('trial'))
    const copy = entitlementsFor('pro')
    copy.recordings = false
    expect(entitlementsFor('pro').recordings).toBe(true)
  })
})

describe('isTrialExpired', () => {
  it('is true only for a trial whose end date passed, whatever the onboarding state', () => {
    expect(isTrialExpired({ plan: 'trial', trial_ends_at: '2026-09-17T09:59:59Z' }, NOW)).toBe(true)
    expect(isTrialExpired({ plan: 'trial', trial_ends_at: '2026-09-20T00:00:00Z' }, NOW)).toBe(false)
    expect(isTrialExpired({ plan: 'trial', trial_ends_at: null }, NOW)).toBe(false)
    expect(isTrialExpired({ plan: 'trial', trial_ends_at: 'soon' }, NOW)).toBe(false)
    expect(isTrialExpired({ plan: 'pro', trial_ends_at: '2020-01-01T00:00:00Z' }, NOW)).toBe(false)
  })
})

describe('callBlockReason', () => {
  it('lets a healthy paid org take calls', () => {
    expect(callBlockReason(org(), NOW)).toBeNull()
  })

  it('refuses calls until onboarding is complete, before any other check', () => {
    expect(callBlockReason(org({ onboarding_completed: false, plan: 'trial', trial_ends_at: '2020-01-01T00:00:00Z' }), NOW)).toBe('org_not_onboarded')
  })

  it('refuses calls once the trial has ended', () => {
    expect(callBlockReason(org({ plan: 'trial', minutes_used: 0, minutes_limit: 5, trial_ends_at: '2026-09-17T09:59:59Z' }), NOW)).toBe('trial_expired')
    expect(callBlockReason(org({ plan: 'trial', minutes_used: 0, minutes_limit: 5, trial_ends_at: NOW.toISOString() }), NOW)).toBe('trial_expired')
  })

  it('answers during the trial and when the end date is missing or unreadable', () => {
    const trial = { plan: 'trial' as const, minutes_used: 1, minutes_limit: 5 }
    expect(callBlockReason(org({ ...trial, trial_ends_at: '2026-09-20T00:00:00Z' }), NOW)).toBeNull()
    expect(callBlockReason(org({ ...trial, trial_ends_at: null }), NOW)).toBeNull()
    expect(callBlockReason(org({ ...trial, trial_ends_at: 'soon' }), NOW)).toBeNull()
  })

  it('ignores trial_ends_at on paid plans', () => {
    expect(callBlockReason(org({ plan: 'pro', trial_ends_at: '2020-01-01T00:00:00Z' }), NOW)).toBeNull()
  })

  it('blocks a trial at its minute limit', () => {
    expect(callBlockReason(org({ plan: 'trial', minutes_used: 5, minutes_limit: 5, trial_ends_at: '2026-09-30T00:00:00Z' }), NOW)).toBe('minutes_exhausted')
    expect(callBlockReason(org({ plan: 'trial', minutes_used: 7, minutes_limit: 5 }), NOW)).toBe('minutes_exhausted')
    expect(callBlockReason(org({ plan: 'trial', minutes_used: 4, minutes_limit: 5 }), NOW)).toBeNull()
  })

  it('reports trial_expired before minutes_exhausted', () => {
    expect(callBlockReason(org({ plan: 'trial', minutes_used: 5, minutes_limit: 5, trial_ends_at: '2026-01-01T00:00:00Z' }), NOW)).toBe('trial_expired')
  })

  it.each<Plan>(['starter', 'pro', 'business', 'custom'])('keeps answering past the limit on %s (overage is billed)', (plan) => {
    expect(callBlockReason(org({ plan, minutes_used: 5000, minutes_limit: 150 }), NOW)).toBeNull()
  })

  it('uses the current time when none is passed', () => {
    expect(callBlockReason(org({ plan: 'trial', minutes_used: 0, minutes_limit: 5, trial_ends_at: '2000-01-01T00:00:00Z' }))).toBe('trial_expired')
  })
})

describe('requiredPlanFor', () => {
  it('returns the cheapest plan that unlocks each feature', () => {
    expect(requiredPlanFor('smsConfirmations')).toBe('starter')
    expect(requiredPlanFor('outboundCalls')).toBe('starter')
    expect(requiredPlanFor('overageAllowed')).toBe('starter')
    expect(requiredPlanFor('recordings')).toBe('pro')
    expect(requiredPlanFor('googleIntegrations')).toBe('pro')
    expect(requiredPlanFor('advancedAnalytics')).toBe('pro')
    expect(requiredPlanFor('voiceCloning')).toBe('pro')
    expect(requiredPlanFor('fullAnalytics')).toBe('business')
    expect(requiredPlanFor('allIntegrations')).toBe('business')
  })

  it('treats quotas as available from the trial', () => {
    expect(requiredPlanFor('ttsCharactersPerMonth')).toBe('trial')
    expect(requiredPlanFor('testCallsPerDay')).toBe('trial')
  })
})
