import { NextResponse, type NextRequest } from 'next/server'
import { ApiError, handleRoute, noStore } from '@/lib/api/http'
import { requireOrgContext } from '@/lib/api/auth'
import { loadOwnWorkflow } from '@/lib/workflows/service'
import type { ActionResult, RunStatus, WorkflowRun } from '@/lib/workflows/types'

export const runtime = 'nodejs'

type Params = { params: Promise<{ id: string }> }

const RUN_LIMIT = 50

function toRun(row: Record<string, unknown>): WorkflowRun {
  const call = row.call && typeof row.call === 'object' && !Array.isArray(row.call) ? (row.call as Record<string, unknown>) : null
  const status = row.status === 'completed' || row.status === 'failed' ? row.status : 'running'
  return {
    id: String(row.id),
    workflow_id: String(row.workflow_id),
    call_id: typeof row.call_id === 'string' ? row.call_id : null,
    status: status as RunStatus,
    results: Array.isArray(row.results) ? (row.results as ActionResult[]) : [],
    error: typeof row.error === 'string' ? row.error : null,
    started_at: typeof row.started_at === 'string' ? row.started_at : new Date(0).toISOString(),
    completed_at: typeof row.completed_at === 'string' ? row.completed_at : null,
    call: call
      ? {
          id: String(call.id),
          caller_number: typeof call.caller_number === 'string' ? call.caller_number : null,
          from_number: typeof call.from_number === 'string' ? call.from_number : null,
          started_at: typeof call.started_at === 'string' ? call.started_at : null,
        }
      : null,
  }
}

// The workflow's last 50 runs with each step's result, newest first.
export const GET = handleRoute(async (_req: NextRequest, { params }: Params) => {
  const { id } = await params
  const ctx = await requireOrgContext()
  // Ownership first: runs have no org column, so they're reached only through an owned workflow.
  await loadOwnWorkflow(ctx, id, 'id')

  const { data, error } = await ctx.supabase
    .from('workflow_runs')
    .select('id, workflow_id, call_id, status, results, error, started_at, completed_at, call:calls(id, caller_number, from_number, started_at)')
    .eq('workflow_id', id)
    .order('started_at', { ascending: false })
    .limit(RUN_LIMIT)
  if (error) {
    console.error('[workflows] runs lookup failed', error.code, error.message)
    throw new ApiError(500, 'runs_unavailable', 'We couldn’t load the run history. Please try again.')
  }
  const rows = (data ?? []) as unknown as Record<string, unknown>[]
  return noStore(NextResponse.json({ runs: rows.map(toRun) }))
})
