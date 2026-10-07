import { describe, expect, it, vi } from 'vitest'
import {
  DELETION_ORDER,
  JOB_STEPS,
  MAX_STEP_ATTEMPTS,
  PREPARE_STEPS,
  isJobStep,
  nextStep,
  retryDelayMs,
  runSteps,
  type DeletionStepFn,
  type JobStepName,
} from './deletion-plan'

function steps(overrides: Partial<Record<JobStepName, DeletionStepFn<{ ran: string[] }>>> = {}) {
  const out = {} as Record<JobStepName, DeletionStepFn<{ ran: string[] }>>
  for (const s of JOB_STEPS) {
    out[s] = overrides[s] ?? (async (ctx) => (ctx.ran.push(s), { status: 'done', counts: { n: 1 } }))
  }
  return out
}

describe('deletion order', () => {
  it('blocks activity first, then stops billing before deleting anything, and deletes the sign-in last', () => {
    expect(PREPARE_STEPS).toEqual(['block_activity'])
    expect(JOB_STEPS[0]).toBe('block_activity')
    expect(DELETION_ORDER[0]).toBe('cancel_subscriptions')
    expect(DELETION_ORDER.at(-1)).toBe('delete_auth_user')
    const at = (s: JobStepName) => JOB_STEPS.indexOf(s)
    // Listed while the agents exist; numbers released before the agents go.
    expect(at('release_numbers')).toBeLessThan(at('delete_agents'))
    expect(at('collect_call_records')).toBeLessThan(at('delete_agents'))
    expect(at('delete_agents')).toBeLessThan(at('delete_call_records'))
    // Provider copies while the ids still exist; archive before the cascade.
    for (const s of ['delete_knowledge_copies', 'delete_pronunciation', 'delete_voices', 'revoke_google', 'delete_storage', 'archive_billing_records'] as const) {
      expect(at(s)).toBeLessThan(at('delete_organization'))
    }
    expect(at('delete_organization')).toBe(JOB_STEPS.length - 2)
    expect(new Set(JOB_STEPS).size).toBe(JOB_STEPS.length)
  })

  it('nextStep / isJobStep', () => {
    expect(nextStep('block_activity')).toBe('cancel_subscriptions')
    expect(nextStep('delete_auth_user')).toBeNull()
    expect(isJobStep('delete_voices')).toBe(true)
    expect(isJobStep('drop_everything')).toBe(false)
  })

  it('backs off between retries and caps the delay', () => {
    expect(retryDelayMs(1)).toBe(60_000)
    expect(retryDelayMs(3)).toBeGreaterThan(retryDelayMs(2))
    expect(retryDelayMs(MAX_STEP_ATTEMPTS + 5)).toBe(6 * 3_600_000)
  })
})

describe('runSteps', () => {
  it('runs every step in order and persists after each one', async () => {
    const ctx = { ran: [] as string[] }
    const done = vi.fn(async () => {})
    const out = await runSteps({ from: null, steps: steps(), ctx, deadline: Infinity, onStepDone: done })
    expect(out).toEqual({ kind: 'completed' })
    expect(ctx.ran).toEqual([...JOB_STEPS])
    expect(done).toHaveBeenCalledTimes(JOB_STEPS.length)
    expect(done).toHaveBeenLastCalledWith('delete_auth_user', { status: 'done', counts: { n: 1 } }, null)
  })

  it('resumes from the saved step', async () => {
    const ctx = { ran: [] as string[] }
    await runSteps({ from: 'delete_storage', steps: steps(), ctx, deadline: Infinity, onStepDone: async () => {} })
    expect(ctx.ran).toEqual(['delete_storage', 'archive_billing_records', 'delete_organization', 'delete_auth_user'])
  })

  it('a failed step stops the run and is never skipped', async () => {
    const ctx = { ran: [] as string[] }
    const boom = new Error('provider down')
    const out = await runSteps({
      from: null,
      steps: steps({ delete_agents: async () => { throw boom } }),
      ctx,
      deadline: Infinity,
      onStepDone: async () => {},
    })
    expect(out).toEqual({ kind: 'failed', step: 'delete_agents', error: boom })
    expect(ctx.ran).not.toContain('delete_call_records')
    expect(ctx.ran).not.toContain('delete_organization')
  })

  it("yields on 'more' and at the deadline (no new step starts after it)", async () => {
    const ctx = { ran: [] as string[] }
    const yielded = vi.fn(async () => {})
    const more = await runSteps({
      from: null,
      steps: steps({ delete_call_records: async () => ({ status: 'more', counts: { left: 3 } }) }),
      ctx,
      deadline: Infinity,
      onStepDone: async () => {},
      onStepYield: yielded,
    })
    expect(more).toEqual({ kind: 'yield', step: 'delete_call_records' })
    expect(yielded).toHaveBeenCalledWith('delete_call_records', { status: 'more', counts: { left: 3 } })

    let t = 0
    const late = await runSteps({ from: null, steps: steps(), ctx: { ran: [] }, deadline: 2, now: () => t++, onStepDone: async () => {} })
    expect(late).toEqual({ kind: 'yield', step: 'release_numbers' })
  })

  it('a persistence failure propagates (the caller records it; the step re-runs idempotently)', async () => {
    await expect(
      runSteps({ from: null, steps: steps(), ctx: { ran: [] }, deadline: Infinity, onStepDone: async () => { throw new Error('db down') } }),
    ).rejects.toThrow('db down')
  })
})
