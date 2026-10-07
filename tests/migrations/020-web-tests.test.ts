import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

// Static checks on migration 020 (the production migration runner cannot run
// DROP unattended, and every statement must be safe to re-run). Its behaviour
// was also verified against a throwaway PostgreSQL 16 with Supabase-like roles
// (docs/elevenlabs/G.md, "Migration 020").

const sql = readFileSync(fileURLToPath(new URL('../../supabase/migrations/020_web_tests.sql', import.meta.url)), 'utf8')
const code = sql
  .split('\n')
  .filter((l) => !l.trim().startsWith('--'))
  .join('\n')

describe('migration 020_web_tests', () => {
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

  it('every function has a fixed search_path and is not executable by tenants', () => {
    expect(code).not.toMatch(/guard_platform_columns/)
    const fns = [...code.matchAll(/CREATE OR REPLACE FUNCTION public\.(\w+)\(/g)].map((m) => m[1])
    expect(fns.sort()).toEqual(['claim_web_test_session', 'release_web_test_session'])
    for (const fn of fns) {
      expect(code, fn).toMatch(new RegExp(`CREATE OR REPLACE FUNCTION public\\.${fn}\\([\\s\\S]*?SET search_path = public`))
      expect(code, fn).toMatch(new RegExp(`REVOKE EXECUTE ON FUNCTION public\\.${fn}\\([^)]*\\) FROM PUBLIC, anon, authenticated;`))
    }
    expect(code).not.toMatch(/SECURITY DEFINER/)
  })

  it('the lifetime cap is one atomic statement (check and increment together)', () => {
    const claim = code.split('FUNCTION public.claim_web_test_session')[1].split('$$;')[0]
    expect(claim).toMatch(/ON CONFLICT \(org_id\) DO UPDATE[\s\S]*WHERE p_limit IS NULL OR u\.sessions_started < p_limit/)
  })

  it('new tables: RLS on; tenants only SELECT their own usage; test runs are service-only', () => {
    for (const t of ['web_test_usage', 'agent_test_runs']) {
      expect(code, t).toMatch(new RegExp(`CREATE TABLE IF NOT EXISTS public\\.${t} \\(`))
      expect(code, t).toContain(`ALTER TABLE public.${t} ENABLE ROW LEVEL SECURITY;`)
    }
    expect(code).toMatch(/CREATE POLICY "web_test_usage_owner_select" ON public\.web_test_usage FOR SELECT TO authenticated\s+USING \(org_id IN \(SELECT id FROM public\.organizations WHERE user_id = \(SELECT auth\.uid\(\)\)\)\);/)
    expect(code).toContain('REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON public.web_test_usage FROM anon, authenticated;')
    expect(code).toContain('REVOKE SELECT, INSERT, UPDATE, DELETE, TRUNCATE ON public.agent_test_runs FROM anon, authenticated;')
    expect(code).not.toMatch(/CREATE POLICY[^;]*agent_test_runs/)
  })
})
