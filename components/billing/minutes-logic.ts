// Pure, client-safe logic of the billing page: the plan picker's button
// relation (Upgrade / Downgrade / Switch), the POST /api/billing/checkout
// response (a Checkout redirect or an in-place plan switch), the Minutes
// section's formatting, labels, auto top-up draft and ?buy= pack, and the
// dashboard's minutes banner (with the out-of-minutes choice of
// lib/billing/upgrade.ts). No I/O, no React: tests/billing-minutes-ui.test.ts
// holds every rule here.

import {
  AUTO_TOPUP_THRESHOLD,
  extraMinuteRate,
  isMinutePack,
  minutesCapacity,
  packQuotes,
  type MinutePack,
  type PackQuote,
} from '@/lib/billing/minute-packs'
import {
  UPGRADE_HREF,
  outOfMinutesActions,
  outOfMinutesChoice,
  type OutOfMinutesAction,
  type OutOfMinutesChoice,
  type PlanChange,
} from '@/lib/billing/upgrade'
import { callAllowance, type OrgUsage } from '@/lib/telephony/quota'
import { PLANS, isSelfServePlan, plansForBusinessType, type BusinessType, type Plan } from '@/types'

// ─── Plan picker ──────────────────────────────────────────────────────────────

// How a plan card relates to the organization's current plan: the one rule
// of lib/billing/upgrade.ts (planRank), where a sales-led plan is the top rung
// of its family and an unknown plan value reads as the trial.
export { planChangeRelation, planRank, type PlanChange } from '@/lib/billing/upgrade'

export const PLAN_CHANGE_LABEL: Record<PlanChange, string> = {
  upgrade: 'Upgrade',
  downgrade: 'Downgrade',
  switch: 'Switch',
}

/** The button's words while the request runs: an existing subscription changes in place, a new one goes to Stripe Checkout. */
export function planChangePendingText(hasSubscription: boolean): string {
  return hasSubscription ? 'Changing plan…' : 'Redirecting to checkout…'
}

export type CheckoutResult = { kind: 'redirect'; url: string } | { kind: 'updated'; plan: string | null }

/**
 * The body of a successful POST /api/billing/checkout: `{ url }` (Stripe
 * Checkout for a new subscription) or `{ updated: true, plan }` (the active
 * subscription was switched in place). Anything else is null, so the caller
 * shows an error instead of navigating somewhere unexpected.
 */
export function readCheckoutResult(body: unknown): CheckoutResult | null {
  if (!body || typeof body !== 'object') return null
  const record = body as Record<string, unknown>
  if (record.updated === true) return { kind: 'updated', plan: typeof record.plan === 'string' ? record.plan : null }
  if (typeof record.url === 'string' && /^https?:\/\//i.test(record.url)) return { kind: 'redirect', url: record.url }
  return null
}

export const PLAN_CHANGED_MESSAGE = 'Your plan was changed.'

/**
 * The current plan's button on the billing page's other cycle tab: "Switch to
 * annual billing" (the change itself, and when it applies, is
 * components/billing/plan-switch.ts).
 */
export function intervalSwitchLabel(interval: 'month' | 'year'): string {
  return `Switch to ${interval === 'year' ? 'annual' : 'monthly'} billing`
}

/**
 * Whether a card of the plan picker is the organization's current plan. A
 * plan paid through a live subscription is current on the tab of the
 * interval it is paid on (on the other tab its card offers the interval
 * switch); without one (the trial, a plan billed another way) it is current
 * on both tabs.
 */
export function isCurrentPlanCard(
  card: { plan: string; interval: 'month' | 'year' },
  current: { plan: string; interval: 'month' | 'year'; subscribed: boolean },
): boolean {
  if (card.plan !== current.plan) return false
  return !current.subscribed || card.interval === current.interval
}

// ─── Money and minutes ────────────────────────────────────────────────────────

const COUNT = new Intl.NumberFormat('en-US')

/** 2500 → "2,500" */
export function formatMinutes(n: number): string {
  return COUNT.format(Math.max(0, Math.floor(Number.isFinite(n) ? n : 0)))
}

/** An amount in the currency's minor unit: (12000, 'usd') → "$120.00". An unknown code prints as "120.00 XYZ". */
export function formatCents(cents: number, currency = 'usd'): string {
  const amount = (Number.isFinite(cents) ? cents : 0) / 100
  const code = currency.trim().toUpperCase()
  if (!/^[A-Z]{3}$/.test(code)) return `${amount.toFixed(2)} ${code}`.trim()
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: code }).format(amount)
}

