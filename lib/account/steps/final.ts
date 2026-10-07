import 'server-only'
// The last two steps.
//
// delete_organization: billing is checked once more (a checkout completed
// during the deletion must not leave a live subscription), then the
// organization row is deleted: every tenant table cascades. Invoices are
// copied into invoices_archive by their BEFORE DELETE trigger and usage
// totals into usage_archive by the organizations trigger (migration 021);
// archive_billing_records already did both explicitly and checked the count.
//
// delete_auth_user: the Supabase sign-in, last. Its email address is read
// just before (kept in memory only) to send the confirmation.

import type { StepOutcome } from '../deletion-plan'
import type { StepContext } from '../job'
import { sendAccountDeletedEmail } from '../email'
import { stopBilling } from './billing'

export async function deleteOrganization(ctx: StepContext): Promise<StepOutcome> {
  const billing = await stopBilling(ctx, 'recheck')
  if (billing.cancelled || billing.checkouts_expired) ctx.log.warn('account_deletion.late_billing_stopped', billing)
  const { count, error } = await ctx.db.from('organizations').delete({ count: 'exact' }).eq('id', ctx.orgId)
  if (error) throw new Error(`organizations delete failed (${(error as { code?: string }).code ?? 'unknown'}): ${error.message}`)
  return { status: 'done', counts: { organization_deleted: count ?? 0, late_subscriptions_cancelled: billing.cancelled } }
}

export async function deleteAuthUser(ctx: StepContext): Promise<StepOutcome> {
  if (!ctx.userId) return { status: 'done', counts: { sign_in_deleted: 0 } }
  const { data, error: readErr } = await ctx.db.auth.admin.getUserById(ctx.userId)
  if (readErr) {
    if (readErr.status === 404) return { status: 'done', counts: { sign_in_deleted: 0 } }
    throw new Error(`sign-in read failed (${readErr.status ?? 'unknown'})`)
  }
  const email = data.user?.email ?? null
  const { error } = await ctx.db.auth.admin.deleteUser(ctx.userId)
  if (error && error.status !== 404) throw new Error(`sign-in delete failed (${error.status ?? 'unknown'})`)
  // Best effort, after the deletion: a failed email never fails the job.
  const sent = email ? await sendAccountDeletedEmail(email, ctx.log) : false
  return { status: 'done', counts: { sign_in_deleted: error ? 0 : 1, confirmation_sent: sent ? 1 : 0 } }
}
