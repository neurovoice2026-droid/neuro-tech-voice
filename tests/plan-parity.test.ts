// The homepage price list and the plan table checkout charges from are one
// list: every number a pricing card prints is the number PLANS (types/index.ts)
// bills, the store cards included, and the feature bullets the app's plan
// cards show say what the homepage cards say. Also the three invariants the
// service ladder is built on (lib/site.ts TIERS).

import { describe, expect, it } from 'vitest'
import { PLANS, SERVICE_PLANS, STORE_PLANS, type Plan } from '@/types'
import { ENTERPRISE, PRICING_PRESETS, TIERS, costFor, feeFor } from '@/lib/site'
import { HOME_ENTERPRISE, HOME_PLANS, estimate, planBands, planFee, yearlyOf } from '@/lib/pages/home/pricing-math'
import { HOME_PRICING, perkText, type CardId } from '@/lib/pages/home/pricing'
import { STORE_ENTERPRISE, STORE_HOME_PLANS, STORE_LISTED, storeFee, storeYearly } from '@/lib/pages/home/store-pricing'
import { entitlementsFor } from '@/lib/pages/entitlements'
import { extraMinuteRate, packQuote } from '@/lib/billing/minute-packs'

const cents = (usd: number) => Math.round(usd * 100)

describe('the homepage service price list is PLANS', () => {
  it('lists the service ladder in order, with Enterprise as the backend\'s sales-led "custom"', () => {
    expect([...TIERS.map((t) => t.id), ENTERPRISE.id]).toEqual([...SERVICE_PLANS])
    expect(HOME_PLANS.map((p) => p.id)).toEqual(TIERS.map((t) => t.id))
    expect(ENTERPRISE.name).toBe(PLANS.custom.name)
    expect(HOME_ENTERPRISE.name).toBe('Enterprise')
    expect(PLANS.custom.contact_sales).toBe(true)
  })

  it('every listed rung bills what its card prints: fee, minutes, extra-minute rate, and annual = 10 × monthly', () => {
    for (const tier of TIERS) {
      const cfg = PLANS[tier.id]
      expect(tier.name, tier.id).toBe(cfg.name)
      expect(tier.monthly, tier.id).toBe(cfg.price_monthly)
      expect(tier.minutes, tier.id).toBe(cfg.minutes_limit)
      expect(tier.overage, tier.id).toBe(cfg.overage_per_min)
      expect(cfg.price_annual, tier.id).toBe(cfg.price_monthly * 10)
      // The yearly figure a card prints is the year checkout charges.
      expect(cents(feeFor(tier, true) * 12), tier.id).toBe(cents(cfg.price_annual))
      const plan = HOME_PLANS.find((p) => p.id === tier.id)!
      expect(yearlyOf(plan).total, tier.id).toBe(cfg.price_annual)
      expect(planFee(plan, false), tier.id).toBe(cfg.price_monthly)
      // The receipt's extra minutes cost what a 100-minute pack costs a minute.
      expect(packQuote(tier.id, 100)!.per_minute_cents, tier.id).toBe(cents(tier.overage))
      expect(extraMinuteRate(tier.id), tier.id).toBe(tier.overage)
    }
  })

  it('carries the owner\'s list of 23 Sep 2026', () => {
    expect(TIERS.map((t) => [t.id, t.monthly, t.minutes, t.overage])).toEqual([
      ['starter', 49, 400, 0.2],
      ['growth', 99, 1000, 0.2],
      ['pro', 249, 3000, 0.2],
      ['business', 499, 5000, 0.2],
      ['scale', 990, 15000, 0.2],
    ])
    expect(TIERS.filter((t) => t.featured).map((t) => t.id)).toEqual(['pro'])
    expect(SERVICE_PLANS.map((p) => PLANS[p].price_annual)).toEqual([490, 990, 2490, 4990, 9900, 0])
  })

  it('Enterprise publishes no price: nothing to print, in the table or on the card', () => {
    expect(PLANS.custom.price_monthly).toBe(0)
    expect(PLANS.custom.price_annual).toBe(0)
    for (const bullet of PLANS.custom.features) expect(bullet).not.toMatch(/\$/)
    expect(Object.keys(HOME_ENTERPRISE).sort()).toEqual(['cta', 'id', 'name'])
    // It starts where Scale ends, and sells extra minutes like every service plan.
    expect(PLANS.custom.minutes_limit).toBe(PLANS.scale.minutes_limit)
    expect(PLANS.custom.overage_per_min).toBe(0.2)
  })

  it('the app\'s plan cards say what the homepage cards say (feature bullets)', () => {
    const cards: CardId[] = [...TIERS.map((t) => t.id), ENTERPRISE.id]
    for (const id of cards) {
      const features = PLANS[id as Plan].features
      for (const perk of HOME_PRICING.perks[id].items) {
        // The plan table states the extra-minute rate itself ("Extra minutes at $0.20/min").
        if (perk.source.kind === 'entitlement' && perk.source.key === 'overageAllowed') continue
        expect(features, `${id}: "${perkText(perk, false)}"`).toContain(perkText(perk, false))
      }
    }
    for (const tier of TIERS) {
      const features = PLANS[tier.id].features
      expect(features[0], tier.id).toBe(`${tier.minutes.toLocaleString('en-US')} minutes/month`)
      expect(features, tier.id).toContain(`Extra minutes at $${tier.overage.toFixed(2)}/min`)
    }
  })

  it('every perk a card owes to an entitlement is one that plan has', () => {
    const cards: CardId[] = [...TIERS.map((t) => t.id), ENTERPRISE.id]
    for (const id of cards) {
      for (const perk of HOME_PRICING.perks[id].items) {
        if (perk.source.kind !== 'entitlement') continue
        const value = entitlementsFor(id as Plan)[perk.source.key]
        expect(value === true || (typeof value === 'number' && value > 0), `${id}: ${perk.source.key}`).toBe(true)
      }
    }
  })
})

