import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import { PLANS, SERVICE_PLANS, STORE_PLANS } from '@/types'

// Static checks on migration 028: it replaces the organizations.plan CHECK so
// that every id in PLANS (types/index.ts), Growth and Scale included, is
// accepted; adds organizations.billing_interval (guarded like the 027 minute
// columns, by a guard of its own); and adds roll_annual_usage_periods(), which
// gives annual plans their included minutes every month. Its behaviour was
// verified against a throwaway PostgreSQL 16 with Supabase-like roles (027,
// then 028 twice, then 027, 028 and 027 again: a tenant JWT is refused
// billing_interval and the minute columns after every order of re-runs): due
// annual organizations roll by whole calendar months (Jan 31 -> Feb 28, a
// missed month is caught up in one step, a leap February ends on the 29th),
// monthly, trial and not-yet-due ones are left alone, a second run rolls
// nothing, a period start moved by a concurrent renewal is not rolled again,
// and a tenant JWT can neither write billing_interval nor run the function.

const read = (name: string) => readFileSync(fileURLToPath(new URL(`../../supabase/migrations/${name}`, import.meta.url)), 'utf8')
const stripComments = (sql: string) =>
  sql
    .split('\n')
    .filter((l) => !l.trim().startsWith('--'))
    .join('\n')
const code = stripComments(read('028_service_plans.sql'))
const m027 = stripComments(read('027_minute_packs.sql'))

/** The quoted ids inside the CHECK (plan IN (...)) list. */
function allowedPlanIds(): string[] {
  const m = code.match(/CHECK \(plan IN \(([^)]*)\)\)/)
  if (!m) throw new Error('organizations_plan_check CHECK not found')
  return [...m[1].matchAll(/'([a-z_]+)'/g)].map((x) => x[1])
}

/** The CREATE OR REPLACE FUNCTION statement of `name`, up to its closing $$;. */
function fnBlock(sql: string, name: string): string {
  const start = sql.indexOf(`CREATE OR REPLACE FUNCTION public.${name}(`)
  if (start < 0) throw new Error(`${name} not found`)
  const bodyStart = sql.indexOf('$$', start)
  const end = sql.indexOf('$$;', bodyStart + 2)
  return sql.slice(start, end + 3)
}

/** The columns a guard compares on UPDATE (NEW.x IS DISTINCT FROM OLD.x). */
const guardedOnUpdate = (fn: string) => [...fn.matchAll(/NEW\.(\w+) IS DISTINCT FROM OLD\.\1/g)].map((m) => m[1])

