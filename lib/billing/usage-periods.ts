import 'server-only'
// Monthly included minutes on annual plans. Every plan card says "N minutes
// a month", but Stripe renews an annual subscription (and the billing webhook
// calls start_usage_period) once a year. roll_annual_usage_periods()
// (migration 028) starts the months in between: for every organization on a
// paid plan billed yearly (organizations.billing_interval 'year', written by
// the webhook) whose usage_period_start is a month old or more, minutes_used
// goes back to 0 and usage_period_start moves forward by the whole months
// elapsed. Prepaid extra minutes are kept. Idempotent and safe to run
// concurrently (one row-locked UPDATE); the 5-minute maintenance cron calls
// it (step 'annual_usage_periods', lib/voice-providers/maintenance.ts).
//
// Deploy order cannot break the cron: before migration 028 is applied the
// function (or the column) does not exist, which is logged as a warning and
// reported, never thrown. No other failure throws either.

import type { SupabaseClient } from '@supabase/supabase-js'
import type { Logger } from '@/lib/observability/logger'

export interface AnnualPeriodsReport {
  /** Organizations whose new monthly period started in this run. */
  rolled: number
  /** Set when migration 028 is not applied yet (nothing was rolled). */
  skipped?: 'migration_pending'
  /** Set when the call failed for another reason (nothing was rolled). */
  error?: string
}

/** PostgREST / Postgres codes of a function or column that does not exist (yet). */
const NOT_MIGRATED_CODES = new Set([
  'PGRST202', // PostgREST: function not found in the schema cache
  '42883', // undefined_function
  '42703', // undefined_column (organizations.billing_interval)
])

/** Starts the due monthly periods of annual plans and reports how many. Never throws. */
export async function rollAnnualUsagePeriods(db: SupabaseClient, log: Logger): Promise<AnnualPeriodsReport> {
  let result: { data: unknown; error: { code?: string; message: string } | null }
  try {
    result = await db.rpc('roll_annual_usage_periods')
  } catch (err) {
    const message = (err instanceof Error ? err.message : String(err)).slice(0, 200)
    log.error('billing.annual_usage_periods_failed', err)
    return { rolled: 0, error: message }
  }
  const { data, error } = result
  if (error) {
    const message = error.message.slice(0, 200)
    if (error.code && NOT_MIGRATED_CODES.has(error.code)) {
      log.warn('billing.annual_usage_periods_unavailable', { code: error.code, error: message, hint: 'apply migration 028_service_plans.sql' })
      return { rolled: 0, skipped: 'migration_pending' }
    }
    log.error('billing.annual_usage_periods_failed', error, { code: error.code })
    return { rolled: 0, error: message }
  }
  const n = Number(data)
  const rolled = Number.isInteger(n) && n > 0 ? n : 0
  if (rolled > 0) log.info('billing.annual_usage_periods_rolled', { rolled })
  else log.debug('billing.annual_usage_periods_rolled', { rolled })
  return { rolled }
}
