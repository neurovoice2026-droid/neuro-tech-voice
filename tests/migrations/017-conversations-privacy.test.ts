import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

// Static checks on migration 017 (the production migration runner cannot run
// DROP unattended, and every statement must be safe to re-run). Its behaviour
// was also verified against a throwaway PostgreSQL 16 with Supabase-like roles
// (docs/elevenlabs/D.md, "Migration 017").

const sql = readFileSync(fileURLToPath(new URL('../../supabase/migrations/017_conversations_privacy.sql', import.meta.url)), 'utf8')
const code = sql
  .split('\n')
  .filter((l) => !l.trim().startsWith('--'))
  .join('\n')

describe('migration 017_conversations_privacy', () => {
  it('contains no DROP of any kind', () => {
    expect(code).not.toMatch(/\bdrop\b/i)
  })

  it('is re-runnable: IF NOT EXISTS / OR REPLACE / duplicate_object guards everywhere', () => {
    for (const m of code.matchAll(/\bADD COLUMN\b(?! IF NOT EXISTS)/g)) throw new Error(`ADD COLUMN without IF NOT EXISTS at ${m.index}`)
    for (const m of code.matchAll(/\bCREATE (UNIQUE )?INDEX\b(?! IF NOT EXISTS)/g)) throw new Error(`CREATE INDEX without IF NOT EXISTS at ${m.index}`)
    for (const m of code.matchAll(/\bCREATE TABLE\b(?! IF NOT EXISTS)/g)) throw new Error(`CREATE TABLE without IF NOT EXISTS at ${m.index}`)
    expect(code).not.toMatch(/CREATE TRIGGER/)
    expect(code).not.toMatch(/CREATE FUNCTION/)
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
    expect(fns.sort()).toEqual(['apply_call_retention', 'call_search_vector', 'divert_call_provider_costs', 'search_org_calls'])
    for (const fn of fns) {
      expect(code, fn).toMatch(new RegExp(`CREATE OR REPLACE FUNCTION public\\.${fn}\\([\\s\\S]*?SET search_path = public`))
      expect(code, fn).toMatch(new RegExp(`REVOKE EXECUTE ON FUNCTION public\\.${fn}\\([^)]*\\) FROM PUBLIC, anon, authenticated;`))
    }
  })

  it('provider cost leaves the tenant-readable calls row: copied, cleared, diverted by a trigger, service-only table', () => {
    expect(code).toMatch(/CREATE TABLE IF NOT EXISTS public\.call_provider_costs/)
    expect(code).toMatch(/ALTER TABLE public\.call_provider_costs ENABLE ROW LEVEL SECURITY;/)
    expect(code).toMatch(/REVOKE SELECT, INSERT, UPDATE, DELETE, TRUNCATE ON public\.call_provider_costs FROM anon, authenticated;/)
    expect(code).not.toMatch(/CREATE POLICY[^;]*call_provider_costs/)
    expect(code).toMatch(/INSERT INTO public\.call_provider_costs[\s\S]*?FROM public\.calls c\s+WHERE c\.cost_credits IS NOT NULL OR c\.cost_usd IS NOT NULL/)
    expect(code).toMatch(/UPDATE public\.calls SET cost_credits = NULL, cost_usd = NULL/)
    expect(code).toMatch(/NEW\.cost_credits := NULL;\s+NEW\.cost_usd := NULL;/)
    expect(code).toMatch(/CREATE OR REPLACE TRIGGER calls_provider_costs_divert\s+BEFORE INSERT OR UPDATE OF cost_credits, cost_usd ON public\.calls/)
    // Fires after calls_guard (trigger name order), so tenant writes are still refused first.
    expect('calls_provider_costs_divert' > 'calls_guard').toBe(true)
  })

  it('new calls columns, checks and the maintenance state table', () => {
    for (const col of ['channel text NOT NULL DEFAULT \'phone\'', 'is_test boolean NOT NULL DEFAULT false', 'call_metadata jsonb NOT NULL DEFAULT', 'owner_feedback text', 'retention_applied_at timestamptz', 'reconcile_attempts smallint NOT NULL DEFAULT 0']) {
      expect(code, col).toContain(`ADD COLUMN IF NOT EXISTS ${col}`)
    }
    expect(code).toMatch(/CHECK \(channel IN \('phone', 'web', 'other'\)\) NOT VALID/)
    expect(code).toMatch(/CHECK \(owner_feedback IS NULL OR owner_feedback IN \('like', 'dislike'\)\) NOT VALID/)
    expect(code).toMatch(/CREATE TABLE IF NOT EXISTS public\.maintenance_state/)
    expect(code).toMatch(/ALTER TABLE public\.maintenance_state ENABLE ROW LEVEL SECURITY;/)
  })

  it('retention keeps billing columns and never touches status, duration or usage', () => {
    const fn = code.split('FUNCTION public.apply_call_retention')[1].split('$$;')[0]
    expect(fn).toMatch(/transcript = '\[\]'::jsonb/)
    expect(fn).toMatch(/recording_status = 'deleted'/)
    expect(fn).toMatch(/retention_applied_at IS NULL/)
    expect(fn).not.toMatch(/duration_seconds\s*=|status\s*=\s*'(?!deleted)|usage_recorded_at\s*=|minutes/)
    // The transfer reason the AI wrote can quote the caller: removed, the rest of routing is kept.
    expect(fn).toMatch(/routing = c\.routing #- '\{transfer,reason\}'/)
  })

  it('documents the lock reality on a large calls table (no misleading NOT VALID claim; CONCURRENTLY only as advice)', () => {
    expect(sql).not.toMatch(/no long ACCESS EXCLUSIVE lock/)
    expect(sql).toMatch(/CREATE INDEX CONCURRENTLY/)
    // Advice in comments only: CONCURRENTLY cannot run inside the migration's transaction.
    expect(code).not.toMatch(/CONCURRENTLY/)
  })

  it('full-text search: immutable vector function, GIN index, org-scoped search function', () => {
    expect(code).toMatch(/FUNCTION public\.call_search_vector\(p_title text, p_summary text, p_transcript jsonb\)[\s\S]*?IMMUTABLE/)
    expect(code).toMatch(/CREATE INDEX IF NOT EXISTS calls_search_fts ON public\.calls\s+USING gin \(public\.call_search_vector\(summary_title, summary, transcript\)\)/)
    expect(code).toMatch(/AND c\.org_id = p_org_id/)
  })
})
