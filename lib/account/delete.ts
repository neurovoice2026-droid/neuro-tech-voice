import 'server-only'
// Account deletion (GDPR Art. 17 erasure across every provider) as a durable,
// resumable job:
//   requestAccountDeletion → one account_deletions row per organization (a
//     second request reuses it) and the organization marked as being deleted;
//   runAccountDeletion → runs the steps of deletion-plan.ts under a lease,
//     within a time budget, saving progress after every step;
//   resumeAccountDeletions → the maintenance step: continues jobs that
//     yielded, retries failed steps with backoff, runs the post-deletion
//     storage sweep and purges archives past their legal retention.
// The step implementations live in ./steps/*. Every external id they use is
// read from the organization's own rows (or listed by its verified agent);
// platform-wide resources (library voices, platform tools, workspace webhooks
// and secrets) are never touched.

import type { SupabaseClient } from '@supabase/supabase-js'
import { createAdminClient } from '@/lib/supabase/admin'
import { createLogger, type Logger } from '@/lib/observability/logger'
import { RequestError } from '@/lib/api/http'
import { JOB_STEPS, runSteps, type DeletionStepFn, type JobStepName, type RunOutcome } from './deletion-plan'
import {
  JOB_COLUMNS,
  LeaseLostError,
  claimJob,
  normalizeJob,
  openJobFor,
  recordFailure,
  updateLeased,
  type DeletionJobRow,
  type JobStatus,
  type Lease,
  type RequestedVia,
  type StepContext,
} from './job'
import { blockActivity } from './steps/block'
import { archiveBillingRecords, cancelSubscriptions } from './steps/billing'
import { releaseNumbers } from './steps/telephony'
import { collectCallRecords, deleteCallRecords } from './steps/call-records'
import { deleteAgents } from './steps/agents'
import { deleteKnowledgeCopies, deletePronunciation, deleteVoices } from './steps/content'
import { revokeGoogle } from './steps/google'
import { deleteOrgStorage, deleteStorage } from './steps/storage'
import { deleteAuthUser, deleteOrganization } from './steps/final'

export type { DeletionJobRow } from './job'

export const STEPS: Record<JobStepName, DeletionStepFn<StepContext>> = {
  block_activity: blockActivity,
  cancel_subscriptions: cancelSubscriptions,
  release_numbers: releaseNumbers,
  collect_call_records: collectCallRecords,
  delete_agents: deleteAgents,
  delete_call_records: deleteCallRecords,
  delete_knowledge_copies: deleteKnowledgeCopies,
  delete_pronunciation: deletePronunciation,
  delete_voices: deleteVoices,
  revoke_google: revokeGoogle,
  delete_storage: deleteStorage,
  archive_billing_records: archiveBillingRecords,
  delete_organization: deleteOrganization,
  delete_auth_user: deleteAuthUser,
}

/** Budget of the run started by the request (the route's maxDuration is 300 s). */
export const REQUEST_RUN_BUDGET_MS = 240_000
/** Budget of all deletion work in one maintenance run. */
export const MAINTENANCE_BUDGET_MS = 90_000
/** A run may overrun its budget by one provider request: the lease covers it. */
const LEASE_MARGIN_MS = 120_000
/** The post-deletion storage sweep runs this long after completion (signed upload URLs live 2 h). */
export const FOLLOWUP_DELAY_MS = 3 * 3_600_000
const MAINTENANCE_JOBS_PER_RUN = 5

export interface RequestResult {
  job: DeletionJobRow
  created: boolean
  /** An admin restarted a job that was waiting for attention. */
  reopened: boolean
}

/**
 * Opens the organization's deletion job (or returns the open one) and marks
 * the organization as being deleted. Throws RequestError 404 for an unknown
 * organization. Only an admin request reopens a job waiting for attention.
 */
