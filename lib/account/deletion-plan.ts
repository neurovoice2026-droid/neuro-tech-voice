// Order and failure policy for closing an account. Pure orchestration (no
// provider or database imports) so the ordering rules are unit-tested; the
// step implementations and the durable job live in lib/account/delete.ts
// (job, lease, retries) and lib/account/steps/* (one module per area).
//
// Rules:
// - New activity is blocked before anything is deleted (PREPARE_STEPS: the
//   organization is marked as being deleted, its agent paused, the sign-in
//   banned), so nothing re-creates what the next steps remove.
// - Stop the money first: subscriptions are cancelled before any data is
//   deleted, so a later failure can never leave the customer billed for a
//   closed account.
// - Provider copies (numbers, agents, call records, documents, voices,
//   Google access, stored files) are removed while the database still holds
//   their ids. Every step is idempotent and treats "already gone" as done.
//   A step that fails is retried later from where it stopped (the job is
//   durable); later steps never run before it succeeds, so the ids it needs
//   are never deleted from under it. Single resources that keep failing are
//   given up on and counted, so one bad id cannot block the erasure.
// - Records the law requires (invoices, monthly usage totals) are archived,
//   then the organization row (cascades every table) and the sign-in are
//   deleted last. The job row stays as a tombstone without personal data.

export type PrepareStepName = 'block_activity'

export type DeletionStepName =
  | 'cancel_subscriptions'
  | 'release_numbers'
  | 'collect_call_records'
  | 'delete_agents'
  | 'delete_call_records'
  | 'delete_knowledge_copies'
  | 'delete_pronunciation'
  | 'delete_voices'
  | 'revoke_google'
  | 'delete_storage'
  | 'archive_billing_records'
  | 'delete_organization'
  | 'delete_auth_user'

export type JobStepName = PrepareStepName | DeletionStepName

/** Runs before the deletion steps: blocks new activity (nothing is deleted yet). */
export const PREPARE_STEPS: readonly PrepareStepName[] = ['block_activity'] as const

/**
 * The deletion steps, in order. The first (billing) and the last (sign-in)
 * are quoted by the marketing pages (lib/pages/custom-mobile-applications.ts).
 */
export const DELETION_ORDER: readonly DeletionStepName[] = [
  'cancel_subscriptions',
  'release_numbers',
  // Listed while the agents still exist (listing a deleted agent's conversations is undocumented).
  'collect_call_records',
  'delete_agents',
  'delete_call_records',
  'delete_knowledge_copies',
  'delete_pronunciation',
  'delete_voices',
  'revoke_google',
  'delete_storage',
  'archive_billing_records',
  'delete_organization',
  'delete_auth_user',
] as const

/** Every step of a deletion job, in execution order. */
export const JOB_STEPS: readonly JobStepName[] = [...PREPARE_STEPS, ...DELETION_ORDER]

export function isJobStep(value: unknown): value is JobStepName {
  return typeof value === 'string' && (JOB_STEPS as readonly string[]).includes(value)
}

/** The step after `step`, or null when it was the last one. */
export function nextStep(step: JobStepName): JobStepName | null {
  const i = JOB_STEPS.indexOf(step)
  return i >= 0 && i + 1 < JOB_STEPS.length ? JOB_STEPS[i + 1] : null
}

/** 'done': the step finished. 'more': it stopped at the time budget and resumes on the next run. */
export interface StepOutcome {
  status: 'done' | 'more'
  /** Log-safe counts for the tombstone (numbers only: never ids, names or provider bodies). */
  counts?: Record<string, number>
}

export type DeletionStepFn<C> = (ctx: C) => Promise<StepOutcome>

export type RunOutcome =
  | { kind: 'completed' }
  | { kind: 'yield'; step: JobStepName }
  | { kind: 'failed'; step: JobStepName; error: unknown }

export interface RunStepsInput<C> {
  /** Where to start (the job's current step); null starts at the beginning. */
  from: JobStepName | null
  steps: Record<JobStepName, DeletionStepFn<C>>
  ctx: C
  /** Epoch ms after which no new step starts. */
  deadline: number
  now?: () => number
  /** Persists progress after each step (the next step, its counts). Throwing stops the run. */
  onStepDone: (step: JobStepName, outcome: StepOutcome, next: JobStepName | null) => Promise<void>
  /** Persists the counts of a step that stopped at the time budget. */
  onStepYield?: (step: JobStepName, outcome: StepOutcome) => Promise<void>
}

/**
 * Runs the steps from `from` in order until all are done, the time budget is
 * spent, a step yields, or a step fails. A failed step is never skipped: the
 * caller records the failure and retries the same step later.
 */
export async function runSteps<C>(input: RunStepsInput<C>): Promise<RunOutcome> {
  const now = input.now ?? (() => Date.now())
  let step: JobStepName | null = input.from ?? JOB_STEPS[0]
  if (!isJobStep(step)) throw new Error('runSteps: unknown step')
  while (step) {
    if (now() >= input.deadline) return { kind: 'yield', step }
    let outcome: StepOutcome
    try {
      outcome = await input.steps[step](input.ctx)
    } catch (error) {
      return { kind: 'failed', step, error }
    }
    if (outcome.status === 'more') {
      await input.onStepYield?.(step, outcome)
      return { kind: 'yield', step }
    }
    const next = nextStep(step)
    await input.onStepDone(step, outcome, next)
    step = next
  }
  return { kind: 'completed' }
}

/** Seconds to wait before retrying a failed step, by consecutive failures (1-based). */
export function retryDelayMs(attempts: number): number {
  const ladder = [60_000, 2 * 60_000, 5 * 60_000, 15 * 60_000, 30 * 60_000, 3_600_000, 3 * 3_600_000, 6 * 3_600_000]
  return ladder[Math.min(Math.max(1, attempts), ladder.length) - 1]
}

/** Consecutive failures of one step after which the job waits for an admin (needs_attention). */
export const MAX_STEP_ATTEMPTS = 8
