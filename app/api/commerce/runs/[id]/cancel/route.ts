// POST /api/commerce/runs/[id]/cancel — cancel a queued run (eligible/scheduled/retry_waiting only).
import { RequestError, assertSameOrigin } from '@/lib/api/http'
import { commerceRoute, noStore, requireCommerceOrg, uuid } from '@/lib/commerce/api'
import { RUN_COLUMNS_WITH_REFS, type RunRow, runDto, writeAudit } from '@/lib/commerce/store'
import { RATE_LIMITS, enforceRateLimit } from '@/lib/security/rate-limit'

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  return commerceRoute(request, 'runs.cancel', async (log) => {
    assertSameOrigin(request)
    const ctx = await requireCommerceOrg(log)
    const { id } = await params
    if (!uuid.safeParse(id).success) throw new RequestError('not_found', 'This scheduled call does not exist.', 404)
    await enforceRateLimit(RATE_LIMITS.commerceAutomationWrite, ctx.org.id)
    const { data, error } = await ctx.db
      .from('commerce_automation_runs')
      .update({ status: 'cancelled', eligibility_reason: 'Canceled manually', completed_at: new Date().toISOString() })
      .eq('id', id)
      .eq('org_id', ctx.org.id)
      .in('status', ['eligible', 'scheduled', 'retry_waiting'])
      .select(RUN_COLUMNS_WITH_REFS)
      .maybeSingle()
    if (error) throw new Error(`commerce_automation_runs update failed: ${error.message}`)
    if (!data) throw new RequestError('precondition_failed', 'The call can no longer be canceled (it is in progress or finished).', 409, { reason: 'not_cancellable' })
    const run = data as RunRow
    await writeAudit(ctx.db, { orgId: ctx.org.id, actor: 'user', actorUserId: ctx.user.id, action: 'run.cancelled', connectionId: run.connection_id, automationId: run.automation_id, runId: run.id, metadata: { reason: 'manual' } }, ctx.log)
    return noStore({ run: runDto(run) })
  })
}
