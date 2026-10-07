// POST /api/admin/accounts/[orgId]/offboard { dry_run = true, confirm? }
// Tenant offboarding by a platform admin (requireAdmin: ADMIN_API_TOKEN or
// PLATFORM_ADMIN_USER_IDS). Dry run by default: returns the plan (what each
// step would delete, and where; counts only, no personal data) and the
// organization's latest deletion job. With dry_run=false and confirm equal to
// the organization id, it opens (or resumes, or restarts after
// needs_attention) the same durable job as the self-serve deletion and starts
// it in the background.
import { NextResponse } from 'next/server'
import { z } from 'zod'
import { requireAdmin } from '@/lib/api/auth'
import { RequestError, assertSameOrigin, errorResponse, parseJsonBody, requestErrorResponse } from '@/lib/api/http'
import { createLogger, requestIdFrom, type Logger } from '@/lib/observability/logger'
import { deferBackground } from '@/lib/observability/telemetry'
import { enforceRateLimit, type RateLimitRule } from '@/lib/security/rate-limit'
import { planAccountDeletion } from '@/lib/account/plan'
import { REQUEST_RUN_BUDGET_MS, requestAccountDeletion, runAccountDeletion } from '@/lib/account/delete'

export const maxDuration = 300

const OrgId = z.uuid()
const Body = z
  .object({
    dry_run: z.boolean().optional().default(true),
    /** Must repeat the organization id to run the deletion (dry_run=false). */
    confirm: z.string().max(64).optional(),
  })
  .strict()

/** Plans read many tables; runs call every provider: 30 per hour platform-wide. */
const RULE: RateLimitRule = { name: 'admin_account_offboard', limit: 30, windowSeconds: 3_600 }

type Params = { params: Promise<{ orgId: string }> }

export async function POST(request: Request, { params }: Params) {
  const requestId = requestIdFrom(request)
  let log: Logger = createLogger({ requestId, route: 'admin.accounts.offboard' })
  try {
    assertSameOrigin(request)
    const admin = await requireAdmin(request)
    const parsed = OrgId.safeParse((await params).orgId)
    if (!parsed.success) throw new RequestError('not_found', 'Organization not found.', 404)
    const orgId = parsed.data.toLowerCase()
    log = log.child({ orgId })
    const body = await parseJsonBody(request, Body, 2 * 1024)
    await enforceRateLimit(RULE, 'platform')

    if (body.dry_run) {
      const plan = await planAccountDeletion(orgId)
      return NextResponse.json({ dry_run: true, plan }, { headers: { 'Cache-Control': 'no-store' } })
    }

    if ((body.confirm ?? '').trim().toLowerCase() !== orgId) {
      throw new RequestError('invalid_request', 'To delete this organization, repeat its id in "confirm".', 400, { reason: 'confirmation_mismatch' })
    }
    const { job, created, reopened } = await requestAccountDeletion({ orgId, requestedBy: admin.userId, via: 'admin', log })
    log.warn('admin.offboard_started', { deletionId: job.id, created, reopened, actor: admin.kind })
    deferBackground(
      runAccountDeletion(job.id, { log, budgetMs: REQUEST_RUN_BUDGET_MS })
        .then((r) => log.info('admin.offboard_run', { deletionId: job.id, outcome: r.outcome ?? 'not_run', step: r.step ?? null }))
        .catch((err: unknown) => log.error('admin.offboard_run_failed', err, { deletionId: job.id })),
    )
    return NextResponse.json(
      { dry_run: false, created, reopened, deletion: { id: job.id, status: job.status, step: job.step, attempts: job.attempts, last_error: job.last_error } },
      { status: 202, headers: { 'Cache-Control': 'no-store' } },
    )
  } catch (err) {
    if (err instanceof RequestError) return requestErrorResponse(err, requestId)
    return errorResponse(err, log, 'admin.offboard_failed', requestId)
  }
}
