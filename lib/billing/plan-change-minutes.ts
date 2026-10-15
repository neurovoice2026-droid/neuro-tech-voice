import 'server-only'
// Included minutes after an immediate upgrade (POST /api/billing/checkout,
// lib/stripe/plan-subscription.ts 'now_upgrade'). The upgrade invoices the
// price difference for the rest of the period only, so the minutes follow
// what was paid: for the current usage period the organization keeps its old
// allowance and gets the new plan's extra minutes only for the share of the
// period that is left; from the next period on, the new allowance in full
// (start_usage_period resets minutes_used at the renewal).
//
// Applied as minutes already counted: minutes_limit becomes the new plan's
// (the webhook writes the same value from customer.subscription.updated) and
// minutes_used becomes min(used, old limit) + the extra minutes of the share
// already gone. Minutes the organization drew from its purchased balance were
// paid for separately and are not counted against the new allowance. The
// write is a compare-and-set on minutes_used, so a call's usage recorded at
// the same moment (record_call_usage) is never lost; it is retried a few
// times and then given up (logged): the organization then keeps the whole
// new allowance for this period.

import type { SupabaseClient } from '@supabase/supabase-js'
import type { Logger } from '@/lib/observability/logger'
import type { BillingInterval } from '@/types'

const CAS_ATTEMPTS = 3

/**
 * minutes_used after an upgrade from `oldLimit` to `newLimit` when `elapsed`
 * (0..1) of the usage period has gone by. Unchanged when the new allowance is
 * not larger.
 */
export function upgradeMinutesUsed(input: { used: number; oldLimit: number; newLimit: number; elapsed: number }): number {
  const used = Math.max(0, Math.floor(Number.isFinite(input.used) ? input.used : 0))
  const oldLimit = Math.max(0, Math.floor(Number.isFinite(input.oldLimit) ? input.oldLimit : 0))
  const delta = Math.floor(input.newLimit) - oldLimit
  if (!(delta > 0)) return used
  const elapsed = Number.isFinite(input.elapsed) ? Math.min(1, Math.max(0, input.elapsed)) : 0
  return Math.min(used, oldLimit) + Math.round(delta * elapsed)
}

/** ms + one calendar month (UTC), the day clamped to the month's length (Jan 31 → Feb 28/29), like Postgres. */
export function addCalendarMonth(ms: number): number {
  const d = new Date(ms)
  const day = d.getUTCDate()
  const next = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 1, d.getUTCHours(), d.getUTCMinutes(), d.getUTCSeconds(), d.getUTCMilliseconds()))
  const lastDay = new Date(Date.UTC(next.getUTCFullYear(), next.getUTCMonth() + 1, 0)).getUTCDate()
  next.setUTCDate(Math.min(day, lastDay))
  return next.getTime()
}

/**
 * The share (0..1) of the current usage period already gone. A monthly plan's
 * usage period is its Stripe period (`periodStart`..`periodEnd`, epoch
 * seconds). An annual plan's is the current month of the year
 * (organizations.usage_period_start when it lies inside the Stripe period,
 * else the latest monthly anniversary of the period start), ending one
 * calendar month later or at the period end.
 */
export function usagePeriodElapsed(input: {
  periodStart: number
  periodEnd: number
  interval: BillingInterval | null
  usagePeriodStart: string | null
  now: number
}): number {
  const periodStartMs = input.periodStart * 1000
  const periodEndMs = input.periodEnd * 1000
  let start = periodStartMs
  let end = periodEndMs
  if (input.interval === 'year') {
    const recorded = input.usagePeriodStart ? Date.parse(input.usagePeriodStart) : NaN
    if (Number.isFinite(recorded) && recorded >= periodStartMs && recorded <= input.now) {
      start = recorded
    } else {
      for (let i = 0; i < 12; i++) {
        const next = addCalendarMonth(start)
        if (next > input.now) break
        start = next
      }
    }
    end = Math.min(addCalendarMonth(start), periodEndMs)
  }
  if (!(end > start)) return 0
  return Math.min(1, Math.max(0, (input.now - start) / (end - start)))
}

/**
 * Sets the new allowance and the minutes already counted for it (see the
 * header). True when written (or nothing needed writing).
 */
export async function applyUpgradeMinutes(
  db: SupabaseClient,
  orgId: string,
  change: { oldLimit: number; newLimit: number; elapsed: number },
  log: Logger,
): Promise<boolean> {
  for (let attempt = 0; attempt < CAS_ATTEMPTS; attempt++) {
    const { data, error } = await db.from('organizations').select('minutes_used').eq('id', orgId).maybeSingle()
    if (error || !data) {
      log.error('billing.upgrade_minutes_read_failed', error ? new Error(error.message) : null)
      return false
    }
    const used = Number((data as { minutes_used: unknown }).minutes_used ?? 0)
    const next = upgradeMinutesUsed({ used, ...change })
    const { data: written, error: writeErr } = await db
      .from('organizations')
      .update({ minutes_used: next, minutes_limit: change.newLimit })
      .eq('id', orgId)
      .eq('minutes_used', used)
      .select('id')
    if (writeErr) {
      log.error('billing.upgrade_minutes_write_failed', new Error(writeErr.message))
      return false
    }
    if (Array.isArray(written) && written.length > 0) {
      log.info('billing.upgrade_minutes_applied', { usedBefore: used, usedAfter: next, newLimit: change.newLimit })
      return true
    }
  }
  log.error('billing.upgrade_minutes_contended', null, { attempts: CAS_ATTEMPTS })
  return false
}
