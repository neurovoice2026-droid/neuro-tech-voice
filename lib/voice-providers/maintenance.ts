import 'server-only'
// Scheduled maintenance (cron → /api/cron/voice-maintenance):
//   1. health probes for both providers; results feed the circuit breaker, so
//      an open circuit is half-opened/closed by probes, not only by live calls;
//   2. retry failed/pending agent syncs whose next_retry_at has passed, and
//      resync agents whose config_revision moved ahead;
//   3. reprocess webhook events that failed or were never processed;
//   4. pull Cartesia results for fallback calls (webhooks not guaranteed),
//      recover ElevenLabs conversations whose post-call webhook was lost
//      (conversation_reconcile) and bill the rest from Twilio's duration;
//   5. retention: prune telemetry, processed webhook receipts, expired
//      rate-limit windows and payloads of dead-lettered webhooks, hourly from
//      a stored last-run timestamp (maintenance-state.ts), whatever the cron
//      cadence (daily on Vercel Hobby, every 5 minutes with pg_cron).
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
import { processDocument, STALE_PROCESSING_MS } from './knowledge'
import { purgeRejectedClones } from './voice-catalog'
import { VOICE_PROVIDERS, isHealthSignalCode, type ProviderErrorCode } from './errors'
import type { ProviderHealth } from './types'

