// The app's plan cards are the homepage's: one presentational card
// (components/pricing/PlanTierCard.tsx) drawn by the homepage's #pricing
// and by the onboarding launch steps and the billing page, every figure
// read off PLANS. These tests hold the app's card for a plan to the
// homepage's card for the same plan (figures, words, light, pick, perks),
// the app's choosing additions (radio, selected / current state, locked
// card), the billing page's button relation from a plan without a price,
// and the shared stylesheet to the palettes it mirrors and to its scope.

import { readFileSync } from 'node:fs'
import { createElement } from 'react'
import { renderToString } from 'react-dom/server'
import { describe, expect, it, vi } from 'vitest'

// next/font only exists under Next's compiler; the cards' wrapper declares the face's variable.
vi.mock('@/components/pricing/fonts', () => ({ planTierDisplay: { variable: 'font-plan-tier-test' } }))

import { PLANS, SERVICE_PLANS, STORE_PLANS, type Plan } from '@/types'
import { HOME_PRICING, perkText } from '@/lib/pages/home/pricing'
import { HOME_PLANS, perDay, planFee, yearlyOf } from '@/lib/pages/home/pricing-math'
import { STORE_LISTED, STORE_PRICING, storeFee, storePerDay, storeYearly } from '@/lib/pages/home/store-pricing'
import { PAID_PLAN_TRIAL_LINE, PRICING_TRIAL } from '@/lib/site'
import { ENTERPRISE_LIGHT, PLAN_LIGHTS } from '@/components/site/home/palettes'
import { Pricing } from '@/components/site/home/pricing'
import { storeLight } from '@/components/site/home/pricing-store-cards'
import { TRIAL_LIGHT, TIER_BLOBS } from '@/components/pricing/lights'
import { TRIAL_TIER, isPickPlan, planTierFigures, planTierLight, planTierView } from '@/components/pricing/plan-tier-view'
import { BILLING_CYCLE_LABEL, billingPickerPlans, currentPlanName, planPriceText } from '@/components/pricing/plan-change'
import { planChangeRelation } from '@/components/billing/minutes-logic'
import { AppPlanTierCard, PlanTierRadio, PlanTierStatus, PlanTiers, appJumpChips, tierButtonClass } from '@/components/pricing/AppPlanTiers'
import { ContactSalesNote, ContactSalesPlanCard } from '@/components/onboarding/commerce/ContactSalesPlanCard'
import { PlanChoice, Step6Launch, launchMicro } from '@/components/onboarding/steps/Step5Launch'
import { LaunchStep } from '@/components/onboarding/commerce/steps/LaunchStep'
import { CommerceNavigationContext } from '@/components/onboarding/commerce/navigation'
import type { Organization } from '@/types'

/** Server-rendered HTML without React's text-node separators, so a sentence built from parts reads whole. */
function render(element: Parameters<typeof renderToString>[0]): string {
  return renderToString(element).replaceAll('<!-- -->', '')
}

/** The visible text of some HTML: tags out, entities of the cards decoded, whitespace collapsed. */
function text(html: string): string {
  return html
    .replace(/<[^>]+>/g, ' ')
    .replaceAll('&amp;', '&')
    .replaceAll('&#x27;', "'")
    .replaceAll('&quot;', '"')
    .replace(/\s+/g, ' ')
    .trim()
}

const noop = () => undefined

function appCard(plan: Plan, annual = false, extra: Partial<Parameters<typeof AppPlanTierCard>[0]> = {}) {
  return render(
    createElement(AppPlanTierCard, {
      plan,
      annual,
      index: 0,
      idPrefix: 'test',
      action: createElement('span', null, 'ACTION'),
      ...extra,
    }),
  )
}

/** The homepage's card for a plan, cut out of the rendered #pricing section (its <li>, perks list and all). */
function homeCard(html: string, plan: string): string {
  const start = html.indexOf(`<li id="plan-${plan}"`)
  expect(start, plan).toBeGreaterThanOrEqual(0)
  let depth = 0
  const tag = /<li[\s>]|<\/li>/g
  tag.lastIndex = start
  for (let m = tag.exec(html); m; m = tag.exec(html)) {
    depth += m[0] === '</li>' ? -1 : 1
    if (depth === 0) return html.slice(start, m.index + 5)
  }
  throw new Error(`no end to the card of ${plan}`)
}

