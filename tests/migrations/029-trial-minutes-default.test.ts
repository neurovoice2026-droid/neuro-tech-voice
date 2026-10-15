import { readdirSync, readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import { PLANS } from '@/types'

// Static checks on migration 029: the organizations.minutes_limit DEFAULT (what
// a new sign-up starts with) is the trial's allowance in PLANS, and nothing
// else changes. The last migration that sets that default must always agree
// with PLANS.trial, so a later change to either side fails here.

const dir = fileURLToPath(new URL('../../supabase/migrations/', import.meta.url))
const stripComments = (sql: string) =>
  sql
    .split('\n')
    .filter((l) => !l.trim().startsWith('--'))
    .join('\n')
const code = stripComments(readFileSync(`${dir}029_trial_minutes_default.sql`, 'utf8'))

const DEFAULT_RE = /ALTER TABLE (?:public\.)?organizations ALTER COLUMN minutes_limit SET DEFAULT (\d+)/g

describe('migration 029_trial_minutes_default', () => {
  it('sets the organizations.minutes_limit default to PLANS.trial.minutes_limit', () => {
    const defaults = [...code.matchAll(DEFAULT_RE)].map((m) => Number(m[1]))
    expect(defaults).toEqual([PLANS.trial.minutes_limit])
    expect(PLANS.trial.minutes_limit).toBe(5)
  })

  it('changes the DEFAULT only: under a lock timeout, no row rewritten, no other table or column touched', () => {
    expect(code).toMatch(/^SET lock_timeout = '5s';/m)
    expect(code).not.toMatch(/^\s*(UPDATE|DELETE|INSERT|DROP|CREATE)\b/im)
    const statements = code.split(';').map((s) => s.trim()).filter(Boolean)
    expect(statements).toEqual([
      "SET lock_timeout = '5s'",
      `ALTER TABLE public.organizations ALTER COLUMN minutes_limit SET DEFAULT ${PLANS.trial.minutes_limit}`,
    ])
  })

  it('the latest migration that sets the default agrees with PLANS.trial', () => {
    const files = readdirSync(dir).filter((f) => /^\d{3}_.*\.sql$/.test(f)).sort()
    let latest: { file: string; value: number } | null = null
    for (const file of files) {
      for (const m of stripComments(readFileSync(`${dir}${file}`, 'utf8')).matchAll(DEFAULT_RE)) latest = { file, value: Number(m[1]) }
    }
    expect(latest).toEqual({ file: '029_trial_minutes_default.sql', value: PLANS.trial.minutes_limit })
  })
})
