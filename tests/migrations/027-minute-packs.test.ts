import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import { AUTO_TOPUP_THRESHOLD, MINUTE_PACKS } from '@/lib/billing/minute-packs'

// Static checks on migration 027 (the production migration runner cannot run
// DROP unattended, and every statement must be safe to re-run). Its behaviour
// was verified against a throwaway PostgreSQL 16 with Supabase-like roles
// (001–028, then 027 and 028 again in either order): record_call_usage draws
// the minutes past the included ones from extra_minutes_balance (never below
// 0) and adds to minutes_used only the minutes the balance did not cover (a
// Starter org at 400/400 with 300 extra minutes records a 300-minute call as
// 400 used, 0 extra, so an in-place switch to Growth's 1,000 leaves 600
// included minutes, not 300), credit_minute_purchase and start_usage_period
// are idempotent, claim_auto_topup respects its cooldown, and a tenant JWT can
// neither write the minute columns nor the purchases nor run the functions.

const read = (name: string) => readFileSync(fileURLToPath(new URL(`../../supabase/migrations/${name}`, import.meta.url)), 'utf8')
const stripComments = (sql: string) =>
  sql
    .split('\n')
    .filter((l) => !l.trim().startsWith('--'))
    .join('\n')
const code = stripComments(read('027_minute_packs.sql'))
const m010 = stripComments(read('010_voice_providers.sql'))

const ORG_COLUMNS: Array<[string, string]> = [
  ['extra_minutes_balance', 'integer NOT NULL DEFAULT 0'],
  ['usage_period_start', 'timestamptz'],
  ['minutes_exhausted_notified_at', 'timestamptz'],
  ['usage_alert_notified_at', 'timestamptz'],
  ['auto_topup_enabled', 'boolean NOT NULL DEFAULT false'],
  ['auto_topup_pack', 'integer'],
  ['auto_topup_threshold', 'integer'],
  ['auto_topup_last_attempt_at', 'timestamptz'],
  ['auto_topup_failed_at', 'timestamptz'],
  ['auto_topup_failure', 'text'],
]
const NEW_FUNCTIONS: Array<[string, string]> = [
  ['credit_minute_purchase', 'uuid, integer, integer, text, text, text, text, text'],
  ['start_usage_period', 'uuid, timestamptz'],
  ['claim_auto_topup', 'uuid, integer'],
  ['guard_minute_columns', ''],
]

/** The CREATE OR REPLACE FUNCTION statement of `name`, up to its closing $$;. */
function fnBlock(sql: string, name: string): string {
  const start = sql.indexOf(`CREATE OR REPLACE FUNCTION public.${name}(`)
  if (start < 0) throw new Error(`${name} not found`)
  const bodyStart = sql.indexOf('$$', start)
  const end = sql.indexOf('$$;', bodyStart + 2)
  return sql.slice(start, end + 3)
}

