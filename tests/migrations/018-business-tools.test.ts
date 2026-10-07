import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

// Static checks on migration 018 (the production migration runner cannot run
// DROP unattended, and every statement must be safe to re-run). Its behaviour
// was also verified against a throwaway PostgreSQL 16 with Supabase-like roles
// (docs/elevenlabs/B2.md, "Migration 018").

const sql = readFileSync(fileURLToPath(new URL('../../supabase/migrations/018_business_tools.sql', import.meta.url)), 'utf8')
const code = sql
  .split('\n')
  .filter((l) => !l.trim().startsWith('--'))
  .join('\n')

const NEW_TABLES = ['bookings', 'booking_locks', 'call_slot_offers', 'tool_invocations', 'call_messages', 'sms_messages', 'sms_opt_outs']

describe('migration 018_business_tools', () => {
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

  it('every function has a fixed search_path and is not executable by tenants; guard_platform_columns is untouched', () => {
    expect(code).not.toMatch(/guard_platform_columns/)
    const fns = [...code.matchAll(/CREATE OR REPLACE FUNCTION public\.(\w+)\(/g)].map((m) => m[1])
    expect(fns.sort()).toEqual(['apply_business_tool_retention', 'guard_b2_columns'])
    for (const fn of fns) {
      expect(code, fn).toMatch(new RegExp(`CREATE OR REPLACE FUNCTION public\\.${fn}\\([\\s\\S]*?SET search_path = public`))
      expect(code, fn).toMatch(new RegExp(`REVOKE EXECUTE ON FUNCTION public\\.${fn}\\([^)]*\\) FROM PUBLIC, anon, authenticated;`))
    }
    expect(code).not.toMatch(/SECURITY DEFINER/)
  })

  it('platform-managed columns are guarded against tenant writes', () => {
    const guard = code.split('FUNCTION public.guard_b2_columns()')[1].split('$$;')[0]
    expect(guard).toMatch(/IF current_user NOT IN \('authenticated', 'anon'\) THEN\s+RETURN NEW;/)
    for (const col of ['booking_settings', 'message_settings', 'sms_capable', 'sms_checked_at']) expect(guard).toContain(`NEW.${col} IS DISTINCT FROM`)
    expect(code).toMatch(/CREATE OR REPLACE TRIGGER agents_guard_b2 BEFORE INSERT OR UPDATE ON public\.agents/)
    expect(code).toMatch(/CREATE OR REPLACE TRIGGER phone_numbers_guard_b2 BEFORE UPDATE ON public\.phone_numbers/)
  })

  it('new tables: RLS on; tenants only SELECT their own rows; internal tables are service-only', () => {
    for (const t of NEW_TABLES) {
      expect(code, t).toMatch(new RegExp(`CREATE TABLE IF NOT EXISTS public\\.${t} \\(`))
      expect(code, t).toContain(`ALTER TABLE public.${t} ENABLE ROW LEVEL SECURITY;`)
    }
    for (const t of ['bookings', 'call_messages', 'sms_messages', 'sms_opt_outs']) {
      expect(code, t).toMatch(new RegExp(`CREATE POLICY "${t}_owner_select" ON public\\.${t} FOR SELECT TO authenticated\\s+USING \\(org_id IN \\(SELECT id FROM public\\.organizations WHERE user_id = \\(SELECT auth\\.uid\\(\\)\\)\\)\\)`))
    }
    expect(code).not.toMatch(/CREATE POLICY[^;]*FOR (INSERT|UPDATE|DELETE|ALL)/)
    expect(code).toMatch(/REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON public\.bookings, public\.call_messages, public\.sms_messages, public\.sms_opt_outs FROM anon, authenticated;/)
    expect(code).toMatch(/REVOKE SELECT, INSERT, UPDATE, DELETE, TRUNCATE ON public\.booking_locks, public\.call_slot_offers, public\.tool_invocations FROM anon, authenticated;/)
    for (const t of ['booking_locks', 'call_slot_offers', 'tool_invocations']) expect(code).not.toMatch(new RegExp(`CREATE POLICY[^;]*ON public\\.${t}`))
  })

  it('double booking and replays are refused by the database too', () => {
    expect(code).toMatch(/CREATE UNIQUE INDEX IF NOT EXISTS bookings_active_slot ON public\.bookings \(org_id, calendar_id, starts_at\) WHERE status IN \('pending', 'booked'\);/)
    expect(code).toMatch(/CREATE UNIQUE INDEX IF NOT EXISTS bookings_idempotency ON public\.bookings \(org_id, idempotency_key\) WHERE idempotency_key IS NOT NULL;/)
    expect(code).toMatch(/CREATE UNIQUE INDEX IF NOT EXISTS call_messages_call ON public\.call_messages \(call_id\) WHERE call_id IS NOT NULL;/)
    expect(code).toMatch(/CONSTRAINT tool_invocations_unique UNIQUE \(call_id, tool, idempotency_key\)/)
    expect(code).toMatch(/CREATE UNIQUE INDEX IF NOT EXISTS sms_messages_idempotency ON public\.sms_messages \(org_id, idempotency_key\)/)
  })

  it('retention clears caller details only, bounded, idempotent and scoped to the agent’s organisation', () => {
    const fn = code.split('FUNCTION public.apply_business_tool_retention')[1].split('$$;')[0]
    expect(fn.match(/retention_applied_at IS NULL/g)).toHaveLength(3)
    expect(fn.match(/FOR UPDATE SKIP LOCKED/g)).toHaveLength(3)
    expect(fn.match(/WHERE org_id = v_org/g)).toHaveLength(3)
    expect(fn).toMatch(/SET caller_name = NULL, callback_number = NULL, reason = ''/)
    expect(fn).toMatch(/SET caller_name = NULL, caller_phone = NULL, notes = NULL/)
    expect(fn).toMatch(/SET to_number = NULL, body = NULL/)
  })
})
