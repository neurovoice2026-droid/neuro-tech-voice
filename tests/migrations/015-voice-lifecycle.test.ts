import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

// Static checks on migration 015 (the production migration runner cannot run
// DROP unattended, and every statement must be safe to re-run). Its behaviour
// was also verified against a throwaway PostgreSQL 16 (docs/elevenlabs/F.md,
// "Migration verification").

const sql = readFileSync(fileURLToPath(new URL('../../supabase/migrations/015_voice_lifecycle.sql', import.meta.url)), 'utf8')
const code = sql
  .split('\n')
  .filter((l) => !l.trim().startsWith('--'))
  .join('\n')

describe('migration 015_voice_lifecycle', () => {
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
    const fns = [...code.matchAll(/CREATE OR REPLACE FUNCTION public\.(\w+)\(\)/g)].map((m) => m[1])
    expect(fns.sort()).toEqual(['guard_voice_columns', 'queue_org_voice_purge', 'scrub_platform_voice_creator'])
    for (const fn of fns) {
      expect(code, fn).toMatch(new RegExp(`CREATE OR REPLACE FUNCTION public\\.${fn}\\(\\)[\\s\\S]*?SET search_path = public`))
      expect(code, fn).toMatch(new RegExp(`REVOKE EXECUTE ON FUNCTION public\\.${fn}\\(\\) FROM PUBLIC, anon, authenticated;`))
    }
  })

  it('agents.pronunciation is platform-managed: the guard only lets non-tenant roles write it', () => {
    expect(code).toMatch(/ALTER TABLE public\.agents ADD COLUMN IF NOT EXISTS pronunciation jsonb;/)
    expect(code).toMatch(/IF current_user NOT IN \('authenticated', 'anon'\) THEN\s+RETURN NEW;/)
    expect(code).toMatch(/TG_OP = 'UPDATE' AND NEW\.pronunciation IS DISTINCT FROM OLD\.pronunciation/)
    expect(code).toMatch(/TG_OP = 'INSERT' AND NEW\.pronunciation IS NOT NULL/)
    expect(code).toMatch(/CREATE OR REPLACE TRIGGER agents_guard_voice\s+BEFORE INSERT OR UPDATE ON public\.agents/)
  })

  it('platform-wide registry rows lose the provisioning tenant user id (existing and future rows)', () => {
    expect(code).toMatch(/UPDATE public\.provider_voices SET created_by = NULL WHERE owner_org_id IS NULL/)
    expect(code).toMatch(/IF NEW\.owner_org_id IS NULL THEN\s+NEW\.created_by := NULL;/)
    expect(code).toMatch(/CREATE OR REPLACE TRIGGER provider_voices_scrub_creator\s+BEFORE INSERT OR UPDATE ON public\.provider_voices/)
  })

  it('curation is limited to platform-wide rows; notices use a closed set', () => {
    expect(code).toMatch(/CHECK \(featured_languages IS NULL OR owner_org_id IS NULL\)/)
    expect(code).toMatch(/notice IN \('removal_scheduled', 'removed', 'moderation', 'custom_rate', 'blocked'\)/)
  })

  it('new tables: RLS on, tenant SELECT scoped by org (design previews), service role only (purge queue)', () => {
    expect(code).toMatch(/ALTER TABLE public\.voice_design_previews ENABLE ROW LEVEL SECURITY;/)
    expect(code).toMatch(/CREATE POLICY "voice_design_previews_owner_select" ON public\.voice_design_previews FOR SELECT\s+USING \(org_id IN \(SELECT id FROM public\.organizations WHERE user_id = \(SELECT auth\.uid\(\)\)\)\);/)
    expect(code).toMatch(/REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON public\.voice_design_previews FROM anon, authenticated;/)
    expect(code).toMatch(/ALTER TABLE public\.provider_voice_purge ENABLE ROW LEVEL SECURITY;/)
    expect(code).toMatch(/REVOKE SELECT, INSERT, UPDATE, DELETE, TRUNCATE ON public\.provider_voice_purge FROM anon, authenticated;/)
    expect(code).not.toMatch(/CREATE POLICY [^;]*ON public\.provider_voice_purge/)
    expect(code).toMatch(/CREATE UNIQUE INDEX IF NOT EXISTS voice_design_previews_generated\s+ON public\.voice_design_previews \(generated_voice_id\);/)
  })

  it('a deleted organization queues its custom voices and pronunciation dictionary for purge', () => {
    expect(code).toMatch(/CREATE OR REPLACE TRIGGER organizations_queue_voice_purge\s+BEFORE DELETE ON public\.organizations/)
    expect(code).toMatch(/pv\.source IN \('cloned', 'designed'\)/)
    expect(code).toMatch(/'pronunciation_dictionary', a\.pronunciation->>'dictionary_id'/)
    expect(code).toMatch(/ON CONFLICT \(provider, kind, resource_id\) DO NOTHING/)
  })
})
