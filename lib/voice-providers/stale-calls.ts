import 'server-only'
// Safety net for app-routed ElevenLabs calls whose post-call webhook never
// arrived (delivery failures exhausted, webhook misconfigured). register-call
// does not return the conversation id, so the conversation cannot be fetched
// directly; instead, once Twilio reports the call ended and an hour has passed,
// the call is billed from Twilio's duration (ledger key call:<id>, so a late
// webhook never bills twice) and finalized at rank 40 — a late webhook
// (rank 50) still fills transcript/analysis. Logged as a warning: repeated
// occurrences mean the webhook configuration needs attention.

import { createAdminClient } from '@/lib/supabase/admin'
import { createLogger, type Logger } from '@/lib/observability/logger'
import { emitProviderEvent } from '@/lib/observability/telemetry'
import { recordUsage } from './call-store'
import { RANK } from './call-merge'

const STALE_AFTER_MS = 60 * 60_000
const TWILIO_TERMINAL = new Set(['completed', 'busy', 'failed', 'no-answer', 'canceled'])

export async function finalizeStaleElevenLabsCalls(limit = 50, log: Logger = createLogger({ component: 'stale_calls' }), now = Date.now()) {
  const db = createAdminClient()
  const { data: calls, error } = await db
    .from('calls')
    .select('id, org_id, status, routing, usage_recorded_at, duration_seconds')
    .eq('provider', 'elevenlabs')
    .eq('status', 'in-progress')
    .lt('lifecycle_rank', RANK.finalizedWithoutProvider)
    .lt('created_at', new Date(now - STALE_AFTER_MS).toISOString())
    .gte('created_at', new Date(now - 7 * 24 * 3600_000).toISOString())
    .order('created_at', { ascending: true })
    .limit(limit)
  if (error) throw new Error(`calls scan failed: ${error.message}`)
  let finalized = 0
  for (const c of calls ?? []) {
    const routing = (c.routing ?? {}) as { twilio_status?: string; twilio_duration?: number }
    if (!TWILIO_TERMINAL.has(routing.twilio_status ?? '')) continue
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
  return { scanned: calls?.length ?? 0, finalized }
}
