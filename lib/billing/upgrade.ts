// What an organization that is out of minutes (or running low) can do about
// it, offered as one explicit choice everywhere it is told: the dashboard
// banner (components/dashboard/MinutesBanner), the "out of minutes" e-mail
// (lib/email/templates.ts), the billing page's Minutes section and the store
// overview's minutes_exhausted problem:
//   • move up one plan in its own family ("Upgrade to Growth (1,000 minutes
//     for $99/mo)"), or "Talk to us" when that rung is sales-led;
//   • buy the smallest prepaid pack ("Buy 100 minutes for $20"), never on
//     the trial, which cannot buy packs.
// It also holds the one rule every plan comparison uses (planRank,
// planChangeRelation): the billing page's Upgrade / Downgrade / Switch
// buttons and the confirmation dialog. A sales-led plan (Enterprise, Store
// Enterprise) is the top rung of its family, above every priced plan, so
// moving off it is a downgrade and nothing is an "upgrade" to a $0 list price.
// Pure and client-safe: every number comes from PLANS (types/index.ts) and the
// pack quotes of lib/billing/minute-packs.ts, never from this file.

import { MINUTE_PACKS, packQuote, type MinutePack } from './minute-packs'
import { PLANS, SERVICE_PLANS, STORE_PLANS, isPlan, plansForBusinessType, type BusinessType, type Plan } from '@/types'

/** The billing page's plan picker. */
export const UPGRADE_HREF = '/billing#plans'

/** The pack the choice offers: the smallest one. */
export const QUICK_PACK: MinutePack = MINUTE_PACKS[0]

/** The words of the sales-led action. */
export const TALK_TO_US_LABEL = 'Talk to us'

/**
 * Where "Talk to us" goes: the sales line, lib/site.ts AUTH.contactSales.
 * Copied rather than imported so the dashboard's client bundle (the banner,
 * the billing page, the store overview) never carries lib/site.ts, which is
 * marketing copy (the convention of app/(dashboard)/store/settings/page.tsx);
 * lib/billing/upgrade.test.ts fails the moment the two differ.
 */
export const CONTACT_SALES_HREF = 'tel:+40774566367'

/**
 * The same line as people read it (lib/site.ts COMPANY.phone), printed next
 * to every "Talk to us": a tel: link does nothing in most desktop browsers
 * and e-mail clients, so the number itself has to be on the page. The one
 * sales channel everywhere (the dashboard banner, the billing page's
 * callout and Enterprise card, the store overview, onboarding's launch step,
 * the out-of-minutes e-mail): the homepage's, until the owner has a
 * monitored sales address (COMPANY.email is still empty).
 */
export const CONTACT_SALES_PHONE = '+40 774 566 367'

/** The billing page's Minutes section with a pack highlighted (`?buy=` never charges by itself). */
export function buyPackHref(minutes: MinutePack = QUICK_PACK): string {
  return `/billing?buy=${minutes}#minutes`
}

// ─── Plan comparison ──────────────────────────────────────────────────────────

export type PlanChange = 'upgrade' | 'downgrade' | 'switch'

/**
 * Where a plan sits on its family's ladder, for comparisons: the trial (and
 * a value that names no plan, shown as the trial) at 0, a self-serve plan at
 * its monthly list price, a sales-led plan (contact_sales: Enterprise, Store
 * Enterprise) above every priced plan whatever PLANS carries for its price
 * (Enterprise publishes none: 0; Store Enterprise starts from $1,000).
 */
export function planRank(plan: string | null | undefined): number {
  if (!isPlan(plan) || plan === 'trial') return 0
  const cfg = PLANS[plan]
  return cfg.contact_sales === true ? Number.POSITIVE_INFINITY : cfg.price_monthly
}

/**
 * How moving from the organization's current plan to `target` reads: a
 * higher rung is an upgrade, a lower one a downgrade, the same rung a switch
 * (planRank). From Enterprise every self-serve plan is a downgrade; to it,
 * from any priced plan, an upgrade.
 */
export function planChangeRelation(current: string | null | undefined, target: Plan): PlanChange {
  const from = planRank(current)
  const to = planRank(target)
  if (to > from) return 'upgrade'
  if (to < from) return 'downgrade'
  return 'switch'
}

// ─── The out-of-minutes choice ────────────────────────────────────────────────

/** The plan ladder a paid plan belongs to, cheapest first; null for the trial. */
function ladderOf(plan: Plan): readonly Plan[] | null {
  const family = PLANS[plan].family
  if (family === 'ecommerce') return STORE_PLANS
  if (family === 'services') return SERVICE_PLANS
  return null
}

/**
 * The next plan up in the organization's own family (SERVICE_PLANS or
 * STORE_PLANS order): the trial goes to the first paid plan of the family its
 * business type buys from, a paid plan to the next rung of its own family.
 * Null on the top rung (Enterprise, Store Enterprise) and for a value that
 * names no plan.
 */
