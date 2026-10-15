import { describe, expect, it, vi } from 'vitest'
import { fakeDb } from '@/tests/helpers/fake-db'
import type { Logger } from '@/lib/observability/logger'
import { addCalendarMonth, applyUpgradeMinutes, upgradeMinutesUsed, usagePeriodElapsed } from './plan-change-minutes'

const DAY_MS = 86_400_000

function logger(): Logger & { error: ReturnType<typeof vi.fn> } {
  const l = { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn(), context: {} } as unknown as Logger & { error: ReturnType<typeof vi.fn> }
  ;(l as unknown as { child: () => Logger }).child = () => l
  return l
}

describe('upgradeMinutesUsed: the minutes follow what was paid', () => {
  it('keeps the old allowance and adds the new minutes for the share of the period left', () => {
    // Starter 400 → Pro 3,000, a quarter gone, 100 used: 750 counted → 2,250 left (300 + 3/4 × 2,600).
    expect(upgradeMinutesUsed({ used: 100, oldLimit: 400, newLimit: 3000, elapsed: 0.25 })).toBe(750)
  })

  it('at the very start of the period the whole new allowance is left; at the end, none of the new minutes', () => {
    expect(upgradeMinutesUsed({ used: 0, oldLimit: 400, newLimit: 3000, elapsed: 0 })).toBe(0)
    expect(upgradeMinutesUsed({ used: 400, oldLimit: 400, newLimit: 3000, elapsed: 1 })).toBe(3000)
  })

  it('minutes drawn from the purchased balance are not counted against the new allowance', () => {
    // 450 used = 400 included + 50 purchased (already spent from the balance).
    expect(upgradeMinutesUsed({ used: 450, oldLimit: 400, newLimit: 1000, elapsed: 0.5 })).toBe(700)
  })

  it('changes nothing when the new allowance is not larger, and clamps odd inputs', () => {
    expect(upgradeMinutesUsed({ used: 120, oldLimit: 15000, newLimit: 15000, elapsed: 0.5 })).toBe(120)
    expect(upgradeMinutesUsed({ used: 120, oldLimit: 3000, newLimit: 400, elapsed: 0.5 })).toBe(120)
    expect(upgradeMinutesUsed({ used: 0, oldLimit: 400, newLimit: 1000, elapsed: 7 })).toBe(600)
    expect(upgradeMinutesUsed({ used: 0, oldLimit: 400, newLimit: 1000, elapsed: Number.NaN })).toBe(0)
  })
})

describe('usagePeriodElapsed', () => {
  const start = Date.UTC(2027, 0, 1) / 1000
  it('a monthly plan: the share of its Stripe period gone', () => {
    const end = start + 30 * 86_400
    expect(usagePeriodElapsed({ periodStart: start, periodEnd: end, interval: 'month', usagePeriodStart: null, now: (start + 15 * 86_400) * 1000 })).toBeCloseTo(0.5)
    expect(usagePeriodElapsed({ periodStart: start, periodEnd: end, interval: 'month', usagePeriodStart: null, now: (end + 100) * 1000 })).toBe(1)
  })

  it('an annual plan: the share of the current month of the year, from the recorded usage period', () => {
    const yearEnd = Date.UTC(2028, 0, 1) / 1000
    const march = Date.UTC(2027, 2, 1)
    expect(usagePeriodElapsed({ periodStart: start, periodEnd: yearEnd, interval: 'year', usagePeriodStart: new Date(march).toISOString(), now: march + 10 * DAY_MS })).toBeCloseTo(10 / 31)
  })

  it('an annual plan without a recorded usage period counts months from the period start', () => {
    const yearEnd = Date.UTC(2028, 0, 1) / 1000
    const now = Date.UTC(2027, 3, 16)
    // April 1 → May 1 (30 days), 15 days gone.
    expect(usagePeriodElapsed({ periodStart: start, periodEnd: yearEnd, interval: 'year', usagePeriodStart: null, now })).toBeCloseTo(15 / 30)
  })
})

describe('addCalendarMonth', () => {
  it('clamps the day like Postgres', () => {
    expect(new Date(addCalendarMonth(Date.UTC(2027, 0, 31, 9))).toISOString()).toBe('2027-02-28T09:00:00.000Z')
    expect(new Date(addCalendarMonth(Date.UTC(2028, 0, 31))).toISOString()).toBe('2028-02-29T00:00:00.000Z')
    expect(new Date(addCalendarMonth(Date.UTC(2027, 11, 15))).toISOString()).toBe('2028-01-15T00:00:00.000Z')
  })
})

describe('applyUpgradeMinutes', () => {
  const ORG = 'org-1'

  it('writes the prorated minutes with the new limit, as a compare-and-set on the minutes it read', async () => {
    const db = fakeDb((c) => (c.op === 'select' ? { data: { minutes_used: 100 }, error: null } : { data: [{ id: ORG }], error: null }))
    expect(await applyUpgradeMinutes(db as never, ORG, { oldLimit: 400, newLimit: 3000, elapsed: 0.25 }, logger())).toBe(true)
    const write = db.calls.find((c) => c.op === 'update')
    expect(write?.payload).toEqual({ minutes_used: 750, minutes_limit: 3000 })
    expect(write?.filters).toEqual([['eq', 'id', ORG], ['eq', 'minutes_used', 100]])
  })

  it('a call recorded meanwhile makes it read again and recompute, never overwriting that usage', async () => {
    let used = 100
    let writes = 0
    const db = fakeDb((c) => {
      if (c.op === 'select') return { data: { minutes_used: used }, error: null }
      writes += 1
      if (writes === 1) {
        used = 103 // record_call_usage landed between the read and the write
        return { data: [], error: null }
      }
      return { data: [{ id: ORG }], error: null }
    })
    expect(await applyUpgradeMinutes(db as never, ORG, { oldLimit: 400, newLimit: 3000, elapsed: 0.25 }, logger())).toBe(true)
    const last = db.calls.filter((c) => c.op === 'update').at(-1)
    expect(last?.payload).toEqual({ minutes_used: 753, minutes_limit: 3000 })
    expect(last?.filters).toContainEqual(['eq', 'minutes_used', 103])
  })

  it('gives up (logged) after repeated contention or a database error', async () => {
    const log = logger()
    const contended = fakeDb((c) => (c.op === 'select' ? { data: { minutes_used: 1 }, error: null } : { data: [], error: null }))
    expect(await applyUpgradeMinutes(contended as never, ORG, { oldLimit: 400, newLimit: 3000, elapsed: 0.5 }, log)).toBe(false)
    expect(contended.calls.filter((c) => c.op === 'update')).toHaveLength(3)
    expect(log.error).toHaveBeenCalledWith('billing.upgrade_minutes_contended', null, { attempts: 3 })

    const broken = fakeDb(() => ({ data: null, error: { message: 'connection reset' } }))
    expect(await applyUpgradeMinutes(broken as never, ORG, { oldLimit: 400, newLimit: 3000, elapsed: 0.5 }, logger())).toBe(false)
  })
})
