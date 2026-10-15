import { describe, expect, it } from 'vitest'
import { PLANS, type Plan } from '@/types'
import {
  AUTO_TOPUP_THRESHOLD,
  MINUTE_PACKS,
  PACK_DISCOUNTS,
  extraMinuteRate,
  isMinutePack,
  minutesCapacity,
  packQuote,
  packQuotes,
} from './minute-packs'

const PAID: Plan[] = ['starter', 'growth', 'pro', 'business', 'scale', 'custom', 'store_starter', 'store_growth', 'store_scale', 'store_enterprise']

describe('minute packs', () => {
  it('sells 100, 500, 1,000 and 2,500 minutes with 0 / 4 / 8 / 12% volume discounts', () => {
    expect([...MINUTE_PACKS]).toEqual([100, 500, 1000, 2500])
    expect(PACK_DISCOUNTS).toEqual({ 100: 0, 500: 0.04, 1000: 0.08, 2500: 0.12 })
    for (const n of MINUTE_PACKS) expect(isMinutePack(n)).toBe(true)
    for (const n of [0, 50, 99, 101, 250, 2000, 5000, -100, 100.5, NaN]) expect(isMinutePack(n)).toBe(false)
    for (const v of ['100', null, undefined, {}, [100]]) expect(isMinutePack(v)).toBe(false)
  })

  it('prices minutes at the plan extra-minute rate; the trial and unknown values cannot buy', () => {
    // Every service plan, Enterprise included, sells extra minutes at $0.20 (the homepage price list).
    for (const p of ['starter', 'growth', 'pro', 'business', 'scale', 'custom']) expect(extraMinuteRate(p), p).toBe(0.2)
    expect(extraMinuteRate('store_starter')).toBe(0.25)
    expect(extraMinuteRate('store_growth')).toBe(0.22)
    expect(extraMinuteRate('store_scale')).toBe(0.2)
    expect(extraMinuteRate('store_enterprise')).toBe(0.18)
    for (const p of PAID) expect(extraMinuteRate(p)).toBe(PLANS[p].overage_per_min)
    for (const p of ['trial', 'free', '__proto__', 'constructor', '', null, undefined]) expect(extraMinuteRate(p)).toBeNull()
  })

  it('quotes amount_cents = round(minutes × rate × (1 − discount) × 100)', () => {
    expect(packQuote('starter', 100)).toEqual({ minutes: 100, amount_cents: 2000, per_minute_cents: 20, discount: 0 })
    expect(packQuote('starter', 500)).toEqual({ minutes: 500, amount_cents: 9600, per_minute_cents: 19.2, discount: 0.04 })
    expect(packQuote('starter', 1000)).toEqual({ minutes: 1000, amount_cents: 18400, per_minute_cents: 18.4, discount: 0.08 })
    expect(packQuote('starter', 2500)).toEqual({ minutes: 2500, amount_cents: 44000, per_minute_cents: 17.6, discount: 0.12 })
    expect(packQuote('growth', 500)).toEqual({ minutes: 500, amount_cents: 9600, per_minute_cents: 19.2, discount: 0.04 })
    expect(packQuote('scale', 2500)).toEqual({ minutes: 2500, amount_cents: 44000, per_minute_cents: 17.6, discount: 0.12 })
    expect(packQuote('custom', 1000)).toEqual({ minutes: 1000, amount_cents: 18400, per_minute_cents: 18.4, discount: 0.08 })
    expect(packQuote('store_starter', 500)).toEqual({ minutes: 500, amount_cents: 12000, per_minute_cents: 24, discount: 0.04 })
    expect(packQuote('store_scale', 500)).toEqual({ minutes: 500, amount_cents: 9600, per_minute_cents: 19.2, discount: 0.04 })
    expect(packQuote('store_enterprise', 2500)).toEqual({ minutes: 2500, amount_cents: 39600, per_minute_cents: 15.84, discount: 0.12 })
    for (const p of PAID) {
      for (const m of MINUTE_PACKS) {
        const q = packQuote(p, m)!
        expect(Number.isInteger(q.amount_cents), `${p} ${m}`).toBe(true)
        expect(q.amount_cents).toBe(Math.round(m * PLANS[p].overage_per_min * (1 - PACK_DISCOUNTS[m]) * 100))
      }
    }
  })

  it('a bigger pack never costs more per minute, and never more than the plan rate', () => {
    for (const p of PAID) {
      const quotes = packQuotes(p)
      expect(quotes.map((q) => q.minutes)).toEqual([100, 500, 1000, 2500])
      for (let i = 1; i < quotes.length; i++) expect(quotes[i].per_minute_cents).toBeLessThan(quotes[i - 1].per_minute_cents)
      expect(quotes[0].per_minute_cents).toBeCloseTo(PLANS[p].overage_per_min * 100, 10)
    }
  })

  it('refuses a size that is not a pack and a plan that cannot buy', () => {
    expect(packQuote('starter', 250)).toBeNull()
    expect(packQuote('starter', 0)).toBeNull()
    expect(packQuote('trial', 100)).toBeNull()
    expect(packQuote('free', 100)).toBeNull()
    expect(packQuote(null, 100)).toBeNull()
    expect(packQuotes('trial')).toEqual([])
    expect(packQuotes(undefined)).toEqual([])
  })

  it('bounds the auto top-up threshold to 10..1000 minutes, 50 by default', () => {
    expect(AUTO_TOPUP_THRESHOLD).toEqual({ min: 10, max: 1000, default: 50 })
  })
})

describe('minutesCapacity', () => {
  it('adds the included minutes left to the purchased balance', () => {
    expect(minutesCapacity({ minutes_used: 100, minutes_limit: 150, extra_minutes_balance: 500 })).toEqual({ includedLeft: 50, extra: 500, total: 550 })
    expect(minutesCapacity({ minutes_used: 0, minutes_limit: 150 })).toEqual({ includedLeft: 150, extra: 0, total: 150 })
  })

  it('never counts overused included minutes against the balance', () => {
    expect(minutesCapacity({ minutes_used: 400, minutes_limit: 150, extra_minutes_balance: 20 })).toEqual({ includedLeft: 0, extra: 20, total: 20 })
    expect(minutesCapacity({ minutes_used: 150, minutes_limit: 150, extra_minutes_balance: 0 })).toEqual({ includedLeft: 0, extra: 0, total: 0 })
  })

  it('treats missing, negative and invalid values as 0', () => {
    expect(minutesCapacity({ minutes_used: null, minutes_limit: null, extra_minutes_balance: null })).toEqual({ includedLeft: 0, extra: 0, total: 0 })
    expect(minutesCapacity({ minutes_used: null, minutes_limit: 30 })).toEqual({ includedLeft: 30, extra: 0, total: 30 })
    expect(minutesCapacity({ minutes_used: -10, minutes_limit: 30, extra_minutes_balance: -5 })).toEqual({ includedLeft: 30, extra: 0, total: 30 })
    expect(minutesCapacity({ minutes_used: Number.NaN, minutes_limit: Number.POSITIVE_INFINITY, extra_minutes_balance: Number.NaN })).toEqual({ includedLeft: 0, extra: 0, total: 0 })
    expect(minutesCapacity({ minutes_used: 29.5, minutes_limit: 30 })).toEqual({ includedLeft: 0.5, extra: 0, total: 0.5 })
  })
})
