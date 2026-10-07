import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

// Static checks on migration 021 (the production migration runner cannot run
// DROP unattended, and every statement must be safe to re-run). Its behaviour
// was also verified against a throwaway PostgreSQL 16 with Supabase-like
// roles (docs/elevenlabs/H.md, "Migration 021").

const sql = readFileSync(fileURLToPath(new URL('../../supabase/migrations/021_account_deletion.sql', import.meta.url)), 'utf8')
const code = sql
  .split('\n')
  .filter((l) => !l.trim().startsWith('--'))
  .join('\n')

const NEW_TABLES = ['account_deletions', 'account_deletion_items', 'invoices_archive', 'usage_archive']

describe('migration 021_account_deletion', () => {
  it('contains no DROP of any kind', () => {
    expect(code).not.toMatch(/\bdrop\b/i)
  })

  it('is re-runnable: IF NOT EXISTS / OR REPLACE / duplicate_object guards everywhere', () => {
    for (const m of code.matchAll(/\bADD COLUMN\b(?! IF NOT EXISTS)/g)) throw new Error(`ADD COLUMN without IF NOT EXISTS at ${m.index}`)
    for (const m of code.matchAll(/\bCREATE (UNIQUE )?INDEX\b(?! IF NOT EXISTS)/g)) throw new Error(`CREATE INDEX without IF NOT EXISTS at ${m.index}`)
    for (const m of code.matchAll(/\bCREATE TABLE\b(?! IF NOT EXISTS)/g)) throw new Error(`CREATE TABLE without IF NOT EXISTS at ${m.index}`)
    for (const m of code.matchAll(/\bCREATE (FUNCTION|TRIGGER)\b/g)) throw new Error(`CREATE ${m[1]} without OR REPLACE at ${m.index}`)
    const blocks = code.split('DO $$ BEGIN')
    for (const part of blocks.slice(1)) {
      const body = part.split('END $$;')[0]
      if (/ADD CONSTRAINT|CREATE POLICY/.test(body)) expect(body).toMatch(/EXCEPTION WHEN duplicate_object THEN NULL;/)
    }
    const outside = blocks.map((p, i) => (i === 0 ? p : p.split('END $$;').slice(1).join(''))).join('')
    expect(outside).not.toMatch(/ADD CONSTRAINT|CREATE POLICY/)
  })

  it('every function has a fixed search_path and is not executable by tenants; guard_platform_columns is untouched', () => {
    expect(code).not.toMatch(/guard_platform_columns/)
    const fns = [...code.matchAll(/CREATE OR REPLACE FUNCTION public\.(\w+)\(/g)].map((m) => m[1])
    expect(fns.sort()).toEqual(['archive_deleted_invoice', 'archive_org_billing_records', 'archive_org_usage', 'archive_org_usage_on_delete', 'guard_account_columns'])
    for (const fn of fns) {
      expect(code, fn).toMatch(new RegExp(`CREATE OR REPLACE FUNCTION public\\.${fn}\\([\\s\\S]*?SET search_path = public`))
      expect(code, fn).toMatch(new RegExp(`REVOKE EXECUTE ON FUNCTION public\\.${fn}\\([^)]*\\) FROM PUBLIC, anon, authenticated;`))
    }
    expect(code).not.toMatch(/SECURITY DEFINER/)
  })

  it('the deletion marker is platform-managed (tenant JWTs cannot set or clear it)', () => {
    expect(code).toContain('ALTER TABLE public.organizations ADD COLUMN IF NOT EXISTS deletion_requested_at timestamptz;')
    const guard = code.split('FUNCTION public.guard_account_columns()')[1].split('$$;')[0]
    expect(guard).toMatch(/IF current_user NOT IN \('authenticated', 'anon'\) THEN\s+RETURN NEW;/)
    expect(guard).toContain('NEW.deletion_requested_at IS DISTINCT FROM OLD.deletion_requested_at')
    expect(guard).toContain("USING ERRCODE = '42501'")
    expect(code).toMatch(/CREATE OR REPLACE TRIGGER organizations_guard_account\s+BEFORE INSERT OR UPDATE ON public\.organizations/)
  })

  it('new tables: RLS on; the job readable by its owner only; archives and items have no tenant access at all', () => {
    for (const t of NEW_TABLES) {
      expect(code, t).toMatch(new RegExp(`CREATE TABLE IF NOT EXISTS public\\.${t} \\(`))
      expect(code, t).toContain(`ALTER TABLE public.${t} ENABLE ROW LEVEL SECURITY;`)
    }
    expect(code).toMatch(/CREATE POLICY "account_deletions_owner_select" ON public\.account_deletions FOR SELECT TO authenticated\s+USING \(org_id IN \(SELECT id FROM public\.organizations WHERE user_id = \(SELECT auth\.uid\(\)\)\)\)/)
    expect(code).not.toMatch(/CREATE POLICY[^;]*FOR (INSERT|UPDATE|DELETE|ALL)/)
    expect(code).toContain('REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON public.account_deletions FROM anon, authenticated;')
    for (const t of ['account_deletion_items', 'invoices_archive', 'usage_archive']) {
      expect(code, t).toContain(`REVOKE SELECT, INSERT, UPDATE, DELETE, TRUNCATE ON public.${t} FROM anon, authenticated;`)
      expect(code, t).not.toMatch(new RegExp(`CREATE POLICY[^;]*ON public\\.${t}`))
    }
  })

  it('the job survives the organization (no foreign key) and there is one open job per organization', () => {
    const table = code.split('CREATE TABLE IF NOT EXISTS public.account_deletions (')[1].split(');')[0]
    expect(table).not.toMatch(/REFERENCES/)
    expect(code).toMatch(/CREATE UNIQUE INDEX IF NOT EXISTS account_deletions_one_open\s+ON public\.account_deletions \(org_id\) WHERE status IN \('pending', 'running', 'needs_attention'\);/)
  })

  it('invoices are copied before any delete (cascade included) and kept 10 years from the end of the financial year', () => {
    expect(code).toMatch(/CREATE OR REPLACE TRIGGER invoices_archive_on_delete\s+BEFORE DELETE ON public\.invoices/)
    expect(code).toMatch(/CREATE OR REPLACE TRIGGER organizations_archive_usage\s+BEFORE DELETE ON public\.organizations/)
    expect(code.match(/::integer \+ 10, 12, 31\)/g)?.length).toBeGreaterThanOrEqual(3)
    const archive = code.split('CREATE TABLE IF NOT EXISTS public.invoices_archive (')[1].split(');')[0]
    expect(archive).not.toMatch(/REFERENCES/)
    // Usage is kept as monthly totals only: no call ids, no phone numbers.
    const usage = code.split('CREATE TABLE IF NOT EXISTS public.usage_archive (')[1].split(');')[0]
    expect(usage).not.toMatch(/call_id|number/)
  })

  it('re-archiving refreshes the mutable fields (never DO NOTHING) and never shortens the retention', () => {
    expect(code).not.toMatch(/DO NOTHING/)
    const invoiceUpserts = [...code.matchAll(/INSERT INTO public\.invoices_archive[\s\S]*?ON CONFLICT \(id\) DO UPDATE([\s\S]*?);/g)].map((m) => m[1])
    // The BEFORE DELETE trigger and archive_org_billing_records.
    expect(invoiceUpserts).toHaveLength(2)
    for (const set of invoiceUpserts) {
      for (const col of ['stripe_invoice_id', 'smartbill_series', 'smartbill_number', 'amount', 'currency', 'status', 'pdf_url', 'client_name', 'client_vat_code', 'issued_at']) {
        expect(set, col).toMatch(new RegExp(`\\b${col}\\s*= EXCLUDED\\.${col}\\b`))
      }
      expect(set).toMatch(/retain_until\s*= GREATEST\(invoices_archive\.retain_until, EXCLUDED\.retain_until\)/)
      expect(set).toMatch(/archived_at\s*= now\(\)/)
      // The identity of the archived invoice never changes.
      expect(set).not.toMatch(/\b(org_id|created_at)\s*=/)
    }
    expect(code).toMatch(/INSERT INTO public\.usage_archive[\s\S]*?ON CONFLICT \(org_id, month\) DO UPDATE/)
  })
})
