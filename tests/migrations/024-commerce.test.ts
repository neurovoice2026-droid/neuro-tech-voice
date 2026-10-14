import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

// Static checks on migration 024 (the production migration runner cannot run
// DROP unattended, and every statement must be safe to re-run). Its behaviour
// was verified against a throwaway PostgreSQL 16 with Supabase-like roles
// (001–024, then 024 twice; see docs/commerce-integrations.md).

const sql = readFileSync(fileURLToPath(new URL('../../supabase/migrations/024_commerce.sql', import.meta.url)), 'utf8')
const code = sql
  .split('\n')
  .filter((l) => !l.trim().startsWith('--'))
  .join('\n')

const NEW_TABLES = ['commerce_connections', 'commerce_sync_jobs', 'commerce_webhook_events', 'commerce_products', 'commerce_customers', 'commerce_orders', 'commerce_order_items', 'commerce_carts', 'commerce_automations', 'commerce_automation_runs', 'commerce_audit_log']
const TENANT_READ = ['commerce_connections', 'commerce_products', 'commerce_customers', 'commerce_orders', 'commerce_order_items', 'commerce_carts', 'commerce_automations', 'commerce_automation_runs', 'commerce_audit_log']
const SERVICE_ONLY = ['commerce_sync_jobs', 'commerce_webhook_events']

