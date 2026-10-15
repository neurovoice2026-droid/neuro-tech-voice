// MinutesSummaryDto: what the billing page's "Minutes" section shows (GET
// /api/billing/minutes): the period's included minutes, the prepaid extra
// minutes (minute packs never expire and are used after the included ones),
// the packs the plan can buy, the auto top-up settings and the last purchases.
// The builder is pure; loadMinutesSummary reads the organization row and its
// minute_purchases with whichever client the caller passes (the tenant's,
// bounded by RLS, in the route).

import type { SupabaseClient } from '@supabase/supabase-js'
import { callAllowance } from '@/lib/telephony/quota'
import { AUTO_TOPUP_THRESHOLD, extraMinuteRate, isMinutePack, minutesCapacity, packQuotes, type PackQuote } from './minute-packs'

/** Organization columns the summary (and the auto top-up checks) read. */
export const MINUTES_ORG_COLUMNS =
  'plan, minutes_used, minutes_limit, extra_minutes_balance, usage_period_start, auto_topup_enabled, auto_topup_pack, auto_topup_threshold, auto_topup_failed_at, auto_topup_failure, stripe_customer_id, stripe_subscription_id'

export interface MinutesOrgRow {
  plan: string | null
  minutes_used: number | null
  minutes_limit: number | null
  extra_minutes_balance: number | null
  usage_period_start: string | null
  auto_topup_enabled: boolean | null
  auto_topup_pack: number | null
  auto_topup_threshold: number | null
  auto_topup_failed_at: string | null
  auto_topup_failure: string | null
  stripe_customer_id: string | null
  stripe_subscription_id: string | null
}

export interface MinutePurchaseRow {
  id: string
  minutes: number
  amount_cents: number
  currency: string
  source: string
  status: string
  created_at: string
}

export interface AutoTopUpDto {
  enabled: boolean
  pack: number | null
  threshold: number | null
  /** A paid plan with a Stripe subscription (the saved payment method is checked when enabling). */
  available: boolean
  last_failed_at: string | null
  failure: string | null
}

export interface MinutesSummaryDto {
  plan: string
  can_buy: boolean
  rate_per_minute: number | null
  packs: PackQuote[]
  included: { used: number; limit: number; left: number; period_start: string | null }
  extra_balance: number
  total_left: number
  /**
   * No new call can start: the same decision as the call paths
   * (lib/telephony/quota.ts callAllowance), made where the builder runs (the
   * route, on the server, where VOICE_TRIAL_MINUTES_ENFORCED is known). False
   * whenever the cap does not apply (the switch is off, an unknown plan, no
   * allowance), even at total_left 0.
   */
  paused: boolean
  auto_topup: AutoTopUpDto
  purchases: MinutePurchaseRow[]
}

/** How many purchases the summary lists (newest first). */
export const SUMMARY_PURCHASE_LIMIT = 20

/** Extra minutes are sold on every paid plan (sales-led tiers included), never on the trial. */
export function canBuyMinutes(plan: string | null | undefined): boolean {
  return extraMinuteRate(plan) !== null
}

/** Auto top-up can charge the saved card only for a paid plan billed through a Stripe subscription. */
export function autoTopUpAvailable(org: Pick<MinutesOrgRow, 'plan' | 'stripe_customer_id' | 'stripe_subscription_id'>): boolean {
  return canBuyMinutes(org.plan) && !!org.stripe_customer_id && !!org.stripe_subscription_id
}

export function autoTopUpDto(org: Pick<MinutesOrgRow, 'plan' | 'stripe_customer_id' | 'stripe_subscription_id' | 'auto_topup_enabled' | 'auto_topup_pack' | 'auto_topup_threshold' | 'auto_topup_failed_at' | 'auto_topup_failure'>): AutoTopUpDto {
  return {
    enabled: org.auto_topup_enabled === true,
    pack: isMinutePack(org.auto_topup_pack) ? org.auto_topup_pack : null,
    threshold: typeof org.auto_topup_threshold === 'number' ? org.auto_topup_threshold : null,
    available: autoTopUpAvailable(org),
    last_failed_at: org.auto_topup_failed_at ?? null,
    failure: org.auto_topup_failure ?? null,
  }
}

/** The configured threshold, or the default when none was saved. */
export function autoTopUpThreshold(value: number | null | undefined): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : AUTO_TOPUP_THRESHOLD.default
}

function wholeMinutes(value: number | null | undefined): number {
  const n = Number(value)
  return Number.isFinite(n) ? Math.max(0, Math.floor(n)) : 0
}

export function buildMinutesSummary(org: MinutesOrgRow, purchases: MinutePurchaseRow[]): MinutesSummaryDto {
  const plan = org.plan ?? 'trial'
  const capacity = minutesCapacity(org)
  return {
    plan,
    can_buy: canBuyMinutes(plan),
    rate_per_minute: extraMinuteRate(plan),
    packs: packQuotes(plan),
    included: {
      // Included usage only: minutes paid from the purchased balance are not in minutes_used (027).
      used: wholeMinutes(org.minutes_used),
      limit: wholeMinutes(org.minutes_limit),
      left: capacity.includedLeft,
      period_start: org.usage_period_start ?? null,
    },
    extra_balance: capacity.extra,
    total_left: capacity.total,
    paused: !callAllowance(org).allowed,
    auto_topup: autoTopUpDto(org),
    purchases: purchases.map((r) => ({
      id: r.id,
      minutes: r.minutes,
      amount_cents: r.amount_cents,
      currency: r.currency,
      source: r.source,
      status: r.status,
      created_at: r.created_at,
    })),
  }
}

export async function loadMinutesOrg(db: SupabaseClient, orgId: string): Promise<MinutesOrgRow> {
  const { data, error } = await db.from('organizations').select(MINUTES_ORG_COLUMNS).eq('id', orgId).single()
  if (error) throw new Error(`organizations minutes read failed: ${error.message}`)
  return data as MinutesOrgRow
}

export async function loadMinutesSummary(db: SupabaseClient, orgId: string): Promise<MinutesSummaryDto> {
  const [org, purchases] = await Promise.all([
    loadMinutesOrg(db, orgId),
    db
      .from('minute_purchases')
      .select('id, minutes, amount_cents, currency, source, status, created_at')
      .eq('org_id', orgId)
      .order('created_at', { ascending: false })
      .limit(SUMMARY_PURCHASE_LIMIT),
  ])
  if (purchases.error) throw new Error(`minute_purchases read failed: ${purchases.error.message}`)
  return buildMinutesSummary(org, (purchases.data ?? []) as MinutePurchaseRow[])
}
