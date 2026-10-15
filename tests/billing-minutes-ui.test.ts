// The billing page's Minutes section, the plan picker's button relation, the
// dashboard's minutes banner and every page that describes how minutes are
// billed: the pure rules (components/billing/minutes-logic.ts), the
// components rendered to HTML, and the copy (no overage billing anywhere;
// calls pause; prepaid extra minutes; auto top-up).

import { createElement } from 'react'
import { renderToString } from 'react-dom/server'
import { describe, expect, it, vi } from 'vitest'
import {
  DEFAULT_AUTO_TOPUP_PACK,
  LOW_MINUTES_SHARE,
  PLAN_CHANGED_MESSAGE,
  PLAN_CHANGE_LABEL,
  PURCHASE_SOURCE_LABEL,
  PURCHASE_STATUS_LABEL,
  THRESHOLD_HINT,
  autoTopUpDirty,
  autoTopUpDraftFrom,
  discountLabel,
  formatCents,
  formatMinutes,
  formatPerMinute,
  includedUsagePct,
  minutesBannerActions,
  minutesBannerCopy,
  minutesBannerState,
  minutesReturnNotice,
  parseBuyParam,
  parseThreshold,
  planChangePendingText,
  planChangeRelation,
  purchaseSourceLabel,
  purchaseStatusLabel,
  readCheckoutResult,
  usageTone,
  withoutMinutesParam,
  autoTopUpNotice,
  autoTopUpTerms,
  autoTopUpThresholdProblem,
  includedPeriodNote,
  intervalSwitchLabel,
  isCurrentPlanCard,
  minutesMeterTone,
  minutesSectionDescription,
  outOfMinutesTitle,
  showsMinutesBanner,
  trialPackPreview,
} from '@/components/billing/minutes-logic'
import { MinutesCard } from '@/components/billing/MinutesCard'
import { BuyMinutesGrid } from '@/components/billing/BuyMinutesGrid'
import { AutoTopUpCard } from '@/components/billing/AutoTopUpCard'
import { PurchaseHistory } from '@/components/billing/PurchaseHistory'
import { MinutesBanner } from '@/components/dashboard/MinutesBanner'
import { ProblemsList } from '@/components/commerce/ProblemsList'
import { PROBLEM_ACTION_LABEL, problemActions } from '@/components/commerce/labels'
import { outOfMinutesChoice } from '@/lib/billing/upgrade'
import { FAQS as MARKETING_FAQS } from '@/components/marketing/Faq'
import TermsPage from '@/app/(legal)/terms/page'
import RefundPolicyPage from '@/app/(legal)/refund-policy/page'
import { buildMinutesSummary, type MinutesOrgRow } from '@/lib/billing/minutes-summary'
import { AUTH, FAQ, PRICING_NOTE } from '@/lib/site'
import { HOME_PRICING } from '@/lib/pages/home/pricing'
import { STORE_PRICING } from '@/lib/pages/home/store-pricing'
import type { CommerceProblemCode } from '@/lib/commerce/types'

function org(overrides: Partial<MinutesOrgRow> = {}): MinutesOrgRow {
  return {
    plan: 'pro',
    minutes_used: 100,
    minutes_limit: 850,
    extra_minutes_balance: 0,
    usage_period_start: '2026-10-01T00:00:00.000Z',
    auto_topup_enabled: false,
    auto_topup_pack: null,
    auto_topup_threshold: null,
    auto_topup_failed_at: null,
    auto_topup_failure: null,
    stripe_customer_id: 'cus_test',
    stripe_subscription_id: 'sub_test',
    ...overrides,
  }
}

const noop = () => undefined

/** Server-rendered HTML without React's text-node separators, so a sentence built from parts reads whole. */
function render(element: Parameters<typeof renderToString>[0]): string {
  return renderToString(element).replaceAll('<!-- -->', '')
}

describe('plan picker: Upgrade / Downgrade / Switch against the current monthly price', () => {
  it('labels a dearer plan an upgrade, a cheaper one a downgrade, the same price a switch', () => {
    expect(planChangeRelation('trial', 'starter')).toBe('upgrade')
    expect(planChangeRelation('starter', 'pro')).toBe('upgrade')
    expect(planChangeRelation('business', 'pro')).toBe('downgrade')
    expect(planChangeRelation('store_scale', 'store_starter')).toBe('downgrade')
    expect(planChangeRelation('store_starter', 'store_growth')).toBe('upgrade')
    expect(planChangeRelation('pro', 'pro')).toBe('switch')
    expect(PLAN_CHANGE_LABEL).toEqual({ upgrade: 'Upgrade', downgrade: 'Downgrade', switch: 'Switch' })
  })

  it('reads a plan value the catalog does not know as the trial', () => {
    expect(planChangeRelation('gold', 'starter')).toBe('upgrade')
    expect(planChangeRelation(null, 'store_starter')).toBe('upgrade')
  })

  it('puts a sales-led plan above every priced one: from Enterprise every card is a downgrade', () => {
    expect(planChangeRelation('custom', 'scale')).toBe('downgrade')
    expect(planChangeRelation('custom', 'starter')).toBe('downgrade')
    expect(planChangeRelation('store_enterprise', 'store_scale')).toBe('downgrade')
    expect(planChangeRelation('scale', 'custom')).toBe('upgrade')
  })

  it('says what the button is doing: an in-place change or a Checkout redirect', () => {
    expect(planChangePendingText(true)).toBe('Changing plan…')
    expect(planChangePendingText(false)).toBe('Redirecting to checkout…')
    expect(PLAN_CHANGED_MESSAGE).toBe('Your plan was changed.')
  })

  it('accepts both answers of POST /api/billing/checkout and nothing else', () => {
    expect(readCheckoutResult({ url: 'https://checkout.stripe.com/c/pay/cs_test' })).toEqual({ kind: 'redirect', url: 'https://checkout.stripe.com/c/pay/cs_test' })
    expect(readCheckoutResult({ updated: true, plan: 'business' })).toEqual({ kind: 'updated', plan: 'business' })
    expect(readCheckoutResult({ updated: true })).toEqual({ kind: 'updated', plan: null })
    expect(readCheckoutResult({ url: 'javascript:alert(1)' })).toBeNull()
    expect(readCheckoutResult({ updated: 'yes' })).toBeNull()
    expect(readCheckoutResult({ error: 'nope' })).toBeNull()
    expect(readCheckoutResult(null)).toBeNull()
    expect(readCheckoutResult('https://checkout.stripe.com')).toBeNull()
  })
})

