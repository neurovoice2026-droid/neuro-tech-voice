import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

// Static checks on migration 014 (the production migration runner cannot run
// DROP unattended, and every statement must be safe to re-run).

const sql = readFileSync(fileURLToPath(new URL('../../supabase/migrations/014_config_rollout.sql', import.meta.url)), 'utf8')
const code = sql
  .split('\n')
  .filter((l) => !l.trim().startsWith('--'))
  .join('\n')

describe('migration 014_config_rollout', () => {
  it('contains no DROP of any kind and no tenant-facing grant', () => {
    expect(code).not.toMatch(/\bdrop\b/i)
    expect(code).not.toMatch(/\bGRANT\b/i)
    expect(code).not.toMatch(/CREATE POLICY/i)
  })

  it('is re-runnable', () => {
    for (const m of code.matchAll(/\bADD COLUMN\b(?! IF NOT EXISTS)/g)) throw new Error(`ADD COLUMN without IF NOT EXISTS at ${m.index}`)
    for (const m of code.matchAll(/\bCREATE (UNIQUE )?INDEX\b(?! IF NOT EXISTS)/g)) throw new Error(`CREATE INDEX without IF NOT EXISTS at ${m.index}`)
    expect(code).not.toMatch(/CREATE (TABLE|FUNCTION|TRIGGER)\b/)
  })

  it('adds the nullable rollout timestamp and the partial index the scan uses', () => {
    expect(code).toMatch(/ALTER TABLE public\.agent_provider_resources ADD COLUMN IF NOT EXISTS rollout_checked_at timestamptz;/)
    expect(code).toMatch(/CREATE INDEX IF NOT EXISTS agent_provider_resources_rollout\s+ON public\.agent_provider_resources \(provider, rollout_checked_at NULLS FIRST\)\s+WHERE status = 'ready' AND external_id IS NOT NULL;/)
  })
})
