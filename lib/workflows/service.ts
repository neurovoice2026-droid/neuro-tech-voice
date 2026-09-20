import 'server-only'
import { randomBytes } from 'node:crypto'
import { ApiError } from '@/lib/api/http'
import type { OrgContext } from '@/lib/api/auth'
import { entitlementsFor, requiredPlanFor } from '@/lib/billing/entitlements'
import { assertPublicHttpsUrl, UnsafeUrlError } from '@/lib/security/ssrf'
import { PLANS } from '@/types'
import type { WorkflowAction } from './schemas'
import { unsafeUrlReason } from './webhook'
import {
  TRIGGER_TYPES,
  isGoogleAction,
  type StoredWorkflowAction,
  type TriggerType,
  type WorkflowSummary,
  type WorkflowWithSecret,
} from './types'

// Shared plumbing for the /api/workflows routes. Workflows are written with
// the signed-in user's client: RLS (workflows_all_own) plus explicit org
// filters scope every query.

export const WORKFLOW_SUMMARY_COLUMNS =
  'id, name, description, trigger, trigger_config, actions, enabled, runs, successful_runs, last_run_at, created_at, updated_at'
export const WORKFLOW_DETAIL_COLUMNS = `${WORKFLOW_SUMMARY_COLUMNS}, signing_secret`

/** Plenty for a small business; stops runaway creation. */
export const MAX_WORKFLOWS_PER_ORG = 50

/** Same format as the database default: 32 random bytes as hex. */
export function newSigningSecret(): string {
  return randomBytes(32).toString('hex')
}

function asTrigger(value: unknown): TriggerType {
  return (TRIGGER_TYPES as readonly string[]).includes(value as string) ? (value as TriggerType) : 'call_ended'
}

export function toWorkflowSummary(row: Record<string, unknown>): WorkflowSummary {
  const config = row.trigger_config && typeof row.trigger_config === 'object' ? (row.trigger_config as { keyword?: unknown }) : {}
  return {
    id: String(row.id),
    name: typeof row.name === 'string' ? row.name : 'Untitled workflow',
    description: typeof row.description === 'string' ? row.description : null,
    trigger: asTrigger(row.trigger),
    trigger_config: typeof config.keyword === 'string' ? { keyword: config.keyword } : {},
    actions: Array.isArray(row.actions) ? (row.actions as StoredWorkflowAction[]) : [],
    enabled: row.enabled !== false,
    runs: typeof row.runs === 'number' ? row.runs : 0,
    successful_runs: typeof row.successful_runs === 'number' ? row.successful_runs : 0,
    last_run_at: typeof row.last_run_at === 'string' ? row.last_run_at : null,
    created_at: typeof row.created_at === 'string' ? row.created_at : new Date(0).toISOString(),
    updated_at: typeof row.updated_at === 'string' ? row.updated_at : null,
  }
}

export function toWorkflowWithSecret(row: Record<string, unknown>): WorkflowWithSecret {
  return {
    ...toWorkflowSummary(row),
    signing_secret: typeof row.signing_secret === 'string' && row.signing_secret ? row.signing_secret : null,
  }
}

/**
 * Plan checks and a network-level check of webhook addresses before saving,
 * so an owner learns about a bad address now instead of from a failed run.
 */
export async function assertActionsAllowed(ctx: OrgContext, actions: WorkflowAction[]): Promise<void> {
  const entitlements = entitlementsFor(ctx.org.plan)

  if (!entitlements.googleIntegrations && actions.some((action) => isGoogleAction(action.type))) {
    const plan = PLANS[requiredPlanFor('googleIntegrations')].name
    throw new ApiError(403, 'upgrade_required', `Google Workspace steps are part of the ${plan} plan. Remove them or upgrade to save this workflow.`)
  }
  if (!entitlements.smsConfirmations && actions.some((action) => action.type === 'send_sms')) {
    const plan = PLANS[requiredPlanFor('smsConfirmations')].name
    throw new ApiError(403, 'upgrade_required', `Texting callers is part of the ${plan} plan. Remove the text step or upgrade to save this workflow.`)
  }

  for (const [index, action] of actions.entries()) {
    if (action.type !== 'send_webhook') continue
    try {
      await assertPublicHttpsUrl(action.config.url)
    } catch (error) {
      if (error instanceof UnsafeUrlError) {
        throw new ApiError(400, 'invalid_webhook_url', `Step ${index + 1}: we can’t send to this address: ${unsafeUrlReason(error.message)}.`)
      }
      throw error
    }
  }
}

export function assertValidId(id: string): void {
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)) {
    throw new ApiError(404, 'workflow_not_found', 'We couldn’t find that workflow.')
  }
}

export async function loadOwnWorkflow(ctx: OrgContext, id: string, columns: string): Promise<Record<string, unknown>> {
  assertValidId(id)
  const { data, error } = await ctx.supabase.from('workflows').select(columns).eq('id', id).eq('org_id', ctx.org.id).maybeSingle()
  if (error) {
    console.error('[workflows] workflow lookup failed', error.code, error.message)
    throw new ApiError(500, 'workflow_lookup_failed', 'We couldn’t load this workflow. Please try again.')
  }
  if (!data) throw new ApiError(404, 'workflow_not_found', 'We couldn’t find that workflow.')
  return data as unknown as Record<string, unknown>
}
