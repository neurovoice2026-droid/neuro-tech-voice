// The store plans on the landing's pricing section: every figure on a store
// card is the backend's own (types/index.ts PLANS), the audience switch
// shows both families, and the audience survives in the URL.

import { describe, expect, it } from 'vitest'
import { createElement } from 'react'
import { renderToString } from 'react-dom/server'
import { PLANS, STORE_PLANS, planAllowedFor } from '@/types'
import { AUTOMATION_TYPE_LABEL } from '@/components/commerce/labels'
import { AUTOMATION_TYPES } from '@/lib/commerce/types'
import { AUTH } from '@/lib/site'
import { STORE_INTENT } from '@/lib/auth/business-intent'
import {
  AUDIENCES,
  DEFAULT_AUDIENCE,
  STORE_PRICING_HREF,
  audienceFromUrl,
  withAudience,
} from '@/lib/pages/home/pricing-audience'
import {
  STORE_AVG_CALL_MIN,
  STORE_ENTERPRISE,
  STORE_FEATURED_ID,
  STORE_FROM,
  STORE_HOME_PLANS,
  STORE_LISTED,
  STORE_PRICING,
  STORE_SIGNUP_HREF,
  approxCalls,
  storeFee,
  storePerDay,
  storeYearly,
} from '@/lib/pages/home/store-pricing'
import { HOME_PLANS } from '@/lib/pages/home/pricing-math'
import { Pricing } from '@/components/site/home/pricing'
import { storeJumpChips, storeLight } from '@/components/site/home/pricing-store-cards'
import { serviceJumpChips } from '@/components/site/home/pricing-cards'

describe('store plan cards read the backend plan table', () => {
  it('lists every store plan, in the backend order, with its own figures and features', () => {
    expect(STORE_HOME_PLANS.map((p) => p.id)).toEqual([...STORE_PLANS])
    for (const plan of STORE_HOME_PLANS) {
      const cfg = PLANS[plan.id]
      expect(cfg.family).toBe('ecommerce')
      expect(plan.name).toBe(cfg.name)
      expect(plan.monthly).toBe(cfg.price_monthly)
      expect(plan.annual).toBe(cfg.price_annual)
      expect(plan.minutes).toBe(cfg.minutes_limit)
      expect(plan.overage).toBe(cfg.overage_per_min)
      expect(plan.features).toBe(cfg.features)
      expect(plan.contactSales).toBe(cfg.contact_sales === true)
    }
  })

  it('starts at $100 a month and climbs in fee, minutes and value', () => {
    expect(STORE_FROM).toBe(100)
    expect(STORE_LISTED[0].monthly).toBe(STORE_FROM)
    for (let i = 1; i < STORE_LISTED.length; i++) {
      const below = STORE_LISTED[i - 1]
      const here = STORE_LISTED[i]
      expect(here.monthly).toBeGreaterThan(below.monthly)
      expect(here.minutes).toBeGreaterThan(below.minutes)
      // Each rung is cheaper a minute than the one below and bills less past its allowance.
      expect(here.monthly / here.minutes).toBeLessThan(below.monthly / below.minutes)
      expect(here.overage).toBeLessThanOrEqual(below.overage)
      // Staying a rung down and paying overage never beats the rung's fee by more than the rung's
      // own fee: at the rung's allowance, the rung below plus overage is at least 90% of its fee, so an
      // upgrade is never a bad deal (the table is the backend's; this holds the shape, not the numbers).
      const belowAtAllowance = below.monthly + (here.minutes - below.minutes) * below.overage
      expect(belowAtAllowance).toBeGreaterThanOrEqual(here.monthly * 0.9)
    }
  })

  it('sends a listed plan to the register page with the store intent, and Enterprise to sales', () => {
    expect(STORE_SIGNUP_HREF).toBe(`${AUTH.signup}?intent=${STORE_INTENT}`)
    expect(STORE_SIGNUP_HREF).toBe('/register?intent=store')
    for (const plan of STORE_LISTED) expect(plan.cta).toEqual({ label: 'Start free', href: STORE_SIGNUP_HREF })
    expect(STORE_ENTERPRISE.id).toBe('store_enterprise')
    expect(STORE_ENTERPRISE.cta.href).toBe(AUTH.contactSales)
    expect(STORE_LISTED).not.toContain(STORE_ENTERPRISE)
  })

  it('marks Store Growth, and only it, as the most popular', () => {
    expect(STORE_FEATURED_ID).toBe('store_growth')
    expect(STORE_HOME_PLANS.filter((p) => p.featured).map((p) => p.id)).toEqual(['store_growth'])
    expect(STORE_PRICING.plan.pick).toBe('Most popular')
  })

  it('every store plan is one an online store may hold, and no service plan is', () => {
    for (const plan of STORE_HOME_PLANS) expect(planAllowedFor(plan.id, 'ecommerce')).toBe(true)
    for (const plan of STORE_HOME_PLANS) expect(planAllowedFor(plan.id, 'services')).toBe(false)
    for (const plan of HOME_PLANS) {
      // The service rungs the landing lists under the backend's own keys stay the service family's.
      if (plan.id in PLANS) expect(planAllowedFor(plan.id as keyof typeof PLANS, 'ecommerce')).toBe(false)
    }
  })
})

