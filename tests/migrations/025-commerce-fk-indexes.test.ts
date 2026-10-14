import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

// Static checks on migration 025: only re-runnable CREATE INDEX IF NOT EXISTS
// statements, one per foreign key the Supabase advisor reported after 024.

const sql = readFileSync(fileURLToPath(new URL('../../supabase/migrations/025_commerce_fk_indexes.sql', import.meta.url)), 'utf8')
const code = sql
  .split('\n')
  .filter((l) => !l.trim().startsWith('--'))
  .join('\n')

const FOREIGN_KEYS: Array<[table: string, column: string]> = [
  ['commerce_audit_log', 'connection_id'],
  ['commerce_audit_log', 'automation_id'],
  ['commerce_audit_log', 'call_id'],
  ['commerce_automation_runs', 'connection_id'],
  ['commerce_automation_runs', 'order_id'],
  ['commerce_automations', 'agent_id'],
  ['commerce_carts', 'customer_id'],
  ['commerce_order_items', 'connection_id'],
  ['commerce_order_items', 'org_id'],
  ['commerce_sync_jobs', 'org_id'],
  ['commerce_webhook_events', 'org_id'],
]

describe('migration 025_commerce_fk_indexes', () => {
  it('is additive and re-runnable', () => {
    expect(code).not.toMatch(/\bdrop\b/i)
    expect(code).not.toMatch(/\b(alter|create table|create policy|create function|update|delete|insert)\b/i)
    for (const m of code.matchAll(/\bCREATE (UNIQUE )?INDEX\b(?! IF NOT EXISTS)/g)) throw new Error(`CREATE INDEX without IF NOT EXISTS at ${m.index}`)
    expect(code).toMatch(/SET lock_timeout = '5s';/)
  })

  it('covers every reported foreign key with the column leading the index', () => {
    for (const [table, column] of FOREIGN_KEYS) {
      const re = new RegExp(`CREATE INDEX IF NOT EXISTS \\w+ ON public\\.${table} \\(${column}[,)]`)
      expect(code, `${table}.${column}`).toMatch(re)
    }
  })
})
