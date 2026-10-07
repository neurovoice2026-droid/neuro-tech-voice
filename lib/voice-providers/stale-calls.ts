import 'server-only'
// Last-resort safety net for app-routed ElevenLabs calls whose post-call
// webhook never arrived. The conversation reconciliation
// (conversation-reconcile.ts) looks the conversation up first (ntv_call_id
// filter on the org's agent) and applies the full provider result; only a
// call it could not recover — checked at least once, or older than 6 hours
// when the reconciliation cannot run — is billed here from Twilio's duration
// (ledger key call:<id>, so a late webhook never bills twice) and finalized
// at rank 40; a late webhook or poll (rank 50) still fills
// transcript/analysis. Logged as a warning: repeated occurrences mean the
// webhook configuration needs attention (webhook-health.ts).
// Every condition is a SQL filter (test sessions, rows without a terminal
// Twilio status): rows this step always skips would otherwise fill the
// oldest-first batch and keep newer calls from ever being billed.

import { createAdminClient } from '@/lib/supabase/admin'
import { createLogger, type Logger } from '@/lib/observability/logger'
import { emitProviderEvent } from '@/lib/observability/telemetry'
import { recordUsage } from './call-store'
import { RANK } from './call-merge'

const STALE_AFTER_MS = 60 * 60_000
/** Billed from Twilio even without a reconciliation attempt after this long (API down for hours). */
const RECONCILE_GRACE_MS = 6 * 60 * 60_000
/** This many calls finalized in one run means webhooks are being lost: logged as an error. */
const MISSING_WEBHOOK_ALERT = 3
const TWILIO_TERMINAL_STATUSES = ['completed', 'busy', 'failed', 'no-answer', 'canceled'] as const
const TWILIO_TERMINAL: ReadonlySet<string> = new Set(TWILIO_TERMINAL_STATUSES)

export async function finalizeStaleElevenLabsCalls(limit = 50, log: Logger = createLogger({ component: 'stale_calls' }), now = Date.now()) {
  const db = createAdminClient()
  const { data: calls, error } = await db
    .from('calls')
    .select('id, org_id, status, routing, usage_recorded_at, duration_seconds')
    .eq('provider', 'elevenlabs')
    .eq('status', 'in-progress')
    // Browser/SDK test sessions are never billed (and have no Twilio leg).
    .eq('is_test', false)
    // Only calls whose Twilio leg ended (routing.twilio_status, set by the status callback).
    .in('routing->>twilio_status', [...TWILIO_TERMINAL_STATUSES])
    .lt('lifecycle_rank', RANK.finalizedWithoutProvider)
    .lt('created_at', new Date(now - STALE_AFTER_MS).toISOString())
    .gte('created_at', new Date(now - 7 * 24 * 3600_000).toISOString())
    // The reconciliation gets the first chance to recover the full result.
    .or(`reconcile_attempts.gte.1,created_at.lt."${new Date(now - RECONCILE_GRACE_MS).toISOString()}"`)
    .order('created_at', { ascending: true })
    .limit(limit)
  if (error) throw new Error(`calls scan failed: ${error.message}`)
  let finalized = 0
  for (const c of calls ?? []) {
    const routing = (c.routing ?? {}) as { twilio_status?: string; twilio_duration?: number }
    if (!TWILIO_TERMINAL.has(routing.twilio_status ?? '')) continue // defensive: filtered in SQL
    const seconds = Number(routing.twilio_duration ?? 0) || 0
    try {
      if (seconds > 0 && !c.usage_recorded_at) {
        await recordUsage(db, { orgId: c.org_id as string, callId: c.id as string, seconds, provider: 'elevenlabs', source: 'twilio_call_duration' }, log)
      }
      const { error: updErr } = await db
        .from('calls')
        .update({
          lifecycle_rank: RANK.finalizedWithoutProvider,
          status: routing.twilio_status === 'completed' ? 'completed' : (routing.twilio_status as string),
          ...(c.duration_seconds ? {} : { duration_seconds: seconds }),
        })
        .eq('id', c.id)
        .lt('lifecycle_rank', RANK.finalizedWithoutProvider)
      if (updErr) throw new Error(`calls finalize failed: ${updErr.message}`)
      finalized++
      log.warn('stale_calls.finalized_without_webhook', { callId: c.id, orgId: c.org_id, seconds })
      emitProviderEvent({ system: 'elevenlabs', kind: 'webhook_processing_failed', ok: false, errorCode: 'missing_webhook', orgId: c.org_id as string, callId: c.id as string })
    } catch (err) {
      log.error('stale_calls.finalize_failed', err, { callId: c.id })
    }
  }
  if (finalized >= MISSING_WEBHOOK_ALERT) {
    log.error('stale_calls.webhooks_missing', null, { finalized, hint: 'check GET /api/admin/voice/diagnostics (post_call_webhook)' })
  }
  return { scanned: calls?.length ?? 0, finalized }
}