describe('the app card for a plan says what the homepage card for it says', () => {
  const services = render(createElement(Pricing, {}))
  const stores = render(createElement(Pricing, { initialAudience: 'stores' }))

  it('every listed service plan: the same figures as the homepage, monthly and yearly', () => {
    for (const plan of HOME_PLANS) {
      for (const annual of [false, true]) {
        const figures = planTierFigures(plan.id, annual)
        expect(figures.fee, plan.id).toBe(planFee(plan, annual))
        expect(figures.perDay, plan.id).toBe(perDay(plan, annual))
        expect(figures.yearlyFee, plan.id).toBe(planFee(plan, true))
        expect(figures.yearTotal, plan.id).toBe(yearlyOf(plan).total)
        expect(figures.yearOff, plan.id).toBe(yearlyOf(plan).off)
        const view = planTierView(plan.id, annual)
        expect(view.light, plan.id).toBe(plan.id)
        expect(view.pick, plan.id).toBe(plan.featured)
        expect(view.perks.items, plan.id).toEqual(HOME_PRICING.perks[plan.id].items.map((p) => perkText(p, annual)))
      }
    }
  })

  it('every listed store plan: the same figures, light and feature list as the homepage store card', () => {
    STORE_LISTED.forEach((plan, rung) => {
      for (const annual of [false, true]) {
        const figures = planTierFigures(plan.id, annual)
        expect(figures.fee, plan.id).toBe(storeFee(plan, annual))
        expect(figures.perDay, plan.id).toBe(storePerDay(plan, annual))
        expect(figures.yearTotal, plan.id).toBe(storeYearly(plan).total)
        expect(figures.yearOff, plan.id).toBe(storeYearly(plan).off)
      }
      expect(planTierLight(plan.id), plan.id).toBe(storeLight(plan, rung))
      expect(planTierView(plan.id, false).perks.items, plan.id).toEqual([...PLANS[plan.id].features])
      expect(isPickPlan(plan.id), plan.id).toBe(plan.featured)
    })
  })

  it('a service card in the app reads, word for word, like the homepage card (the homepage\'s button aside)', () => {
    for (const plan of HOME_PLANS) {
      const home = text(homeCard(services, plan.id)).replace(` ${plan.cta.label} ${HOME_PRICING.plan.trialMicro}`, '')
      const app = text(appCard(plan.id)).replace(' ACTION', '')
      // The homepage card also says which band of calls it is the cheapest for (its estimator).
      expect(home.replace(/ Cheapest [^.]*? calls a day/, ''), plan.id).toBe(app)
    }
  })

  it('a store card in the app reads, word for word, like the homepage store card', () => {
    for (const plan of STORE_LISTED) {
      const home = text(homeCard(stores, plan.id)).replace(` ${plan.cta.label} 5 free minutes, no card`, '')
      expect(home, plan.id).toBe(text(appCard(plan.id)).replace(' ACTION', ''))
    }
  })

  it('the Pro card: magenta pearl, ring, badge, the larger fee, and the homepage numbers', () => {
    const html = appCard('pro')
    expect(html).toContain('data-plan="pro"')
    expect(html).toContain('data-pick="true"')
    expect(html).toContain('home-plan-ring')
    expect(html).toContain('home-plan-fee-pick')
    const words = text(html)
    for (const phrase of ['Pro', 'Our pick', '$249', '/mo', '$8.30 a day', 'or $207.50/mo billed yearly', '3,000 min included', 'then prepaid extra minutes at $0.20', 'Everything in Growth, plus', 'Call recordings']) {
      expect(words, phrase).toContain(phrase)
    }
    expect(text(appCard('pro', true))).toContain('$2,490 a year, $498 off')
  })

  it('Enterprise prints no price at all; Store Enterprise starts from its fee', () => {
    const enterprise = appCard('custom')
    expect(enterprise).toContain('home-plan-enterprise')
    expect(enterprise).toContain('data-plan="custom"')
    expect(text(enterprise)).toContain('Priced with you')
    expect(text(enterprise)).toContain('Everything in Scale, plus')
    expect(text(enterprise).replace(' ACTION', '')).not.toMatch(/\$/)
    const store = appCard('store_enterprise')
    expect(store).toContain('data-plan="custom"')
    expect(text(store)).toContain('From $1,000 a month')
    expect(text(store)).toContain('4,500 minutes and up')
  })

  it('the trial: its own quiet light, $0 for 14 days, five minutes, no extra minutes', () => {
    const html = appCard('trial')
    expect(html).toContain('data-plan="trial"')
    expect(html).not.toContain('data-pick')
    const words = text(html)
    for (const phrase of [TRIAL_TIER.name, '$0', TRIAL_TIER.unit, TRIAL_TIER.line, TRIAL_TIER.note, '5 min included', TRIAL_TIER.then, ...PLANS.trial.features]) {
      expect(words, phrase).toContain(phrase)
    }
    expect(words).toContain(TRIAL_TIER.spoken)
  })

  it('every plan of both families has a card and a light with flowing pools', () => {
    for (const plan of ['trial', ...SERVICE_PLANS, ...STORE_PLANS] as Plan[]) {
      const view = planTierView(plan, false)
      expect(TIER_BLOBS[view.light].length, plan).toBeGreaterThan(0)
      expect(appCard(plan)).toContain(`data-plan="${view.light}"`)
    }
  })
})

