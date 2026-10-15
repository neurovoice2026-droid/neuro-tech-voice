// Prepaid extra-minute packs (migration 027). Once a plan's included minutes
// are used up, calls stop (lib/telephony/quota.ts) unless the organization
// holds purchased minutes: packs of 100 / 500 / 1,000 / 2,500 minutes priced
// at the plan's extra-minute rate (PLANS[plan].overage_per_min) with volume
// discounts. Purchased minutes never expire and are used only after the
// period's included minutes. Only paid plans can buy (every plan but the
// trial, contact-sales tiers included). Pure: no I/O.

import { isPlan, PLANS } from '@/types'

export const MINUTE_PACKS = [100, 500, 1000, 2500] as const

export type MinutePack = (typeof MINUTE_PACKS)[number]

/** Volume discount of each pack, as a fraction of the plan's extra-minute rate. */
export const PACK_DISCOUNTS: Record<MinutePack, number> = { 100: 0, 500: 0.04, 1000: 0.08, 2500: 0.12 }

export function isMinutePack(n: unknown): n is MinutePack {
  return typeof n === 'number' && (MINUTE_PACKS as readonly number[]).includes(n)
}

/** The plan's price of one extra minute in USD; null for the trial or a value that names no plan. */
export function extraMinuteRate(plan: string | null | undefined): number | null {
  if (!isPlan(plan) || plan === 'trial') return null
  const rate = PLANS[plan].overage_per_min
  return Number.isFinite(rate) && rate > 0 ? rate : null
}

export interface PackQuote {
  minutes: MinutePack
  /** What the pack costs, in US cents. */
  amount_cents: number
  /** The effective price of one minute in the pack, in US cents (two decimals). */
  per_minute_cents: number
  /** The volume discount applied (0.04 = 4%). */
  discount: number
}

/** The price of one pack for an organization on this plan; null when the plan cannot buy or the size is not a pack. */
export function packQuote(plan: string | null | undefined, minutes: number): PackQuote | null {
  const rate = extraMinuteRate(plan)
  if (rate === null || !isMinutePack(minutes)) return null
  const discount = PACK_DISCOUNTS[minutes]
  const amount_cents = Math.round(minutes * rate * (1 - discount) * 100)
  return { minutes, amount_cents, per_minute_cents: Math.round((amount_cents / minutes) * 100) / 100, discount }
}

/** Every pack for this plan, smallest first; empty when the plan cannot buy minutes. */
export function packQuotes(plan: string | null | undefined): PackQuote[] {
  return MINUTE_PACKS.map((m) => packQuote(plan, m)).filter((q): q is PackQuote => q !== null)
}

/** Auto top-up threshold in minutes of total capacity left (organizations.auto_topup_threshold CHECK). */
export const AUTO_TOPUP_THRESHOLD = { min: 10, max: 1000, default: 50 }

export interface MinuteUsage {
  /** The period's included usage: record_call_usage (027) never adds the minutes it takes from the purchased balance. */
  minutes_used: number | null
  minutes_limit: number | null
  extra_minutes_balance?: number | null
}

function nonNegative(v: unknown): number {
  const n = Number(v)
  return Number.isFinite(n) && n > 0 ? n : 0
}

/**
 * Minutes an organization can still use: the period's included minutes left
 * (minutes_limit - minutes_used, never below 0) plus the purchased balance.
 * Missing or invalid values count as 0.
 */
export function minutesCapacity(u: MinuteUsage): { includedLeft: number; extra: number; total: number } {
  const includedLeft = Math.max(0, nonNegative(u.minutes_limit) - nonNegative(u.minutes_used))
  const extra = nonNegative(u.extra_minutes_balance)
  return { includedLeft, extra, total: includedLeft + extra }
}