describe('migration 027_minute_packs', () => {
  it('runs under a lock timeout, contains no DROP of any kind and is re-runnable', () => {
    expect(code).toMatch(/^SET lock_timeout = '5s';/m)
    expect(code).not.toMatch(/\bdrop\b/i)
    expect(code).not.toMatch(/\bTRUNCATE\s+(TABLE\s+)?public\./i)
    for (const m of code.matchAll(/\bADD COLUMN\b(?! IF NOT EXISTS)/g)) throw new Error(`ADD COLUMN without IF NOT EXISTS at ${m.index}`)
    for (const m of code.matchAll(/\bCREATE (UNIQUE )?INDEX\b(?! IF NOT EXISTS)/g)) throw new Error(`CREATE INDEX without IF NOT EXISTS at ${m.index}`)
    for (const m of code.matchAll(/\bCREATE TABLE\b(?! IF NOT EXISTS)/g)) throw new Error(`CREATE TABLE without IF NOT EXISTS at ${m.index}`)
    for (const m of code.matchAll(/\bCREATE (FUNCTION|TRIGGER)\b/g)) throw new Error(`CREATE ${m[1]} without OR REPLACE at ${m.index}`)
    // Constraints and policies are added inside DO blocks that tolerate a re-run.
    for (const m of code.matchAll(/\b(ADD CONSTRAINT|CREATE POLICY)\b/g)) {
      const before = code.slice(0, m.index)
      const doStart = before.lastIndexOf('DO $$ BEGIN')
      expect(doStart, `${m[1]} at ${m.index} outside a DO block`).toBeGreaterThan(before.lastIndexOf('END $$;'))
      const block = code.slice(doStart, code.indexOf('END $$;', m.index!) + 7)
      expect(block).toMatch(/EXCEPTION WHEN duplicate_object THEN NULL; END \$\$;/)
    }
    // Additive: no row of an existing table is rewritten outside the functions, no default changes.
    const outsideFunctions = code.replace(/AS \$\$[\s\S]*?\$\$;/g, '')
    expect(outsideFunctions).not.toMatch(/^\s*(UPDATE|DELETE|INSERT)\b/im)
    expect(outsideFunctions).not.toMatch(/SET DEFAULT|DROP DEFAULT|ALTER COLUMN/i)
  })

  it('adds the minute columns to organizations with their CHECK lists', () => {
    for (const [col, type] of ORG_COLUMNS) {
      expect(code, col).toContain(`ALTER TABLE public.organizations ADD COLUMN IF NOT EXISTS ${col} ${type};`)
    }
    expect(code).toMatch(/ADD CONSTRAINT organizations_extra_minutes_balance_check\s+CHECK \(extra_minutes_balance >= 0\);/)
    const pack = code.match(/ADD CONSTRAINT organizations_auto_topup_pack_check\s+CHECK \(auto_topup_pack IS NULL OR auto_topup_pack IN \(([^)]*)\)\);/)
    expect(pack).not.toBeNull()
    expect(pack![1].split(',').map((n) => Number(n.trim()))).toEqual([...MINUTE_PACKS])
    const threshold = code.match(/ADD CONSTRAINT organizations_auto_topup_threshold_check\s+CHECK \(auto_topup_threshold IS NULL OR auto_topup_threshold BETWEEN (\d+) AND (\d+)\);/)
    expect(threshold).not.toBeNull()
    expect([Number(threshold![1]), Number(threshold![2])]).toEqual([AUTO_TOPUP_THRESHOLD.min, AUTO_TOPUP_THRESHOLD.max])
  })

  it('guards every minute column against tenant JWTs, like guard_commerce_columns', () => {
    const guard = fnBlock(code, 'guard_minute_columns')
    expect(guard).toMatch(/RETURNS trigger LANGUAGE plpgsql SET search_path = public AS \$\$/)
    expect(guard).toMatch(/IF current_user NOT IN \('authenticated', 'anon'\) THEN\s+RETURN NEW;/)
    expect(guard).toMatch(/TG_OP = 'INSERT'/)
    expect(guard).toMatch(/TG_OP = 'UPDATE'/)
    for (const [col] of ORG_COLUMNS) expect(guard, col).toContain(`NEW.${col} IS DISTINCT FROM OLD.${col}`)
    expect(guard).toContain("USING ERRCODE = '42501'")
    expect(code).toMatch(/CREATE OR REPLACE TRIGGER organizations_guard_minutes BEFORE INSERT OR UPDATE ON public\.organizations\s+FOR EACH ROW EXECUTE FUNCTION public\.guard_minute_columns\(\);/)
  })

  it('creates minute_purchases with its CHECK lists, unique Stripe references, RLS and owner-only reads', () => {
    expect(code).toMatch(/CREATE TABLE IF NOT EXISTS public\.minute_purchases \(/)
    expect(code).toMatch(/org_id\s+uuid NOT NULL REFERENCES public\.organizations\(id\) ON DELETE CASCADE/)
    expect(code).toMatch(/id\s+uuid PRIMARY KEY DEFAULT gen_random_uuid\(\)/)
    expect(code).toMatch(/currency\s+text NOT NULL DEFAULT 'usd'/)
    expect(code).toMatch(/created_at\s+timestamptz NOT NULL DEFAULT now\(\)/)
    expect(code).toContain('CONSTRAINT minute_purchases_minutes_check CHECK (minutes > 0)')
    expect(code).toContain('CONSTRAINT minute_purchases_amount_cents_check CHECK (amount_cents >= 0)')
    expect(code).toContain("CONSTRAINT minute_purchases_source_check CHECK (source IN ('checkout', 'auto_topup', 'admin'))")
    expect(code).toContain("CONSTRAINT minute_purchases_status_check CHECK (status IN ('credited', 'failed'))")
    expect(code).toContain('CONSTRAINT minute_purchases_checkout_session_key UNIQUE (stripe_checkout_session_id)')
    expect(code).toContain('CONSTRAINT minute_purchases_invoice_key UNIQUE (stripe_invoice_id)')
    expect(code).toContain('CREATE INDEX IF NOT EXISTS minute_purchases_org_created ON public.minute_purchases (org_id, created_at DESC);')
    expect(code).toContain('ALTER TABLE public.minute_purchases ENABLE ROW LEVEL SECURITY;')
    expect(code).toMatch(/CREATE POLICY "minute_purchases_owner_select" ON public\.minute_purchases FOR SELECT TO authenticated\s+USING \(org_id IN \(SELECT id FROM public\.organizations WHERE user_id = \(SELECT auth\.uid\(\)\)\)\);/)
    expect(code).not.toMatch(/CREATE POLICY "[^"]*" ON public\.minute_purchases FOR (INSERT|UPDATE|DELETE|ALL)/)
    expect(code).toContain('REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON public.minute_purchases FROM anon, authenticated;')
    expect(code).toContain('REVOKE SELECT ON public.minute_purchases FROM anon;')
  })

  it('adds the store automation wait anchor to commerce_automation_runs only', () => {
    expect(code).toContain('ALTER TABLE public.commerce_automation_runs ADD COLUMN IF NOT EXISTS minutes_wait_since timestamptz;')
    const altered = [...code.matchAll(/ALTER TABLE public\.(\w+)/g)].map((m) => m[1])
    expect([...new Set(altered)].sort()).toEqual(['commerce_automation_runs', 'minute_purchases', 'organizations'])
  })

  it('keeps the new functions plain (invoker) with a fixed search_path, executable by the service role only', () => {
    for (const [name, args] of NEW_FUNCTIONS) {
      const block = fnBlock(code, name)
      expect(block, name).not.toMatch(/SECURITY DEFINER/)
      expect(block, name).toMatch(/LANGUAGE plpgsql SET search_path = public/)
      const sig = args ? `${name}\\(${args.replace(/,/g, ',')}\\)` : `${name}\\(\\)`
      expect(code, name).toMatch(new RegExp(`REVOKE ALL ON FUNCTION public\\.${sig} FROM PUBLIC, anon, authenticated;`))
      expect(code, name).toMatch(new RegExp(`GRANT EXECUTE ON FUNCTION public\\.${sig} TO service_role;`))
    }
    expect(fnBlock(code, 'credit_minute_purchase')).toMatch(/RETURNS TABLE \(credited boolean, balance_after integer\)/)
    expect(fnBlock(code, 'start_usage_period')).toMatch(/RETURNS boolean/)
    expect(fnBlock(code, 'claim_auto_topup')).toMatch(/RETURNS boolean/)
    // The only SECURITY DEFINER is record_call_usage, as in 010.
    expect(code.match(/SECURITY DEFINER/g)).toHaveLength(1)
  })

  it('credits a purchase once per Stripe reference, under advisory locks', () => {
    const fn = fnBlock(code, 'credit_minute_purchase')
    expect(fn).toMatch(/pg_advisory_xact_lock\(hashtext\('minute_purchase:' \|\| p_checkout_session_id\)\)/)
    expect(fn).toMatch(/pg_advisory_xact_lock\(hashtext\('minute_purchase:' \|\| p_invoice_id\)\)/)
    expect(fn).toMatch(/mp\.stripe_checkout_session_id = p_checkout_session_id/)
    expect(fn).toMatch(/mp\.stripe_invoice_id = p_invoice_id/)
    expect(fn).toMatch(/RETURN QUERY SELECT false, v_balance;/)
    expect(fn).toMatch(/ON CONFLICT DO NOTHING/)
    expect(fn).toMatch(/SET extra_minutes_balance = o\.extra_minutes_balance \+ p_minutes/)
    // Locks are taken before the existence check.
    expect(fn.indexOf('pg_advisory_xact_lock')).toBeLessThan(fn.indexOf('FROM public.minute_purchases mp'))
  })

  it('resets minutes_used only for a later period start and keeps the purchased balance', () => {
    const fn = fnBlock(code, 'start_usage_period')
    expect(fn).toMatch(/FOR UPDATE;/)
    expect(fn).toMatch(/IF v_current IS NOT NULL AND p_period_start <= v_current THEN\s+RETURN false;/)
    expect(fn).toMatch(/UPDATE public\.organizations SET minutes_used = 0, usage_period_start = p_period_start WHERE id = p_org_id;/)
    expect(fn).not.toMatch(/extra_minutes_balance/)
  })

  it('claims an auto top-up attempt only when enabled and outside the cooldown', () => {
    const fn = fnBlock(code, 'claim_auto_topup')
    expect(fn).toMatch(/SET auto_topup_last_attempt_at = now\(\)/)
    expect(fn).toMatch(/AND auto_topup_enabled/)
    expect(fn).toMatch(/auto_topup_last_attempt_at IS NULL OR auto_topup_last_attempt_at < now\(\) - make_interval\(secs => p_cooldown_seconds\)/)
    expect(fn).toMatch(/RETURN FOUND;/)
  })

  it('replaces record_call_usage with the same signature, return type, SECURITY DEFINER, search_path and grants as 010', () => {
    const before = fnBlock(m010, 'record_call_usage')
    const after = fnBlock(code, 'record_call_usage')
    const header = (fn: string) => fn.slice(0, fn.indexOf('AS $$')).replace(/\s+/g, ' ').trim()
    expect(header(after)).toBe(header(before))
    expect(header(after)).toContain('p_org_id uuid, p_call_id uuid, p_key text, p_seconds integer, p_provider text, p_source text')
    expect(header(after)).toContain('RETURNS TABLE (recorded boolean, minutes integer, minutes_used_after integer)')
    expect(header(after)).toContain('LANGUAGE plpgsql SECURITY DEFINER SET search_path = public')
    for (const stmt of [
      'REVOKE ALL ON FUNCTION public.record_call_usage(uuid, uuid, text, integer, text, text) FROM PUBLIC, anon, authenticated;',
      'GRANT EXECUTE ON FUNCTION public.record_call_usage(uuid, uuid, text, integer, text, text) TO service_role;',
    ]) {
      expect(m010).toContain(stmt)
      expect(code).toContain(stmt)
    }
    // The ledger insert, the idempotent early return and the calls stamp are 010's, verbatim.
    for (const line of [
      'v_minutes integer := GREATEST(0, CEIL(GREATEST(p_seconds, 0) / 60.0))::integer;',
      'INSERT INTO usage_ledger (org_id, call_id, idempotency_key, provider, billable_seconds, minutes, source)',
      'VALUES (p_org_id, p_call_id, p_key, p_provider, GREATEST(p_seconds, 0), v_minutes, p_source)',
      'ON CONFLICT (idempotency_key) DO NOTHING;',
      'RETURN QUERY SELECT false, v_minutes, NULL::integer;',
      'UPDATE calls SET usage_recorded_at = now() WHERE id = p_call_id;',
      'RETURN QUERY SELECT true, v_minutes, v_after;',
    ]) {
      expect(before, line).toContain(line)
      expect(after, line).toContain(line)
    }
    // Only the organizations update changes: lock, included minutes first, then the balance.
    expect(after).toMatch(/FROM organizations o WHERE o\.id = p_org_id FOR UPDATE;/)
    expect(after).toContain('v_included_left := GREATEST(COALESCE(v_limit, 0) - COALESCE(v_used, 0), 0);')
    expect(after).toContain('v_from_extra := LEAST(GREATEST(v_minutes - v_included_left, 0), COALESCE(v_extra, 0));')
    // minutes_used is the included usage: the minutes paid from the balance are not added to it,
    // so they are never charged a second time against minutes_limit (e.g. after an in-place upgrade).
    expect(after).toMatch(/SET minutes_used = COALESCE\(o\.minutes_used, 0\) \+ \(v_minutes - v_from_extra\),\s+extra_minutes_balance = o\.extra_minutes_balance - v_from_extra/)
    expect(after).not.toMatch(/minutes_used = COALESCE\(o\.minutes_used, 0\) \+ v_minutes,/)
  })

  it('consumption order: what the update asserted above does to an organization', () => {
    // The update above, line by line (v_included_left, v_from_extra, the SET list), on sample organizations.
    const record = (o: { limit: number | null; used: number; extra: number }, minutes: number) => {
      const includedLeft = Math.max((o.limit ?? 0) - o.used, 0)
      const fromExtra = Math.min(Math.max(minutes - includedLeft, 0), o.extra)
      return { limit: o.limit, used: o.used + (minutes - fromExtra), extra: o.extra - fromExtra }
    }
    const left = (o: { limit: number | null; used: number; extra: number }) => Math.max((o.limit ?? 0) - o.used, 0) + o.extra
    // The review's case: Starter 400/400 with 300 purchased, a 300-minute call, then an in-place upgrade to Growth.
    const starter = record({ limit: 400, used: 400, extra: 300 }, 300)
    expect(starter).toEqual({ limit: 400, used: 400, extra: 0 })
    expect(left({ ...starter, limit: 1000 })).toBe(600)
    // A call that spans both: the included minutes first, the rest from the balance.
    expect(record({ limit: 400, used: 380, extra: 50 }, 30)).toEqual({ limit: 400, used: 400, extra: 40 })
    // Only minutes the balance cannot cover push minutes_used past the limit (the 60-second minimum, or no cap).
    expect(record({ limit: 400, used: 400, extra: 5 }, 10)).toEqual({ limit: 400, used: 405, extra: 0 })
    // The trial (no balance) counts every minute, as before 027.
    expect(record({ limit: 5, used: 4, extra: 0 }, 3)).toEqual({ limit: 5, used: 7, extra: 0 })
    // The capacity a call is allowed against never shrinks by more than the minutes recorded.
    for (const o of [{ limit: 400, used: 100, extra: 50 }, { limit: 400, used: 390, extra: 20 }, { limit: null, used: 0, extra: 10 }]) {
      for (const m of [1, 10, 40]) expect(left(o) - left(record(o, m))).toBe(Math.min(m, left(o)))
    }
  })
})