describe('the service ladder holds together (lib/site.ts TIERS invariants)', () => {
  it('every rung sells extra minutes above its own effective rate', () => {
    for (const annual of [false, true]) {
      for (const t of TIERS) expect(t.overage, t.id).toBeGreaterThan(feeFor(t, annual) / t.minutes)
    }
  })

  it('every rung owns one band of calls a day where it is the cheapest', () => {
    const bands = (annual: boolean) => planBands(annual).map((b) => [b.id, b.from, b.to])
    expect(bands(false)).toEqual([
      ['starter', 1, 5],
      ['growth', 6, 14],
      ['pro', 15, 35],
      ['business', 36, 62],
      ['scale', 63, 80],
    ])
    expect(bands(true)).toEqual([
      ['starter', 1, 5],
      ['growth', 6, 13],
      ['pro', 14, 33],
      ['business', 34, 58],
      ['scale', 59, 80],
    ])
  })

  it('each handover lands inside the next rung\'s allowance', () => {
    const handovers: number[] = []
    for (let i = 1; i < TIERS.length; i++) {
      const below = TIERS[i - 1]
      const here = TIERS[i]
      // Where the rung below plus extra minutes costs the same as this rung's fee.
      const m = below.minutes + (here.monthly - below.monthly) / below.overage
      handovers.push(Math.round(m))
      expect(m, here.id).toBeLessThanOrEqual(here.minutes)
      expect(costFor(below, m, false)).toBeCloseTo(costFor(here, m, false), 6)
    }
    expect(handovers).toEqual([650, 1750, 4250, 7455])
  })

  it('the presets land exactly on a fee with nothing over: Starter $49, Growth $99, Pro $249', () => {
    expect(PRICING_PRESETS.map((p) => p.callsDay)).toEqual([3, 8, 25])
    const monthly = PRICING_PRESETS.map((p) => estimate(p.callsDay, false))
    expect(monthly.map((e) => [e.plan.id, e.total, e.overMinutes])).toEqual([
      ['starter', 49, 0],
      ['growth', 99, 0],
      ['pro', 249, 0],
    ])
    expect(PRICING_PRESETS.map((p) => estimate(p.callsDay, true).total)).toEqual([40.83, 82.5, 207.5])
  })
})

describe('the store cards are the store plans of PLANS (values unchanged)', () => {
  it('every store tier on the homepage equals PLANS', () => {
    expect(STORE_HOME_PLANS.map((p) => p.id)).toEqual([...STORE_PLANS])
    for (const card of STORE_HOME_PLANS) {
      const cfg = PLANS[card.id]
      expect(card.name).toBe(cfg.name)
      expect(card.monthly).toBe(cfg.price_monthly)
      expect(card.annual).toBe(cfg.price_annual)
      expect(card.annual).toBe(cfg.price_monthly * 10)
      expect(card.minutes).toBe(cfg.minutes_limit)
      expect(card.overage).toBe(cfg.overage_per_min)
      expect(card.features).toEqual(cfg.features)
      expect(card.contactSales).toBe(cfg.contact_sales === true)
    }
    for (const card of STORE_LISTED) {
      expect(storeYearly(card).total).toBe(PLANS[card.id].price_annual)
      expect(storeFee(card, false)).toBe(PLANS[card.id].price_monthly)
      expect(packQuote(card.id, 100)!.per_minute_cents).toBe(cents(card.overage))
    }
    expect(STORE_ENTERPRISE.id).toBe('store_enterprise')
  })

  it('keeps the store prices of their launch', () => {
    expect(STORE_PLANS.map((p) => [PLANS[p].price_monthly, PLANS[p].price_annual, PLANS[p].minutes_limit, PLANS[p].overage_per_min])).toEqual([
      [100, 1000, 350, 0.25],
      [250, 2500, 950, 0.22],
      [500, 5000, 2000, 0.2],
      [1000, 10000, 4500, 0.18],
    ])
  })
})
