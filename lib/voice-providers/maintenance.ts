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
//
// Time budget (VOICE_MAINTENANCE_BUDGET_MS): the cheap steps that keep
// billing, call data and privacy correct (the HEAD) run first, in a fixed
// order; the long ones (the TAIL: provider resources, knowledge, voices,
// rollout, account deletions) run after them with whatever budget is left.
// The tail's start rotates (maintenance_state 'maintenance_tail_rotation'):
// the next run starts at the first tail step this run had to defer, so a slow
// step can never starve the steps listed after it. Steps that accept a
// deadline get one (conversation_reconcile its own, shorter one).

import type { SupabaseClient } from '@supabase/supabase-js'
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
import { KEY_BLOCKING_CODES } from './quota-monitor'
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
      else if (h.errorCode && KEY_BLOCKING_CODES.has(h.errorCode)) {
        // A revoked / auto-disabled key, a missing permission or exhausted
        // credits fails every tenant at once: an alert, not a warning (slice G).
        log.error('maintenance.provider_blocked', null, { provider: p, code: h.errorCode })
        emitProviderEvent({ system: p, kind: 'health_check', operation: 'provider_blocked', ok: false, errorCode: h.errorCode })
      } else log.warn('maintenance.health_non_signal', { provider: p, code: h.errorCode })
    }
  }
  return out
}

const RETRY_STATUSES = ['failed', 'degraded', 'pending'] as const
/** A retry that could not run (org being deleted, provider not configured, agent gone) is looked at again after this. */
export const SKIPPED_SYNC_RETRY_DELAY_MS = 60 * 60_000

/** Orgs among `orgIds` whose account deletion was requested (empty when unreadable: syncAgent checks again). */
async function orgsBeingDeleted(db: SupabaseClient, orgIds: string[], log: Logger): Promise<Set<string>> {
  if (orgIds.length === 0) return new Set()
  const { data, error } = await db.from('organizations').select('id').in('id', orgIds).not('deletion_requested_at', 'is', null)
  if (error) {
    log.warn('maintenance.deleting_orgs_read_failed', { error: error.message.slice(0, 200) })
    return new Set()
  }
  return new Set((data ?? []).map((o) => o.id as string))
}

/**
 * Retries failed/degraded/pending provider resources whose next_retry_at has
 * passed, longest-waiting first. Rows that cannot be synced now (org being
 * deleted, provider not configured, agent gone) get next_retry_at pushed
 * forward, so they never keep the batch from reaching the others.
 */