export async function probeProviders(log: Logger): Promise<ProviderHealth[]> {
  const out: ProviderHealth[] = []
  for (const p of VOICE_PROVIDERS) {
    const h = await LIFECYCLES[p].health()
    out.push(h)
    emitProviderEvent({ system: p, kind: 'health_check', ok: h.ok, latencyMs: h.latencyMs, errorCode: h.errorCode })
    if (h.configured) {
      // The API probe feeds the provider's API circuit only; the media
      // circuit is driven by real call outcomes (router / call-store).
      if (h.ok) await reportOutcome(p, { ok: true })
      else if (h.errorCode && isHealthSignalCode(h.errorCode as ProviderErrorCode)) await reportOutcome(p, { ok: false, code: h.errorCode as ProviderErrorCode })
      else log.warn('maintenance.health_non_signal', { provider: p, code: h.errorCode })
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

/**
 * Knowledge documents stuck in 'processing' (abandoned run, or reset by
 * migration 010 because the old code never attached them) are resumed here;
 * processDocument verifies an existing ElevenLabs doc before re-uploading.
 * Failed documents are left for the owner to retry (bad file, too large…).
 */
export async function retryStaleKnowledgeDocs(limit: number, log: Logger) {
  const db = createAdminClient()
  const cutoff = new Date(Date.now() - STALE_PROCESSING_MS).toISOString()
  const { data, error } = await db
    .from('knowledge_documents')
    .select('id, org_id')
    .eq('status', 'processing')
    .lt('updated_at', cutoff)
    .lt('attempt_count', 5)
    .order('updated_at', { ascending: true })
    .limit(limit)
  if (error) throw new Error(`knowledge_documents scan failed: ${error.message}`)
  const out: Record<string, number> = {}
  for (const d of data ?? []) {
    try {
      const doc = await processDocument(d.org_id as string, d.id as string, log, { mode: 'retry' })
      out[doc.status] = (out[doc.status] ?? 0) + 1
    } catch (err) {
      log.error('maintenance.knowledge_retry_failed', err, { docId: d.id, orgId: d.org_id })
      out.error = (out.error ?? 0) + 1
    }
  }
  return out
}

/**
 * A voice save interrupted mid-flight (function timeout) leaves
 * voice_sync_status 'saving'. Re-sync those agents: the sync reads the agent
 * back from ElevenLabs and settles the status to synced/failed.
 */
export async function settleInterruptedVoiceSaves(limit: number, log: Logger) {
  const db = createAdminClient()
  const cutoff = new Date(Date.now() - 5 * 60_000).toISOString()
  const { data, error } = await db
    .from('agents')
    .select('id')
    .eq('voice_sync_status', 'saving')
    .or(`voice_sync_started_at.is.null,voice_sync_started_at.lt."${cutoff}"`)
    .order('voice_sync_started_at', { ascending: true, nullsFirst: true })
    .limit(limit)
  if (error) throw new Error(`agents scan failed: ${error.message}`)
  for (const a of data ?? []) {
    try {
      const [res] = await syncAgent(a.id as string, { providers: ['elevenlabs'], force: true, log })
      // A ready sync settles the status itself (agent-sync reconcileVoiceStatus);
      // otherwise end the stuck save as failed so the owner can retry.
      if (!res || res.status !== 'ready' || !res.appliedVoiceId) {
        const { error: updErr } = await db
          .from('agents')
          .update({ voice_sync_status: 'failed', voice_sync_error: 'The voice could not be applied. Retry or choose another voice.', voice_sync_started_at: null })
          .eq('id', a.id)
          .eq('voice_sync_status', 'saving')
        if (updErr) log.error('maintenance.voice_settle_write_failed', updErr, { agentId: a.id })
      }
    } catch (err) {
      log.error('maintenance.voice_settle_failed', err, { agentId: a.id })
    }
  }
  return { settled: data?.length ?? 0 }
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
  await run('webhook_payloads', () =>
    db.from('webhook_events').update({ payload: null }).eq('status', 'failed').lt('received_at', iso(retentionDays('WEBHOOK_PAYLOAD_RETENTION_DAYS', 30))),
  )
  await run('rate_limit_buckets', () => db.from('rate_limit_buckets').delete().lt('window_start', iso(2)))
  return out
}

/** Wall-clock budget of one maintenance run (VOICE_MAINTENANCE_BUDGET_MS, 30 s – 270 s, default 240 s). */
export function maintenanceBudgetMs(): number {
  const v = Number(process.env.VOICE_MAINTENANCE_BUDGET_MS)
  return Number.isFinite(v) && v >= 30_000 && v <= 270_000 ? Math.floor(v) : 240_000
}

export async function runVoiceMaintenance(log: Logger = createLogger({ component: 'voice_maintenance' })) {
  const report: Record<string, unknown> = {}
  const steps: Array<[string, () => Promise<unknown>]> = [
    ['health', () => probeProviders(log)],
    ['agent_sync_retries', () => retryAgentSyncs(20, log)],
    ['config_rollout', () => import('./config-rollout').then((m) => m.runConfigRollout({ dryRun: false, log }))],
    ['webhook_retries', () => reprocessPendingWebhooks(50, log)],
    ['cartesia_poll', () => reconcileCartesiaCalls(25, log)],
    ['conversation_reconcile', () => import('./conversation-reconcile').then((m) => m.reconcileElevenLabsConversations({ log }))],
    ['stale_elevenlabs_calls', () => finalizeStaleElevenLabsCalls(50, log)],
    ['knowledge_retries', () => retryStaleKnowledgeDocs(2, log)],
    ['voice_saves', () => settleInterruptedVoiceSaves(5, log)],
    ['rejected_clones', () => purgeRejectedClones(5, log)],
    ['knowledge_sync', () => import('./knowledge-maintenance').then((m) => m.runKnowledgeMaintenance(log))],
    ['library_voices', () => import('./library-lifecycle').then((m) => m.checkLibraryVoices({ log }))],
    ['default_voice_migration', () => import('./default-voices').then((m) => m.runScheduledDefaultVoiceMigration(log))],
    ['voice_orphans', () => import('./voice-orphans').then((m) => m.runVoiceOrphanMaintenance(log))],
    ['voice_housekeeping', () => import('./voice-orphans').then((m) => m.runVoiceHousekeeping(log))],
    ['elevenlabs_workspace_health', () => import('./webhook-health').then((m) => m.runWorkspaceHealth(log))],
    ['call_retention', () => import('./call-retention').then((m) => m.runCallRetention(log))],
    // Hourly, from the stored last run (not the clock minute: the cron may be daily).
    ['retention', () => import('./maintenance-state').then((m) => m.runIfDue('retention', 3_600_000, log, () => pruneOperationalData(log)))],
  ]
  // The route's maxDuration is 300 s: steps left when the budget is spent run
  // on the next invocation (every step is bounded and idempotent).
  const startedAt = Date.now()
  const budgetMs = maintenanceBudgetMs()
  for (const [name, fn] of steps) {
    if (Date.now() - startedAt > budgetMs) {
      report[name] = { skipped: 'time_budget' }
      log.warn('maintenance.step_deferred', { step: name, elapsedMs: Date.now() - startedAt })
      continue
    }
    try {
      report[name] = await fn()
    } catch (err) {
      log.error('maintenance.step_failed', err, { step: name })
      report[name] = { error: err instanceof Error ? err.message.slice(0, 200) : 'failed' }
    }
  }
  return report
}