export function nextPlanUp(plan: string | null | undefined, businessType?: BusinessType | null): Plan | null {
  if (!isPlan(plan)) return null
  if (plan === 'trial') return plansForBusinessType(businessType)[0] ?? null
  const ladder = ladderOf(plan)
  if (!ladder) return null
  const i = ladder.indexOf(plan)
  return i >= 0 && i + 1 < ladder.length ? ladder[i + 1] : null
}

const COUNT = new Intl.NumberFormat('en-US')

/** US cents as the price list writes dollars: 2000 → "$20", 2250 → "$22.50", 100000 → "$1,000". */
export function formatUsd(cents: number): string {
  const safe = Number.isFinite(cents) ? Math.max(0, Math.round(cents)) : 0
  const whole = safe % 100 === 0
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: whole ? 0 : 2,
    maximumFractionDigits: whole ? 0 : 2,
  }).format(safe / 100)
}

export type UpgradeAction =
  /** A self-serve plan one rung up, bought on the billing page's plan picker. */
  | { kind: 'upgrade'; plan: Plan; label: string; href: string }
  /** A sales-led rung (or the organization already holds one): talk to sales. */
  | { kind: 'contact'; plan: Plan; label: string; href: string }

export interface BuyPackAction {
  kind: 'buy'
  minutes: MinutePack
  amount_cents: number
  label: string
  /** The Minutes section with this pack highlighted; it never charges by itself. */
  href: string
}

export interface OutOfMinutesChoice {
  upgrade: UpgradeAction | null
  buy: BuyPackAction | null
}

/**
 * "Upgrade to Growth (1,000 minutes for $99/mo)". A sales-led plan has no
 * price to print (never "$0/mo"): "Talk to us about Enterprise".
 */
export function upgradeLabel(plan: Plan): string {
  const cfg = PLANS[plan]
  if (cfg.contact_sales === true) return `${TALK_TO_US_LABEL} about ${cfg.name}`
  return `Upgrade to ${cfg.name} (${COUNT.format(cfg.minutes_limit)} minutes for ${formatUsd(cfg.price_monthly * 100)}/mo)`
}

/** "Buy 100 minutes for $20" */
export function buyPackLabel(minutes: number, amountCents: number): string {
  return `Buy ${COUNT.format(minutes)} minutes for ${formatUsd(amountCents)}`
}

function upgradeAction(plan: Plan, businessType: BusinessType | null | undefined): UpgradeAction | null {
  const next = nextPlanUp(plan, businessType)
  if (next) {
    if (PLANS[next].contact_sales === true) return { kind: 'contact', plan: next, label: TALK_TO_US_LABEL, href: CONTACT_SALES_HREF }
    return { kind: 'upgrade', plan: next, label: upgradeLabel(next), href: UPGRADE_HREF }
  }
  // Already on the sales-led top rung: its minutes are agreed with sales, so that is who raises them.
  if (PLANS[plan].contact_sales === true) return { kind: 'contact', plan, label: TALK_TO_US_LABEL, href: CONTACT_SALES_HREF }
  return null
}

/**
 * The two ways out of an empty minute balance for an organization on this
 * plan: the next plan up (or "Talk to us") and the smallest pack at the
 * plan's extra-minute price. The trial gets no pack (it cannot buy minutes);
 * a value that names no plan gets neither (the cap never applies to it).
 */
export function outOfMinutesChoice(plan: string | null | undefined, businessType?: BusinessType | null): OutOfMinutesChoice {
  if (!isPlan(plan)) return { upgrade: null, buy: null }
  const quote = packQuote(plan, QUICK_PACK)
  return {
    upgrade: upgradeAction(plan, businessType),
    buy: quote
      ? { kind: 'buy', minutes: quote.minutes, amount_cents: quote.amount_cents, label: buyPackLabel(quote.minutes, quote.amount_cents), href: buyPackHref(quote.minutes) }
      : null,
  }
}

/** One button of the choice, in the order it is shown. */
export interface OutOfMinutesAction {
  kind: UpgradeAction['kind'] | 'buy'
  label: string
  /** An app path ('/billing…') or the sales line (CONTACT_SALES_HREF, a tel: link). */
  href: string
  /** The one filled button: the upgrade when it is self-serve, otherwise the pack. */
  primary: boolean
}

/** The choice as buttons: the upgrade (or "Talk to us") first, then the pack. */
export function outOfMinutesActions(choice: OutOfMinutesChoice): OutOfMinutesAction[] {
  const primaryIsUpgrade = choice.upgrade?.kind === 'upgrade' || !choice.buy
  const actions: OutOfMinutesAction[] = []
  if (choice.upgrade) actions.push({ kind: choice.upgrade.kind, label: choice.upgrade.label, href: choice.upgrade.href, primary: primaryIsUpgrade })
  if (choice.buy) actions.push({ kind: 'buy', label: choice.buy.label, href: choice.buy.href, primary: !primaryIsUpgrade })
  return actions
}

/** True for an app path (a client-side link), false for the sales line (tel:) or any other scheme. */
export function isAppPath(href: string): boolean {
  return href.startsWith('/') && !href.startsWith('//')
}
