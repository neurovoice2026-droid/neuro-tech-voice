import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

// Static checks on migration 030 (the production migration runner cannot run
// DROP unattended, and every statement must be safe to re-run). Its behaviour
// was verified against a throwaway PostgreSQL 16 with Supabase-like roles
// (001-style integrations, 005, the 022 policy, then 030 twice): the owner's
// session reads the status columns and nothing else, every tenant write and
// any read of the token is refused, the service role still upserts, reads
// and clears tokens, and a token-less active Google row is refused.

const root = fileURLToPath(new URL('../../', import.meta.url))
const sql = readFileSync(`${root}supabase/migrations/030_integrations_token_privacy.sql`, 'utf8')
const code = sql
  .split('\n')
  .filter((l) => !l.trim().startsWith('--'))
  .join('\n')

const grant = code.match(/GRANT SELECT \(([^)]+)\)\s+ON public\.integrations TO authenticated;/)
const granted = (grant?.[1] ?? '').split(',').map((c) => c.trim())

describe('migration 030_integrations_token_privacy', () => {
  it('contains no DROP and is re-runnable', () => {
    expect(code).not.toMatch(/\bdrop\b/i)
    const blocks = code.split('DO $$ BEGIN')
    expect(blocks.length - 1).toBe(4)
    for (const part of blocks.slice(1)) {
      const body = part.split('END $$;')[0]
      expect(body).toMatch(/ADD CONSTRAINT|CREATE POLICY/)
      expect(body).toMatch(/EXCEPTION WHEN duplicate_object THEN NULL;/)
    }
  })

  it('takes every privilege from anon and authenticated, then grants the status columns back for reading', () => {
    expect(code).toMatch(/REVOKE ALL ON public\.integrations FROM anon, authenticated;/)
    expect(grant).not.toBeNull()
    expect(granted).not.toContain('google_refresh_token')
    expect(granted.sort()).toEqual(['config', 'connected_at', 'created_at', 'id', 'is_active', 'org_id', 'type'])
    // No other privilege comes back to a tenant role.
    expect(code).not.toMatch(/GRANT (INSERT|UPDATE|DELETE|ALL)\b[^;]*integrations/i)
    expect(code).not.toMatch(/GRANT [^;]*TO [^;]*\banon\b/)
    // The REVOKE runs before the GRANT (a re-run starts from the same state).
    expect(code.indexOf('REVOKE ALL ON public.integrations')).toBeLessThan(code.indexOf('GRANT SELECT ('))
  })

  it('denies tenant writes with restrictive policies and keeps the owner read policy for signed-in users', () => {
    expect(code).toMatch(/ALTER POLICY "integrations_owner" ON public\.integrations TO authenticated;/)
    expect(code).toMatch(/CREATE POLICY "integrations_no_tenant_insert" ON public\.integrations AS RESTRICTIVE FOR INSERT TO authenticated, anon WITH CHECK \(false\);/)
    expect(code).toMatch(/CREATE POLICY "integrations_no_tenant_update" ON public\.integrations AS RESTRICTIVE FOR UPDATE TO authenticated, anon USING \(false\);/)
    expect(code).toMatch(/CREATE POLICY "integrations_no_tenant_delete" ON public\.integrations AS RESTRICTIVE FOR DELETE TO authenticated, anon USING \(false\);/)
    expect(code).not.toMatch(/AS PERMISSIVE|FOR (INSERT|UPDATE|DELETE|ALL) TO [^;]*USING \(true\)/)
  })

  it('switches off token-less Google rows, then requires a token on every active Google row', () => {
    const update = code.match(/UPDATE public\.integrations\s+SET is_active = false\s+WHERE type <> 'webhook'\s+AND is_active IS TRUE\s+AND coalesce\(google_refresh_token, ''\) = '';/)
    expect(update).not.toBeNull()
    expect(code).not.toMatch(/DELETE FROM/i)
    expect(code).toMatch(
      /ADD CONSTRAINT integrations_google_active_needs_token\s+CHECK \(type = 'webhook' OR is_active IS NOT TRUE OR coalesce\(google_refresh_token, ''\) <> ''\);/,
    )
    // Data fix before the CHECK; both after the privileges, which matter most.
    expect(code.indexOf('UPDATE public.integrations')).toBeLessThan(code.indexOf('ADD CONSTRAINT'))
    expect(code.indexOf('GRANT SELECT (')).toBeLessThan(code.indexOf('UPDATE public.integrations'))
  })

  it('every integrations read made with the owner\'s session names granted columns only', () => {
    const files = [
      'app/(dashboard)/dashboard/page.tsx',
      'app/(dashboard)/integrations/page.tsx',
      'app/(dashboard)/workflows/page.tsx',
      'app/api/integrations/[type]/route.ts',
    ]
    let reads = 0
    for (const f of files) {
      const src = readFileSync(`${root}${f}`, 'utf8')
      for (const m of src.matchAll(/(createAdminClient\(\)\s*)?\.from\('integrations'\)\s*\.select\('([^']*)'\)/g)) {
        if (m[1]) continue
        reads++
        for (const col of m[2].split(',').map((c) => c.trim())) expect(granted, `${f}: ${col}`).toContain(col)
      }
    }
    expect(reads).toBeGreaterThanOrEqual(4)
  })
})