describe('minutes formatting', () => {
  it('prints money, per-minute prices, discounts and minutes the way the price list does', () => {
    expect(formatCents(12000, 'usd')).toBe('$120.00')
    expect(formatCents(10560, 'USD')).toBe('$105.60')
    expect(formatCents(2500, 'eur')).toBe('€25.00')
    expect(formatCents(2500, 'not a code')).toBe('25.00 NOT A CODE')
    expect(formatPerMinute(24)).toBe('$0.24')
    expect(formatPerMinute(21.12)).toBe('$0.2112')
    expect(formatPerMinute(19.2)).toBe('$0.192')
    expect(discountLabel(0)).toBeNull()
    expect(discountLabel(0.04)).toBe('Save 4%')
    expect(discountLabel(0.12)).toBe('Save 12%')
    expect(formatMinutes(2500)).toBe('2,500')
    expect(formatMinutes(-3)).toBe('0')
    expect(formatMinutes(Number.NaN)).toBe('0')
  })

  it('meters the included minutes like every usage meter of the app', () => {
    expect(includedUsagePct(425, 850)).toBe(50)
    expect(includedUsagePct(900, 850)).toBe(100)
    expect(includedUsagePct(10, 0)).toBe(0)
    expect(usageTone(79)).toBe('default')
    expect(usageTone(80)).toBe('warning')
    expect(usageTone(100)).toBe('danger')
  })

  it('names every purchase source and status of minute_purchases, and passes unknown ones through', () => {
    expect(Object.keys(PURCHASE_SOURCE_LABEL).sort()).toEqual(['admin', 'auto_topup', 'checkout'])
    expect(Object.keys(PURCHASE_STATUS_LABEL).sort()).toEqual(['credited', 'failed'])
    expect(purchaseSourceLabel('auto_topup')).toBe('Auto top-up')
    expect(purchaseStatusLabel('credited')).toBe('Added')
    expect(purchaseSourceLabel('gift')).toBe('gift')
    expect(purchaseStatusLabel('pending')).toBe('pending')
  })
})

describe('auto top-up form', () => {
  it('starts from the saved settings, else the 500-minute pack and a 50-minute threshold', () => {
    expect(DEFAULT_AUTO_TOPUP_PACK).toBe(500)
    expect(autoTopUpDraftFrom({ enabled: false, pack: null, threshold: null })).toEqual({ enabled: false, pack: 500, threshold: '50' })
    expect(autoTopUpDraftFrom({ enabled: true, pack: 1000, threshold: 200 })).toEqual({ enabled: true, pack: 1000, threshold: '200' })
    expect(autoTopUpDraftFrom({ enabled: false, pack: 750, threshold: 20 })).toEqual({ enabled: false, pack: 500, threshold: '20' })
  })

  it('accepts a whole threshold from 10 to 1,000 minutes', () => {
    expect(parseThreshold('50')).toBe(50)
    expect(parseThreshold(' 1000 ')).toBe(1000)
    expect(parseThreshold('10')).toBe(10)
    expect(parseThreshold('9')).toBeNull()
    expect(parseThreshold('1001')).toBeNull()
    expect(parseThreshold('10.5')).toBeNull()
    expect(parseThreshold('-20')).toBeNull()
    expect(parseThreshold('')).toBeNull()
    expect(THRESHOLD_HINT).toBe('A whole number from 10 to 1,000 minutes.')
  })

  it('is dirty only when it differs from what is saved', () => {
    const saved = { enabled: true, pack: 500, threshold: 50 }
    expect(autoTopUpDirty(autoTopUpDraftFrom(saved), saved)).toBe(false)
    expect(autoTopUpDirty({ enabled: false, pack: 500, threshold: '50' }, saved)).toBe(true)
    expect(autoTopUpDirty({ enabled: true, pack: 2500, threshold: '50' }, saved)).toBe(true)
    expect(autoTopUpDirty({ enabled: true, pack: 500, threshold: '60' }, saved)).toBe(true)
  })
})

describe('return from Stripe Checkout', () => {
  it('toasts ?minutes=success and ?minutes=canceled once, then drops the flag', () => {
    expect(minutesReturnNotice('?minutes=success')).toMatchObject({ tone: 'success' })
    expect(minutesReturnNotice('?minutes=canceled')).toEqual({ tone: 'info', message: 'Checkout canceled. No minutes were added.' })
    expect(minutesReturnNotice('?minutes=other')).toBeNull()
    expect(minutesReturnNotice('')).toBeNull()
    expect(withoutMinutesParam('?minutes=success')).toBe('')
    expect(withoutMinutesParam('?minutes=success&tab=year')).toBe('?tab=year')
  })
})