describe('store plan arithmetic', () => {
  const starter = STORE_LISTED[0]

  it('yearly billing is the table price_annual spread over twelve, two months off', () => {
    expect(storeFee(starter, false)).toBe(100)
    expect(storeFee(starter, true)).toBe(83.33)
    expect(storeYearly(starter)).toEqual({ total: 1000, off: 200 })
    expect(storePerDay(starter, false)).toBe(3.33)
    for (const plan of STORE_HOME_PLANS) expect(plan.annual).toBe(plan.monthly * 10)
  })

  it('order calls per allowance match the backend bullets, to two figures', () => {
    expect(STORE_AVG_CALL_MIN).toBe(1.5)
    expect(approxCalls(350)).toBe(230)
    expect(approxCalls(950)).toBe(630)
    expect(approxCalls(2000)).toBe(1300)
    expect(approxCalls(4500)).toBe(3000)
    expect(approxCalls(12)).toBe(8)
    for (const plan of STORE_LISTED) {
      const bullets = plan.features.join(' ').replace(/,/g, '')
      expect(bullets, `${plan.name}'s allowance bullet`).toContain(String(approxCalls(plan.minutes)))
    }
  })

  it('the store copy names the three calls and the platforms, and quotes the rates off the table', () => {
    // The pricing page names the calls as the dashboard names the automations the owner turns on.
    expect(STORE_PRICING.calls.items.map((c) => c.title)).toEqual(AUTOMATION_TYPES.map((type) => AUTOMATION_TYPE_LABEL[type]))
    expect(STORE_PRICING.calls.items.map((c) => c.title)).toEqual(['COD confirmation', 'Abandoned cart', 'Order follow-up'])
    for (const platform of ['WooCommerce', 'Shopify', 'Magento', 'PrestaShop', 'your own API']) {
      expect(STORE_PRICING.calls.platforms).toContain(platform)
    }
    expect(STORE_PRICING.sub).toContain('$100 a month')
    const last = STORE_LISTED[STORE_LISTED.length - 1]
    expect(STORE_PRICING.facts[0].body).toContain(`$${starter.overage.toFixed(2)} a minute on ${starter.name}`)
    expect(STORE_PRICING.facts[0].body).toContain(`$${last.overage.toFixed(2)} on ${last.name}`)
  })
})

