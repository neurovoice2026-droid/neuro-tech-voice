import 'server-only'
// Keeps the Stripe catalogue of the self-serve plans in place. Every hour
// (maintenance_state 'stripe_plan_catalog') the maintenance makes sure each
// self-serve plan has its monthly and its annual price, through the same
// ensurePlanPriceId checkout uses: a valid env pin, else the lookup-key price,
// created on first use with the PLANS amount, name and description.
//
// Checkout creates a missing price on demand anyway; doing it ahead means the
// Stripe Dashboard lists the catalogue the homepage sells (not only the
// prices someone has already bought) and a plan's first checkout does not
// pay the creation round-trips. Nothing here archives a price or touches a
// customer, subscription or invoice. The only edits are ensurePlanPriceId's:
// an app-created product's label brought in line with PLANS, and the lookup
// key moved off an outdated app-created price (transfer_lookup_key). An
// untagged env pin (the July 2026 prices) is simply not used.
//
// Time: the step stops at the run's deadline, between pairs and while a
// Stripe call is pending (the call is abandoned, not cancelled; the next run
// finds what it created). A pair left out is checked at the next hourly run.
//
// The report names plans, intervals and Stripe error codes only, never a
// price id (env pins are the operator's) or an upstream message.

import type { Logger } from '@/lib/observability/logger'
import { isStripeConfigured } from '@/lib/stripe/client'
import { ensurePlanPriceId } from '@/lib/stripe/store-prices'
import { SELF_SERVE_PLANS } from '@/types'
import type { BillingInterval, Plan } from '@/types'

/** maintenance_state key of the catalogue check. */
export const PLAN_CATALOG_STEP_KEY = 'stripe_plan_catalog'
/**
 * How often the catalogue is checked. Hourly: a pair the deadline deferred or
 * Stripe refused is retried at the next run. A warm lambda answers from
 * ensurePlanPriceId's cache; a cold one makes one list call per pair, plus a
 * retrieve per env-pinned pair.
 */
export const PLAN_CATALOG_INTERVAL_MS = 3_600_000
/** The step never takes more than this of a maintenance run. */
export const PLAN_CATALOG_STEP_MAX_MS = 30_000

const INTERVALS: readonly BillingInterval[] = ['month', 'year']

export interface PlanCatalogReport {
  /** Plan and interval pairs checked this run. */
  checked: number
  /** Pairs that resolved to a price billing exactly what PLANS says. */
  ready: number
  failed: Array<{ plan: Plan; interval: BillingInterval; code: string }>
  /** The run's deadline stopped the check before every pair was looked at. */
  deferred?: true
  skipped?: 'not_configured'
}

const TIMED_OUT = Symbol('timed_out')

/** `promise`, or TIMED_OUT once `deadline` passes first (the promise keeps running; its outcome is ignored). */
function beforeDeadline<T>(promise: Promise<T>, deadline: number): Promise<T | typeof TIMED_OUT> {
  if (!Number.isFinite(deadline)) return promise
  let timer: ReturnType<typeof setTimeout> | undefined
  const timeout = new Promise<typeof TIMED_OUT>((resolve) => {
    timer = setTimeout(() => resolve(TIMED_OUT), Math.max(0, deadline - Date.now()))
  })
  return Promise.race([promise, timeout]).finally(() => clearTimeout(timer))
}

/** A Stripe error's code or type, never its message (which can name ids). */
function errorCode(err: unknown): string {
  const e = err as { code?: unknown; type?: unknown } | null
  if (e && typeof e.code === 'string' && e.code) return e.code.slice(0, 60)
  if (e && typeof e.type === 'string' && e.type) return e.type.slice(0, 60)
  return 'error'
}

/**
 * Resolves (creating when missing) the monthly and annual Stripe price of
 * every self-serve plan. One failure never stops the others; the next run
 * retries it.
 */
export async function ensureStripePlanCatalog(log: Logger, deadline = Number.POSITIVE_INFINITY): Promise<PlanCatalogReport> {
  if (!isStripeConfigured()) return { checked: 0, ready: 0, failed: [], skipped: 'not_configured' }
  const report: PlanCatalogReport = { checked: 0, ready: 0, failed: [] }
  outer: for (const plan of SELF_SERVE_PLANS) {
    for (const interval of INTERVALS) {
      if (Date.now() >= deadline) {
        report.deferred = true
        break outer
      }
      report.checked++
      try {
        if ((await beforeDeadline(ensurePlanPriceId(plan, interval), deadline)) === TIMED_OUT) {
          report.failed.push({ plan, interval, code: 'timeout' })
          report.deferred = true
          log.warn('billing.plan_catalog_price_failed', { plan, interval, code: 'timeout' })
          break outer
        }
        report.ready++
      } catch (err) {
        const code = errorCode(err)
        report.failed.push({ plan, interval, code })
        log.warn('billing.plan_catalog_price_failed', { plan, interval, code })
      }
    }
  }
  log.info('billing.plan_catalog_checked', { checked: report.checked, ready: report.ready, failed: report.failed.length, deferred: report.deferred === true })
  return report
}