describe('dashboard minutes banner', () => {
  const usage = (o: { plan?: string; used: number; limit: number; extra?: number; auto?: boolean; business?: 'services' | 'ecommerce' | null }) => ({
    plan: o.plan ?? 'pro',
    minutes_used: o.used,
    minutes_limit: o.limit,
    extra_minutes_balance: o.extra ?? 0,
    auto_topup_enabled: o.auto ?? false,
    business_type: o.business ?? null,
  })
  const out = (plan: string, businessType: 'services' | 'ecommerce' | null = null) => ({ kind: 'out' as const, canBuy: plan !== 'trial', plan, businessType })

  it('is out when no call can start, low under 20% of the included minutes, otherwise hidden', () => {
    expect(LOW_MINUTES_SHARE).toBe(0.2)
    expect(minutesBannerState(usage({ used: 850, limit: 850 }))).toEqual({ kind: 'out', canBuy: true, plan: 'pro', businessType: null })
    expect(minutesBannerState(usage({ used: 700, limit: 850, business: 'services' }))).toEqual({ kind: 'low', left: 150, canBuy: true, plan: 'pro', businessType: 'services' })
    // Purchased minutes count: 100 left in total is still under 20% of 850.
    expect(minutesBannerState(usage({ used: 900, limit: 850, extra: 100 }))).toMatchObject({ kind: 'low', left: 100, canBuy: true })
    expect(minutesBannerState(usage({ used: 900, limit: 850, extra: 500 }))).toBeNull()
    expect(minutesBannerState(usage({ used: 680, limit: 850 }))).toBeNull()
    expect(minutesBannerState(usage({ used: 100, limit: 850 }))).toBeNull()
  })

  it('offers the next plan up and 100 minutes, the upgrade first and filled', () => {
    expect(minutesBannerActions(out('pro'))).toEqual([
      { kind: 'upgrade', label: 'Upgrade to Business (5,000 minutes for $499/mo)', href: '/billing#plans', primary: true },
      { kind: 'buy', label: 'Buy 100 minutes for $20', href: '/billing?buy=100#minutes', primary: false },
    ])
    expect(minutesBannerActions(out('store_starter', 'ecommerce'))).toEqual([
      { kind: 'upgrade', label: 'Upgrade to Store Growth (950 minutes for $250/mo)', href: '/billing#plans', primary: true },
      { kind: 'buy', label: 'Buy 100 minutes for $25', href: '/billing?buy=100#minutes', primary: false },
    ])
  })

  it('gives the running-low state the same two actions', () => {
    const low = minutesBannerState(usage({ plan: 'growth', used: 900, limit: 1000 }))!
    expect(low.kind).toBe('low')
    expect(minutesBannerActions(low).map((a) => a.label)).toEqual(['Upgrade to Pro (3,000 minutes for $249/mo)', 'Buy 100 minutes for $20'])
  })

  it('turns the upgrade into "Talk to us" when the next rung is sales-led', () => {
    for (const [plan, business] of [['scale', 'services'], ['custom', 'services'], ['store_scale', 'ecommerce'], ['store_enterprise', 'ecommerce']] as const) {
      const actions = minutesBannerActions(out(plan, business))
      expect(actions[0], plan).toEqual({ kind: 'contact', label: 'Talk to us', href: AUTH.contactSales, primary: false })
      expect(actions[1], plan).toMatchObject({ kind: 'buy', href: '/billing?buy=100#minutes', primary: true })
    }
  })

  it('sends the trial to the first plan of its family, with no pack to buy', () => {
    const trial = minutesBannerState(usage({ plan: 'trial', used: 5, limit: 5 }))!
    expect(trial).toEqual({ kind: 'out', canBuy: false, plan: 'trial', businessType: null })
    expect(minutesBannerActions(trial)).toEqual([{ kind: 'upgrade', label: 'Upgrade to Starter (400 minutes for $49/mo)', href: '/billing#plans', primary: true }])
    const storeTrial = minutesBannerState(usage({ plan: 'trial', used: 5, limit: 5, business: 'ecommerce' }))!
    expect(minutesBannerActions(storeTrial)).toEqual([{ kind: 'upgrade', label: 'Upgrade to Store Starter (350 minutes for $100/mo)', href: '/billing#plans', primary: true }])
  })

  it('keeps the generic button for a plan the catalog does not know', () => {
    expect(minutesBannerActions({ kind: 'out', canBuy: true, plan: 'gold', businessType: null })).toEqual([{ kind: 'buy', label: 'Buy minutes', href: '/billing#minutes', primary: true }])
    expect(minutesBannerActions({ kind: 'out', canBuy: false, plan: null, businessType: null })).toEqual([{ kind: 'upgrade', label: 'Choose a plan', href: '/billing#plans', primary: true }])
  })

  it('stays quiet while auto top-up is on, unless the minutes are already gone', () => {
    expect(minutesBannerState(usage({ used: 700, limit: 850, auto: true }))).toBeNull()
    expect(minutesBannerState(usage({ used: 850, limit: 850, auto: true }))).toMatchObject({ kind: 'out', canBuy: true })
  })

  it('shows nothing where the cap does not apply', () => {
    expect(minutesBannerState(null)).toBeNull()
    expect(minutesBannerState(usage({ plan: 'gold', used: 900, limit: 850 }))).toBeNull()
    expect(minutesBannerState(usage({ used: 10, limit: 0 }))).toBeNull()
    vi.stubEnv('VOICE_TRIAL_MINUTES_ENFORCED', 'false')
    expect(minutesBannerState(usage({ used: 850, limit: 850 }))).toBeNull()
    vi.unstubAllEnvs()
  })

  it('words the banner as the owner reads it', () => {
    expect(minutesBannerCopy(out('pro')).title).toBe("You're out of minutes. Calls are paused until you add minutes.")
    expect(minutesBannerCopy(out('pro')).description).toBe("Your agent isn't taking new calls. Upgrade to Business for 5,000 minutes a month, or buy 100 minutes to resume right away.")
    expect(minutesBannerCopy(out('scale')).description).toBe("Your agent isn't taking new calls. Buy 100 minutes to resume right away, or talk to us about a larger allowance.")
    expect(minutesBannerCopy(out('trial')).description).toBe("Your agent isn't taking new calls. Choose a plan to keep it answering.")
    const low = { kind: 'low' as const, canBuy: true, plan: 'pro', businessType: null }
    expect(minutesBannerCopy({ ...low, left: 150 }).title).toBe('Running low: 150 minutes left')
    expect(minutesBannerCopy({ ...low, left: 1 }).title).toBe('Running low: 1 minute left')
    expect(minutesBannerCopy({ ...low, left: 1200, canBuy: false, plan: 'trial' }).title).toBe('Running low: 1,200 minutes left')
    // The running-low words are unchanged.
    expect(minutesBannerCopy({ ...low, left: 150 }).description).toBe("Buy minutes or turn on auto top-up so calls don't pause.")
  })

  it('is shown on every dashboard page but billing, where the Minutes section says the same', () => {
    expect(showsMinutesBanner('/dashboard')).toBe(true)
    expect(showsMinutesBanner('/store/automations')).toBe(true)
    expect(showsMinutesBanner('/billing')).toBe(false)
    expect(showsMinutesBanner('/billings')).toBe(true)
  })

  it('renders the alert with both buttons', () => {
    const html = render(createElement(MinutesBanner, { state: out('pro') }))
    expect(html).toContain('You&#x27;re out of minutes. Calls are paused until you add minutes.')
    expect(html).toMatch(/href="\/billing#plans"[^>]*>Upgrade to Business \(5,000 minutes for \$499\/mo\)</)
    expect(html).toMatch(/href="\/billing\?buy=100#minutes"[^>]*>Buy 100 minutes for \$20</)
  })

  it('renders "Talk to us" as the sales line and a trial without a pack', () => {
    const scale = render(createElement(MinutesBanner, { state: out('scale') }))
    expect(scale).toContain(`href="${AUTH.contactSales}"`)
    expect(scale).toContain('>Talk to us<')
    expect(scale).toContain('· +40 774 566 367')
    const trial = render(createElement(MinutesBanner, { state: out('trial') }))
    expect(trial).toContain('Upgrade to Starter (400 minutes for $49/mo)')
    expect(trial).not.toContain('buy=')
  })
})