export async function retryAgentSyncs(limit: number, log: Logger, opts: { deadline?: number; now?: number } = {}) {
  const db = createAdminClient()
  const nowMs = opts.now ?? Date.now()
  const { data, error } = await db
    .from('agent_provider_resources')
    .select('id, org_id, agent_id, provider')
    .in('status', [...RETRY_STATUSES])
    .or(`next_retry_at.is.null,next_retry_at.lte."${new Date(nowMs).toISOString()}"`)
    .order('next_retry_at', { ascending: true, nullsFirst: true })
    .limit(limit)
  if (error) throw new Error(`agent_provider_resources scan failed: ${error.message}`)
  const rows = (data ?? []) as Array<{ id: string; org_id: string; agent_id: string; provider: string }>
  const deleting = await orgsBeingDeleted(db, [...new Set(rows.map((r) => r.org_id))], log)
  const postpone = async (rowId: string) => {
    const { error: updErr } = await db
      .from('agent_provider_resources')
      .update({ next_retry_at: new Date(Date.now() + SKIPPED_SYNC_RETRY_DELAY_MS).toISOString() })
      .eq('id', rowId)
      .in('status', [...RETRY_STATUSES])
    if (updErr) log.error('maintenance.sync_postpone_failed', updErr, { rowId })
  }
  const done: Array<{ agentId: string; provider: string; status: string }> = []
  for (const r of rows) {
    if (deleting.has(r.org_id)) {
      // Account deletion in progress: never recreate what it removes.
      await postpone(r.id)
      done.push({ agentId: r.agent_id, provider: r.provider, status: 'skipped_deleting' })
      continue
    }
    if (opts.deadline !== undefined && Date.now() >= opts.deadline) {
      done.push({ agentId: r.agent_id, provider: r.provider, status: 'deferred' })
      continue
    }
    const [res] = await syncAgent(r.agent_id, { providers: [r.provider as 'elevenlabs' | 'cartesia'], log })
    // Nothing ran (agent gone, org being deleted, provider not configured, no remote agent): look again later.
    if (!res || res.status === 'skipped') await postpone(r.id)
    done.push({ agentId: r.agent_id, provider: r.provider, status: res?.status ?? 'skipped' })
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

/** A maintenance step; `deadline` (epoch ms) is the end of the run's time budget. */
export type MaintenanceStep = readonly [name: string, run: (deadline: number) => Promise<unknown>]

/** conversation_reconcile never takes more than this of the run (lost-webhook recovery, many provider GETs). */
const RECONCILE_STEP_MAX_MS = 60_000

/**
 * HEAD: cheap steps that keep billing, call data and privacy correct, in
 * order, always first. TAIL: long steps, rotated (runMaintenanceSteps).
 */
export function maintenanceSteps(log: Logger): { head: MaintenanceStep[]; tail: MaintenanceStep[] } {
  const head: MaintenanceStep[] = [
    ['health', () => probeProviders(log)],
    ['agent_sync_retries', (deadline) => retryAgentSyncs(20, log, { deadline })],
    ['webhook_retries', () => reprocessPendingWebhooks(50, log)],
    ['cartesia_poll', () => reconcileCartesiaCalls(25, log)],
    // Gets the first chance to recover a lost webhook's full result, before
    // stale_elevenlabs_calls bills from Twilio's duration.
    [
      'conversation_reconcile',
      (deadline) => import('./conversation-reconcile').then((m) => m.reconcileElevenLabsConversations({ log, deadline: Math.min(deadline, Date.now() + RECONCILE_STEP_MAX_MS) })),
    ],
    ['stale_elevenlabs_calls', () => finalizeStaleElevenLabsCalls(50, log)],
    ['web_test_finalize', () => import('./web-test').then((m) => m.finalizeStaleWebTests(100, log))],
    ['call_retention', (deadline) => import('./call-retention').then((m) => m.runCallRetention(log, Date.now(), deadline))],
    ['business_tools_retention', () => import('@/lib/voice-tools/retention').then((m) => m.runBusinessToolRetention(log))],
    // Hourly, from the stored last run (not the clock minute: the cron may be daily).
    ['retention', () => import('./maintenance-state').then((m) => m.runIfDue('retention', 3_600_000, log, () => pruneOperationalData(log)))],
    ['elevenlabs_quota', () => import('./quota-monitor').then((m) => m.runQuotaMonitor(log))],
    ['elevenlabs_workspace_health', () => import('./webhook-health').then((m) => m.runWorkspaceHealth(log))],
  ]
  const tail: MaintenanceStep[] = [
    // Agent syncs verify the platform tools themselves (verify 'cached'; a
    // 404 invalidates the memo), so they do not wait for this full check.
    ['platform_tools', () => import('./platform-tool-monitor').then((m) => m.runPlatformToolMaintenance(log))],
    ['config_rollout', () => import('./config-rollout').then((m) => m.runConfigRollout({ dryRun: false, log }))],
    // Its own budget, never past the run's deadline.
    [
      'account_deletions',
      (deadline) => import('@/lib/account/delete').then((m) => m.resumeAccountDeletions(log, { budgetMs: Math.min(m.MAINTENANCE_BUDGET_MS, Math.max(0, deadline - Date.now())) })),
    ],
    ['knowledge_retries', () => retryStaleKnowledgeDocs(2, log)],
    ['voice_saves', () => settleInterruptedVoiceSaves(5, log)],
    ['rejected_clones', () => purgeRejectedClones(5, log)],
    ['knowledge_sync', () => import('./knowledge-maintenance').then((m) => m.runKnowledgeMaintenance(log))],
    ['library_voices', () => import('./library-lifecycle').then((m) => m.checkLibraryVoices({ log }))],
    ['default_voice_migration', () => import('./default-voices').then((m) => m.runScheduledDefaultVoiceMigration(log))],
    ['voice_orphans', () => import('./voice-orphans').then((m) => m.runVoiceOrphanMaintenance(log))],
    ['voice_housekeeping', () => import('./voice-orphans').then((m) => m.runVoiceHousekeeping(log))],
  ]
  return { head, tail }
}

/** maintenance_state key holding where the next run starts the tail. */
export const TAIL_ROTATION_KEY = 'maintenance_tail_rotation'

/** Index of the tail step the next run starts with (by stored name, else stored index; 0 when unreadable). */
async function readTailStart(db: SupabaseClient, names: string[], log: Logger): Promise<number> {
  if (names.length === 0) return 0
  const { data, error } = await db.from('maintenance_state').select('details').eq('key', TAIL_ROTATION_KEY).maybeSingle()
  if (error) {
    log.warn('maintenance_state.read_failed', { key: TAIL_ROTATION_KEY, error: error.message.slice(0, 200) })
    return 0
  }
  const details = (data?.details ?? {}) as { next_step?: unknown; next_index?: unknown }
  const byName = typeof details.next_step === 'string' ? names.indexOf(details.next_step) : -1
  if (byName >= 0) return byName
  const index = Number(details.next_index)
  return Number.isInteger(index) && index >= 0 ? index % names.length : 0
}

async function writeTailStart(db: SupabaseClient, names: string[], index: number, log: Logger): Promise<void> {
  const nowIso = new Date().toISOString()
  const { error } = await db
    .from('maintenance_state')
    .upsert({ key: TAIL_ROTATION_KEY, last_run_at: nowIso, updated_at: nowIso, details: { next_index: index, next_step: names[index] ?? null } }, { onConflict: 'key' })
  if (error) log.warn('maintenance_state.write_failed', { key: TAIL_ROTATION_KEY, error: error.message.slice(0, 200) })
}

/**
 * Runs the head in order, then the tail from its stored start, while the
 * budget lasts. Steps left when the budget is spent run on a later invocation
 * (every step is bounded and idempotent); the next tail starts at the first
 * one deferred here.
 */
export async function runMaintenanceSteps(
  steps: { head: readonly MaintenanceStep[]; tail: readonly MaintenanceStep[] },
  log: Logger,
  opts: { budgetMs?: number; clock?: () => number; db?: SupabaseClient } = {},
): Promise<Record<string, unknown>> {
  const clock = opts.clock ?? Date.now
  const report: Record<string, unknown> = {}
  const startedAt = clock()
  const deadline = startedAt + (opts.budgetMs ?? maintenanceBudgetMs())
  const run = async (name: string, fn: MaintenanceStep[1]): Promise<boolean> => {
    if (clock() >= deadline) {
      report[name] = { skipped: 'time_budget' }
      log.warn('maintenance.step_deferred', { step: name, elapsedMs: clock() - startedAt })
      return false
    }
    try {
      report[name] = await fn(deadline)
    } catch (err) {
      log.error('maintenance.step_failed', err, { step: name })
      report[name] = { error: err instanceof Error ? err.message.slice(0, 200) : 'failed' }
    }
    return true
  }
  for (const [name, fn] of steps.head) await run(name, fn)

  const names = steps.tail.map(([name]) => name)
  if (names.length === 0) return report
  const db = opts.db ?? createAdminClient()
  const start = await readTailStart(db, names, log)
  let firstDeferred: number | null = null
  for (let k = 0; k < names.length; k++) {
    const i = (start + k) % names.length
    const ran = await run(names[i], steps.tail[i][1])
    if (!ran && firstDeferred === null) firstDeferred = i
  }
  // Everything ran: keep the order. Otherwise start with what was deferred.
  const next = firstDeferred ?? start
  if (firstDeferred !== null) await writeTailStart(db, names, next, log)
  report.maintenance_rotation = { tail_start: names[start], next_tail_start: names[next], deferred: firstDeferred !== null }
  return report
}

export async function runVoiceMaintenance(log: Logger = createLogger({ component: 'voice_maintenance' })) {
  return runMaintenanceSteps(maintenanceSteps(log), log)
}
