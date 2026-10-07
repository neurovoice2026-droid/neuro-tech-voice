import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

// Static checks on migration 016 (the production migration runner cannot run
// DROP unattended, and every statement must be safe to re-run). The
// semantics (lease claim, constraints, privileges) were also verified on a
// throwaway PostgreSQL 16, see docs/elevenlabs/B1.md.

const sql = readFileSync(fileURLToPath(new URL('../../supabase/migrations/016_platform_tools.sql', import.meta.url)), 'utf8')
const code = sql
  .split('\n')
  .filter((l) => !l.trim().startsWith('--'))
  .join('\n')

describe('migration 016_platform_tools', () => {
  it('contains no DROP of any kind, no grant and no policy', () => {
    expect(code).not.toMatch(/\bdrop\b/i)
    expect(code).not.toMatch(/\bGRANT\b/i)
    expect(code).not.toMatch(/CREATE POLICY/i)
  })

  it('is re-runnable', () => {
    for (const m of code.matchAll(/\bADD COLUMN\b(?! IF NOT EXISTS)/g)) throw new Error(`ADD COLUMN without IF NOT EXISTS at ${m.index}`)
    // Every constraint is added inside a DO block that ignores duplicate_object.
    const constraints = [...code.matchAll(/ADD CONSTRAINT (\w+)/g)].map((m) => m[1])
    expect(constraints).toEqual(['platform_resources_status_check', 'platform_resources_ready_has_id', 'platform_resources_creating_has_lease'])
    expect(code.match(/EXCEPTION WHEN duplicate_object THEN NULL; END \$\$;/g)).toHaveLength(constraints.length)
    expect(code).not.toMatch(/CREATE (TABLE|FUNCTION|TRIGGER)\b/)
  })

  it('adds the lease, verification and monitoring columns with safe defaults for existing rows', () => {
    expect(code).toMatch(/ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'ready';/)
    expect(code).toMatch(/ADD COLUMN IF NOT EXISTS lease_owner text;/)
    expect(code).toMatch(/ADD COLUMN IF NOT EXISTS lease_until timestamptz;/)
    expect(code).toMatch(/ADD COLUMN IF NOT EXISTS checked_at timestamptz;/)
    expect(code).toMatch(/ADD COLUMN IF NOT EXISTS monitor jsonb NOT NULL DEFAULT '\{\}'::jsonb;/)
    expect(code).toMatch(/CHECK \(status IN \('creating', 'ready'\)\)/)
    expect(code).toMatch(/CHECK \(status <> 'ready' OR external_id <> ''\)/)
  })

  it('keeps the table service-role only', () => {
    expect(code).toMatch(/ALTER TABLE public\.platform_resources ENABLE ROW LEVEL SECURITY;/)
    expect(code).toMatch(/REVOKE ALL ON TABLE public\.platform_resources FROM anon, authenticated;/)
  })
})
