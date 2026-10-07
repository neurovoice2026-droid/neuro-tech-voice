import 'server-only'
// The durable deletion job (table account_deletions, migration 021): types,
// lease, progress and failure bookkeeping. One open job per organization; a
// run holds a lease so the request's background run and the maintenance step
// never work on the same job at once. Nothing here stores personal data:
// ids, step names, counts and short error codes only.

import crypto from 'crypto'
import type { SupabaseClient } from '@supabase/supabase-js'
import type { Logger } from '@/lib/observability/logger'
import { isProviderError } from '@/lib/voice-providers/errors'
import { redactText } from '@/lib/security/redact'
import { MAX_STEP_ATTEMPTS, isJobStep, retryDelayMs, type JobStepName } from './deletion-plan'

export type JobStatus = 'pending' | 'running' | 'completed' | 'needs_attention'
export type RequestedVia = 'self_service' | 'admin'

/** Per provider agent: whether it is ours, and where its listing stopped. */
export interface AgentCursor {
  verdict: 'ours' | 'gone' | 'foreign'
  cursor?: string | null
  listed?: boolean
  pages?: number
}

/** Resume cursors (ids and booleans only). */
export interface JobState {
  calls_after?: string | null
  calls_collected?: boolean
  sms_after?: string | null
  sms_collected?: boolean
  el_agents?: Record<string, AgentCursor>
  ct_agents?: Record<string, AgentCursor>
  agents_verified?: boolean
  storage_removed?: number
}

export interface DeletionJobRow {
  id: string
  org_id: string
  user_id: string | null
  requested_by: string | null
  requested_via: RequestedVia
  status: JobStatus
  step: JobStepName | null
  attempts: number
  last_error: string | null
  counts: Record<string, Record<string, number>>
  state: JobState
  lease_owner: string | null
  lease_until: string | null
  next_attempt_at: string
  requested_at: string
  started_at: string | null
  completed_at: string | null
  followup_done_at: string | null
}

export const JOB_COLUMNS =
  'id, org_id, user_id, requested_by, requested_via, status, step, attempts, last_error, counts, state, lease_owner, lease_until, next_attempt_at, requested_at, started_at, completed_at, followup_done_at'

/** What a step works with. `state` is persisted by the runner after each step. */
export interface StepContext {
  db: SupabaseClient
  jobId: string
  orgId: string
  userId: string | null
  state: JobState
  /** Epoch ms: long steps stop starting new work after it and return 'more'. */
  deadline: number
  log: Logger
  now: () => number
  /** Consecutive earlier failures of the current step (0 on its first run). */
  attempts: number
}

/** Thrown when another run took the job over (its lease expired): this run stops at once. */
export class LeaseLostError extends Error {
  constructor() {
    super('account deletion lease lost')
    this.name = 'LeaseLostError'
  }
}

/** A step that must be retried later (with backoff) without anything being wrong yet. */
export class RetryLaterError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'RetryLaterError'
  }
}

export function normalizeJob(row: Record<string, unknown>): DeletionJobRow {
  const step = row.step
  return {
    id: String(row.id),
    org_id: String(row.org_id),
    user_id: (row.user_id as string | null) ?? null,
    requested_by: (row.requested_by as string | null) ?? null,
    requested_via: row.requested_via === 'admin' ? 'admin' : 'self_service',
    status: (row.status as JobStatus) ?? 'pending',
    step: isJobStep(step) ? step : null,
    attempts: Number(row.attempts ?? 0),
    last_error: (row.last_error as string | null) ?? null,
    counts: (row.counts && typeof row.counts === 'object' ? row.counts : {}) as DeletionJobRow['counts'],
    state: (row.state && typeof row.state === 'object' ? row.state : {}) as JobState,
    lease_owner: (row.lease_owner as string | null) ?? null,
    lease_until: (row.lease_until as string | null) ?? null,
    next_attempt_at: String(row.next_attempt_at ?? new Date(0).toISOString()),
    requested_at: String(row.requested_at ?? ''),
    started_at: (row.started_at as string | null) ?? null,
    completed_at: (row.completed_at as string | null) ?? null,
    followup_done_at: (row.followup_done_at as string | null) ?? null,
  }
}

/** Short, log-safe error summary for last_error: a code for provider errors, never upstream bodies or numbers. */
export function errorSummary(err: unknown): string {
  if (isProviderError(err)) return `${err.system}:${err.code}${err.status ? `:${err.status}` : ''}`.slice(0, 300)
  const message = err instanceof Error ? err.message : typeof err === 'string' ? err : 'failed'
  return redactText(message).slice(0, 300)
}

