import { describe, expect, it } from 'vitest'
import { AUTH, COMPANY } from '@/lib/site'
import { PLANS, SERVICE_PLANS, STORE_PLANS, type Plan } from '@/types'
import { packQuote } from './minute-packs'
import {
  CONTACT_SALES_HREF,
  CONTACT_SALES_PHONE,
  QUICK_PACK,
  TALK_TO_US_LABEL,
  UPGRADE_HREF,
  buyPackHref,
  formatUsd,
  isAppPath,
  nextPlanUp,
  outOfMinutesActions,
  outOfMinutesChoice,
  planChangeRelation,
  planRank,
  upgradeLabel,
} from './upgrade'

// The out-of-minutes choice: one rung up in the organization's own family
// (SERVICE_PLANS / STORE_PLANS order), "Talk to us" for a sales-led rung, and
// the 100-minute pack at the plan's extra-minute price (never on the trial).

describe('nextPlanUp', () => {
  it('climbs the service ladder one rung at a time, Enterprise last', () => {
    const table: Array<[Plan, Plan | null]> = [
      ['starter', 'growth'],
      ['growth', 'pro'],
      ['pro', 'business'],
      ['business', 'scale'],
      ['scale', 'custom'],
      ['custom', null],
    ]
    for (const [plan, next] of table) expect(nextPlanUp(plan), plan).toBe(next)
    // The table covers every service plan.
    expect(table.map(([plan]) => plan)).toEqual([...SERVICE_PLANS])
  })

  it('climbs the store ladder one rung at a time, Store Enterprise last', () => {
    const table: Array<[Plan, Plan | null]> = [
      ['store_starter', 'store_growth'],
      ['store_growth', 'store_scale'],
      ['store_scale', 'store_enterprise'],
      ['store_enterprise', null],
    ]
    for (const [plan, next] of table) expect(nextPlanUp(plan), plan).toBe(next)
    expect(table.map(([plan]) => plan)).toEqual([...STORE_PLANS])
  })

  it('stays in the plan’s own family whatever the business type says', () => {
    expect(nextPlanUp('pro', 'ecommerce')).toBe('business')
    expect(nextPlanUp('store_starter', 'services')).toBe('store_growth')
  })

  it('sends the trial to the first paid plan of the family its business type buys from', () => {
    expect(nextPlanUp('trial', 'services')).toBe('starter')
    expect(nextPlanUp('trial', 'ecommerce')).toBe('store_starter')
    // Legacy organizations (no business type) buy service plans.
    expect(nextPlanUp('trial', null)).toBe('starter')
    expect(nextPlanUp('trial')).toBe('starter')
  })

  it('knows no next plan for a value that names no plan', () => {
    for (const value of [null, undefined, '', 'gold', '__proto__', 'toString']) expect(nextPlanUp(value)).toBeNull()
  })

  it('covers every plan of the catalog', () => {
    for (const plan of Object.keys(PLANS) as Plan[]) {
      const next = nextPlanUp(plan)
      if (next === null) expect(PLANS[plan].contact_sales, plan).toBe(true)
      else expect(PLANS[next].family === PLANS[plan].family || plan === 'trial', plan).toBe(true)
    }
  })
})