describe('the out-of-minutes buttons fit a phone (banner, billing callout, store overview)', () => {
  /** Every class of the elements whose opening tag matches `tag` and which contain `text`. */
  const classesOf = (html: string, text: string) => {
    const at = html.indexOf(`${text}<`)
    expect(at, text).toBeGreaterThan(0)
    const open = html.lastIndexOf('<', html.lastIndexOf('class="', at))
    return html.slice(open, at).match(/class="([^"]*)"/)![1].split(' ')
  }
  const actionRow = (html: string) => html.match(/<div data-slot="alert-action" class="([^"]*)"/)![1].split(' ')

  it('lets the longest upgrade label shrink to its row and wrap, instead of widening the page', () => {
    const store = render(createElement(MinutesBanner, { state: { kind: 'out', canBuy: true, plan: 'store_growth', businessType: 'ecommerce' } }))
    const label = classesOf(store, 'Upgrade to Store Scale (2,000 minutes for $500/mo)')
    // The button's own shrink-0 is replaced: a flex item that cannot shrink never wraps.
    expect(label).not.toContain('shrink-0')
    for (const cls of ['shrink', 'max-w-full', 'whitespace-normal', 'h-auto']) expect(label, cls).toContain(cls)
    expect(label).not.toContain('whitespace-nowrap')
    // The row is the text column's width below sm and may narrow below its content.
    for (const cls of ['w-full', 'min-w-0', 'sm:w-auto', 'sm:max-w-72']) expect(actionRow(store), cls).toContain(cls)
  })

  it('does the same on the billing page\'s callout and on the store overview\'s problem', () => {
    const summary = buildMinutesSummary(org({ plan: 'store_growth', minutes_limit: 950, minutes_used: 950 }), [])
    const card = render(createElement(MinutesCard, { summary, choice: outOfMinutesChoice('store_growth', 'ecommerce'), onBuy: noop }))
    const upgrade = classesOf(card, 'Upgrade to Store Scale (2,000 minutes for $500/mo)')
    expect(upgrade).toContain('shrink')
    expect(upgrade).not.toContain('shrink-0')
    expect(classesOf(card, 'Buy 100 minutes for $22')).toContain('max-w-full')
    expect(actionRow(card)).toEqual(expect.arrayContaining(['w-full', 'min-w-0', 'sm:w-auto']))

    const problems = render(createElement(ProblemsList, { problems: [{ code: 'minutes_exhausted', message: 'Out of minutes.', href: '/billing#minutes' }] }))
    expect(actionRow(problems)).toEqual(expect.arrayContaining(['w-full', 'min-w-0', 'sm:w-auto']))
    expect(classesOf(problems, 'Buy minutes')).toEqual(expect.arrayContaining(['shrink', 'max-w-full', 'whitespace-normal']))
  })
})

describe('store overview problem', () => {
  const exhausted = { code: 'minutes_exhausted' as const, href: '/billing#minutes' }

  it('names every problem, and keeps "Buy minutes" as minutes_exhausted\'s fallback', () => {
    const codes: CommerceProblemCode[] = [
      'no_connection', 'connection_error', 'credentials_expired', 'webhook_failure', 'sync_error',
      'no_phone_number', 'no_consent', 'agent_inactive', 'minutes_exhausted', 'encryption_not_configured',
    ]
    expect(Object.keys(PROBLEM_ACTION_LABEL).sort()).toEqual([...codes].sort())
    expect(PROBLEM_ACTION_LABEL.minutes_exhausted).toBe('Buy minutes')
    // Until the plan is known: the server's single button.
    expect(problemActions(exhausted, null)).toEqual([{ kind: 'buy', label: 'Buy minutes', href: '/billing#minutes', primary: false }])
  })

  it('offers the store the next store plan or 100 minutes', () => {
    expect(problemActions(exhausted, { plan: 'store_growth', business_type: 'ecommerce' })).toEqual([
      { kind: 'upgrade', label: 'Upgrade to Store Scale (2,000 minutes for $500/mo)', href: '/billing#plans', primary: true },
      { kind: 'buy', label: 'Buy 100 minutes for $22', href: '/billing?buy=100#minutes', primary: false },
    ])
    expect(problemActions(exhausted, { plan: 'store_scale', business_type: 'ecommerce' }).map((a) => a.label)).toEqual(['Talk to us', 'Buy 100 minutes for $20'])
    expect(problemActions(exhausted, { plan: 'trial', business_type: 'ecommerce' })).toEqual([
      { kind: 'upgrade', label: 'Upgrade to Store Starter (350 minutes for $100/mo)', href: '/billing#plans', primary: true },
    ])
  })

  it('leaves every other problem with its single button, and none without an href', () => {
    const org = { plan: 'store_growth', business_type: 'ecommerce' as const }
    expect(problemActions({ code: 'no_connection', href: '/store/connections' }, org)).toEqual([{ kind: 'fix', label: 'Connect store', href: '/store/connections', primary: false }])
    expect(problemActions({ code: 'encryption_not_configured', href: null }, org)).toEqual([])
  })
})