export async function readJob(db: SupabaseClient, jobId: string): Promise<DeletionJobRow | null> {
  const { data, error } = await db.from('account_deletions').select(JOB_COLUMNS).eq('id', jobId).maybeSingle()
  if (error) throw new Error(`account_deletions read failed: ${error.message}`)
  return data ? normalizeJob(data as Record<string, unknown>) : null
}

/** The organization's open job (pending, running or waiting for an admin), if any. */
export async function openJobFor(db: SupabaseClient, orgId: string): Promise<DeletionJobRow | null> {
  const { data, error } = await db
    .from('account_deletions')
    .select(JOB_COLUMNS)
    .eq('org_id', orgId)
    .in('status', ['pending', 'running', 'needs_attention'])
    .order('requested_at', { ascending: false })
    .limit(1)
  if (error) throw new Error(`account_deletions read failed: ${error.message}`)
  const row = (data ?? [])[0] as Record<string, unknown> | undefined
  return row ? normalizeJob(row) : null
}

/** The organization's most recent job of any status (tombstones included). */
export async function latestJobFor(db: SupabaseClient, orgId: string): Promise<DeletionJobRow | null> {
  const { data, error } = await db.from('account_deletions').select(JOB_COLUMNS).eq('org_id', orgId).order('requested_at', { ascending: false }).limit(1)
  if (error) throw new Error(`account_deletions read failed: ${error.message}`)
  const row = (data ?? [])[0] as Record<string, unknown> | undefined
  return row ? normalizeJob(row) : null
}

export interface Lease {
  owner: string
  job: DeletionJobRow
}

/**
 * Takes the job for one run (compare-and-set on lease_owner). Refused while
 * another run's lease is valid, and for completed jobs or jobs waiting for an
 * admin.
 */
export async function claimJob(db: SupabaseClient, jobId: string, leaseMs: number, now = Date.now()): Promise<Lease | null> {
  const job = await readJob(db, jobId)
  if (!job || job.status === 'completed' || job.status === 'needs_attention') return null
  if (job.lease_owner && job.lease_until && Date.parse(job.lease_until) > now) return null
  const owner = crypto.randomUUID()
  const nowIso = new Date(now).toISOString()
  let q = db
    .from('account_deletions')
    .update({ status: 'running', lease_owner: owner, lease_until: new Date(now + leaseMs).toISOString(), started_at: job.started_at ?? nowIso })
    .eq('id', jobId)
    .in('status', ['pending', 'running'])
  q = job.lease_owner ? q.eq('lease_owner', job.lease_owner) : q.is('lease_owner', null)
  const { data, error } = await q.select(JOB_COLUMNS)
  if (error) throw new Error(`account_deletions claim failed: ${error.message}`)
  const row = (data ?? [])[0] as Record<string, unknown> | undefined
  return row ? { owner, job: normalizeJob(row) } : null
}

/** Writes `patch` only while this run still holds the lease. */
export async function updateLeased(db: SupabaseClient, lease: Lease, patch: Record<string, unknown>): Promise<void> {
  const { data, error } = await db.from('account_deletions').update(patch).eq('id', lease.job.id).eq('lease_owner', lease.owner).select('id')
  if (error) throw new Error(`account_deletions update failed: ${error.message}`)
  if (!(data ?? []).length) throw new LeaseLostError()
}

/** Records a failed step: retried with backoff, or left for an admin after MAX_STEP_ATTEMPTS. */
export async function recordFailure(
  db: SupabaseClient,
  lease: Lease,
  step: JobStepName,
  err: unknown,
  extra: { counts: DeletionJobRow['counts']; state: JobState },
  log: Logger,
  now = Date.now(),
): Promise<JobStatus> {
  const attempts = lease.job.step === step ? lease.job.attempts + 1 : 1
  const status: JobStatus = attempts >= MAX_STEP_ATTEMPTS ? 'needs_attention' : 'pending'
  const summary = errorSummary(err)
  await updateLeased(db, lease, {
    status,
    step,
    attempts,
    last_error: summary,
    counts: extra.counts,
    state: extra.state,
    lease_owner: null,
    lease_until: null,
    next_attempt_at: new Date(now + retryDelayMs(attempts)).toISOString(),
  })
  if (status === 'needs_attention') log.error('account_deletion.needs_attention', err, { step, attempts })
  else if (err instanceof RetryLaterError) log.warn('account_deletion.step_retry_later', { step, attempts, reason: summary })
  else log.error('account_deletion.step_failed', err, { step, attempts })
  return status
}