export async function requestAccountDeletion(params: {
  orgId: string
  requestedBy: string | null
  via: RequestedVia
  log?: Logger
  db?: SupabaseClient
}): Promise<RequestResult> {
  const db = params.db ?? createAdminClient()
  const log = (params.log ?? createLogger()).child({ orgId: params.orgId, component: 'account_deletion' })
  const { data: org, error } = await db.from('organizations').select('id, user_id').eq('id', params.orgId).maybeSingle()
  if (error) throw new Error(`organizations read failed: ${error.message}`)
  if (!org) throw new RequestError('not_found', 'Organization not found.', 404)

  let job = await openJobFor(db, params.orgId)
  let created = false
  let reopened = false
  if (job?.status === 'needs_attention' && params.via === 'admin') {
    const { data, error: reopenErr } = await db
      .from('account_deletions')
      .update({ status: 'pending', attempts: 0, last_error: null, next_attempt_at: new Date().toISOString(), lease_owner: null, lease_until: null })
      .eq('id', job.id)
      .eq('status', 'needs_attention')
      .select(JOB_COLUMNS)
    if (reopenErr) throw new Error(`account_deletions reopen failed: ${reopenErr.message}`)
    const row = (data ?? [])[0] as Record<string, unknown> | undefined
    if (row) {
      job = normalizeJob(row)
      reopened = true
      log.warn('account_deletion.reopened', { deletionId: job.id, step: job.step })
    }
  }
  if (!job) {
    const { data, error: insertErr } = await db
      .from('account_deletions')
      .insert({
        org_id: params.orgId,
        user_id: (org.user_id as string | null) ?? null,
        requested_by: params.requestedBy,
        requested_via: params.via,
        status: 'pending',
        step: JOB_STEPS[0],
        next_attempt_at: new Date().toISOString(),
      })
      .select(JOB_COLUMNS)
      .single()
    if (insertErr) {
      // A concurrent request opened it first (one open job per organization).
      if ((insertErr as { code?: string }).code !== '23505') throw new Error(`account_deletions insert failed: ${insertErr.message}`)
      job = await openJobFor(db, params.orgId)
      if (!job) throw new Error('account_deletions: concurrent job not found')
    } else {
      job = normalizeJob(data as Record<string, unknown>)
      created = true
      log.info('account_deletion.requested', { deletionId: job.id, via: params.via })
    }
  }
  // Blocks tenant API calls at once; the job's first step repeats it.
  const { error: markErr } = await db
    .from('organizations')
    .update({ deletion_requested_at: new Date().toISOString() })
    .eq('id', params.orgId)
    .is('deletion_requested_at', null)
  if (markErr) log.error('account_deletion.mark_failed', markErr)
  return { job, created, reopened }
}

export interface RunReport {
  jobId: string
  ran: boolean
  outcome?: RunOutcome['kind'] | 'lease_lost'
  status?: JobStatus
  step?: JobStepName | null
}

/**
 * Runs one job for at most `budgetMs`. Safe to call concurrently (the lease
 * lets one run through) and to call again after any failure: every step is
 * idempotent and the job resumes from its saved step and cursors.
 */
export async function runAccountDeletion(
  jobId: string,
  opts: { log?: Logger; budgetMs?: number; now?: () => number; db?: SupabaseClient } = {},
): Promise<RunReport> {
  const db = opts.db ?? createAdminClient()
  const now = opts.now ?? (() => Date.now())
  const budget = opts.budgetMs ?? REQUEST_RUN_BUDGET_MS
  const deadline = now() + budget
  const lease = await claimJob(db, jobId, budget + LEASE_MARGIN_MS, now())
  if (!lease) return { jobId, ran: false }
  const job = lease.job
  const log = (opts.log ?? createLogger()).child({ orgId: job.org_id, component: 'account_deletion', deletionId: job.id })
  const ctx: StepContext = {
    db,
    jobId: job.id,
    orgId: job.org_id,
    userId: job.user_id,
    state: structuredClone(job.state ?? {}),
    deadline,
    log,
    now,
    attempts: job.attempts,
  }
  const counts: DeletionJobRow['counts'] = { ...job.counts }
  let current: JobStepName = job.step ?? JOB_STEPS[0]
  let outcome: RunOutcome
  try {
    outcome = await runSteps({
      from: current,
      steps: STEPS,
      ctx,
      deadline,
      now,
      onStepDone: async (step, out, next) => {
        if (out.counts) counts[step] = out.counts
        log.info('account_deletion.step_done', { step, counts: out.counts ?? {} })
        if (next) {
          await updateLeased(db, lease, { step: next, attempts: 0, last_error: null, counts, state: ctx.state })
          current = next
          ctx.attempts = 0
        }
      },
      onStepYield: async (step, out) => {
        if (out.counts) counts[step] = out.counts
        await updateLeased(db, lease, { counts, state: ctx.state })
      },
    })
  } catch (err) {
    if (err instanceof LeaseLostError) {
      log.warn('account_deletion.lease_lost', { step: current })
      return { jobId, ran: true, outcome: 'lease_lost' }
    }
    // Progress could not be saved: the step that just finished runs again next time (idempotent).
    outcome = { kind: 'failed', step: current, error: err }
  }
  return finish(db, lease, outcome, counts, ctx, log)
}