/** A pack's effective price of one minute, in dollars as the price list writes it: 24 → "$0.24", 21.12 → "$0.2112". */
export function formatPerMinute(perMinuteCents: number): string {
  const usd = (Number.isFinite(perMinuteCents) ? perMinuteCents : 0) / 100
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 2, maximumFractionDigits: 4 }).format(usd)
}

/** What the packs will cost an organization that cannot buy them yet (the trial), from the plans it can choose. */
export interface PackPreview {
  /** The family's first self-serve plan, the one its "Upgrade to …" offers: the quotes are its prices. */
  plan: Plan
  planName: string
  quotes: PackQuote[]
  /** True when every plan of the family sells extra minutes at the same rate (the service plans' $0.20). */
  uniform: boolean
  /** The family's rates in words: "$0.20 a minute on every plan", "$0.18 to $0.25 a minute depending on the plan". */
  rate: string
}

/**
 * The packs' prices for the trial, which cannot buy until it chooses a plan
 * (BuyMinutesGrid): the prices of its family's first plan, and the family's
 * extra-minute rates (types/index.ts PLANS overage_per_min, the 100-minute
 * pack's) in one phrase. Null when no plan of the family sells minutes.
 */
export function trialPackPreview(businessType: BusinessType | null | undefined): PackPreview | null {
  const family = plansForBusinessType(businessType)
  const rates = family.map((p) => extraMinuteRate(p)).filter((r): r is number => r !== null)
  const entry = family.find((p) => isSelfServePlan(p))
  if (!entry || rates.length === 0) return null
  const low = Math.min(...rates)
  const high = Math.max(...rates)
  const usd = (rate: number) => formatPerMinute(rate * 100)
  const uniform = low === high
  return {
    plan: entry,
    planName: PLANS[entry].name,
    quotes: packQuotes(entry),
    uniform,
    rate: uniform ? `${usd(low)} a minute on every plan` : `${usd(low)} to ${usd(high)} a minute depending on the plan`,
  }
}

/** The volume discount badge: 0.04 → "Save 4%"; null without a discount. */
export function discountLabel(discount: number): string | null {
  const pct = Math.round((Number.isFinite(discount) ? discount : 0) * 100)
  return pct > 0 ? `Save ${pct}%` : null
}

/** Share of the period's included minutes used, 0..100 (0 without an allowance). */
export function includedUsagePct(used: number, limit: number): number {
  if (!Number.isFinite(limit) || limit <= 0) return 0
  const u = Number.isFinite(used) ? Math.max(0, used) : 0
  return Math.min(100, Math.round((u / limit) * 100))
}

/** The meter's tone, like every usage meter of the app: ≥ 80% warning, ≥ 100% danger. */
export function usageTone(pct: number): 'default' | 'warning' | 'danger' {
  return pct >= 100 ? 'danger' : pct >= 80 ? 'warning' : 'default'
}

/**
 * The included-minutes meter's tone with the prepaid extra minutes counted
 * (the sidebar meter, the dashboard's "Minutes used" tile, the billing
 * page): at 100% of the included minutes it warns instead of alarming while
 * extra minutes are left, since calls keep going on them.
 */
export function minutesMeterTone(pct: number, extraBalance: number | null | undefined): 'default' | 'warning' | 'danger' {
  const tone = usageTone(pct)
  const extra = Number(extraBalance)
  return tone === 'danger' && Number.isFinite(extra) && extra > 0 ? 'warning' : tone
}

/**
 * The billing page's Minutes section, in one sentence: the trial's minutes
 * never reset and it cannot buy more (it chooses a plan); every paid plan's
 * included minutes start over every month, annual billing included, and
 * calls go on to the extra minutes before they pause.
 */
