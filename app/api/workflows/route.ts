import { NextResponse } from 'next/server'
import { ApiError, handleRoute, noStore, parseJson } from '@/lib/api/http'
import { requireOrgContext } from '@/lib/api/auth'
import { enforceRateLimit, RATE_LIMITS } from '@/lib/security/rate-limit'
import { workflowCreateSchema } from '@/lib/workflows/schemas'
import {
  MAX_WORKFLOWS_PER_ORG,
  WORKFLOW_SUMMARY_COLUMNS,
  assertActionsAllowed,
  toWorkflowSummary,
} from '@/lib/workflows/service'

export const runtime = 'nodejs'

// The organisation's workflows, newest first. Signing secrets are not part of
// the list; GET /api/workflows/[id] returns one to the signed-in owner.
export const GET = handleRoute(async () => {
  const ctx = await requireOrgContext()
  const { data, error } = await ctx.supabase
    .from('workflows')
    .select(WORKFLOW_SUMMARY_COLUMNS)
    .eq('org_id', ctx.org.id)
    .order('created_at', { ascending: false })
  if (error) {
    console.error('[workflows] list failed', error.code, error.message)
    throw new ApiError(500, 'workflows_unavailable', 'We couldn’t load your workflows. Please try again.')
  }
  const rows = (data ?? []) as unknown as Record<string, unknown>[]
  return noStore(NextResponse.json(rows.map(toWorkflowSummary)))
})

export const POST = handleRoute(async (req) => {
  const ctx = await requireOrgContext()
  await enforceRateLimit(RATE_LIMITS.apiWrite, ctx.user.id)
  const input = await parseJson(req, workflowCreateSchema)
  await assertActionsAllowed(ctx, input.actions)

  const { count, error: countError } = await ctx.supabase
    .from('workflows')
    .select('id', { count: 'exact', head: true })
    .eq('org_id', ctx.org.id)
  if (countError) {
    console.error('[workflows] count failed', countError.code, countError.message)
    throw new ApiError(500, 'workflow_create_failed', 'We couldn’t save this workflow. Please try again.')
  }
  if ((count ?? 0) >= MAX_WORKFLOWS_PER_ORG) {
    throw new ApiError(409, 'workflow_limit_reached', `You can have up to ${MAX_WORKFLOWS_PER_ORG} workflows. Delete one you no longer use first.`)
  }

  const { data, error } = await ctx.supabase
    .from('workflows')
    .insert({
      org_id: ctx.org.id,
      name: input.name,
      description: input.description,
      trigger: input.trigger,
      trigger_config: input.trigger_config,
      actions: input.actions,
      enabled: input.enabled,
    })
    .select(WORKFLOW_SUMMARY_COLUMNS)
    .single()
  if (error || !data) {
    console.error('[workflows] create failed', error?.code, error?.message)
    throw new ApiError(500, 'workflow_create_failed', 'We couldn’t save this workflow. Please try again.')
  }
  // The signing secret stays out of list-shaped responses; the builder loads it from GET /api/workflows/[id].
  return noStore(NextResponse.json(toWorkflowSummary(data as unknown as Record<string, unknown>), { status: 201 }))
})
