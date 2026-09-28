import 'server-only'
import { createAdminClient } from '@/lib/supabase/admin'

// Small building blocks for the daily cron: step isolation and the kv_store purge.

export interface CronStepResult {
  ok: boolean
  duration_ms: number
  result?: unknown
  /** Short, non-sensitive description; details are in the server log. */
  error?: string
}

/** Runs one job so that its failure (or throw) never stops the others. */
export async function runCronStep(name: string, job: () => Promise<unknown>): Promise<CronStepResult> {
  const started = Date.now()
  try {
    const result = await job()
    return { ok: true, duration_ms: Date.now() - started, result }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    console.error('[cron]', name, 'failed:', message)
    return { ok: false, duration_ms: Date.now() - started, error: `${name} failed; see the server log` }
  }
}

/** Deletes kv_store rows whose TTL passed (readers already ignore them). */
export async function purgeExpiredKv(now: Date = new Date()): Promise<{ purged: number } | { skipped: 'missing_table' }> {
  const { error, count } = await createAdminClient()
    .from('kv_store')
    .delete({ count: 'exact' })
    .lt('expires_at', now.toISOString())
  if (error) {
    // Before migration 010 there is no table to purge.
    if (error.code === '42P01' || error.code === 'PGRST205') return { skipped: 'missing_table' }
    throw new Error(`kv_store purge failed: ${error.message}`)
  }
  return { purged: count ?? 0 }
}
