import { NextResponse, type NextRequest } from 'next/server'
import { ApiError, handleRoute, noStore, parseJson } from '@/lib/api/http'
import { requireOrgContext } from '@/lib/api/auth'
import { enforceRateLimit, RATE_LIMITS } from '@/lib/security/rate-limit'
import { keywordListIssue, parseKeywords } from '@/lib/workflows/keywords'
import { workflowPatchSchema } from '@/lib/workflows/schemas'
import {
  WORKFLOW_DETAIL_COLUMNS,
  WORKFLOW_SUMMARY_COLUMNS,
  assertActionsAllowed,
  assertValidId,
  loadOwnWorkflow,
  newSigningSecret,
  toWorkflowSummary,
  toWorkflowWithSecret,
} from '@/lib/workflows/service'

export const runtime = 'nodejs'

type Params = { params: Promise<{ id: string }> }

// One workflow, with its webhook signing secret (owner only: the session is
// the organisation's owner and RLS limits rows to their organisation).
export const GET = handleRoute(async (_req: NextRequest, { params }: Params) => {
  const { id } = await params
  const ctx = await requireOrgContext()
  const row = await loadOwnWorkflow(ctx, id, WORKFLOW_DETAIL_COLUMNS)
  return noStore(NextResponse.json(toWorkflowWithSecret(row)))
})

export const PATCH = handleRoute(async (req: NextRequest, { params }: Params) => {
  const { id } = await params
  const ctx = await requireOrgContext()
  assertValidId(id)
  await enforceRateLimit(RATE_LIMITS.apiWrite, ctx.user.id)
  const patch = await parseJson(req, workflowPatchSchema)
  const existing = toWorkflowSummary(await loadOwnWorkflow(ctx, id, WORKFLOW_SUMMARY_COLUMNS))

  const updates: Record<string, unknown> = {}
  if (patch.name !== undefined) updates.name = patch.name
  if (patch.description !== undefined) updates.description = patch.description ? patch.description : null
  if (patch.enabled !== undefined) updates.enabled = patch.enabled
  if (patch.actions !== undefined) {
    await assertActionsAllowed(ctx, patch.actions)
    updates.actions = patch.actions
  }
  if (patch.trigger !== undefined || patch.trigger_config !== undefined) {
    const trigger = patch.trigger ?? existing.trigger
    const keywordSource = patch.trigger_config !== undefined ? patch.trigger_config.keyword : existing.trigger_config.keyword
    if (trigger === 'keyword_detected') {
      const issue = keywordListIssue(keywordSource)
      if (issue) throw new ApiError(400, 'validation_error', `Invalid request. trigger_config.keyword: ${issue}`)
      updates.trigger_config = { keyword: parseKeywords(keywordSource).join(', ') }
    } else {
      updates.trigger_config = {}
    }
    updates.trigger = trigger
  }
  if (patch.rotate_secret) updates.signing_secret = newSigningSecret()

  if (Object.keys(updates).length === 0) {
    return noStore(NextResponse.json(existing))
  }

  const { data, error } = await ctx.supabase
    .from('workflows')
    .update(updates)
    .eq('id', id)
    .eq('org_id', ctx.org.id)
    .select(patch.rotate_secret ? WORKFLOW_DETAIL_COLUMNS : WORKFLOW_SUMMARY_COLUMNS)
    .maybeSingle()
  if (error) {
    console.error('[workflows] update failed', error.code, error.message)
    throw new ApiError(500, 'workflow_update_failed', 'We couldn’t save your changes. Please try again.')
  }
  if (!data) throw new ApiError(404, 'workflow_not_found', 'We couldn’t find that workflow.')
  const row = data as unknown as Record<string, unknown>
  return noStore(NextResponse.json(patch.rotate_secret ? toWorkflowWithSecret(row) : toWorkflowSummary(row)))
})

export const DELETE = handleRoute(async (_req: NextRequest, { params }: Params) => {
  const { id } = await params
  const ctx = await requireOrgContext()
  assertValidId(id)
  await enforceRateLimit(RATE_LIMITS.apiWrite, ctx.user.id)

  const { data, error } = await ctx.supabase
    .from('workflows')
    .delete()
    .eq('id', id)
    .eq('org_id', ctx.org.id)
    .select('id')
  if (error) {
    console.error('[workflows] delete failed', error.code, error.message)
    throw new ApiError(500, 'workflow_delete_failed', 'We couldn’t delete this workflow. Please try again.')
  }
  if (!data || data.length === 0) {
    throw new ApiError(404, 'workflow_not_found', 'We couldn’t find that workflow.')
  }
  return noStore(NextResponse.json({ success: true }))
})