describe('migration 028_service_plans', () => {
  it('runs under a lock timeout and is re-runnable: one DROP (the plan CHECK, IF EXISTS), everything else created if missing or replaced', () => {
    expect(code).toMatch(/^SET lock_timeout = '5s';/m)
    expect(code).toMatch(/ALTER TABLE public\.organizations DROP CONSTRAINT IF EXISTS organizations_plan_check;/)
    expect(code).toMatch(/ALTER TABLE public\.organizations\s+ADD CONSTRAINT organizations_plan_check\s+CHECK \(plan IN \(/)
    expect(code.match(/\bDROP\b/gi)).toHaveLength(1)
    for (const m of code.matchAll(/\bADD COLUMN\b(?! IF NOT EXISTS)/g)) throw new Error(`ADD COLUMN without IF NOT EXISTS at ${m.index}`)
    for (const m of code.matchAll(/\bCREATE (FUNCTION|TRIGGER|TABLE|INDEX)\b/g)) throw new Error(`CREATE ${m[1]} without OR REPLACE / IF NOT EXISTS at ${m.index}`)
    // The new CHECK is added inside a DO block that tolerates a re-run.
    const check = code.indexOf('ADD CONSTRAINT organizations_billing_interval_check')
    expect(code.lastIndexOf('DO $$ BEGIN', check)).toBeGreaterThan(code.lastIndexOf('END $$;', check))
    expect(code.slice(check, code.indexOf('END $$;', check) + 7)).toMatch(/EXCEPTION WHEN duplicate_object THEN NULL; END \$\$;/)
    // Additive outside the functions: no row rewritten, no default changed, only organizations altered.
    const outsideFunctions = code.replace(/AS \$\$[\s\S]*?\$\$;/g, '')
    expect(outsideFunctions).not.toMatch(/^\s*(UPDATE|DELETE|INSERT)\b/im)
    expect(outsideFunctions).not.toMatch(/SET DEFAULT|DROP DEFAULT|ALTER COLUMN|DROP COLUMN|DROP TABLE/i)
    expect([...new Set([...code.matchAll(/ALTER TABLE public\.(\w+)/g)].map((m) => m[1]))]).toEqual(['organizations'])
  })

  it('accepts exactly the eleven plan ids of PLANS: the trial, the service ladder and the store tiers', () => {
    const allowed = allowedPlanIds()
    expect(allowed).toHaveLength(11)
    expect(new Set(allowed).size).toBe(allowed.length)
    expect([...allowed].sort()).toEqual(Object.keys(PLANS).sort())
    expect(allowed).toEqual(['trial', ...SERVICE_PLANS, ...STORE_PLANS])
    expect(allowed).toEqual(expect.arrayContaining(['growth', 'scale']))
  })

  it('keeps every id migration 026 allowed, so no existing row can fail the new CHECK', () => {
    const m = read('026_store_plans.sql').match(/CHECK \(plan IN \(([^)]*)\)\)/)
    if (!m) throw new Error('026 CHECK not found')
    const previous = [...m[1].matchAll(/'([a-z_]+)'/g)].map((x) => x[1])
    expect(allowedPlanIds()).toEqual(expect.arrayContaining(previous))
  })

  it('adds billing_interval, NULL or month / year (the BillingInterval of types/index.ts)', () => {
    expect(code).toContain('ALTER TABLE public.organizations ADD COLUMN IF NOT EXISTS billing_interval text;')
    expect(code).toMatch(/ADD CONSTRAINT organizations_billing_interval_check\s+CHECK \(billing_interval IN \('month', 'year'\)\);/)
  })

  it('guards billing_interval with a function and trigger of its own, so re-running 027 cannot drop it', () => {
    const guard = fnBlock(code, 'guard_billing_interval')
    expect(guard).toMatch(/^CREATE OR REPLACE FUNCTION public\.guard_billing_interval\(\)\s+RETURNS trigger LANGUAGE plpgsql SET search_path = public AS \$\$/)
    expect(guard).not.toMatch(/SECURITY DEFINER/)
    expect(guard).toMatch(/IF current_user NOT IN \('authenticated', 'anon'\) THEN\s+RETURN NEW;/)
    expect(guard).toMatch(/IF TG_OP = 'INSERT' AND NEW\.billing_interval IS NOT NULL THEN/)
    expect(guard).toMatch(/IF TG_OP = 'UPDATE' AND NEW\.billing_interval IS DISTINCT FROM OLD\.billing_interval THEN/)
    expect(guardedOnUpdate(guard)).toEqual(['billing_interval'])
    expect(guard.match(/USING ERRCODE = '42501'/g)).toHaveLength(2)
    expect(code).toContain('REVOKE ALL ON FUNCTION public.guard_billing_interval() FROM PUBLIC, anon, authenticated;')
    expect(code).toContain('GRANT EXECUTE ON FUNCTION public.guard_billing_interval() TO service_role;')
    expect(code).toMatch(
      /CREATE OR REPLACE TRIGGER organizations_guard_billing_interval BEFORE INSERT OR UPDATE ON public\.organizations\s+FOR EACH ROW EXECUTE FUNCTION public\.guard_billing_interval\(\);/,
    )
    // 027 is the only owner of guard_minute_columns and its trigger: 028 neither replaces nor
    // re-attaches them, and 027's guard needs no column 027 does not create.
    expect(code).not.toContain('guard_minute_columns')
    expect(code).not.toContain('organizations_guard_minutes')
    expect(fnBlock(m027, 'guard_minute_columns')).not.toContain('billing_interval')
    // Distinct names: neither migration's CREATE OR REPLACE can overwrite the other's guard.
    expect(m027).not.toContain('guard_billing_interval')
  })

  it('roll_annual_usage_periods is a plain plpgsql function returning the count, executable by the service role only', () => {
    const fn = fnBlock(code, 'roll_annual_usage_periods')
    expect(fn).toMatch(/^CREATE OR REPLACE FUNCTION public\.roll_annual_usage_periods\(\)\s+RETURNS integer\s+LANGUAGE plpgsql SET search_path = public AS \$\$/)
    expect(code).not.toMatch(/SECURITY DEFINER/)
    expect(code).toContain('REVOKE ALL ON FUNCTION public.roll_annual_usage_periods() FROM PUBLIC, anon, authenticated;')
    expect(code).toContain('GRANT EXECUTE ON FUNCTION public.roll_annual_usage_periods() TO service_role;')
    expect(fn).toMatch(/GET DIAGNOSTICS v_rolled = ROW_COUNT;\s+RETURN v_rolled;/)
  })

  it('rolls only due annual paid plans, set-based, by whole calendar months, keeping the purchased balance', () => {
    const fn = fnBlock(code, 'roll_annual_usage_periods')
    // One UPDATE statement, no loop over rows.
    expect(fn.match(/\bUPDATE\b/g)).toHaveLength(1)
    expect(fn).not.toMatch(/\b(LOOP|FOR \w+ IN)\b/)
    expect(fn).toMatch(/SET minutes_used = 0,\s+usage_period_start = d\.next_start/)
    expect(fn).not.toMatch(/extra_minutes_balance/)
    // Who is due.
    expect(fn).toMatch(/oo\.billing_interval = 'year'/)
    expect(fn).toMatch(/oo\.plan <> 'trial'/)
    expect(fn).toMatch(/oo\.usage_period_start \+ interval '1 month' <= now\(\)/)
    // Month arithmetic: the calendar months between the start and now, less one when the last would land after now.
    expect(fn).toMatch(/\(EXTRACT\(YEAR FROM now\(\)\) - EXTRACT\(YEAR FROM oo\.usage_period_start\)\) \* 12/)
    expect(fn).toMatch(/EXTRACT\(MONTH FROM now\(\)\) - EXTRACT\(MONTH FROM oo\.usage_period_start\)/)
    expect(fn).toMatch(/x\.start \+ make_interval\(months => x\.months - CASE WHEN x\.start \+ make_interval\(months => x\.months\) > now\(\) THEN 1 ELSE 0 END\)/)
    // Row-lock safe: the start read must still be the row's when it is written (re-checked after a concurrent update).
    expect(fn).toMatch(/WHERE o\.id = d\.id\s+AND o\.usage_period_start = d\.start\s+AND o\.billing_interval = 'year'/)
    expect(fn).toMatch(/AND d\.next_start > d\.start;/)
  })
})
