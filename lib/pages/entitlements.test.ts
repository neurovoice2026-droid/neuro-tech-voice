import { describe, expect, it } from 'vitest'
import { PLANS, SERVICE_PLANS, STORE_PLANS } from '@/types'
import { PLAN_ORDER, STORE_PLAN_EQUIVALENT, entitlementsFor, requiredPlanFor } from './entitlements'

describe('entitlements of the service ladder', () => {
  it('follow the homepage cards: Growth is Starter with more minutes, Scale is Business with more minutes', () => {
    expect(entitlementsFor('growth')).toEqual(entitlementsFor('starter'))
    expect(entitlementsFor('scale')).toEqual(entitlementsFor('business'))
    expect(entitlementsFor('growth')).toMatchObject({ smsConfirmations: true, outboundCalls: true, overageAllowed: true, recordings: false, voiceCloning: false })
    expect(entitlementsFor('scale')).toMatchObject({ recordings: true, fullAnalytics: true, allIntegrations: true })
    // Enterprise has the largest voice-lab allowance and the most test calls.
    for (const p of SERVICE_PLANS.filter((x) => x !== 'custom')) {
      expect(entitlementsFor('custom').ttsCharactersPerMonth, p).toBeGreaterThan(entitlementsFor(p).ttsCharactersPerMonth)
      expect(entitlementsFor('custom').testCallsPerDay, p).toBeGreaterThan(entitlementsFor(p).testCallsPerDay)
    }
  })
})

describe('entitlements of the store plans', () => {
  it('equal those of the listed service plan with the nearest price, and the sales-led tier those of Enterprise', () => {
    const listedServices = SERVICE_PLANS.filter((p) => !PLANS[p].contact_sales)
    for (const [store, service] of Object.entries(STORE_PLAN_EQUIVALENT) as Array<[keyof typeof STORE_PLAN_EQUIVALENT, (typeof STORE_PLAN_EQUIVALENT)[keyof typeof STORE_PLAN_EQUIVALENT]]>) {
      expect(entitlementsFor(store), store).toEqual(entitlementsFor(service))
      expect(SERVICE_PLANS, store).toContain(service)
      if (PLANS[store].contact_sales) {
        expect(PLANS[service].contact_sales, store).toBe(true)
        continue
      }
      // "Nearest" is a fact about PLANS, not a convention: no other listed service plan is closer in price.
      const distance = (p: (typeof SERVICE_PLANS)[number]) => Math.abs(PLANS[p].price_monthly - PLANS[store].price_monthly)
      expect(PLANS[service].contact_sales, store).toBeUndefined()
      expect(Math.min(...listedServices.map(distance)), store).toBe(distance(service))
    }
  })

  it('match the feature lists: recordings and analytics from Store Growth, every integration from Store Scale, outbound calls on every paid store plan', () => {
    expect(entitlementsFor('store_starter')).toMatchObject({ outboundCalls: true, overageAllowed: true, recordings: false, advancedAnalytics: false, allIntegrations: false })
    expect(entitlementsFor('store_growth')).toMatchObject({ recordings: true, advancedAnalytics: true, allIntegrations: false })
    expect(entitlementsFor('store_scale')).toMatchObject({ recordings: true, fullAnalytics: true, allIntegrations: true })
    expect(entitlementsFor('store_enterprise')).toEqual(entitlementsFor('custom'))
  })

  it('an unknown plan value gets trial rights, never more', () => {
    expect(entitlementsFor('enterprise-hack' as never)).toEqual(entitlementsFor('trial'))
    expect(entitlementsFor('trial').outboundCalls).toBe(false)
  })
})

describe('PLAN_ORDER / requiredPlanFor', () => {
  it('lists every plan once, cheapest first, the sales-led tiers last', () => {
    expect([...PLAN_ORDER].sort()).toEqual(Object.keys(PLANS).sort())
    const priced = PLAN_ORDER.filter((p) => !PLANS[p].contact_sales)
    const prices = priced.map((p) => PLANS[p].price_monthly)
    expect(prices).toEqual([...prices].sort((a, b) => a - b))
    expect(PLAN_ORDER.slice(priced.length)).toEqual(['custom', 'store_enterprise'])
  })

  it('answers with a service plan by default and with a store plan for online stores, never the other family', () => {
    expect(requiredPlanFor('recordings')).toBe('pro')
    expect(requiredPlanFor('smsConfirmations')).toBe('starter')
    expect(requiredPlanFor('allIntegrations')).toBe('business')
    // Growth adds minutes, not features: nothing starts on it.
    expect(requiredPlanFor('outboundCalls')).toBe('starter')
    expect(requiredPlanFor('voiceCloning')).toBe('pro')
    expect(requiredPlanFor('ttsCharactersPerMonth')).toBe('trial')
    expect(requiredPlanFor('recordings', 'ecommerce')).toBe('store_growth')
    expect(requiredPlanFor('voiceCloning', 'ecommerce')).toBe('store_growth')
    expect(requiredPlanFor('outboundCalls', 'ecommerce')).toBe('store_starter')
    expect(requiredPlanFor('allIntegrations', 'ecommerce')).toBe('store_scale')
    for (const feature of ['recordings', 'voiceCloning', 'fullAnalytics'] as const) {
      expect(STORE_PLANS).toContain(requiredPlanFor(feature, 'ecommerce'))
      expect(SERVICE_PLANS).toContain(requiredPlanFor(feature, 'services'))
    }
  })
})