describe('choosing in the app', () => {
  it('the wrapper scopes the cards, declares the display face and lays out a rail, then two columns', () => {
    const html = render(createElement(PlanTiers, { role: 'radiogroup', 'aria-label': 'Plans' }, createElement('span', null, 'x')))
    expect(html).toContain('role="radiogroup"')
    expect(html).toMatch(/class="plan-tiers font-plan-tier-test [^"]*snap-x[^"]*sm:grid-cols-2/)
  })

  it('a selected card is ringed with a tab, and its button is the checked radio', () => {
    const radio = createElement(PlanTierRadio, { name: 'Pro', selected: true, pick: true, onSelect: noop })
    const html = appCard('pro', false, { state: 'selected', stateLabel: 'Selected', action: radio })
    expect(html).toContain('data-state="selected"')
    expect(html).toMatch(/<span aria-hidden="true" class="home-plan-tab">Selected<\/span>/)
    expect(html).toMatch(/role="radio" aria-checked="true"/)
    // Chosen: the quiet button, never the magenta one, and the plan's name for a screen reader.
    expect(html).not.toContain('home-plan-cta-pick')
    expect(html).toContain('Selected<span class="sr-only">: Pro</span>')
  })

  it('an unselected card offers "Choose <plan>", magenta on the pick; a click on the card chooses it', () => {
    const radio = createElement(PlanTierRadio, { name: 'Pro', selected: false, pick: true, onSelect: noop })
    const html = appCard('pro', false, { action: radio, onPick: noop })
    expect(html).toMatch(/role="radio" aria-checked="false"/)
    expect(text(html)).toContain('Choose Pro')
    expect(html).toContain('home-plan-cta-pick')
    const root = html.slice(0, html.indexOf('>'))
    expect(root).toContain('data-pickable="true"')
    expect(root).not.toContain('data-state')
  })

  it('a locked card steps back and does not select', () => {
    const radio = createElement(PlanTierRadio, { name: 'Growth', selected: false, pick: false, disabled: true, onSelect: noop })
    const html = appCard('growth', false, { action: radio, onPick: noop, disabled: true })
    expect(html).toContain('data-disabled="true"')
    expect(html).not.toContain('data-pickable')
    expect(html).toMatch(/<button[^>]*disabled=""/)
  })

  it('the current plan is ringed with "Current plan" and says so in place of a button', () => {
    const html = appCard('business', false, {
      state: 'current',
      stateLabel: 'Current plan',
      action: createElement(PlanTierStatus, null, 'Your current plan'),
    })
    expect(html).toContain('data-state="current"')
    expect(text(html)).toContain('Current plan')
    expect(text(html)).toContain('Your current plan')
  })

  it('the buttons are the homepage card\'s pill: ink, the pick\'s magenta, or quiet once chosen', () => {
    expect(tierButtonClass()).toContain('bg-pp-ink')
    expect(tierButtonClass({ pick: true })).toContain('home-plan-cta-pick')
    expect(tierButtonClass({ pick: true, quiet: true })).not.toContain('home-plan-cta-pick')
    expect(tierButtonClass({ quiet: true })).toContain('bg-white')
  })

  it('the sales-led card at launch is a radio too, and its note names the plan and the sales line', () => {
    const html = render(createElement(ContactSalesPlanCard, { id: 'custom', index: 6, selected: true, onSelect: noop, annual: false }))
    expect(html).toContain('home-plan-enterprise')
    expect(html).toMatch(/role="radio" aria-checked="true"/)
    const note = text(render(createElement(ContactSalesNote, { plan: 'store_enterprise' })))
    expect(note).toContain('Store Enterprise is set up with our team')
    // The one sales channel of the app: the homepage's phone line, printed so it works on a desktop too.
    expect(note).toMatch(/In a hurry\? Call \+40 774 566 367\s?\./)
    expect(render(createElement(ContactSalesNote, { plan: 'custom' }))).toContain('href="tel:+40774566367"')
    expect(note).not.toContain('@')
  })
})

describe('the onboarding launch steps show the homepage cards of their own family', () => {
  const org = { id: 'org_1', name: 'Acme', plan: 'trial', business_type: null } as unknown as Organization
  const cards = (html: string) => [...html.matchAll(/data-card="([^"]+)"/g)].map((m) => m[1])

  it('services: the trial, Starter, Growth, Pro, Business, Scale, then Enterprise; the store plans never', () => {
    const html = render(createElement(Step6Launch, { organization: org }))
    expect(cards(html)).toEqual(['trial', ...SERVICE_PLANS])
    expect(html).toMatch(/role="radiogroup" aria-labelledby="onboarding-plan-title"/)
    expect(html).toContain('class="plan-tiers ')
    expect(text(html)).toContain('Our pick')
    expect(html).not.toContain('Store Starter')
    // The onboarding's default choice, Starter, is the selected card.
    expect(html).toMatch(/id="launch-plan-starter"[^>]*data-state="selected"/)
    expect(text(html)).toContain('Choose Pro')
    expect(text(html)).toContain('Start on the free trial')
  })

  it('stores: the trial and the store plans, Store Growth the popular one; the service plans never', () => {
    const nav = { goTo: noop, refetchState: noop, oauth: null, dismissOauth: noop }
    const html = render(
      createElement(CommerceNavigationContext.Provider, { value: nav }, createElement(LaunchStep, { organization: { ...org, business_type: 'ecommerce' } })),
    )
    expect(cards(html)).toEqual(['trial', ...STORE_PLANS])
    expect(html).toMatch(/role="radiogroup" aria-labelledby="commerce-plan-title"/)
    expect(text(html)).toContain('Most popular')
    expect(text(html)).toContain('From $1,000 a month')
    expect(html).not.toContain('data-card="pro"')
  })

  it('a paid card says its 14 free days, the minutes they include and how it is billed after; the trial needs no card', () => {
    expect(launchMicro('trial', false)).toBe('No card required')
    expect(launchMicro('growth', false)).toBe('14 days free with up to 100 minutes, then billed monthly')
    expect(launchMicro('store_scale', true)).toBe('14 days free with up to 100 minutes, then billed yearly')
    expect(launchMicro('custom', false)).toBeNull()
    const html = render(createElement(PlanChoice, { id: 'scale', index: 5, selected: false, onSelect: noop, annual: true, changed: false }))
    expect(text(html)).toContain('$825 /mo')
    expect(text(html)).toContain('$9,900 a year, $1,980 off')
    expect(text(html)).toContain('14 days free with up to 100 minutes, then billed yearly')
  })

  it('the homepage says the same of a paid plan chosen at launch, for services and stores', () => {
    expect(PAID_PLAN_TRIAL_LINE).toBe('Choose a paid plan when you launch and its first fourteen days are free as well, with up to 100 minutes before the first payment.')
    expect(PRICING_TRIAL.body.endsWith(PAID_PLAN_TRIAL_LINE)).toBe(true)
    expect(STORE_PRICING.trial.body.endsWith(PAID_PLAN_TRIAL_LINE)).toBe(true)
    expect(text(render(createElement(Pricing, {})))).toContain(PAID_PLAN_TRIAL_LINE)
    expect(text(render(createElement(Pricing, { initialAudience: 'stores' })))).toContain(PAID_PLAN_TRIAL_LINE)
  })
})

describe('billing: what a card\'s button does', () => {
  it('Upgrade / Downgrade / Switch by rung, and from Enterprise (no published price) everything is a downgrade', () => {
    expect(planChangeRelation('starter', 'pro')).toBe('upgrade')
    expect(planChangeRelation('scale', 'growth')).toBe('downgrade')
    expect(planChangeRelation('trial', 'scale')).toBe('upgrade')
    expect(planChangeRelation('custom', 'scale')).toBe('downgrade')
    expect(planChangeRelation('custom', 'starter')).toBe('downgrade')
    expect(planChangeRelation('store_enterprise', 'store_scale')).toBe('downgrade')
    expect(planChangeRelation('pro', 'pro')).toBe('switch')
    expect(planChangeRelation('gold', 'starter')).toBe('upgrade')
    // The sales-led rung sits above every priced plan of its family: never an "upgrade to $0".
    expect(planChangeRelation('scale', 'custom')).toBe('upgrade')
    expect(planChangeRelation('trial', 'custom')).toBe('upgrade')
    for (const plan of SERVICE_PLANS.filter((p) => p !== 'custom')) expect(planChangeRelation('custom', plan), plan).toBe('downgrade')
    for (const plan of STORE_PLANS.filter((p) => p !== 'store_enterprise')) expect(planChangeRelation('store_enterprise', plan), plan).toBe('downgrade')
  })

  it('no card of a sales-led plan prints a $0 price, at launch or on billing, monthly or yearly', () => {
    for (const plan of ['custom', 'store_enterprise'] as const) {
      for (const annual of [false, true]) {
        const cards = [
          appCard(plan, annual),
          render(createElement(ContactSalesPlanCard, { id: plan, index: 6, selected: false, onSelect: noop, annual })),
          render(createElement(PlanChoice, { id: plan, index: 6, selected: false, onSelect: noop, annual, changed: false })),
        ]
        for (const html of cards) expect(text(html), `${plan} ${annual ? 'yearly' : 'monthly'}`).not.toMatch(/\$0(?![.,]?\d)|\$0\.00/)
      }
    }
  })

  it('names the current plan\'s price without ever printing $0 for Enterprise', () => {
    expect(planPriceText('trial')).toBe('No subscription')
    expect(planPriceText('pro')).toBe('$249 / month')
    expect(planPriceText('scale')).toBe('$990 / month')
    expect(planPriceText('custom')).toBe('Priced with you')
    expect(planPriceText('store_enterprise')).toBe('From $1,000 / month')
  })

  it('names the price on the interval the organization pays: an annual subscriber sees the yearly price', () => {
    expect(planPriceText('starter', 'year')).toBe('$490 / year')
    expect(planPriceText('starter', 'month')).toBe('$49 / month')
    expect(planPriceText('scale', 'year')).toBe('$9,900 / year')
    expect(planPriceText('store_enterprise', 'year')).toBe('From $10,000 / year')
    expect(planPriceText('custom', 'year')).toBe('Priced with you')
    expect(planPriceText('trial', 'year')).toBe('No subscription')
  })
})

describe('billing: the header, the cycle switch and the cards, in the homepage\'s words', () => {
  it('names the trial as its card does ("Free trial"), every other plan as PLANS does', () => {
    expect(currentPlanName('trial')).toBe(TRIAL_TIER.name)
    expect(currentPlanName('trial')).toBe('Free trial')
    expect(currentPlanName('growth')).toBe('Growth')
    expect(currentPlanName('store_scale')).toBe('Store Scale')
  })

  it('labels the cycle switch "Monthly | Yearly", as the homepage and onboarding do', () => {
    expect(BILLING_CYCLE_LABEL).toEqual({ month: HOME_PRICING.billing.monthly, year: HOME_PRICING.billing.yearly })
    expect(BILLING_CYCLE_LABEL).toEqual({ month: 'Monthly', year: 'Yearly' })
  })

  it('offers the trial card only to the trial: a paying organization never sees its sign-up words with "Downgrade"', () => {
    const services = SERVICE_PLANS.filter((p) => !PLANS[p].contact_sales)
    expect(billingPickerPlans('trial', services)).toEqual(['trial', 'starter', 'growth', 'pro', 'business', 'scale'])
    for (const plan of services) expect(billingPickerPlans(plan, services), plan).toEqual(services)
    const stores = STORE_PLANS.filter((p) => !PLANS[p].contact_sales)
    expect(billingPickerPlans('store_growth', stores)).toEqual(['store_starter', 'store_growth', 'store_scale'])
    expect(billingPickerPlans('custom', services)).not.toContain('trial')
  })
})

describe('the app\'s rail has the homepage\'s jump chips below sm', () => {
  it('a chip per card: its light, its name and its fee a month on the billing shown', () => {
    const plans: Plan[] = ['trial', ...SERVICE_PLANS]
    const monthly = appJumpChips(plans, false)
    expect(monthly.map((c) => c.id)).toEqual(plans)
    expect(monthly.map((c) => c.name)).toEqual(['Free trial', 'Starter', 'Growth', 'Pro', 'Business', 'Scale', 'Enterprise'])
    expect(monthly.map((c) => c.price)).toEqual([undefined, '$49', '$99', '$249', '$499', '$990', undefined])
    expect(monthly.map((c) => c.light)).toEqual(plans.map((p) => planTierLight(p)))
    expect(appJumpChips(['pro'], true)[0].price).toBe('$207.50')
    // Store Enterprise starts from a fee, but its chip, like the homepage's, names no price.
    expect(appJumpChips(['store_growth', 'store_enterprise'], false).map((c) => c.price)).toEqual(['$250', undefined])
  })

  it('PlanTiers draws them above the rail, in their own scope, hidden from sm', () => {
    const html = render(createElement(PlanTiers, { jump: appJumpChips(['trial', 'starter', 'custom'], false) }, createElement('span', null, 'x')))
    expect(html).toMatch(/^<div class="plan-tiers sm:hidden"><div role="group" aria-label="Jump to a plan" class="[^"]*sm:hidden/)
    expect(text(html)).toContain('Free trial Starter $49 Enterprise')
    expect(html).toContain('aria-label="Show Starter, $49 a month"')
    expect(html).toMatch(/data-plan="starter" class="home-plan-light home-plan-swatch/)
    // The rail itself is unchanged and comes after the chips.
    expect(html.indexOf('class="plan-tiers font-plan-tier-test')).toBeGreaterThan(html.indexOf('Jump to a plan'))
    // Without chips, the rail alone.
    expect(render(createElement(PlanTiers, null, createElement('span', null, 'x')))).not.toContain('Jump to a plan')
  })

  it('onboarding shows a chip for each of its seven cards, Enterprise included', () => {
    const org = { id: 'org_1', name: 'Acme', plan: 'trial', business_type: null } as unknown as Organization
    const html = render(createElement(Step6Launch, { organization: org }))
    const start = html.indexOf('aria-label="Jump to a plan"')
    // The chips come right before the rail of cards.
    const group = html.slice(start, html.indexOf('class="plan-tiers font-plan-tier-test', start))
    expect(start).toBeGreaterThan(0)
    expect([...group.matchAll(/aria-label="Show ([^",]+)/g)].map((m) => m[1])).toEqual(['Free trial', 'Starter', 'Growth', 'Pro', 'Business', 'Scale', 'Enterprise'])
  })
})