export function minutesSectionDescription(plan: string | null | undefined, trialMinutes: number = PLANS.trial.minutes_limit): string {
  if (plan === 'trial') {
    return `Your trial includes ${formatMinutes(trialMinutes)} ${trialMinutes === 1 ? 'minute' : 'minutes'}. When they run out, calls pause until you choose a plan.`
  }
  return "Your plan's minutes reset every month, on annual billing too. When they run out, calls go on with any extra minutes you bought, then pause until you add more."
}

/** The period note under the included-minutes meter (MinutesCard): every paid plan's minutes reset monthly, the trial's never. */
export function includedPeriodNote(periodStart: string | null, canBuy: boolean): string {
  if (!canBuy) return 'Trial minutes do not reset.'
  return periodStart ? `Since ${formatPurchaseDate(periodStart)}. Resets every month.` : 'Resets every month.'
}

/** The out-of-minutes title (the banner and the billing page): a paid plan adds minutes, the trial chooses a plan. */
export function outOfMinutesTitle(canBuy: boolean): string {
  return canBuy ? "You're out of minutes. Calls are paused until you add minutes." : "You're out of minutes. Calls are paused until you choose a plan."
}

// ─── Purchase history ─────────────────────────────────────────────────────────

/** minute_purchases.source, in the owner's words. */
export const PURCHASE_SOURCE_LABEL: Record<'checkout' | 'auto_topup' | 'admin', string> = {
  checkout: 'Bought',
  auto_topup: 'Auto top-up',
  admin: 'Added by support',
}

/** minute_purchases.status, in the owner's words. */
export const PURCHASE_STATUS_LABEL: Record<'credited' | 'failed', string> = {
  credited: 'Added',
  failed: 'Failed',
}

export function purchaseSourceLabel(source: string): string {
  return Object.hasOwn(PURCHASE_SOURCE_LABEL, source) ? PURCHASE_SOURCE_LABEL[source as keyof typeof PURCHASE_SOURCE_LABEL] : source
}

export function purchaseStatusLabel(status: string): string {
  return Object.hasOwn(PURCHASE_STATUS_LABEL, status) ? PURCHASE_STATUS_LABEL[status as keyof typeof PURCHASE_STATUS_LABEL] : status
}