describe('Minutes section components', () => {
  it('shows the included usage, the extra balance and the total left', () => {
    const summary = buildMinutesSummary(org({ minutes_used: 425, extra_minutes_balance: 500 }), [])
    const html = render(createElement(MinutesCard, { summary }))
    expect(html).toContain('425')
    expect(html).toContain('of 850 included minutes')
    expect(html).toContain('Extra minutes')
    expect(html).toContain('925')
    expect(html).not.toContain('out of minutes')
  })

  it('says calls are paused when nothing is left', () => {
    const summary = buildMinutesSummary(org({ minutes_used: 850 }), [])
    const html = render(createElement(MinutesCard, { summary }))
    expect(html).toContain('You&#x27;re out of minutes. Calls are paused until you add minutes.')
    // Without a choice the callout has no buttons.
    expect(html).not.toContain('Upgrade to')
  })

  it('offers the next plan up (the picker on this page) or 100 minutes (straight to checkout) at zero', () => {
    const summary = buildMinutesSummary(org({ minutes_used: 850 }), [])
    const html = render(createElement(MinutesCard, { summary, choice: outOfMinutesChoice(summary.plan, 'services'), onBuy: noop, pending: null }))
    expect(html).toContain('Upgrade to Business for 5,000 minutes a month, or buy 100 minutes to resume right away.')
    expect(html).toMatch(/<a href="#plans"[^>]*>Upgrade to Business \(5,000 minutes for \$499\/mo\)<\/a>/)
    expect(html).toMatch(/<button[^>]*>Buy 100 minutes for \$20<\/button>/)
    expect(html).not.toMatch(/<button[^>]*disabled=""[^>]*>Buy 100 minutes/)
  })

  it('offers "Talk to us" on a sales-led rung and only the upgrade on the trial', () => {
    const scale = buildMinutesSummary(org({ plan: 'scale', minutes_limit: 15000, minutes_used: 15000 }), [])
    const scaleHtml = render(createElement(MinutesCard, { summary: scale, choice: outOfMinutesChoice('scale'), onBuy: noop }))
    expect(scaleHtml).toContain(`href="${AUTH.contactSales}"`)
    // The tel: link does nothing in a desktop browser: the number is printed on the button.
    expect(scaleHtml).toContain('>Talk to us<span class="tabular-nums"> · +40 774 566 367</span></a>')
    expect(scaleHtml).toContain('Buy 100 minutes for $20')

    const trial = buildMinutesSummary(org({ plan: 'trial', minutes_limit: 5, minutes_used: 5, stripe_subscription_id: null }), [])
    const trialHtml = render(createElement(MinutesCard, { summary: trial, choice: outOfMinutesChoice('trial', 'ecommerce'), onBuy: noop }))
    expect(trialHtml).toContain('Upgrade to Store Starter (350 minutes for $100/mo)')
    expect(trialHtml).not.toContain('Buy 100 minutes')
  })

  it('reads ?buy= as a pack size only', () => {
    expect(parseBuyParam('100')).toBe(100)
    expect(parseBuyParam(' 2500 ')).toBe(2500)
    for (const value of [null, undefined, '', '0', '101', '100.0', '1e2', '-100', 'abc', '99999999']) expect(parseBuyParam(value), String(value)).toBeNull()
  })

  it('highlights the requested pack without buying it, and never on the trial', () => {
    const summary = buildMinutesSummary(org(), [])
    const onBuy = vi.fn()
    const html = render(createElement(BuyMinutesGrid, { summary, onBuy, pending: null, highlight: 100 }))
    expect(html.match(/data-highlighted="true"/g)?.length).toBe(1)
    expect(html).toMatch(/<li data-highlighted="true"[^>]*>.*?100 min.*?Selected/)
    expect(onBuy).not.toHaveBeenCalled()

    const trial = buildMinutesSummary(org({ plan: 'trial', minutes_limit: 5, stripe_subscription_id: null }), [])
    expect(render(createElement(BuyMinutesGrid, { summary: trial, onBuy, pending: null, highlight: 100 }))).not.toContain('data-highlighted')
  })

  it('lists the four packs with price, per-minute price and discount on a paid plan', () => {
    const summary = buildMinutesSummary(org(), [])
    const html = render(createElement(BuyMinutesGrid, { summary, onBuy: noop, pending: null }))
    // Pro's extra minutes cost $0.20 (types/index.ts PLANS, the homepage price list).
    for (const text of ['100 min', '500 min', '1,000 min', '2,500 min', '$20.00', '$96.00', '$184.00', '$440.00', '$0.192 a minute', 'Save 4%', 'Save 8%', 'Save 12%']) {
      expect(html).toContain(text)
    }
    expect(html).not.toContain('Choose a plan to buy extra minutes')
  })

  it('disables the packs on the trial, priced as on its family\'s plans: $0.20 on every service plan', () => {
    const summary = buildMinutesSummary(org({ plan: 'trial', minutes_limit: 5, stripe_subscription_id: null }), [])
    const html = render(createElement(BuyMinutesGrid, { summary, onBuy: noop, pending: null }))
    for (const text of ['$20.00', '$96.00', '$184.00', '$440.00', '$0.192 a minute']) expect(html).toContain(text)
    expect(html).toContain('Extra minutes cost $0.20 a minute on every plan, less in bigger packs. Choose a plan to buy them.')
    expect(html).not.toContain('Priced by plan')
    expect(html).not.toContain('—')
    expect(html.match(/\sdisabled=""/g)?.length).toBe(4)
    // Nothing to buy yet: the button names the pack, never a price it cannot charge.
    expect(html).toContain('<span class="sr-only"> 100 extra minutes</span>')
  })

  it('prices a store trial\'s packs at Store Starter\'s rate and names the store range', () => {
    const summary = buildMinutesSummary(org({ plan: 'trial', minutes_limit: 5, stripe_subscription_id: null }), [])
    const html = render(createElement(BuyMinutesGrid, { summary, onBuy: noop, pending: null, businessType: 'ecommerce' }))
    expect(html).toContain('$25.00')
    expect(html).toContain('$0.25 a minute on Store Starter')
    expect(html).toContain('Extra minutes cost $0.18 to $0.25 a minute depending on the plan, less in bigger packs.')
    expect(html.match(/\sdisabled=""/g)?.length).toBe(4)
  })

  it('trialPackPreview: the family\'s first plan\'s prices and its rates in words', () => {
    expect(trialPackPreview(null)).toMatchObject({ plan: 'starter', planName: 'Starter', uniform: true, rate: '$0.20 a minute on every plan' })
    expect(trialPackPreview('services')!.quotes.map((q) => q.amount_cents)).toEqual([2000, 9600, 18400, 44000])
    expect(trialPackPreview('ecommerce')).toMatchObject({ plan: 'store_starter', uniform: false, rate: '$0.18 to $0.25 a minute depending on the plan' })
    expect(trialPackPreview('ecommerce')!.quotes[0]).toMatchObject({ minutes: 100, amount_cents: 2500 })
  })

  it('gives the discount badge its own row on every pack, so the four prices line up', () => {
    const summary = buildMinutesSummary(org(), [])
    const html = render(createElement(BuyMinutesGrid, { summary, onBuy: noop, pending: null, highlight: 1000 }))
    const cards = html.split('<li ').slice(1)
    expect(cards).toHaveLength(4)
    for (const card of cards) {
      // Title, then the badge row (empty on the 100-minute pack), then the price: the same three rows on every card.
      expect(card).toMatch(/<\/h4>(<span[^>]*>Selected<\/span>)?<div class="mt-1 flex h-6 items-center">(<span[^>]*>Save \d+%<\/span>)?<\/div><p class="mt-2 /)
    }
    // "Selected" is a tab on the card's edge, out of the flow.
    expect(cards[2]).toMatch(/<span[^>]*class="[^"]*absolute -top-3[^"]*"[^>]*>Selected<\/span>/)
  })

  it('shows auto top-up as unavailable on the trial and the last failure on a paid plan', () => {
    const trial = buildMinutesSummary(org({ plan: 'trial', stripe_subscription_id: null }), [])
    const trialHtml = render(createElement(AutoTopUpCard, { autoTopUp: trial.auto_topup, packs: trial.packs, canBuy: false, onSave: async () => trial.auto_topup }))
    expect(trialHtml).toContain('Auto top-up is available on paid plans.')

    const failed = buildMinutesSummary(org({ auto_topup_failed_at: '2026-10-12T09:00:00.000Z', auto_topup_failure: 'Your card was declined.' }), [])
    const html = render(createElement(AutoTopUpCard, { autoTopUp: failed.auto_topup, packs: failed.packs, canBuy: true, onSave: async () => failed.auto_topup }))
    expect(html).toContain('The last auto top-up failed on Oct 12, 2026, so it was turned off.')
    expect(html).toContain('Your card was declined.')
    expect(html).toContain('500 minutes · $96.00')
  })

  it('lists purchases, or says there are none', () => {
    expect(render(createElement(PurchaseHistory, { purchases: [] }))).toContain('No extra minutes bought yet.')
    const html = render(
      createElement(PurchaseHistory, {
        purchases: [
          { id: 'p1', minutes: 500, amount_cents: 12000, currency: 'usd', source: 'auto_topup', status: 'credited', created_at: '2026-10-10T12:00:00.000Z' },
          { id: 'p2', minutes: 100, amount_cents: 2500, currency: 'usd', source: 'checkout', status: 'failed', created_at: '2026-10-09T12:00:00.000Z' },
        ],
      }),
    )
    for (const text of ['Oct 10, 2026', '$120.00', 'Auto top-up', 'Added', 'Bought', 'Failed']) expect(html).toContain(text)
  })
})

describe('the copy promises prepaid minutes, never overage billing', () => {
  const OVERAGE = /overage|billed per minute|keeps (answering|calling) past|never cut off/i

  it('the landing FAQ says calls pause and how to add minutes, with the real prices', () => {
    const entry = FAQ.find((f) => f.where?.href === '#your-bill')!
    expect(entry.q).toBe('What happens when my included minutes run out?')
    expect(entry.a).toMatch(/^Calls pause until you add minutes\./)
    expect(entry.a).toContain('100 to 2,500 minutes')
    // Service visitors read the service rate; the store range is named as the stores' own.
    expect(entry.a).toContain('$0.20 a minute on every service plan ($0.18 to $0.25 on the online-store plans)')
    expect(entry.a).not.toContain('depending on the plan')
    expect(entry.a).toContain('up to 12% less')
    expect(entry.a).toContain('auto top-up')
    expect(entry.a).toContain('The free trial cannot buy minutes')
    expect(entry.a).not.toMatch(OVERAGE)
  })

  it('the pricing sections and their notes describe prepaid extra minutes', () => {
    expect(HOME_PRICING.vat).toBe('Prices are in US dollars and exclude VAT.')
    expect(PRICING_NOTE).toContain('prepaid extra minutes')
    expect(PRICING_NOTE).toContain('100-minute packs')
    // The receipt prices the minutes used; the note says packs are bought whole and the rest carries over.
    expect(PRICING_NOTE).toContain('Packs are bought whole')
    expect(PRICING_NOTE).toContain("the minutes the month doesn't use carry over")
    expect(PRICING_NOTE).not.toMatch(/priced as 100-minute packs/)
    expect(STORE_PRICING.note).toContain('packs of 100 to 2,500 minutes')
    expect(STORE_PRICING.note).toContain('up to 12% less')
    for (const text of [PRICING_NOTE, STORE_PRICING.note, HOME_PRICING.facts[0].body, STORE_PRICING.facts[0].body]) {
      expect(text).not.toMatch(OVERAGE)
      expect(text).not.toMatch(/cancelled/)
    }
    expect(HOME_PRICING.facts[0].title).toBe('Calls pause when your minutes run out')
    expect(STORE_PRICING.facts[0].title).toBe('Calls pause when your minutes run out')
    expect(HOME_PRICING.plan.then('$0.20')).toBe('then prepaid extra minutes at $0.20')
    expect(STORE_PRICING.plan.then('$0.25')).toBe('then prepaid extra minutes at $0.25')
    expect(HOME_PRICING.perks.starter.items.map((p) => p.text)).toContain('Prepaid extra minutes whenever you need more')
  })

  it('the older marketing FAQ says the same', () => {
    const entry = MARKETING_FAQS.find((f) => f.question === 'What happens when my included minutes run out?')!
    expect(entry.answer).toMatch(/^Calls pause until you add minutes\./)
    expect(entry.answer).toContain('$0.18 to $0.25 per minute')
    expect(entry.answer).toContain('packs of 100 to 2,500')
    expect(entry.answer).toContain('up to 12% off')
    for (const faq of MARKETING_FAQS) expect(faq.answer).not.toMatch(OVERAGE)
  })

  it('the terms and the refund policy describe prepaid, non-expiring, non-refundable-once-used packs', () => {
    const terms = render(createElement(TermsPage))
    expect(terms).toContain('prepaid extra minutes')
    expect(terms).toContain('auto top-up')
    expect(terms).toContain('do not expire while')
    expect(terms).not.toMatch(OVERAGE)
    expect(terms).not.toMatch(/cancelled/)

    const refund = render(createElement(RefundPolicyPage))
    expect(refund).toContain('Included minutes and extra minute packs')
    expect(refund).toContain('prepaid')
    expect(refund).toContain('never expire while your account exists')
    expect(refund).toContain('non-refundable')
    expect(refund).toContain('handled under section 4')
    expect(refund).not.toMatch(OVERAGE)
    expect(refund).not.toMatch(/cancelled/)
  })

  it('both say the included minutes reset every month, annual billing included (migration 028)', () => {
    for (const html of [render(createElement(TermsPage)), render(createElement(RefundPolicyPage))]) {
      expect(html).toMatch(/reset every\s+month, on annual billing too|reset every month,\s+on\s+annual billing too/)
      expect(html).not.toContain('reset when your subscription renews')
    }
  })

  it('both pause calls only when the included and the purchased minutes are gone', () => {
    const flat = (html: string) => html.replace(/\s+/g, ' ')
    const terms = flat(render(createElement(TermsPage)))
    const refund = flat(render(createElement(RefundPolicyPage)))
    expect(terms).toContain('When your included minutes and any extra minutes you bought are used up, the Service stops placing and answering calls')
    expect(refund).toContain('When your included minutes and any extra minutes you bought are used up, calls pause until you add minutes')
    expect(terms).not.toContain('When the included minutes are used up')
    expect(refund).not.toContain('When they are used up')
  })

  it('both describe a plan change as the checkout route applies it (lib/stripe/plan-subscription.ts)', () => {
    const flat = (html: string) => html.replace(/\s+/g, ' ')
    for (const html of [flat(render(createElement(TermsPage))), flat(render(createElement(RefundPolicyPage)))]) {
      // An upgrade on the same interval: charged now ('always_invoice'), never "on your next invoice".
      expect(html).toContain('An upgrade to a higher-priced plan on the same billing interval takes effect right away')
      expect(html).toMatch(/price difference for the rest of the (current )?billing period is charged immediately/)
      // A downgrade or an interval change: a subscription schedule at the renewal.
      expect(html).toContain('a change between monthly and annual billing takes effect at the end of the current billing period')
      expect(html).toContain('nothing is charged until the trial ends')
      expect(html).not.toContain('prorated on your next invoice')
    }
  })
})

describe('the plan picker knows the interval a plan is paid on', () => {
  const pro = { plan: 'pro', interval: 'year' as const, subscribed: true }

  it('marks a subscribed plan current on its own tab only, and offers the interval switch on the other', () => {
    expect(isCurrentPlanCard({ plan: 'pro', interval: 'year' }, pro)).toBe(true)
    expect(isCurrentPlanCard({ plan: 'pro', interval: 'month' }, pro)).toBe(false)
    expect(isCurrentPlanCard({ plan: 'business', interval: 'year' }, pro)).toBe(false)
    expect(intervalSwitchLabel('month')).toBe('Switch to monthly billing')
    expect(intervalSwitchLabel('year')).toBe('Switch to annual billing')
  })

  it('keeps the trial (or a plan with no subscription) current on both tabs', () => {
    const trial = { plan: 'trial', interval: 'month' as const, subscribed: false }
    expect(isCurrentPlanCard({ plan: 'trial', interval: 'month' }, trial)).toBe(true)
    expect(isCurrentPlanCard({ plan: 'trial', interval: 'year' }, trial)).toBe(true)
  })
})

describe('minutes copy per plan', () => {
  it('words the Minutes section for the trial (no reset, choose a plan) and for paid plans (monthly reset, then extra)', () => {
    expect(minutesSectionDescription('trial')).toBe('Your trial includes 5 minutes. When they run out, calls pause until you choose a plan.')
    expect(minutesSectionDescription('trial', 1)).toBe('Your trial includes 1 minute. When they run out, calls pause until you choose a plan.')
    const paid = minutesSectionDescription('pro')
    expect(paid).toContain('reset every month, on annual billing too')
    expect(paid).toContain('calls go on with any extra minutes you bought, then pause until you add more.')
  })

  it('says every paid plan resets monthly (annual included), and the trial never', () => {
    expect(includedPeriodNote('2026-10-01T00:00:00.000Z', true)).toBe('Since Oct 1, 2026. Resets every month.')
    expect(includedPeriodNote(null, true)).toBe('Resets every month.')
    expect(includedPeriodNote(null, false)).toBe('Trial minutes do not reset.')
    for (const note of [includedPeriodNote(null, true), includedPeriodNote('2026-10-01T00:00:00.000Z', true)]) expect(note).not.toContain('renews')
  })

  it('tells a trial out of minutes to choose a plan, not to add minutes it cannot buy', () => {
    expect(outOfMinutesTitle(true)).toBe("You're out of minutes. Calls are paused until you add minutes.")
    expect(outOfMinutesTitle(false)).toBe("You're out of minutes. Calls are paused until you choose a plan.")
    expect(minutesBannerCopy({ kind: 'out', canBuy: false, plan: 'trial', businessType: null }).title).toBe(outOfMinutesTitle(false))
    const trial = buildMinutesSummary(org({ plan: 'trial', minutes_limit: 5, minutes_used: 5, stripe_subscription_id: null }), [])
    const html = render(createElement(MinutesCard, { summary: trial }))
    expect(html).toContain('Calls are paused until you choose a plan.')
    expect(html).toContain('Trial minutes do not reset.')
  })
})

describe('the out-of-minutes callout follows the cap, not total_left alone', () => {
  it('shows nothing when the minute cap is off (VOICE_TRIAL_MINUTES_ENFORCED=false), even at 0 left', () => {
    vi.stubEnv('VOICE_TRIAL_MINUTES_ENFORCED', 'false')
    try {
      const summary = buildMinutesSummary(org({ minutes_used: 850 }), [])
      expect(summary).toMatchObject({ total_left: 0, paused: false })
      expect(render(createElement(MinutesCard, { summary }))).not.toContain('out of minutes')
    } finally {
      vi.unstubAllEnvs()
    }
  })

  it('shows nothing for a plan value the cap fails open on', () => {
    const summary = buildMinutesSummary(org({ plan: 'gold', minutes_used: 850 }), [])
    expect(summary.paused).toBe(false)
    expect(render(createElement(MinutesCard, { summary }))).not.toContain('out of minutes')
  })

  it('meters 100% of the included minutes as a warning while extra minutes are left (sidebar, tile, billing)', () => {
    expect(minutesMeterTone(100, 0)).toBe('danger')
    expect(minutesMeterTone(100, 250)).toBe('warning')
    expect(minutesMeterTone(85, 0)).toBe('warning')
    expect(minutesMeterTone(40, 250)).toBe('default')
    expect(minutesMeterTone(100, null)).toBe('danger')
  })
})

describe('auto top-up never charges pack after pack, and says it can repeat', () => {
  it('refuses a threshold above the pack, as the route does', () => {
    expect(autoTopUpThresholdProblem(100, 1000)).toContain('cannot be larger than the pack (100 minutes)')
    expect(autoTopUpThresholdProblem(500, 500)).toBeNull()
    expect(autoTopUpThresholdProblem(500, null)).toBeNull()
  })

  it('warns when saving buys a pack right away, or while included minutes are still left', () => {
    const on = { enabled: true, pack: 500 as const }
    expect(autoTopUpNotice(on, 100, { totalLeft: 40, includedLimit: 400, amountCents: 9600 })).toBe(
      'You have 40 minutes left, fewer than this threshold, so auto top-up buys 500 minutes ($96.00) within a few minutes of saving.',
    )
    expect(autoTopUpNotice(on, 450, { totalLeft: 900, includedLimit: 400, amountCents: 9600 })).toContain('Your plan includes 400 minutes a month, fewer than this threshold')
    expect(autoTopUpNotice(on, 50, { totalLeft: 900, includedLimit: 400, amountCents: 9600 })).toBeNull()
    expect(autoTopUpNotice({ ...on, enabled: false }, 100, { totalLeft: 0, includedLimit: 400, amountCents: 9600 })).toBeNull()
  })

  it('describes every charge, not a single one', () => {
    expect(autoTopUpTerms(50, 500, 9600)).toBe('Each time your minutes left drop below 50, we charge your saved card $96.00 for 500 minutes, with an invoice.')
  })

  it('renders the guard on the card: the reason under the field and Save disabled', () => {
    const saved = buildMinutesSummary(org({ auto_topup_enabled: true, auto_topup_pack: 100, auto_topup_threshold: 1000 }), [])
    const html = render(createElement(AutoTopUpCard, { autoTopUp: saved.auto_topup, packs: saved.packs, canBuy: true, totalLeft: saved.total_left, includedLimit: saved.included.limit, onSave: async () => saved.auto_topup }))
    expect(html).toContain('The threshold cannot be larger than the pack (100 minutes)')
    expect(html).not.toContain('never pause')
    expect(html).toContain('so you rarely run out')
    expect(html).not.toContain('Each time your minutes left drop below 1,000')

    const ok = buildMinutesSummary(org({ auto_topup_enabled: true, auto_topup_pack: 500, auto_topup_threshold: 50 }), [])
    const okHtml = render(createElement(AutoTopUpCard, { autoTopUp: ok.auto_topup, packs: ok.packs, canBuy: true, totalLeft: ok.total_left, includedLimit: ok.included.limit, onSave: async () => ok.auto_topup }))
    expect(okHtml).toContain('Each time your minutes left drop below 50, we charge your saved card $96.00 for 500 minutes, with an invoice.')
  })

  it('the landing FAQ no longer promises the line never goes quiet', () => {
    const entry = FAQ.find((f) => f.where?.href === '#your-bill')!
    expect(entry.a).not.toContain('never goes quiet')
    expect(entry.a).toContain('as long as the charge to your card goes through')
  })
})
