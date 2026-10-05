import 'server-only'
// Scheduled maintenance (cron → /api/cron/voice-maintenance):
//   1. health probes for both providers; results feed the circuit breaker, so
//      an open circuit is half-opened/closed by probes, not only by live calls;
//   2. retry failed/pending agent syncs whose next_retry_at has passed, and
//      resync agents whose config_revision moved ahead;
//   3. reprocess webhook events that failed or were never processed;
//   4. pull Cartesia results for fallback calls (webhooks not guaranteed) and
//      finalize ElevenLabs calls whose post-call webhook never arrived;
//   5. retention: prune telemetry, processed webhook receipts, expired
//      rate-limit windows and payloads of dead-lettered webhooks.
// Each step is isolated: one failing step never stops the others.

import { createAdminClient } from '@/lib/supabase/admin'
import { createLogger, type Logger } from '@/lib/observability/logger'
import { emitProviderEvent } from '@/lib/observability/telemetry'
import { LIFECYCLES } from './adapters'
import { reportOutcome } from './circuit-registry'
import { syncAgent } from './agent-sync'
import { reprocessPendingWebhooks } from './webhook-ingest'
import { reconcileCartesiaCalls } from './cartesia-poll'
import { finalizeStaleElevenLabsCalls } from './stale-calls'
import { VOICE_PROVIDERS, isHealthSignalCode, type ProviderErrorCode } from './errors'
import type { ProviderHealth } from './types'

export async function probeProviders(log: Logger): Promise<ProviderHealth[]> {
  const out: ProviderHealth[] = []
  for (const p of VOICE_PROVIDERS) {
    const h = await LIFECYCLES[p].health()
    out.push(h)
    emitProviderEvent({ system: p, kind: 'health_check', ok: h.ok, latencyMs: h.latencyMs, errorCode: h.errorCode })
    if (h.configured) {
      // providerRequest already reported the outcome of the probe request;
      // only non-HTTP failures need an explicit report here.
      if (!h.ok && h.errorCode && !isHealthSignalCode(h.errorCode as ProviderErrorCode) && h.errorCode !== 'auth') {
        log.warn('maintenance.health_non_signal', { provider: p, code: h.errorCode })
      }
      if (h.ok) await reportOutcome(p, { ok: true })
    }
  }
  return out
}

export async function retryAgentSyncs(limit: number, log: Logger) {
  const db = createAdminClient()
  const now = new Date().toISOString()
  const { data, error } = await db
    .from('agent_provider_resources')
    .select('agent_id, provider')
    .in('status', ['failed', 'degraded', 'pending'])
    .or(`next_retry_at.is.null,next_retry_at.lte."${now}"`)
    .limit(limit)
  if (error) throw new Error(`agent_provider_resources scan failed: ${error.message}`)
  const done: Array<{ agentId: string; provider: string; status: string }> = []
  for (const r of data ?? []) {
    const [res] = await syncAgent(r.agent_id as string, { providers: [r.provider as 'elevenlabs' | 'cartesia'], log })
    done.push({ agentId: r.agent_id as string, provider: r.provider as string, status: res?.status ?? 'unknown' })
  }
  return done
}

const DAY_MS = 86_400_000

function retentionDays(name: string, fallback: number): number {
  const v = Number(process.env[name])
  return Number.isFinite(v) && v >= 1 ? Math.floor(v) : fallback
}

export async function pruneOperationalData(log: Logger, now = Date.now()) {
  const db = createAdminClient()
  const iso = (days: number) => new Date(now - days * DAY_MS).toISOString()
  const out: Record<string, string> = {}
  const run = async (name: string, op: () => PromiseLike<{ error: { message: string } | null }>) => {
    const { error } = await op()
    if (error) {
      log.error('maintenance.prune_failed', error, { target: name })
      out[name] = 'failed'
    } else out[name] = 'ok'
  }
  await run('provider_events', () => db.from('provider_events').delete().lt('created_at', iso(retentionDays('PROVIDER_EVENTS_RETENTION_DAYS', 30))))
  // Receipts double as the dedupe window for provider retries/replays.
  await run('webhook_events', () =>
    db.from('webhook_events').delete().in('status', ['processed', 'ignored']).lt('received_at', iso(retentionDays('WEBHOOK_EVENTS_RETENTION_DAYS', 90))),
  )
  // Dead-lettered events keep their row (audit) but not the PII payload.
  await run('webhook_payloads', () => db.from('webhook_events').update({ payload: null }).eq('status', 'failed').lt('received_at', iso(30)))
  await run('rate_limit_buckets', () => db.from('rate_limit_buckets').delete().lt('window_start', iso(2)))
  return out
}

export async function runVoiceMaintenance(log: Logger = createLogger({ component: 'voice_maintenance' })) {
  const report: Record<string, unknown> = {}
  const steps: Array<[string, () => Promise<unknown>]> = [
    ['health', () => probeProviders(log)],
    ['agent_sync_retries', () => retryAgentSyncs(20, log)],
    ['webhook_retries', () => reprocessPendingWebhooks(50, log)],
    ['cartesia_poll', () => reconcileCartesiaCalls(25, log)],
    ['stale_elevenlabs_calls', () => finalizeStaleElevenLabsCalls(50, log)],
    // Hourly is plenty for retention (the cron fires every 5 minutes).
    ...(new Date().getUTCMinutes() < 5 ? ([['retention', () => pruneOperationalData(log)]] as Array<[string, () => Promise<unknown>]>) : []),
  ]
  for (const [name, fn] of steps) {
    try {
      report[name] = await fn()
    } catch (err) {
      log.error('maintenance.step_failed', err, { step: name })
      report[name] = { error: err instanceof Error ? err.message.slice(0, 200) : 'failed' }
    }
  }
  return report
}
