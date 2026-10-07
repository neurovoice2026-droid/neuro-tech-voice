import 'server-only'
// Last-run timestamps and watermarks of maintenance steps
// (maintenance_state, migration 017, service role only). Steps that must run
// at a cadence (retention, workspace health) claim their slot here instead of
// relying on the clock minute of the cron invocation, so they work with any
// schedule: daily on the Hobby plan, every 5 minutes with pg_cron.
// A claim is a compare-and-set on last_run_at: two concurrent invocations
// never both run a step in the same period.

import type { SupabaseClient } from '@supabase/supabase-js'
import { createAdminClient } from '@/lib/supabase/admin'
import type { Logger } from '@/lib/observability/logger'

type ClaimResult = 'claimed' | 'not_due' | 'unavailable'

/**
 * Claims `key` when its last run is older than `intervalMs` (or it never ran).
 * 'unavailable' when the state table cannot be read (migration 017 missing):
 * callers then run their bounded, idempotent step anyway.
 */
export async function claimStep(key: string, intervalMs: number, log: Logger, now = Date.now(), db: SupabaseClient = createAdminClient()): Promise<ClaimResult> {
  const nowIso = new Date(now).toISOString()
  const { data, error } = await db.from('maintenance_state').select('last_run_at').eq('key', key).maybeSingle()
  if (error) {
    log.warn('maintenance_state.read_failed', { key, error: error.message.slice(0, 200) })
    return 'unavailable'
  }
  if (!data) {
    const { error: insErr } = await db.from('maintenance_state').insert({ key, last_run_at: nowIso, updated_at: nowIso })
    if (!insErr) return 'claimed'
    if (insErr.code === '23505') return 'not_due' // a concurrent run claimed it first
    log.warn('maintenance_state.write_failed', { key, error: insErr.message.slice(0, 200) })
    return 'unavailable'
  }
  const last = Date.parse(data.last_run_at as string)
  if (Number.isFinite(last) && now - last < intervalMs) return 'not_due'
  const { data: won, error: updErr } = await db
    .from('maintenance_state')
    .update({ last_run_at: nowIso, updated_at: nowIso })
    .eq('key', key)
    .eq('last_run_at', data.last_run_at as string)
    .select('key')
  if (updErr) {
    log.warn('maintenance_state.write_failed', { key, error: updErr.message.slice(0, 200) })
    return 'unavailable'
  }
  return (won?.length ?? 0) > 0 ? 'claimed' : 'not_due'
}

/** Runs `fn` at most once per `intervalMs` across invocations. */
export async function runIfDue<T>(key: string, intervalMs: number, log: Logger, fn: () => Promise<T>, now = Date.now()): Promise<T | { skipped: 'not_due' }> {
  const claim = await claimStep(key, intervalMs, log, now)
  if (claim === 'not_due') return { skipped: 'not_due' }
  return fn()
}

/** Stored watermark of `key` (null when never set or unreadable). */
export async function readWatermark(key: string, log: Logger, db: SupabaseClient = createAdminClient()): Promise<number | null> {
  const { data, error } = await db.from('maintenance_state').select('watermark').eq('key', key).maybeSingle()
  if (error) {
    log.warn('maintenance_state.read_failed', { key, error: error.message.slice(0, 200) })
    return null
  }
  const t = data?.watermark ? Date.parse(data.watermark as string) : NaN
  return Number.isFinite(t) ? t : null
}

/** Every watermark whose key starts with `prefix` (one query; empty map when unreadable). */
export async function readWatermarks(prefix: string, log: Logger, db: SupabaseClient = createAdminClient()): Promise<Map<string, number>> {
  const out = new Map<string, number>()
  const { data, error } = await db.from('maintenance_state').select('key, watermark').like('key', `${prefix}%`).limit(5000)
  if (error) {
    log.warn('maintenance_state.read_failed', { key: prefix, error: error.message.slice(0, 200) })
    return out
  }
  for (const r of data ?? []) {
    const t = r.watermark ? Date.parse(r.watermark as string) : NaN
    if (Number.isFinite(t)) out.set(r.key as string, t)
  }
  return out
}

export async function writeWatermark(key: string, atMs: number, log: Logger, db: SupabaseClient = createAdminClient()): Promise<void> {
  const nowIso = new Date().toISOString()
  const { error } = await db
    .from('maintenance_state')
    .upsert({ key, last_run_at: nowIso, watermark: new Date(atMs).toISOString(), updated_at: nowIso }, { onConflict: 'key' })
  if (error) log.warn('maintenance_state.write_failed', { key, error: error.message.slice(0, 200) })
}
