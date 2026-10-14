import { describe, expect, it } from 'vitest'
import {
  PLANS,
  SERVICE_PLANS,
  STORE_PLANS,
  isPlan,
  planAllowedFor,
  planFamilyOf,
  plansForBusinessType,
  stripePriceId,
  type Plan,
} from '@/types'

// The shared plan model (types/index.ts): two plan families behind one Plan
// type, the trial shared, and the rules every route and page codes against.

describe('plan catalogue', () => {
  it('lists every plan of both families, with the trial the only plan of family "any"', () => {
    expect([...SERVICE_PLANS]).toEqual(['starter', 'pro', 'business', 'custom'])
    expect([...STORE_PLANS]).toEqual(['store_starter', 'store_growth', 'store_scale', 'store_enterprise'])
    expect(Object.keys(PLANS).sort()).toEqual(['trial', ...SERVICE_PLANS, ...STORE_PLANS].sort())
    for (const p of SERVICE_PLANS) expect(PLANS[p].family).toBe('services')
    for (const p of STORE_PLANS) expect(PLANS[p].family).toBe('ecommerce')
    expect(PLANS.trial.family).toBe('any')
  })

  it('prices the store plans from $100/month, annual at ten months, cheapest first with sales-led enterprise', () => {
    expect(STORE_PLANS.map((p) => PLANS[p].price_monthly)).toEqual([100, 250, 500, 1000])
    expect(STORE_PLANS.map((p) => PLANS[p].minutes_limit)).toEqual([350, 950, 2000, 4500])
    expect(STORE_PLANS.map((p) => PLANS[p].overage_per_min)).toEqual([0.25, 0.22, 0.2, 0.18])
    for (const p of [...SERVICE_PLANS, ...STORE_PLANS]) {
      expect(PLANS[p].price_annual, p).toBe(PLANS[p].price_monthly * 10)
      expect(PLANS[p].features.length, p).toBeGreaterThanOrEqual(4)
    }
    expect(PLANS.store_enterprise.contact_sales).toBe(true)
    expect(PLANS.store_enterprise.stripe_price_id).toBe('')
    for (const p of ['store_starter', 'store_growth', 'store_scale'] as const) expect(PLANS[p].contact_sales).toBeUndefined()
  })

  it('keeps every paid store tier at or above a 60% gross margin on the $0.10/min cost model', () => {
    for (const p of ['store_starter', 'store_growth', 'store_scale'] as const) {
      const sellPerMinute = PLANS[p].price_monthly / PLANS[p].minutes_limit
      expect(sellPerMinute, p).toBeGreaterThanOrEqual(0.25)
      expect(PLANS[p].overage_per_min, p).toBeGreaterThanOrEqual(0.18)
    }
  })

  it('names the store plans in English with store-oriented features', () => {
    expect(PLANS.store_starter.name).toBe('Store Starter')
    expect(PLANS.store_starter.features).toContain('COD confirmation, abandoned cart & delivery follow-up calls')
    expect(PLANS.store_growth.features).toContain('Call recordings & analytics')
    expect(PLANS.store_scale.features).toContain('All integrations')
    expect(PLANS.store_enterprise.features).toContain('Custom scripts & SLA')
  })
})

describe('plansForBusinessType / planAllowedFor', () => {
  it('offers the store plans to online stores and the service plans to everyone else, legacy NULL included', () => {
    expect(plansForBusinessType('ecommerce')).toBe(STORE_PLANS)
    expect(plansForBusinessType('services')).toBe(SERVICE_PLANS)
    expect(plansForBusinessType(null)).toBe(SERVICE_PLANS)
    expect(plansForBusinessType(undefined)).toBe(SERVICE_PLANS)
    expect(planFamilyOf('ecommerce')).toBe('ecommerce')
    expect(planFamilyOf(null)).toBe('services')
  })

  it('allows the trial everywhere and otherwise only the plans of the organization\'s own family', () => {
    for (const t of ['services', 'ecommerce', null, undefined] as const) expect(planAllowedFor('trial', t)).toBe(true)
    for (const p of STORE_PLANS) {
      expect(planAllowedFor(p, 'ecommerce'), p).toBe(true)
      expect(planAllowedFor(p, 'services'), p).toBe(false)
      expect(planAllowedFor(p, null), p).toBe(false)
    }
    for (const p of SERVICE_PLANS) {
      expect(planAllowedFor(p, 'services'), p).toBe(true)
      expect(planAllowedFor(p, null), p).toBe(true)
      expect(planAllowedFor(p, 'ecommerce'), p).toBe(false)
    }
    // A plan value the catalogue does not know (a bad row) is allowed nowhere.
    expect(planAllowedFor('enterprise-hack' as Plan, 'ecommerce')).toBe(false)
  })

  it('isPlan recognises catalogue ids only', () => {
    expect(isPlan('store_growth')).toBe(true)
    expect(isPlan('pro')).toBe(true)
    expect(isPlan('__proto__')).toBe(false)
    expect(isPlan('')).toBe(false)
    expect(isPlan(null)).toBe(false)
  })

  it('stripePriceId reads the env-configured id per interval and is empty for sales-led tiers', () => {
    expect(stripePriceId('store_enterprise', 'month')).toBe('')
    expect(stripePriceId('custom', 'year')).toBe('')
    expect(stripePriceId('trial', 'month')).toBe('')
  })
})
