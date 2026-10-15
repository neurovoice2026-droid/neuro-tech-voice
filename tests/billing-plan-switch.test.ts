import { describe, expect, it } from 'vitest'
import {
  currentBillingInterval,
  expectedPlanSwitch,
  planSwitchDescription,
  planSwitchMicro,
  planSwitchToast,
  readPlanSwitchTiming,
} from '@/components/billing/plan-switch'

// The billing page's words for an in-place plan change, matching what
// POST /api/billing/checkout does (lib/stripe/plan-subscription.ts).

describe('currentBillingInterval: the cycle toggle starts on the interval the organization pays', () => {
  it('annual subscribers start on annual; monthly, unknown and missing read as monthly', () => {
    expect(currentBillingInterval('year')).toBe('year')
    expect(currentBillingInterval('month')).toBe('month')
    expect(currentBillingInterval(null)).toBe('month')
    expect(currentBillingInterval(undefined)).toBe('month')
  })
})

describe('expectedPlanSwitch', () => {
  it('a higher price on the same interval applies now', () => {
    expect(expectedPlanSwitch({ plan: 'starter', interval: 'month' }, { plan: 'pro', interval: 'month' })).toBe('now')
    expect(expectedPlanSwitch({ plan: 'pro', interval: 'year' }, { plan: 'business', interval: 'year' })).toBe('now')
    expect(expectedPlanSwitch({ plan: 'store_starter', interval: 'month' }, { plan: 'store_growth', interval: 'month' })).toBe('now')
  })

  it('a downgrade, a billing-interval change, or moving off a sales-led plan waits for the renewal', () => {
    expect(expectedPlanSwitch({ plan: 'scale', interval: 'month' }, { plan: 'starter', interval: 'month' })).toBe('renewal')
    // An annual subscriber who leaves the toggle alone stays annual; flipping it changes the interval at the renewal.
    expect(expectedPlanSwitch({ plan: 'pro', interval: 'year' }, { plan: 'business', interval: 'month' })).toBe('renewal')
    expect(expectedPlanSwitch({ plan: 'starter', interval: 'month' }, { plan: 'starter', interval: 'year' })).toBe('renewal')
    expect(expectedPlanSwitch({ plan: 'custom', interval: 'month' }, { plan: 'scale', interval: 'month' })).toBe('renewal')
  })
})

describe('readPlanSwitchTiming', () => {
  it('reads the server\'s answer; anything unexpected reads as now', () => {
    expect(readPlanSwitchTiming({ updated: true, plan: 'starter', effective: 'renewal', effective_at: '2026-11-14T10:00:00.000Z' })).toEqual({ effective: 'renewal', effectiveAt: '2026-11-14T10:00:00.000Z' })
    expect(readPlanSwitchTiming({ updated: true, plan: 'pro', effective: 'now', effective_at: null })).toEqual({ effective: 'now', effectiveAt: null })
    expect(readPlanSwitchTiming({ updated: true, plan: 'pro' })).toEqual({ effective: 'now', effectiveAt: null })
    expect(readPlanSwitchTiming({ effective: 'renewal', effective_at: 'not a date' })).toEqual({ effective: 'renewal', effectiveAt: null })
    expect(readPlanSwitchTiming(null)).toEqual({ effective: 'now', effectiveAt: null })
  })
})

describe('the words', () => {
  it('the toast says when the plan changes', () => {
    expect(planSwitchToast('Pro', { effective: 'now', effectiveAt: null })).toBe('Your plan is now Pro.')
    expect(planSwitchToast('Starter', { effective: 'renewal', effectiveAt: '2026-11-14T10:00:00.000Z' })).toBe(
      'Your plan changes to Starter on November 14, 2026. Until then you keep your current plan and its minutes.',
    )
    expect(planSwitchToast('Starter', { effective: 'renewal', effectiveAt: null })).toContain('at your next renewal')
  })

  it('the card never promises a prorated next invoice', () => {
    expect(planSwitchMicro('now')).toBe('Prorated difference charged now')
    expect(planSwitchMicro('renewal')).toBe('Starts at your next renewal')
  })

  it('the dialog says what is charged when, and an interval change out loud', () => {
    const base = { currentName: 'Starter', targetName: 'Pro', targetPrice: '$249 a month', targetMinutes: '3,000', fromInterval: 'month' as const, toInterval: 'month' as const }
    const now = planSwitchDescription({ ...base, effective: 'now' })
    expect(now).toContain('right away')
    expect(now).toContain('charged to your card now')
    expect(now).not.toMatch(/next invoice/)

    const later = planSwitchDescription({ ...base, targetName: 'Growth', targetPrice: '$990 a year', effective: 'renewal', toInterval: 'year' })
    expect(later).toContain('at your next renewal')
    expect(later).toContain('nothing is refunded or charged today')
    expect(later).toContain('Your billing also moves from monthly to annual at that renewal.')
    expect(planSwitchDescription({ ...base, effective: 'renewal' })).not.toContain('billing also moves')
  })
})
