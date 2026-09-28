import { describe, expect, it } from 'vitest'
import { CHECKOUT_POLL_TIMEOUT_MS, checkoutWaitState, parseBillingStatus } from './checkout-wait'

describe('checkoutWaitState', () => {
  it('waits on the billing page until the plan differs from the one it loaded with', () => {
    expect(checkoutWaitState({ flow: 'billing', initialPlan: 'trial', status: { plan: 'trial', onboarding_completed: true }, elapsedMs: 2_000 })).toBe('waiting')
    expect(checkoutWaitState({ flow: 'billing', initialPlan: 'trial', status: { plan: 'pro', onboarding_completed: true }, elapsedMs: 4_000 })).toBe('applied')
    expect(checkoutWaitState({ flow: 'billing', initialPlan: 'trial', status: null, elapsedMs: 1_000 })).toBe('waiting')
  })

  it('waits after onboarding checkout until the webhook finished onboarding', () => {
    expect(checkoutWaitState({ flow: 'onboarding', initialPlan: 'trial', status: { plan: 'trial', onboarding_completed: false }, elapsedMs: 2_000 })).toBe('waiting')
    expect(checkoutWaitState({ flow: 'onboarding', initialPlan: 'trial', status: { plan: 'starter', onboarding_completed: true }, elapsedMs: 6_000 })).toBe('applied')
  })

  it('gives up waiting after the timeout, but an applied plan always wins', () => {
    expect(checkoutWaitState({ flow: 'billing', initialPlan: 'trial', status: { plan: 'trial', onboarding_completed: true }, elapsedMs: CHECKOUT_POLL_TIMEOUT_MS })).toBe('timed_out')
    expect(checkoutWaitState({ flow: 'billing', initialPlan: 'trial', status: { plan: 'business', onboarding_completed: true }, elapsedMs: CHECKOUT_POLL_TIMEOUT_MS * 2 })).toBe('applied')
  })
})

describe('parseBillingStatus', () => {
  it('accepts the status route body and nothing else', () => {
    expect(parseBillingStatus({ plan: 'pro', onboarding_completed: true, extra: 1 })).toEqual({ plan: 'pro', onboarding_completed: true })
    expect(parseBillingStatus({ plan: 'pro' })).toBeNull()
    expect(parseBillingStatus(null)).toBeNull()
  })
})
