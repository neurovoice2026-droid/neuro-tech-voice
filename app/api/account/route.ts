// DELETE /api/account { confirm } → 202 { status, deletion: { id, status, step } }
// Self-serve account deletion (Settings → Danger zone). Same-origin, signed
// in, owner only, a sign-in within the last 30 minutes, the business name
// typed exactly, strict rate limit. It opens the durable deletion job
// (lib/account/delete.ts), starts it in the background and signs the user
// out everywhere; the maintenance job resumes and retries it until done.
import { NextResponse } from 'next/server'
import { z } from 'zod'
import { requireOrg } from '@/lib/api/auth'
import { RequestError, assertSameOrigin, errorResponse, parseJsonBody, requestErrorResponse } from '@/lib/api/http'
import { createLogger, requestIdFrom, type Logger } from '@/lib/observability/logger'
import { deferBackground } from '@/lib/observability/telemetry'
import { enforceRateLimit, type RateLimitRule } from '@/lib/security/rate-limit'
import { createAdminClient } from '@/lib/supabase/admin'
import { isDeletionConfirmed, isRecentSignIn } from '@/lib/account/confirmation'
import { REQUEST_RUN_BUDGET_MS, requestAccountDeletion, runAccountDeletion } from '@/lib/account/delete'

// The first run of the job (Stripe, numbers, agents, call records…) continues after the response.
export const maxDuration = 300

const Body = z.object({ confirm: z.string().max(200) }).strict()

/** Irreversible and costly: a few attempts per hour per user (room for a sign-in round trip). */
const ACCOUNT_DELETE: RateLimitRule = { name: 'account_delete', limit: 5, windowSeconds: 3_600 }

export async function DELETE(request: Request) {
  const requestId = requestIdFrom(request)
  let log: Logger = createLogger({ requestId, route: 'account.delete' })
  try {
    assertSameOrigin(request)
    // A second request while the deletion runs answers with the same job.
    const { supabase, user, org } = await requireOrg({ allowDeleting: true })
    log = log.child({ orgId: org.id })
    await enforceRateLimit(ACCOUNT_DELETE, user.id, 'Too many attempts. Please wait an hour and try again.')
    const body = await parseJsonBody(request, Body, 2 * 1024)

    // Owner only (organizations.user_id), read with the service role, not trusted from the session.
    const admin = createAdminClient()
    const { data: owner, error: ownerErr } = await admin.from('organizations').select('user_id').eq('id', org.id).maybeSingle()
    if (ownerErr) throw new Error(`organizations read failed: ${ownerErr.message}`)
    if (!owner || owner.user_id !== user.id) {
      throw new RequestError('forbidden', 'Only the account owner can delete the account.', 403)
    }
    if (!isDeletionConfirmed(body.confirm, org.name)) {
      throw new RequestError('invalid_request', 'The name you typed does not match your business name.', 400, { reason: 'confirmation_mismatch' })
    }
    if (!isRecentSignIn(user.last_sign_in_at)) {
      throw new RequestError(
        'forbidden',
        'For your security, please sign in again, then delete your account within 30 minutes.',
        403,
        { reason: 'reauth_required' },
      )
    }

    const { job, created } = await requestAccountDeletion({ orgId: org.id, requestedBy: user.id, via: 'self_service', log })
    log.info('account.deletion_accepted', { deletionId: job.id, created })
    deferBackground(
      runAccountDeletion(job.id, { log, budgetMs: REQUEST_RUN_BUDGET_MS })
        .then((r) => log.info('account.deletion_run', { deletionId: job.id, outcome: r.outcome ?? 'not_run', step: r.step ?? null }))
        .catch((err: unknown) => log.error('account.deletion_run_failed', err, { deletionId: job.id })),
    )

    // Every session of this user ends now (the sign-in is also blocked by the job's first step).
    const { error: signOutErr } = await supabase.auth.signOut({ scope: 'global' })
    if (signOutErr) log.warn('account.sign_out_failed', { status: signOutErr.status ?? null })

    return NextResponse.json(
      { status: 'accepted', deletion: { id: job.id, status: job.status, step: job.step } },
      { status: 202, headers: { 'Cache-Control': 'no-store' } },
    )
  } catch (err) {
    if (err instanceof RequestError) return requestErrorResponse(err, requestId)
    return errorResponse(err, log, 'account.delete_failed', requestId)
  }
}