describe('migration 024_commerce', () => {
  it('contains no DROP of any kind and is re-runnable', () => {
    expect(code).not.toMatch(/\bdrop\b/i)
    for (const m of code.matchAll(/\bADD COLUMN\b(?! IF NOT EXISTS)/g)) throw new Error(`ADD COLUMN without IF NOT EXISTS at ${m.index}`)
    for (const m of code.matchAll(/\bCREATE (UNIQUE )?INDEX\b(?! IF NOT EXISTS)/g)) throw new Error(`CREATE INDEX without IF NOT EXISTS at ${m.index}`)
    for (const m of code.matchAll(/\bCREATE TABLE\b(?! IF NOT EXISTS)/g)) throw new Error(`CREATE TABLE without IF NOT EXISTS at ${m.index}`)
    for (const m of code.matchAll(/\bCREATE (FUNCTION|TRIGGER)\b/g)) throw new Error(`CREATE ${m[1]} without OR REPLACE at ${m.index}`)
    const blocks = code.split('DO $$ BEGIN')
    for (const part of blocks.slice(1)) {
      const body = part.split('END $$;')[0]
      if (/ADD CONSTRAINT|CREATE POLICY/.test(body)) expect(body).toMatch(/EXCEPTION WHEN duplicate_object THEN NULL;/)
    }
  })

  it('backfills existing organizations to services exactly once, and never marks the backfill as a choice', () => {
    expect(code).toMatch(/UPDATE public\.organizations SET business_type = 'services' WHERE business_type IS NULL;/)
    expect(code).toMatch(/IF NOT EXISTS \(SELECT 1 FROM public\.maintenance_state WHERE key = 'commerce_business_type_backfill'\)/)
    expect(code).not.toMatch(/business_type_selected_at = now\(\)/)
    expect(code).toMatch(/CHECK \(business_type IS NULL OR business_type IN \('services', 'ecommerce'\)\)/)
  })

  it('creates every table with RLS, tenant SELECT only where meant, and no tenant privileges on the queues', () => {
    for (const t of NEW_TABLES) {
      expect(code, t).toMatch(new RegExp(`CREATE TABLE IF NOT EXISTS public\\.${t} \\(`))
      expect(code, t).toMatch(new RegExp(`ALTER TABLE public\\.${t} ENABLE ROW LEVEL SECURITY;`))
    }
    for (const t of TENANT_READ) {
      expect(code, t).toMatch(new RegExp(`CREATE POLICY "${t}_owner_select" ON public\\.${t} FOR SELECT TO authenticated\\s+USING \\(org_id IN \\(SELECT id FROM public\\.organizations WHERE user_id = \\(SELECT auth\\.uid\\(\\)\\)\\)\\)`))
    }
    for (const t of SERVICE_ONLY) expect(code).not.toMatch(new RegExp(`CREATE POLICY "[^"]*" ON public\\.${t}`))
    expect(code).toMatch(/REVOKE SELECT, INSERT, UPDATE, DELETE, TRUNCATE ON public\.commerce_sync_jobs, public\.commerce_webhook_events FROM anon, authenticated;/)
    // No policy grants tenants INSERT/UPDATE/DELETE on any commerce table.
    expect(code).not.toMatch(/CREATE POLICY "[^"]*" ON public\.commerce_\w+ FOR (INSERT|UPDATE|DELETE|ALL)/)
    expect(code).toMatch(/REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON\s+public\.commerce_connections,/)
  })

  it('hides the credential envelope, cursors and webhook ids from tenants (column-level grant)', () => {
    expect(code).toMatch(/REVOKE SELECT ON public\.commerce_connections FROM authenticated;/)
    const grant = code.match(/GRANT SELECT \(([^)]+)\)\s+ON public\.commerce_connections TO authenticated;/)
    expect(grant).not.toBeNull()
    const cols = grant![1].split(',').map((c) => c.trim())
    for (const secret of ['encrypted_credentials', 'credential_key_version', 'sync_cursor', 'webhook_config', 'webhook_public_id']) expect(cols).not.toContain(secret)
    expect(cols).toEqual(expect.arrayContaining(['id', 'org_id', 'platform', 'status', 'capabilities']))
  })

  it('uses plain (invoker) claim functions with a fixed search_path, executable by the service role only', () => {
    const fns = [...code.matchAll(/CREATE OR REPLACE FUNCTION public\.(\w+)\(/g)].map((m) => m[1]).sort()
    expect(fns).toEqual(['commerce_claim_automation_runs', 'commerce_claim_sync_jobs', 'commerce_claim_webhook_events', 'guard_commerce_columns'])
    expect(code).not.toMatch(/SECURITY DEFINER/)
    for (const fn of ['commerce_claim_sync_jobs', 'commerce_claim_webhook_events', 'commerce_claim_automation_runs']) {
      expect(code).toMatch(new RegExp(`REVOKE ALL ON FUNCTION public\\.${fn}\\(text, integer, integer\\) FROM PUBLIC, anon, authenticated;`))
      expect(code).toMatch(new RegExp(`GRANT EXECUTE ON FUNCTION public\\.${fn}\\(text, integer, integer\\) TO service_role;`))
      expect(code).toMatch(new RegExp(`FUNCTION public\\.${fn}[^$]*LANGUAGE plpgsql SET search_path = public`))
    }
    expect((code.match(/FOR UPDATE SKIP LOCKED/g) ?? []).length).toBe(3)
    expect(code).toMatch(/REVOKE EXECUTE ON FUNCTION public\.guard_commerce_columns\(\) FROM PUBLIC, anon, authenticated;/)
    expect(code).not.toMatch(/CREATE (OR REPLACE )?VIEW/)
  })

  it('guards the platform-written columns and links calls to runs', () => {
    expect(code).toMatch(/NEW\.business_type IS DISTINCT FROM OLD\.business_type/)
    expect(code).toMatch(/NEW\.commerce_profile IS DISTINCT FROM OLD\.commerce_profile/)
    expect(code).toMatch(/NEW\.commerce_run_id IS DISTINCT FROM OLD\.commerce_run_id/)
    expect(code).toMatch(/CREATE OR REPLACE TRIGGER organizations_guard_commerce BEFORE INSERT OR UPDATE ON public\.organizations/)
    expect(code).toMatch(/CREATE OR REPLACE TRIGGER calls_guard_commerce BEFORE INSERT OR UPDATE ON public\.calls/)
    expect(code).toMatch(/ALTER TABLE public\.calls ADD COLUMN IF NOT EXISTS commerce_run_id uuid;/)
    expect(code).toMatch(/REFERENCES public\.commerce_automation_runs\(id\) ON DELETE SET NULL/)
  })

  it('enforces the uniqueness the queues rely on', () => {
    expect(code).toMatch(/CONSTRAINT commerce_webhook_events_dedupe_key UNIQUE \(connection_id, dedupe_key\)/)
    expect(code).toMatch(/CONSTRAINT commerce_automation_runs_idempotency_key UNIQUE \(idempotency_key\)/)
    expect(code).toMatch(/CREATE UNIQUE INDEX IF NOT EXISTS commerce_automation_runs_one_active ON public\.commerce_automation_runs \(automation_id, external_ref\)\s+WHERE status IN \('eligible', 'scheduled', 'calling', 'retry_waiting'\)/)
    expect(code).toMatch(/CREATE UNIQUE INDEX IF NOT EXISTS commerce_sync_jobs_one_active ON public\.commerce_sync_jobs \(connection_id, resource\) WHERE status IN \('pending', 'running'\)/)
    for (const t of ['commerce_products', 'commerce_customers', 'commerce_orders', 'commerce_carts']) expect(code).toMatch(new RegExp(`CONSTRAINT ${t}_external_key UNIQUE \\(connection_id, external_id\\)`))
    expect(code).toMatch(/CONSTRAINT commerce_connections_org_store_key UNIQUE \(org_id, platform, store_domain\)/)
  })
})