/** "Oct 14, 2026", or the raw value when it is not a date. */
export function formatPurchaseDate(iso: string): string {
  const t = Date.parse(iso)
  if (!Number.isFinite(t)) return iso
  return new Date(t).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

// ─── Auto top-up ──────────────────────────────────────────────────────────────

/** The pack the form offers until the owner has saved one. */
export const DEFAULT_AUTO_TOPUP_PACK: MinutePack = 500

export interface AutoTopUpDraft {
  enabled: boolean
  pack: MinutePack
  /** The threshold field as typed (validated by parseThreshold on save). */
  threshold: string
}

/** The saved settings as GET /api/billing/minutes reports them. */
export interface AutoTopUpSaved {
  enabled: boolean
  pack: number | null
  threshold: number | null
}

export function autoTopUpDraftFrom(saved: AutoTopUpSaved): AutoTopUpDraft {
  return {
    enabled: saved.enabled,
    pack: isMinutePack(saved.pack) ? saved.pack : DEFAULT_AUTO_TOPUP_PACK,
    threshold: String(saved.threshold ?? AUTO_TOPUP_THRESHOLD.default),
  }
}

/** A whole number of minutes in 10..1000 (organizations.auto_topup_threshold CHECK), else null. */
export function parseThreshold(input: string): number | null {
  const text = input.trim()
  if (!/^\d+$/.test(text)) return null
  const n = Number(text)
  return n >= AUTO_TOPUP_THRESHOLD.min && n <= AUTO_TOPUP_THRESHOLD.max ? n : null
}

export const THRESHOLD_HINT = `A whole number from ${AUTO_TOPUP_THRESHOLD.min} to ${COUNT.format(AUTO_TOPUP_THRESHOLD.max)} minutes.`

/** True when the form differs from what is saved (a draft with an invalid threshold is dirty too). */
export function autoTopUpDirty(draft: AutoTopUpDraft, saved: AutoTopUpSaved): boolean {
  const base = autoTopUpDraftFrom(saved)
  return draft.enabled !== base.enabled || draft.pack !== base.pack || draft.threshold.trim() !== base.threshold
}

/**
 * Why the form cannot be saved as typed, or null. A threshold above the pack
 * would charge pack after pack (one every cooldown) until the minutes climb
 * back over it, so PUT /api/billing/minutes/auto-topup refuses it
 * (threshold_above_pack); the form says so before the request.
 */
export function autoTopUpThresholdProblem(pack: MinutePack, threshold: number | null): string | null {
  if (threshold === null || threshold <= pack) return null
  return `The threshold cannot be larger than the pack (${formatMinutes(pack)} minutes): one pack has to bring your minutes back above it. Choose a bigger pack or a lower threshold.`
}

/**
 * A heads-up before saving an enabled auto top-up whose threshold buys a pack
 * sooner than the owner may expect: right away when the minutes left are
 * already under it, or while included minutes are still left when the plan
 * includes fewer minutes than the threshold. Null otherwise.
 */
export function autoTopUpNotice(
  draft: { enabled: boolean; pack: MinutePack },
  threshold: number | null,
  minutes: { totalLeft: number; includedLimit: number; amountCents: number | null },
): string | null {
  if (!draft.enabled || threshold === null || threshold > draft.pack) return null
  const pack = `${formatMinutes(draft.pack)} minutes${minutes.amountCents === null ? '' : ` (${formatCents(minutes.amountCents, 'usd')})`}`
  if (minutes.totalLeft < threshold) {
    return `You have ${formatMinutes(minutes.totalLeft)} minutes left, fewer than this threshold, so auto top-up buys ${pack} within a few minutes of saving.`
  }
  if (minutes.includedLimit > 0 && threshold > minutes.includedLimit) {
    return `Your plan includes ${formatMinutes(minutes.includedLimit)} minutes a month, fewer than this threshold, so auto top-up also buys packs while you still have included minutes left.`
  }
  return null
}

/** What an enabled auto top-up does, in the card's footer and the save toast. */
export function autoTopUpTerms(threshold: number, pack: number, amountCents: number | null): string {
  const price = amountCents === null ? '' : ` ${formatCents(amountCents, 'usd')}`
  return `Each time your minutes left drop below ${formatMinutes(threshold)}, we charge your saved card${price} for ${formatMinutes(pack)} minutes, with an invoice.`
}

// ─── Return from Stripe Checkout ──────────────────────────────────────────────

export type MinutesReturn = { tone: 'success' | 'info'; message: string }

/** The toast for /billing?minutes=success|canceled (Checkout's success and cancel URLs); null otherwise. */
export function minutesReturnNotice(search: string): MinutesReturn | null {
  const value = new URLSearchParams(search).get('minutes')
  if (value === 'success') return { tone: 'success', message: 'Payment received. Your extra minutes will show here in a moment.' }
  if (value === 'canceled') return { tone: 'info', message: 'Checkout canceled. No minutes were added.' }
  return null
}

/** The query string without the `minutes` flag ("" when nothing else is left), so a reload does not repeat the toast. */
export function withoutMinutesParam(search: string): string {
  const params = new URLSearchParams(search)
  params.delete('minutes')
  const rest = params.toString()
  return rest ? `?${rest}` : ''
}

// ─── Dashboard banner ─────────────────────────────────────────────────────────

/** "Running low" below this share of the plan's included minutes. */
export const LOW_MINUTES_SHARE = 0.2

/** The plan the banner's choice is priced from, and the family the trial upgrades within. */
interface BannerPlan {
  plan: string | null
  businessType: BusinessType | null
}

export type MinutesBannerState =
  | ({ kind: 'out'; canBuy: boolean } & BannerPlan)
  | ({ kind: 'low'; left: number; canBuy: boolean } & BannerPlan)

/**
 * The banner every dashboard page shows (components/dashboard/MinutesBanner):
 * 'out' when no new call can start (the same decision as the call paths,
 * lib/telephony/quota.ts callAllowance), 'low' when the minutes left
 * (included + extra) are under 20% of the plan's included minutes, else
 * nothing. No banner where the cap does not apply (an unknown plan, no
 * allowance, VOICE_TRIAL_MINUTES_ENFORCED=false: evaluate on the server), and
 * no "running low" while auto top-up is on (it buys before minutes run out).
 * The plan and the business type travel with the state so the banner can
 * offer the next plan up of the right family (lib/billing/upgrade.ts).
 */
export function minutesBannerState(
  usage: (OrgUsage & { auto_topup_enabled?: boolean | null; business_type?: BusinessType | null }) | null | undefined,
): MinutesBannerState | null {
  if (!usage) return null
  const allowance = callAllowance(usage)
  const canBuy = extraMinuteRate(usage.plan) !== null
  const plan: BannerPlan = { plan: usage.plan ?? null, businessType: usage.business_type ?? null }
  if (!allowance.allowed) return { kind: 'out', canBuy, ...plan }
  if (allowance.capSeconds === null || usage.auto_topup_enabled === true) return null
  const { total } = minutesCapacity(usage)
  const limit = Number(usage.minutes_limit)
  if (total < limit * LOW_MINUTES_SHARE) return { kind: 'low', left: Math.floor(total), canBuy, ...plan }
  return null
}

/**
 * Whether the dashboard shell shows the minutes banner on this page: not on
 * the billing page, whose Minutes section already shows the same
 * out-of-minutes callout (and the auto top-up form that answers "running low").
 */
export function showsMinutesBanner(pathname: string): boolean {
  return !(pathname === '/billing' || pathname.startsWith('/billing/'))
}

/**
 * The banner's buttons, the same in both states: the next plan up ("Upgrade
 * to Growth (1,000 minutes for $99/mo)", or "Talk to us" when that rung is
 * sales-led) and "Buy 100 minutes for $20" (never on the trial). A plan the
 * catalog does not know keeps the single generic button.
 */
export function minutesBannerActions(state: MinutesBannerState): OutOfMinutesAction[] {
  const actions = outOfMinutesActions(outOfMinutesChoice(state.plan, state.businessType))
  if (actions.length > 0) return actions
  return [
    state.canBuy
      ? { kind: 'buy', label: 'Buy minutes', href: '/billing#minutes', primary: true }
      : { kind: 'upgrade', label: 'Choose a plan', href: UPGRADE_HREF, primary: true },
  ]
}

/**
 * What the owner can do once the minutes are gone, in one sentence after
 * "Your agent isn't taking new calls.": the dashboard banner and the billing
 * page's out-of-minutes callout say the same thing.
 */
export function outOfMinutesDescription(choice: OutOfMinutesChoice, canBuy: boolean): string {
  const lead = "Your agent isn't taking new calls."
  const { upgrade, buy } = choice
  if (upgrade?.kind === 'upgrade' && buy) {
    const next = PLANS[upgrade.plan]
    return `${lead} Upgrade to ${next.name} for ${formatMinutes(next.minutes_limit)} minutes a month, or buy ${formatMinutes(buy.minutes)} minutes to resume right away.`
  }
  if (upgrade?.kind === 'contact' && buy) {
    return `${lead} Buy ${formatMinutes(buy.minutes)} minutes to resume right away, or talk to us about a larger allowance.`
  }
  if (canBuy) return `${lead} Buy minutes or turn on auto top-up to resume.`
  return `${lead} Choose a plan to keep it answering.`
}

/** The banner's words. */
export function minutesBannerCopy(state: MinutesBannerState): { title: string; description: string } {
  if (state.kind === 'out') {
    return {
      title: outOfMinutesTitle(state.canBuy),
      description: outOfMinutesDescription(outOfMinutesChoice(state.plan, state.businessType), state.canBuy),
    }
  }
  return {
    title: `Running low: ${formatMinutes(state.left)} ${state.left === 1 ? 'minute' : 'minutes'} left`,
    description: state.canBuy
      ? "Buy minutes or turn on auto top-up so calls don't pause."
      : 'Choose a plan before they run out: calls pause when they do.',
  }
}

// ─── Billing page: ?buy= ──────────────────────────────────────────────────────

/**
 * The pack a link asked the Minutes section to highlight (/billing?buy=100#minutes,
 * from the banner, the out-of-minutes e-mail and the store overview): a pack
 * size, else null. Highlighting only: the owner still presses Buy.
 */
export function parseBuyParam(value: string | null | undefined): MinutePack | null {
  const text = (value ?? '').trim()
  if (!/^\d{1,5}$/.test(text)) return null
  const n = Number(text)
  return isMinutePack(n) ? n : null
}
