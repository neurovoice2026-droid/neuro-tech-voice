// Order and failure policy for closing an account. Pure orchestration (no
// provider or database imports) so the ordering rules are unit-tested; the
// real steps live in lib/account/delete.ts.
//
// Rules:
// - Stop the money first: subscriptions are cancelled before anything else,
//   so a later failure can never leave the customer billed for a closed account.
// - Provider copies (numbers, agents, voices, documents, call records, Google
//   access, storage) are removed while the database still tells us their ids.
//   A provider failure is logged and the deletion continues: the customer asked
//   for their data to go, and one flaky API must not keep everything else.
// - The organization row (cascades every table) and then the sign-in are
//   deleted last. Those two are critical: if one fails we stop and report it.

export type DeletionStepName =
  | 'cancel_subscriptions'
  | 'release_numbers'
  | 'delete_knowledge_copies'
  | 'delete_agents'
  | 'delete_voices'
  | 'delete_call_records'
  | 'revoke_google'
  | 'delete_storage'
  | 'delete_organization'
  | 'delete_auth_user'

export const DELETION_ORDER: readonly DeletionStepName[] = [
  'cancel_subscriptions',
  'release_numbers',
  'delete_knowledge_copies',
  'delete_agents',
  'delete_voices',
  'delete_call_records',
  'revoke_google',
  'delete_storage',
  'delete_organization',
  'delete_auth_user',
] as const

export const CRITICAL_DELETION_STEPS: ReadonlySet<DeletionStepName | 'load_inventory'> = new Set([
  'load_inventory',
  'delete_organization',
  'delete_auth_user',
])

export interface DeletionStepResult {
  step: DeletionStepName | 'load_inventory'
  ok: boolean
  /** Short, log-safe summary ("2 subscriptions cancelled"); never provider bodies. */
  detail: string | null
  duration_ms: number
}

export class AccountDeletionError extends Error {
  readonly step: DeletionStepResult['step']
  readonly results: DeletionStepResult[]

  constructor(step: DeletionStepResult['step'], message: string, results: DeletionStepResult[]) {
    super(message)
    this.name = 'AccountDeletionError'
    this.step = step
    this.results = results
  }
}

/** A step returns a short summary, or throws when (part of) it failed. */
export type DeletionStep<I> = (inventory: I) => Promise<string | void>

export interface DeletionPlanInput<I> {
  orgId: string
  loadInventory: () => Promise<I>
  steps: Record<DeletionStepName, DeletionStep<I>>
  log?: (entry: { org_id: string } & DeletionStepResult) => void
  now?: () => number
}

function errorSummary(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error)
  return message.slice(0, 300)
}

export async function runDeletionPlan<I>(input: DeletionPlanInput<I>): Promise<DeletionStepResult[]> {
  const now = input.now ?? (() => Date.now())
  const results: DeletionStepResult[] = []
  const record = (result: DeletionStepResult) => {
    results.push(result)
    input.log?.({ org_id: input.orgId, ...result })
  }

  let inventory: I
  const loadStart = now()
  try {
    inventory = await input.loadInventory()
    record({ step: 'load_inventory', ok: true, detail: null, duration_ms: now() - loadStart })
  } catch (error) {
    record({ step: 'load_inventory', ok: false, detail: errorSummary(error), duration_ms: now() - loadStart })
    throw new AccountDeletionError('load_inventory', 'Could not read the account before deleting it.', results)
  }

  for (const step of DELETION_ORDER) {
    const started = now()
    try {
      const detail = await input.steps[step](inventory)
      record({ step, ok: true, detail: detail || null, duration_ms: now() - started })
    } catch (error) {
      record({ step, ok: false, detail: errorSummary(error), duration_ms: now() - started })
      if (CRITICAL_DELETION_STEPS.has(step)) {
        throw new AccountDeletionError(step, `Account deletion stopped at ${step}.`, results)
      }
    }
  }

  return results
}