describe('planRank and planChangeRelation: one rule for every plan comparison', () => {
  it('ranks the trial (and anything unknown) at 0, a self-serve plan at its fee, a sales-led plan above every priced one', () => {
    expect(planRank('trial')).toBe(0)
    for (const value of [null, undefined, '', 'gold', '__proto__']) expect(planRank(value)).toBe(0)
    expect(planRank('growth')).toBe(99)
    expect(planRank('store_scale')).toBe(500)
    // Enterprise publishes no price (0 in PLANS) and Store Enterprise starts from $1,000: both are the top rung.
    for (const plan of ['custom', 'store_enterprise'] as Plan[]) {
      expect(PLANS[plan].contact_sales, plan).toBe(true)
      expect(planRank(plan), plan).toBe(Number.POSITIVE_INFINITY)
    }
  })

  it('every sales-led plan is the last rung of its family ladder, so the rank and nextPlanUp agree', () => {
    for (const ladder of [SERVICE_PLANS, STORE_PLANS]) {
      const ranks = ladder.map((p) => planRank(p))
      expect([...ranks].sort((a, b) => a - b), ladder.join()).toEqual(ranks)
      expect(PLANS[ladder[ladder.length - 1]].contact_sales).toBe(true)
      for (let i = 0; i + 1 < ladder.length; i++) expect(planChangeRelation(ladder[i], ladder[i + 1]), ladder[i]).toBe('upgrade')
    }
  })

  it('moving off a sales-led plan is a downgrade; nothing is an upgrade to a $0 list price', () => {
    for (const plan of SERVICE_PLANS) if (plan !== 'custom') expect(planChangeRelation('custom', plan), plan).toBe('downgrade')
    for (const plan of STORE_PLANS) if (plan !== 'store_enterprise') expect(planChangeRelation('store_enterprise', plan), plan).toBe('downgrade')
    for (const from of ['trial', 'starter', 'scale', null] as const) expect(planChangeRelation(from, 'custom'), String(from)).toBe('upgrade')
    expect(planChangeRelation('custom', 'custom')).toBe('switch')
    // Across families (never shown together) the two top rungs are level.
    expect(planChangeRelation('custom', 'store_enterprise')).toBe('switch')
  })

  it('compares self-serve plans by their monthly list price, an unknown current plan as the trial', () => {
    expect(planChangeRelation('trial', 'starter')).toBe('upgrade')
    expect(planChangeRelation('business', 'pro')).toBe('downgrade')
    expect(planChangeRelation('pro', 'pro')).toBe('switch')
    expect(planChangeRelation('gold', 'starter')).toBe('upgrade')
  })
})

describe('the sales line', () => {
  it('is the homepage’s "Talk to us" link (lib/site.ts AUTH.contactSales)', () => {
    expect(CONTACT_SALES_HREF).toBe(AUTH.contactSales)
  })

  it('prints as the company’s phone number, the same digits as the link', () => {
    expect(CONTACT_SALES_PHONE).toBe(COMPANY.phone)
    expect(`tel:${CONTACT_SALES_PHONE.replace(/\s+/g, '')}`).toBe(CONTACT_SALES_HREF)
    expect(COMPANY.phoneHref).toBe(CONTACT_SALES_HREF)
  })
})

describe('formatUsd', () => {
  it('prints whole dollars without cents and anything else with them', () => {
    expect(formatUsd(2000)).toBe('$20')
    expect(formatUsd(2250)).toBe('$22.50')
    expect(formatUsd(99900)).toBe('$999')
    expect(formatUsd(100000)).toBe('$1,000')
    expect(formatUsd(-5)).toBe('$0')
    expect(formatUsd(Number.NaN)).toBe('$0')
  })
})

