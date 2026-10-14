import 'server-only'
// The commerce worker, one step of the voice maintenance cron (every 5 min
// with pg_cron, daily on the Hobby plan as a safety net): processes verified
// webhook deliveries, runs sync jobs, schedules polling, dispatches due
// automation runs, recovers expired leases and settles finished calls whose
// post-call event was lost. Every stage is bounded by the step's time
// budget, and every queue is claimed with a lease (a parallel invocation
// never processes the same row twice).

import { randomUUID } from 'node:crypto'
import type { SupabaseClient } from '@supabase/supabase-js'
import { createAdminClient } from '@/lib/supabase/admin'
import type { Logger } from '@/lib/observability/logger'
import { runIfDue } from '@/lib/voice-providers/maintenance-state'
import { commerceWorkerBudgetMs } from './config'
import { rewrapCredentials } from './connections'
import type { RunRow } from './store'
import { claimSyncJobs, runSyncJob, schedulePollingJobs } from './sync'
import { type WebhookEventRow, claimWebhookEvents, processWebhookEvent } from './webhooks/ingest'
import { claimDueRuns, dispatchRun, recoverStaleDispatches } from './automations/dispatch'
import { reconcileStaleCallingRuns } from './automations/reconcile'
import { runCommerceRetention } from './retention'

export interface WorkerReport {
  webhooks: Record<string, number>
  syncs: Record<string, number>
  polling_queued: number
  dispatch: Record<string, number>
  recovered: number
  reconciled: number
  /** Credentials re-wrapped under the current key version (key rotation housekeeping). */
  rewrapped: number
  retention: Record<string, number | string> | 'not_due'
  stopped_early: boolean
}

const WEBHOOK_BATCH = 25
const SYNC_BATCH = 3
const SYNC_SLICE_MS = 20_000
const DISPATCH_BATCH = 10

/** Runs every stage once, within `budgetMs` (default COMMERCE_WORKER_BUDGET_MS) and never past `deadline`. */
export async function runCommerceWorker(log: Logger, opts: { deadline?: number; budgetMs?: number; db?: SupabaseClient; now?: () => number } = {}): Promise<WorkerReport> {
  const db = opts.db ?? createAdminClient()
  const now = opts.now ?? Date.now
  const started = now()
  const end = Math.min(started + (opts.budgetMs ?? commerceWorkerBudgetMs()), opts.deadline ?? Number.POSITIVE_INFINITY)
  const owner = `worker:${randomUUID()}`
  const l = log.child({ component: 'commerce_worker' })
  const report: WorkerReport = { webhooks: {}, syncs: {}, polling_queued: 0, dispatch: {}, recovered: 0, reconciled: 0, rewrapped: 0, retention: 'not_due', stopped_early: false }
  const timeLeft = () => end - now()
  const bump = (bucket: Record<string, number>, key: string) => {
    bucket[key] = (bucket[key] ?? 0) + 1
  }

  // 1. Webhook deliveries: cheap, and they feed the automation queue.
  if (timeLeft() > 2_000) {
    const events = await claimWebhookEvents(db, owner, WEBHOOK_BATCH)
    for (let i = 0; i < events.length; i++) {
      if (timeLeft() < 2_000) {
        report.stopped_early = true
        await releaseWebhookEvents(db, events.slice(i), owner, l)
        break
      }
      bump(report.webhooks, await processWebhookEvent(db, events[i], owner, l))
    }
  }

  // 2. Due calls before long imports: a delayed confirmation call is the costlier failure.
  if (timeLeft() > 5_000) {
    const runs = await claimDueRuns(db, owner, DISPATCH_BATCH)
    for (let i = 0; i < runs.length; i++) {
      const run = runs[i]
      if (timeLeft() < 5_000) {
        report.stopped_early = true
        await releaseRuns(db, runs.slice(i), owner, l)
        break
      }
      try {
        bump(report.dispatch, await dispatchRun(db, run, owner, l, undefined, new Date(now())))
      } catch (err) {
        // dispatchRun settles its own failures; this is a bug or a DB outage: the lease expires and recovery settles the run.
        l.error('commerce.worker.dispatch_threw', err, { runId: run.id })
        bump(report.dispatch, 'threw')
      }
    }
  }

  // 3. Imports and refreshes, one time slice each.
  if (timeLeft() > SYNC_SLICE_MS / 2) {
    for (const job of await claimSyncJobs(db, owner, SYNC_BATCH)) {
      const slice = Math.min(SYNC_SLICE_MS, timeLeft() - 2_000)
      if (slice < 3_000) {
        report.stopped_early = true
        // Hand the lease back right away instead of letting it expire.
        await db.from('commerce_sync_jobs').update({ status: 'pending', lease_owner: null, lease_until: null, attempts: Math.max(0, job.attempts - 1) }).eq('id', job.id).eq('lease_owner', owner)
        continue
      }
      try {
        bump(report.syncs, (await runSyncJob(db, job, l, { owner, sliceMs: slice, now })).status)
      } catch (err) {
        l.error('commerce.worker.sync_threw', err, { jobId: job.id })
        bump(report.syncs, 'threw')
      }
    }
  }

  // 4. Housekeeping: cheap queries.
  try {
    report.polling_queued = await schedulePollingJobs(db, l, now())
    report.recovered = await recoverStaleDispatches(db, l, new Date(now()))
    report.reconciled = await reconcileStaleCallingRuns(db, l, new Date(now()))
    report.rewrapped = await rewrapCredentials(db, l)
  } catch (err) {
    l.error('commerce.worker.housekeeping_failed', err)
  }
  const retention = await runIfDue('commerce_retention', 24 * 3_600_000, l, () => runCommerceRetention(db, l, now()), now())
  report.retention = 'skipped' in retention ? 'not_due' : retention
  if (report.stopped_early) l.warn('commerce.worker.budget_exhausted', { elapsedMs: now() - started })
  return report
}

// A claim moves rows to processing/calling and counts an attempt. When the
// budget ends before a claimed row is reached, its lease is handed back at
// once: the attempt is refunded (a starved tick must not push a delivery
// toward dead-lettering) and a run never stays 'calling' without a dial, which
// recovery would otherwise settle as an uncertain dispatch.

async function releaseWebhookEvents(db: SupabaseClient, events: WebhookEventRow[], owner: string, log: Logger): Promise<void> {
  for (const event of events) {
    const { error } = await db
      .from('commerce_webhook_events')
      .update({ status: 'received', lease_owner: null, lease_until: null, attempts: Math.max(0, event.attempts - 1) })
      .eq('id', event.id)
      .eq('lease_owner', owner)
    if (error) log.error('commerce.worker.release_failed', error, { table: 'commerce_webhook_events', id: event.id })
  }
}

async function releaseRuns(db: SupabaseClient, runs: RunRow[], owner: string, log: Logger): Promise<void> {
  for (const run of runs) {
    // 'scheduled' is what dispatch's own deferral uses; the claim treats it like retry_waiting.
    const { error } = await db
      .from('commerce_automation_runs')
      .update({ status: 'scheduled', attempt: Math.max(0, run.attempt - 1), lease_owner: null, lease_until: null })
      .eq('id', run.id)
      .eq('lease_owner', owner)
      .is('call_id', null)
    if (error) log.error('commerce.worker.release_failed', error, { table: 'commerce_automation_runs', id: run.id })
  }
}
