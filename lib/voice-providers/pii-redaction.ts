import 'server-only'
// Whether the ONE ElevenLabs workspace every tenant shares accepts transcript
// redaction (privacy.conversation_history_redaction, enterprise-only). The
// answer is the same for every agent and every server instance, so once the
// workspace refuses it (feature_not_available) the refusal is remembered in
// maintenance_state (key elevenlabs_pii_redaction, service role only). Cold
// instances then send the body without redaction straight away instead of
// repeating the refused write and its log line (adapters.ts reports
// pii_redaction 'rejected', diagnostics count it).
//
//   • A refusal holds for a day: the first write after that asks again, so an
//     upgraded workspace is picked up without anyone acting, at the cost of
//     one refused write and one warning per day.
//   • The quota monitor clears it sooner when the subscription tier it reads
//     is no longer the tier recorded with the refusal (an upgrade).
//   • ELEVENLABS_PII_REDACTION stays the switch: false never sends it at all.
// The store never fails a sync: a read or write error is logged and the write
// simply asks for redaction (the adapter's retry without it still applies).

import type { SupabaseClient } from '@supabase/supabase-js'
import { createAdminClient } from '@/lib/supabase/admin'
import { describeError, type Logger } from '@/lib/observability/logger'
import { isProviderError } from './errors'

export const PII_REDACTION_STATE_KEY = 'elevenlabs_pii_redaction'
/** How long a refusal is trusted before one write asks again. */
export const PII_REJECTION_TTL_MS = 24 * 3_600_000
/** How long an instance trusts what it last read (a refusal stored or cleared elsewhere is seen within this). */
const READ_TTL_MS = 10 * 60_000

interface StoredState {
  status?: unknown
  tier?: unknown
}

let memo: { rejectedAt: number | null; readAt: number } | null = null

/** Test helper (also what a fresh instance starts from). */
export function resetPiiRedactionMemo(): void {
  memo = null
}

/** The workspace refused transcript redaction (403 feature_not_available, or a 400/402 naming it). */
export function isPiiRedactionRejection(err: unknown): boolean {
  return isProviderError(err) && ['validation', 'permission', 'quota'].includes(err.code) && /redact/i.test(err.detail ?? '')
}

/** True while the workspace is known to refuse transcript redaction. */
export async function piiRedactionRejected(log: Logger, now = Date.now(), db?: SupabaseClient): Promise<boolean> {
  // A refusal that expired since this instance last read may already have been
  // renewed by another instance asking again: read once more rather than repeat that ask.
  const expiredUnread = memo?.rejectedAt != null && now - memo.rejectedAt >= PII_REJECTION_TTL_MS && memo.readAt < memo.rejectedAt + PII_REJECTION_TTL_MS
  if (!memo || expiredUnread || now - memo.readAt >= READ_TTL_MS) {
    const { data, error } = await (db ?? createAdminClient()).from('maintenance_state').select('last_run_at, details').eq('key', PII_REDACTION_STATE_KEY).maybeSingle()
    if (error) {
      // Unknown: keep what this instance already knew, and read again next time.
      log.warn('pii_redaction.state_read_failed', { error: error.message.slice(0, 200) })
    } else {
      const at = data && (data.details as StoredState | null)?.status === 'rejected' ? Date.parse(data.last_run_at as string) : NaN
      memo = { rejectedAt: Number.isFinite(at) ? at : null, readAt: now }
    }
  }
  return memo?.rejectedAt != null && now - memo.rejectedAt < PII_REJECTION_TTL_MS
}

/** Remembers a refusal for every instance; the one warning per refusal (at most daily) is logged here. */
export async function rememberPiiRedactionRejected(err: unknown, log: Logger, now = Date.now(), db?: SupabaseClient): Promise<void> {
  memo = { rejectedAt: now, readAt: now }
  log.warn('agent_sync.pii_redaction_rejected', { error: describeError(err), recheck_in_hours: PII_REJECTION_TTL_MS / 3_600_000 })
  const iso = new Date(now).toISOString()
  const code = isProviderError(err) ? (err.providerCode ?? err.code) : null
  const { error } = await (db ?? createAdminClient())
    .from('maintenance_state')
    .upsert({ key: PII_REDACTION_STATE_KEY, last_run_at: iso, details: { status: 'rejected', code, tier: null }, updated_at: iso }, { onConflict: 'key' })
  if (error) log.warn('pii_redaction.state_write_failed', { error: error.message.slice(0, 200) })
}

/**
 * Quota monitor hook, with the tier it just read: the first tier seen after a
 * refusal is recorded with it, and a different tier later (an upgrade) clears
 * it so the next write asks for redaction again instead of waiting out the
 * day. An unknown tier (a key without user_read) changes nothing.
 */
export async function refreshPiiRedactionCapability(
  tier: string | null | undefined,
  log: Logger,
  now = Date.now(),
  db?: SupabaseClient,
): Promise<'none' | 'recorded' | 'unchanged' | 'cleared'> {
  if (!tier) return 'none'
  const client = db ?? createAdminClient()
  const { data, error } = await client.from('maintenance_state').select('details').eq('key', PII_REDACTION_STATE_KEY).maybeSingle()
  if (error) {
    log.warn('pii_redaction.state_read_failed', { error: error.message.slice(0, 200) })
    return 'none'
  }
  const state = (data?.details ?? null) as StoredState | null
  if (state?.status !== 'rejected') return 'none'
  if (typeof state.tier !== 'string' || !state.tier) {
    const { error: writeErr } = await client
      .from('maintenance_state')
      .update({ details: { ...state, tier }, updated_at: new Date(now).toISOString() })
      .eq('key', PII_REDACTION_STATE_KEY)
    if (writeErr) log.warn('pii_redaction.state_write_failed', { error: writeErr.message.slice(0, 200) })
    return 'recorded'
  }
  if (state.tier === tier) return 'unchanged'
  const { error: delErr } = await client.from('maintenance_state').delete().eq('key', PII_REDACTION_STATE_KEY)
  if (delErr) {
    log.warn('pii_redaction.state_write_failed', { error: delErr.message.slice(0, 200) })
    return 'unchanged'
  }
  memo = null
  log.info('pii_redaction.recheck', { from_tier: state.tier, to_tier: tier })
  return 'cleared'
}