async function finish(
  db: SupabaseClient,
  lease: Lease,
  outcome: RunOutcome,
  counts: DeletionJobRow['counts'],
  ctx: StepContext,
  log: Logger,
): Promise<RunReport> {
  const jobId = lease.job.id
  try {
    if (outcome.kind === 'completed') {
      // The provider ids are no longer needed once everything is deleted.
      const { error: itemsErr } = await db.from('account_deletion_items').delete().eq('deletion_id', jobId)
      if (itemsErr) log.error('account_deletion.items_cleanup_failed', itemsErr)
      await updateLeased(db, lease, {
        status: 'completed',
        step: null,
        attempts: 0,
        last_error: null,
        counts,
        state: {},
        lease_owner: null,
        lease_until: null,
        completed_at: new Date(ctx.now()).toISOString(),
      })
      log.info('account_deletion.completed', { counts })
      return { jobId, ran: true, outcome: 'completed', status: 'completed', step: null }
    }
    if (outcome.kind === 'yield') {
      await updateLeased(db, lease, {
        status: 'pending',
        step: outcome.step,
        counts,
        state: ctx.state,
        lease_owner: null,
        lease_until: null,
        next_attempt_at: new Date(ctx.now()).toISOString(),
      })
      log.info('account_deletion.yielded', { step: outcome.step })
      return { jobId, ran: true, outcome: 'yield', status: 'pending', step: outcome.step }
    }
    const status = await recordFailure(db, lease, outcome.step, outcome.error, { counts, state: ctx.state }, log, ctx.now())
    return { jobId, ran: true, outcome: 'failed', status, step: outcome.step }
  } catch (err) {
    if (err instanceof LeaseLostError) {
      log.warn('account_deletion.lease_lost')
      return { jobId, ran: true, outcome: 'lease_lost' }
    }
    // The lease expires on its own; the maintenance step resumes the job.
    log.error('account_deletion.finish_failed', err)
    return { jobId, ran: true, outcome: outcome.kind }
  }
}

/**
 * Maintenance step `account_deletions`: continues due jobs within a time
 * budget, then the post-deletion storage sweep and the archive retention.
 */
export async function resumeAccountDeletions(
  log: Logger,
  opts: { budgetMs?: number; now?: () => number; db?: SupabaseClient } = {},
): Promise<Record<string, unknown>> {
  const db = opts.db ?? createAdminClient()
  const now = opts.now ?? (() => Date.now())
  const startedAt = now()
  const budget = opts.budgetMs ?? MAINTENANCE_BUDGET_MS
  const report: { runs: RunReport[]; followups: number; archives_purged: number } = { runs: [], followups: 0, archives_purged: 0 }

  const { data: due, error } = await db
    .from('account_deletions')
    .select('id')
    .in('status', ['pending', 'running'])
    .lte('next_attempt_at', new Date(startedAt).toISOString())
    .order('next_attempt_at', { ascending: true })
    .limit(MAINTENANCE_JOBS_PER_RUN)
  if (error) throw new Error(`account_deletions scan failed: ${error.message}`)
  for (const row of due ?? []) {
    const left = budget - (now() - startedAt)
    if (left < 15_000) break
    try {
      report.runs.push(await runAccountDeletion(row.id as string, { log, budgetMs: Math.min(60_000, left), now, db }))
    } catch (err) {
      log.error('account_deletion.resume_failed', err, { deletionId: row.id })
    }
  }

  report.followups = await runFollowups(db, log, now)
  report.archives_purged = await purgeExpiredArchives(db, log, now)
  return {
    jobs: report.runs.length,
    completed: report.runs.filter((r) => r.outcome === 'completed').length,
    failed: report.runs.filter((r) => r.outcome === 'failed').length,
    followups: report.followups,
    archives_purged: report.archives_purged,
  }
}

/** Storage sweep a few hours after completion (late uploads through an earlier signed URL). */
async function runFollowups(db: SupabaseClient, log: Logger, now: () => number): Promise<number> {
  const cutoff = new Date(now() - FOLLOWUP_DELAY_MS).toISOString()
  const { data, error } = await db
    .from('account_deletions')
    .select('id, org_id')
    .eq('status', 'completed')
    .is('followup_done_at', null)
    .lte('completed_at', cutoff)
    .order('completed_at', { ascending: true })
    .limit(MAINTENANCE_JOBS_PER_RUN)
  if (error) throw new Error(`account_deletions followup scan failed: ${error.message}`)
  let done = 0
  for (const row of data ?? []) {
    try {
      const res = await deleteOrgStorage(db, row.org_id as string)
      if (res.removed) log.warn('account_deletion.late_files_removed', { deletionId: row.id, orgId: row.org_id, files: res.removed })
      if (res.more) continue
      const { error: updErr } = await db.from('account_deletions').update({ followup_done_at: new Date(now()).toISOString() }).eq('id', row.id)
      if (updErr) throw new Error(`account_deletions update failed: ${updErr.message}`)
      done++
    } catch (err) {
      log.error('account_deletion.followup_failed', err, { deletionId: row.id })
    }
  }
  return done
}

/** Archived invoices and usage totals past their legal retention (end of year + 10 years). */
async function purgeExpiredArchives(db: SupabaseClient, log: Logger, now: () => number): Promise<number> {
  const today = new Date(now()).toISOString().slice(0, 10)
  let purged = 0
  for (const table of ['invoices_archive', 'usage_archive'] as const) {
    // Rows expire once a year (31 Dec): one bounded statement per table.
    const { count, error } = await db.from(table).delete({ count: 'exact' }).lt('retain_until', today)
    if (error) {
      log.error('account_deletion.archive_purge_failed', error, { table })
      continue
    }
    purged += count ?? 0
  }
  return purged
}