describe('outOfMinutesChoice', () => {
  it('offers Pro the next plan and 100 minutes, both priced from PLANS', () => {
    const choice = outOfMinutesChoice('pro', 'services')
    expect(choice.upgrade).toEqual({ kind: 'upgrade', plan: 'business', label: 'Upgrade to Business (5,000 minutes for $499/mo)', href: '/billing#plans' })
    expect(choice.buy).toEqual({ kind: 'buy', minutes: 100, amount_cents: 2000, label: 'Buy 100 minutes for $20', href: '/billing?buy=100#minutes' })
  })

  it('prices every label from the catalog and the pack quote, never from a constant', () => {
    for (const plan of Object.keys(PLANS) as Plan[]) {
      const { upgrade, buy } = outOfMinutesChoice(plan)
      if (upgrade?.kind === 'upgrade') {
        const cfg = PLANS[upgrade.plan]
        expect(upgrade.label).toBe(`Upgrade to ${cfg.name} (${cfg.minutes_limit.toLocaleString('en-US')} minutes for ${formatUsd(cfg.price_monthly * 100)}/mo)`)
        expect(upgrade.label).toBe(upgradeLabel(upgrade.plan))
        expect(upgrade.href).toBe(UPGRADE_HREF)
      }
      const quote = packQuote(plan, QUICK_PACK)
      if (quote) expect(buy).toMatchObject({ minutes: 100, amount_cents: quote.amount_cents, label: `Buy 100 minutes for ${formatUsd(quote.amount_cents)}`, href: buyPackHref(100) })
      else expect(buy).toBeNull()
    }
  })

  it('reads the homepage price list for the service ladder', () => {
    expect(outOfMinutesChoice('starter').upgrade?.label).toBe('Upgrade to Growth (1,000 minutes for $99/mo)')
    expect(outOfMinutesChoice('growth').upgrade?.label).toBe('Upgrade to Pro (3,000 minutes for $249/mo)')
    expect(outOfMinutesChoice('business').upgrade?.label).toBe('Upgrade to Scale (15,000 minutes for $990/mo)')
    for (const plan of SERVICE_PLANS) expect(outOfMinutesChoice(plan).buy?.label, plan).toBe('Buy 100 minutes for $20')
  })

  it('offers a store its own ladder and its own extra-minute price', () => {
    expect(outOfMinutesChoice('store_starter', 'ecommerce')).toEqual({
      upgrade: { kind: 'upgrade', plan: 'store_growth', label: 'Upgrade to Store Growth (950 minutes for $250/mo)', href: '/billing#plans' },
      buy: { kind: 'buy', minutes: 100, amount_cents: 2500, label: 'Buy 100 minutes for $25', href: '/billing?buy=100#minutes' },
    })
    expect(outOfMinutesChoice('store_growth', 'ecommerce').buy?.label).toBe('Buy 100 minutes for $22')
  })

  it('turns the upgrade into "Talk to us" when the next rung is sales-led, and on the top rung', () => {
    for (const plan of ['scale', 'custom', 'store_scale', 'store_enterprise'] as Plan[]) {
      const { upgrade, buy } = outOfMinutesChoice(plan)
      expect(upgrade, plan).toMatchObject({ kind: 'contact', label: TALK_TO_US_LABEL, href: AUTH.contactSales })
      expect(buy, plan).not.toBeNull()
    }
    expect(outOfMinutesChoice('scale').upgrade?.plan).toBe('custom')
    expect(outOfMinutesChoice('store_scale').upgrade?.plan).toBe('store_enterprise')
  })

  it('never prints a price for a sales-led plan, even when asked for its upgrade label', () => {
    expect(upgradeLabel('custom')).toBe('Talk to us about Enterprise')
    expect(upgradeLabel('store_enterprise')).toBe('Talk to us about Store Enterprise')
    for (const plan of Object.keys(PLANS) as Plan[]) {
      const { upgrade } = outOfMinutesChoice(plan)
      if (upgrade) expect(upgrade.label, plan).not.toMatch(/\$0(?![.,]?\d)/)
    }
  })

  it('offers the trial its family’s first plan and no pack (it cannot buy minutes)', () => {
    expect(outOfMinutesChoice('trial', 'services')).toEqual({
      upgrade: { kind: 'upgrade', plan: 'starter', label: 'Upgrade to Starter (400 minutes for $49/mo)', href: '/billing#plans' },
      buy: null,
    })
    expect(outOfMinutesChoice('trial', 'ecommerce')).toEqual({
      upgrade: { kind: 'upgrade', plan: 'store_starter', label: 'Upgrade to Store Starter (350 minutes for $100/mo)', href: '/billing#plans' },
      buy: null,
    })
  })

  it('offers nothing for a value that names no plan', () => {
    expect(outOfMinutesChoice('gold')).toEqual({ upgrade: null, buy: null })
    expect(outOfMinutesChoice(null)).toEqual({ upgrade: null, buy: null })
  })
})

describe('outOfMinutesActions', () => {
  it('lists the upgrade then the pack, the self-serve upgrade filled', () => {
    expect(outOfMinutesActions(outOfMinutesChoice('growth'))).toEqual([
      { kind: 'upgrade', label: 'Upgrade to Pro (3,000 minutes for $249/mo)', href: '/billing#plans', primary: true },
      { kind: 'buy', label: 'Buy 100 minutes for $20', href: '/billing?buy=100#minutes', primary: false },
    ])
  })

  it('fills the pack when the upgrade is a conversation with sales', () => {
    expect(outOfMinutesActions(outOfMinutesChoice('store_scale'))).toEqual([
      { kind: 'contact', label: 'Talk to us', href: AUTH.contactSales, primary: false },
      { kind: 'buy', label: 'Buy 100 minutes for $20', href: '/billing?buy=100#minutes', primary: true },
    ])
  })

  it('gives the trial its single upgrade, filled', () => {
    expect(outOfMinutesActions(outOfMinutesChoice('trial', 'ecommerce'))).toEqual([
      { kind: 'upgrade', label: 'Upgrade to Store Starter (350 minutes for $100/mo)', href: '/billing#plans', primary: true },
    ])
    expect(outOfMinutesActions({ upgrade: null, buy: null })).toEqual([])
  })

  it('tells app paths from the sales line', () => {
    expect(isAppPath('/billing#plans')).toBe(true)
    expect(isAppPath(buyPackHref())).toBe(true)
    expect(isAppPath(AUTH.contactSales)).toBe(false)
    expect(isAppPath('//evil.example')).toBe(false)
  })
})
