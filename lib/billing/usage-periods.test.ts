import { describe, expect, it, vi } from 'vitest'
import type { SupabaseClient } from '@supabase/supabase-js'
import type { Logger } from '@/lib/observability/logger'
import { rollAnnualUsagePeriods } from './usage-periods'

// The maintenance step that gives annual plans their included minutes every
// month: one RPC (roll_annual_usage_periods, migration 028), its count logged
// and reported, and nothing ever thrown, so the cron survives a deploy that
// lands before the migration.

function logger() {
  const calls: Array<{ level: string; event: string; fields: unknown[] }> = []
  const at = (level: string) => (event: string, ...fields: unknown[]) => calls.push({ level, event, fields })
  const log = { debug: at('debug'), info: at('info'), warn: at('warn'), error: at('error') } as Record<string, unknown>
  log.child = () => log
  return { log: log as unknown as Logger, calls }
}

/** A Supabase client whose rpc answers `answer` (or throws it) and records the calls. */
function db(answer: { data: unknown; error: { code?: string; message: string } | null } | Error) {
  const rpc = vi.fn(async () => {
    if (answer instanceof Error) throw answer
    return answer
  })
  return { client: { rpc } as unknown as SupabaseClient, rpc }
}

describe('rollAnnualUsagePeriods', () => {
  it('calls roll_annual_usage_periods without arguments and logs the count', async () => {
    const { client, rpc } = db({ data: 4, error: null })
    const { log, calls } = logger()
    expect(await rollAnnualUsagePeriods(client, log)).toEqual({ rolled: 4 })
    expect(rpc).toHaveBeenCalledWith('roll_annual_usage_periods')
    expect(calls).toEqual([{ level: 'info', event: 'billing.annual_usage_periods_rolled', fields: [{ rolled: 4 }] }])
  })

  it('a run with nothing due reports 0 at debug level (no info line every five minutes)', async () => {
    const { log, calls } = logger()
    expect(await rollAnnualUsagePeriods(db({ data: 0, error: null }).client, log)).toEqual({ rolled: 0 })
    expect(calls.map((c) => [c.level, c.event, c.fields])).toEqual([['debug', 'billing.annual_usage_periods_rolled', [{ rolled: 0 }]]])
  })

  it('reads an odd answer as 0', async () => {
    for (const data of [null, 'x', -2, 1.5]) {
      expect(await rollAnnualUsagePeriods(db({ data, error: null }).client, logger().log)).toEqual({ rolled: 0 })
    }
  })

  it.each([
    ['PGRST202', 'Could not find the function public.roll_annual_usage_periods without parameters in the schema cache'],
    ['42883', 'function public.roll_annual_usage_periods() does not exist'],
    ['42703', 'column o.billing_interval does not exist'],
  ])('before migration 028 (%s) it warns and reports the pending migration, never throws', async (code, message) => {
    const { log, calls } = logger()
    expect(await rollAnnualUsagePeriods(db({ data: null, error: { code, message } }).client, log)).toEqual({ rolled: 0, skipped: 'migration_pending' })
    expect(calls).toHaveLength(1)
    expect(calls[0]).toMatchObject({ level: 'warn', event: 'billing.annual_usage_periods_unavailable' })
    expect(calls[0].fields[0]).toMatchObject({ code, hint: 'apply migration 028_service_plans.sql' })
  })

  it('any other database error is logged as an error and reported, never thrown', async () => {
    const { log, calls } = logger()
    const res = await rollAnnualUsagePeriods(db({ data: null, error: { code: '57014', message: 'canceling statement due to statement timeout' } }).client, log)
    expect(res).toEqual({ rolled: 0, error: 'canceling statement due to statement timeout' })
    expect(calls.map((c) => [c.level, c.event])).toEqual([['error', 'billing.annual_usage_periods_failed']])
  })

  it('a thrown network failure is caught and reported the same way', async () => {
    const { log, calls } = logger()
    const res = await rollAnnualUsagePeriods(db(new Error('fetch failed')).client, log)
    expect(res).toEqual({ rolled: 0, error: 'fetch failed' })
    expect(calls.map((c) => [c.level, c.event])).toEqual([['error', 'billing.annual_usage_periods_failed']])
  })
})
