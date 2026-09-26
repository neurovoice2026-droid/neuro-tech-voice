import { describe, expect, it } from 'vitest'
import { billableSeconds, canConsume, quotaHeaders, quotaState, sumQuantities, toolUsagePeriod } from './quota'

describe('toolUsagePeriod', () => {
  const now = new Date('2026-09-17T12:00:00Z')

  it('uses the organisation billing period when it covers now', () => {
    const period = toolUsagePeriod(
      { usage_period_start: '2026-09-05T08:00:00Z', usage_period_end: '2026-10-05T08:00:00Z' },
      now
    )
    expect(period.start.toISOString()).toBe('2026-09-05T08:00:00.000Z')
    expect(period.end.toISOString()).toBe('2026-10-05T08:00:00.000Z')
  })

  it('falls back to the UTC calendar month without a period', () => {
    const period = toolUsagePeriod({ usage_period_start: null, usage_period_end: null }, now)
    expect(period.start.toISOString()).toBe('2026-09-01T00:00:00.000Z')
    expect(period.end.toISOString()).toBe('2026-10-01T00:00:00.000Z')
  })

  it('falls back when the stored period is stale, inverted or unparseable', () => {
    const month = toolUsagePeriod({ usage_period_start: null, usage_period_end: null }, now)
    expect(toolUsagePeriod({ usage_period_start: '2026-08-01T00:00:00Z', usage_period_end: '2026-09-01T00:00:00Z' }, now)).toEqual(month)
    expect(toolUsagePeriod({ usage_period_start: '2026-10-01T00:00:00Z', usage_period_end: '2026-09-01T00:00:00Z' }, now)).toEqual(month)
    expect(toolUsagePeriod({ usage_period_start: 'soon', usage_period_end: 'later' }, now)).toEqual(month)
  })

  it('rolls over December into January', () => {
    const period = toolUsagePeriod({ usage_period_start: null, usage_period_end: null }, new Date('2026-12-31T23:59:59Z'))
    expect(period.end.toISOString()).toBe('2027-01-01T00:00:00.000Z')
  })

  it('treats the period end as exclusive', () => {
    const period = toolUsagePeriod(
      { usage_period_start: '2026-08-17T12:00:00Z', usage_period_end: '2026-09-17T12:00:00Z' },
      now
    )
    expect(period.start.toISOString()).toBe('2026-09-01T00:00:00.000Z')
  })
})

describe('quota math', () => {
  it('computes remaining without going negative', () => {
    expect(quotaState(2000, 500)).toEqual({ limit: 2000, used: 500, remaining: 1500 })
    expect(quotaState(2000, 2600)).toEqual({ limit: 2000, used: 2600, remaining: 0 })
    expect(quotaState(300, 12.345)).toEqual({ limit: 300, used: 12.35, remaining: 287.65 })
    expect(quotaState(NaN, -5)).toEqual({ limit: 0, used: 0, remaining: 0 })
  })

  it('allows exactly the remaining amount and nothing past it', () => {
    const state = quotaState(2000, 1000)
    expect(canConsume(state, 1000)).toBe(true)
    expect(canConsume(state, 1001)).toBe(false)
    expect(canConsume(state, 0)).toBe(true)
    expect(canConsume(quotaState(2000, 2000), 0)).toBe(false)
    expect(canConsume(quotaState(0, 0), 0)).toBe(false)
  })

  it('sums numeric and string quantities, ignoring junk', () => {
    expect(sumQuantities([{ quantity: 100 }, { quantity: '250.5' }, { quantity: null }, { quantity: 'x' }, { quantity: -3 }])).toBe(350.5)
    expect(sumQuantities([])).toBe(0)
    expect(sumQuantities([{ quantity: 0.1 }, { quantity: 0.2 }])).toBe(0.3)
  })

  it('builds quota headers', () => {
    const headers = quotaHeaders(quotaState(20000, 1234), {
      start: new Date('2026-09-01T00:00:00Z'),
      end: new Date('2026-10-01T00:00:00Z'),
    })
    expect(headers).toEqual({
      'X-Quota-Limit': '20000',
      'X-Quota-Used': '1234',
      'X-Quota-Remaining': '18766',
      'X-Quota-Resets-At': '2026-10-01T00:00:00.000Z',
    })
  })

  it('bills the reported duration, else the measured one, rounded up', () => {
    expect(billableSeconds(12.341, 99)).toBe(12.35)
    expect(billableSeconds(null, 3.001)).toBe(3.01)
    expect(billableSeconds(0, null)).toBe(0)
  })
})
