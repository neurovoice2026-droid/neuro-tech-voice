import { NextResponse, type NextRequest } from 'next/server'
import { z } from 'zod'
import { ApiError, handleRoute, noStore, readBodyText, validationError } from '@/lib/api/http'
import { requireOrgContext } from '@/lib/api/auth'
import { enforceRateLimit, type RateLimitPolicy } from '@/lib/security/rate-limit'
import { loadLatestCallData } from '@/lib/workflows/context'
import { runWorkflowTest, WORKFLOW_RUN_COLUMNS, type WorkflowRunRecord } from '@/lib/workflows/executor'
import { sampleCallData } from '@/lib/workflows/payload'
import { loadOwnWorkflow } from '@/lib/workflows/service'
import type { WorkflowTestResult } from '@/lib/workflows/types'

export const runtime = 'nodejs'
// Webhook and Slack steps with retries can take a while; the run itself stops at 45 s.
export const maxDuration = 60

type Params = { params: Promise<{ id: string }> }

/** Each test sends real requests to the owner's endpoints, so it's capped per organisation. */
const WORKFLOW_TEST_LIMIT: RateLimitPolicy = { name: 'workflowTest', limit: 20, windowSeconds: 10 * 60 }

const bodySchema = z.object({ use_sample: z.boolean().optional() }).strict()

/** The body is optional: an empty POST tests against the latest real call. */
async function readOptionalBody(req: NextRequest): Promise<z.infer<typeof bodySchema>> {
  const text = await readBodyText(req, 1024)
  if (!text.trim()) return {}
  let data: unknown
  try {
    data = JSON.parse(text)
  } catch {
    throw new ApiError(400, 'invalid_json', 'Request body must be valid JSON.')
  }
  const parsed = bodySchema.safeParse(data)
  if (!parsed.success) throw validationError(parsed.error)
  return parsed.data
}

// "Send test": runs the workflow's webhook and Slack steps against the latest
// real call (or a clearly labelled sample call) with test: true in the payload.
// Texts, emails, tags and Google steps are never run by a test, and nothing is
// recorded in the run history or success rate.
export const POST = handleRoute(async (req: NextRequest, { params }: Params) => {
  const { id } = await params
  const ctx = await requireOrgContext()
  const input = await readOptionalBody(req)
  const row = await loadOwnWorkflow(ctx, id, WORKFLOW_RUN_COLUMNS)
  await enforceRateLimit(WORKFLOW_TEST_LIMIT, ctx.org.id)

  const latest = input.use_sample ? null : await loadLatestCallData(ctx.supabase, ctx.org.id)
  const call = latest ?? sampleCallData()

  const { success, results } = await runWorkflowTest({
    workflow: row as unknown as WorkflowRunRecord,
    org: { id: ctx.org.id, name: ctx.org.name, timezone: ctx.org.timezone, plan: ctx.org.plan },
    call,
  })

  const body: WorkflowTestResult = {
    source: latest ? 'latest_call' : 'sample',
    call_started_at: call.started_at,
    ok: success,
    results,
  }
  return noStore(NextResponse.json(body))
})