describe('the shared stylesheet', () => {
  const css = readFileSync('components/pricing/plan-tier.css', 'utf8')
  const block = (plan: string) => {
    const at = css.indexOf(`.home-plan-light[data-plan="${plan}"] {`)
    expect(at, plan).toBeGreaterThanOrEqual(0)
    return css.slice(at, css.indexOf('}', at))
  }
  const token = (body: string, name: string) => body.match(new RegExp(`--plan-${name}: ([^;]+);`))?.[1]

  it('declares every light value for value as palettes.ts and lights.ts', () => {
    for (const [id, light] of Object.entries(PLAN_LIGHTS)) {
      const body = block(id)
      expect(token(body, 'ground'), id).toBe(light.ground)
      for (const name of ['text', 'dim', 'accent', 'tick', 'ink', 'signal'] as const) expect(token(body, name), `${id} ${name}`).toBe(light[name])
      expect(token(body, 'floor'), id).toBe(light.ground.slice(light.ground.lastIndexOf('#')))
    }
    const custom = block('custom')
    expect(token(custom, 'ground')).toBe(ENTERPRISE_LIGHT.ground)
    for (const name of ['text', 'dim', 'accent', 'tick'] as const) expect(token(custom, name)).toBe(ENTERPRISE_LIGHT[name])
    const trial = block('trial')
    expect(token(trial, 'ground')).toBe(TRIAL_LIGHT.ground)
    for (const name of ['text', 'dim', 'accent', 'tick', 'ink', 'signal'] as const) expect(token(trial, name)).toBe(TRIAL_LIGHT[name])
  })

  it('leaks nothing: every rule is the homepage body\'s (.pp), the app wrapper\'s (.plan-tiers), or both', () => {
    const selectors = css
      .replace(/\/\*[\s\S]*?\*\//g, '')
      .replace(/@keyframes[^{]+\{(?:[^{}]*\{[^{}]*\})*[^{}]*\}/g, '')
      .split('{')
      .slice(0, -1)
      .map((chunk) => chunk.slice(chunk.lastIndexOf('}') + 1).trim())
      .filter((sel) => sel && !sel.startsWith('@'))
    expect(selectors.length).toBeGreaterThan(40)
    for (const group of selectors) {
      for (const sel of group.split(/,(?![^(]*\))/).map((s) => s.trim())) {
        expect(sel, sel).toMatch(/^(:root[^ ]* )?(\.pp |\.plan-tiers( |$)|:is\(\.pp, \.plan-tiers\) )/)
      }
    }
  })
})