describe('the audience in the URL', () => {
  it('offers the two families, service businesses first', () => {
    expect(AUDIENCES.map((a) => a.id)).toEqual(['services', 'stores'])
    expect(AUDIENCES.map((a) => a.label)).toEqual(['Service businesses', 'Online stores'])
    expect(DEFAULT_AUDIENCE).toBe('services')
  })

  it('reads the audience from the query, from the hash, and defaults to services', () => {
    expect(audienceFromUrl('?audience=stores', '#pricing')).toBe('stores')
    expect(audienceFromUrl('?utm=x&audience=stores', '')).toBe('stores')
    expect(audienceFromUrl('', '#pricing?audience=stores')).toBe('stores')
    expect(audienceFromUrl('', '#pricing')).toBe('services')
    expect(audienceFromUrl('?audience=services', '')).toBe('services')
    expect(audienceFromUrl('?audience=plumbers', '')).toBe('services')
    expect(audienceFromUrl('', '')).toBe('services')
  })

  it('a link to the estimator means the service plans, whatever the query says', () => {
    expect(audienceFromUrl('?audience=stores', '#your-bill')).toBe('services')
  })

  it('writes the audience into a URL and takes it out again, keeping everything else', () => {
    expect(withAudience('/#pricing', 'stores')).toBe('/?audience=stores#pricing')
    expect(withAudience('/?audience=stores#pricing', 'services')).toBe('/#pricing')
    expect(withAudience('/?utm=x#pricing?audience=stores', 'services')).toBe('/?utm=x#pricing')
    expect(withAudience('https://example.com/?a=1#pricing', 'stores')).toBe('https://example.com/?a=1&audience=stores#pricing')
    // Switching to the store plans from the estimator's hash drops that hash, which would have won.
    expect(withAudience('/#your-bill', 'stores')).toBe('/?audience=stores#pricing')
    expect(audienceFromUrl('?audience=stores', '#pricing')).toBe('stores')
    expect(STORE_PRICING_HREF).toBe('/?audience=stores#pricing')
  })
})

describe('the pricing section renders both families', () => {
  const html = (initialAudience?: 'services' | 'stores') => renderToString(createElement(Pricing, { initialAudience }))

  it('shows the service plans and the estimator by default, with the audience switch', () => {
    const out = html()
    expect(out).toContain('Service businesses')
    expect(out).toContain('Online stores')
    expect(out).toContain('id="plan-starter"')
    expect(out).toContain('id="your-bill"')
    expect(out).toContain('Calls on a normal day')
    expect(out).not.toContain('Store Starter')
    expect(out).not.toContain('intent=store')
  })

  it('shows the store plans, the store CTAs and what the calls do on the store tab', () => {
    const out = html('stores')
    for (const plan of STORE_HOME_PLANS) {
      expect(out).toContain(`id="plan-${plan.id}"`)
      expect(out).toContain(plan.name)
    }
    expect(out).toContain('$100')
    expect(out).toContain('$250')
    expect(out).toContain('$500')
    expect(out).toContain('From $1,000 a month')
    expect(out).toContain('Most popular')
    expect(out).toContain('href="/register?intent=store"')
    expect(out).toContain('What the calls do')
    expect(out).toContain('WooCommerce')
    expect(out).toContain('350 min included')
    expect(out).toContain('about 230 order calls a month')
    // The service estimator prices service plans only: it is not on the store tab.
    expect(out).not.toContain('id="your-bill"')
    expect(out).not.toContain('id="plan-starter"')
    // The switch says which tab is on.
    expect(out).toMatch(/aria-checked="true"[^>]*>Online stores</)
    expect(out).toMatch(/aria-checked="false"[^>]*>Service businesses</)
  })

  it('the jump chips name every card of the rail they serve, wearing a real light', () => {
    const lights = ['starter', 'growth', 'pro', 'business', 'scale', 'custom']
    const store = storeJumpChips(false)
    expect(store.map((c) => c.id)).toEqual([...STORE_PLANS])
    expect(store.map((c) => c.price)).toEqual(['$100', '$250', '$500', undefined])
    for (const chip of store) expect(lights).toContain(chip.light)
    expect(storeLight(STORE_LISTED[1], 1)).toBe('pro')
    expect(storeJumpChips(true).map((c) => c.price)).toEqual(['$83.33', '$208.33', '$416.67', undefined])
    const service = serviceJumpChips(false)
    expect(service.map((c) => c.id)).toEqual([...HOME_PLANS.map((p) => p.id), 'custom'])
    for (const chip of service) expect(lights).toContain(chip.light)
  })
})
