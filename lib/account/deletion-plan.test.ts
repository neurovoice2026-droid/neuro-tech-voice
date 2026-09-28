import { describe, expect, it, vi } from 'vitest'
import {
  AccountDeletionError,
  DELETION_ORDER,
  runDeletionPlan,
  type DeletionStep,
  type DeletionStepName,
} from './deletion-plan'

type Inventory = { orgId: string }

function makeSteps(calls: string[], overrides: Partial<Record<DeletionStepName, DeletionStep<Inventory>>> = {}) {
  return Object.fromEntries(
    DELETION_ORDER.map((name) => [
      name,
      async (inventory: Inventory) => {
        calls.push(name)
        expect(inventory.orgId).toBe('org-1')
        const override = overrides[name]
        return override ? override(inventory) : `${name} done`
      },
    ])
  ) as Record<DeletionStepName, DeletionStep<Inventory>>
}

describe('runDeletionPlan', () => {
  it('stops billing first and deletes the organization and then the sign-in last', async () => {
    const calls: string[] = []
    const results = await runDeletionPlan({
      orgId: 'org-1',
      loadInventory: async () => {
        calls.push('load_inventory')
        return { orgId: 'org-1' }
      },
      steps: makeSteps(calls),
    })

    expect(calls[0]).toBe('load_inventory')
    expect(calls[1]).toBe('cancel_subscriptions')
    expect(calls.at(-2)).toBe('delete_organization')
    expect(calls.at(-1)).toBe('delete_auth_user')
    // Provider copies go while the rows that reference them still exist.
    for (const providerStep of ['release_numbers', 'delete_agents', 'delete_voices', 'delete_call_records', 'revoke_google', 'delete_storage']) {
      expect(calls.indexOf(providerStep)).toBeLessThan(calls.indexOf('delete_organization'))
    }
    // Documents are removed from providers before their agents are.
    expect(calls.indexOf('delete_knowledge_copies')).toBeLessThan(calls.indexOf('delete_agents'))
    expect(results.every((r) => r.ok)).toBe(true)
    expect(results).toHaveLength(DELETION_ORDER.length + 1)
  })

  it('continues past provider failures and logs them', async () => {
    const calls: string[] = []
    const log = vi.fn()
    const results = await runDeletionPlan({
      orgId: 'org-1',
      loadInventory: async () => ({ orgId: 'org-1' }),
      steps: makeSteps(calls, {
        cancel_subscriptions: async () => {
          throw new Error('Stripe timed out')
        },
        release_numbers: async () => {
          throw new Error('1 of 2 numbers could not be released')
        },
      }),
      log,
    })

    expect(calls).toEqual([...DELETION_ORDER])
    const failed = results.filter((r) => !r.ok).map((r) => r.step)
    expect(failed).toEqual(['cancel_subscriptions', 'release_numbers'])
    expect(log).toHaveBeenCalledWith(expect.objectContaining({ org_id: 'org-1', step: 'cancel_subscriptions', ok: false, detail: 'Stripe timed out' }))
    expect(log).toHaveBeenCalledTimes(DELETION_ORDER.length + 1)
  })

  it('never deletes the sign-in when the organization row could not be deleted', async () => {
    const calls: string[] = []
    const run = runDeletionPlan({
      orgId: 'org-1',
      loadInventory: async () => ({ orgId: 'org-1' }),
      steps: makeSteps(calls, {
        delete_organization: async () => {
          throw new Error('permission denied')
        },
      }),
    })

    await expect(run).rejects.toBeInstanceOf(AccountDeletionError)
    await run.catch((error: AccountDeletionError) => {
      expect(error.step).toBe('delete_organization')
      expect(error.results.at(-1)).toMatchObject({ step: 'delete_organization', ok: false })
    })
    expect(calls).not.toContain('delete_auth_user')
  })

  it('does nothing when the account cannot be read first', async () => {
    const calls: string[] = []
    await expect(
      runDeletionPlan({
        orgId: 'org-1',
        loadInventory: async () => {
          throw new Error('db down')
        },
        steps: makeSteps(calls),
      })
    ).rejects.toMatchObject({ step: 'load_inventory' })
    expect(calls).toEqual([])
  })

  it('reports a failed sign-in deletion as critical after the data is gone', async () => {
    const calls: string[] = []
    await expect(
      runDeletionPlan({
        orgId: 'org-1',
        loadInventory: async () => ({ orgId: 'org-1' }),
        steps: makeSteps(calls, {
          delete_auth_user: async () => {
            throw new Error('auth admin unavailable')
          },
        }),
      })
    ).rejects.toMatchObject({ step: 'delete_auth_user' })
    expect(calls).toContain('delete_organization')
  })
})
