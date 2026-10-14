import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import { PLANS } from '@/types'

// Static checks on migration 026: it only replaces the organizations.plan
// CHECK so that every id in PLANS (types/index.ts) is accepted, and nothing else.

const sql = readFileSync(fileURLToPath(new URL('../../supabase/migrations/026_store_plans.sql', import.meta.url)), 'utf8')
const code = sql
  .split('\n')
  .filter((l) => !l.trim().startsWith('--'))
  .join('\n')

/** The quoted ids inside the CHECK (plan IN (...)) list. */
function allowedPlanIds(): string[] {
  const m = code.match(/CHECK \(plan IN \(([^)]*)\)\)/)
  if (!m) throw new Error('organizations_plan_check CHECK not found')
  return [...m[1].matchAll(/'([a-z_]+)'/g)].map((x) => x[1])
}

describe('migration 026_store_plans', () => {
  it('drops and re-adds organizations_plan_check under a lock timeout, touching nothing else', () => {
    expect(code).toMatch(/SET lock_timeout = '5s';/)
    expect(code).toMatch(/ALTER TABLE public\.organizations DROP CONSTRAINT IF EXISTS organizations_plan_check;/)
    expect(code).toMatch(/ALTER TABLE public\.organizations\s+ADD CONSTRAINT organizations_plan_check\s+CHECK \(plan IN \(/)
    // The constraint drop is the only DROP; rows, defaults, tables and policies are left alone.
    expect(code.match(/\bDROP\b/gi)).toHaveLength(1)
    expect(code).not.toMatch(/\b(update|delete|insert|create|set default|drop column|drop table)\b/i)
    expect(code.match(/\bALTER TABLE\b/g)).toHaveLength(2)
  })

  it('accepts exactly the plan ids of PLANS, service and store tiers alike', () => {
    const allowed = allowedPlanIds()
    expect([...allowed].sort()).toEqual(Object.keys(PLANS).sort())
    expect(allowed).toEqual(expect.arrayContaining(['store_starter', 'store_growth', 'store_scale', 'store_enterprise']))
  })
})
