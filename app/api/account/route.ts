import { NextResponse, after } from 'next/server'
import { z } from 'zod'
import { sendEmail } from '@/lib/email/client'
import { accountDeletedEmail } from '@/lib/email/templates'
import { ApiError, handleRoute, noStore, parseJson } from '@/lib/api/http'
import { requireOrgContext } from '@/lib/api/auth'
import { isSupabaseAdminConfigured } from '@/lib/env'
import { enforceRateLimit, type RateLimitPolicy } from '@/lib/security/rate-limit'
import { deleteOrganizationData, isAccountDeletionError } from '@/lib/account/delete'
import { isDeletionConfirmed } from './confirmation'

export const runtime = 'nodejs'
// Provider cleanup (numbers, voices, call records, files) can take a while
// for a busy account.
export const maxDuration = 300

// Irreversible and expensive: a handful of attempts per hour per user. Room
// for a "sign in again" round trip or two before the real attempt.
const ACCOUNT_DELETE_LIMIT: RateLimitPolicy = { name: 'accountDelete', limit: 5, windowSeconds: 60 * 60 }
const REAUTH_WINDOW_MS = 30 * 60 * 1000

const bodySchema = z.object({
  confirm: z.string().max(200),
})

export const DELETE = handleRoute(async (req) => {
  const ctx = await requireOrgContext()
  await enforceRateLimit(ACCOUNT_DELETE_LIMIT, ctx.user.id)

  const { confirm } = await parseJson(req, bodySchema, { maxBytes: 2048 })
  if (!isDeletionConfirmed(confirm, ctx.org.name)) {
    throw new ApiError(400, 'confirmation_mismatch', 'The name you typed doesn’t match your organization name.')
  }

  // Deleting an account needs a fresh sign-in, so a session left open on a
  // shared computer can't be used to wipe the business.
  const { data, error } = await ctx.supabase.auth.getUser()
  if (error || !data.user || data.user.id !== ctx.user.id) {
    throw new ApiError(401, 'unauthorized', 'Please sign in to continue.')
  }
  const lastSignIn = data.user.last_sign_in_at ? Date.parse(data.user.last_sign_in_at) : Number.NaN
  if (!Number.isFinite(lastSignIn) || Date.now() - lastSignIn > REAUTH_WINDOW_MS) {
    throw new ApiError(
      403,
      'reauth_required',
      'For your security, please sign in again, then delete your account within 30 minutes.'
    )
  }

  if (!isSupabaseAdminConfigured()) {
    throw new ApiError(503, 'not_configured', 'Account deletion is temporarily unavailable. Please contact support.')
  }

  console.info('[account] deletion requested', JSON.stringify({ org_id: ctx.org.id }))
  try {
    await deleteOrganizationData(ctx.org.id)
  } catch (err) {
    if (!isAccountDeletionError(err)) throw err
    if (err.step === 'load_inventory') {
      throw new ApiError(500, 'deletion_failed', 'We couldn’t delete your account and nothing was changed. Please try again in a few minutes.')
    }
    if (err.step === 'delete_auth_user') {
      throw new ApiError(
        500,
        'deletion_incomplete',
        'Your data has been deleted, but we couldn’t close your sign-in. Please contact support and we’ll finish it for you.'
      )
    }
    throw new ApiError(
      500,
      'deletion_incomplete',
      'We stopped your subscriptions and services but couldn’t finish deleting your data. Please contact support and we’ll complete it for you.'
    )
  }

  // Confirmation to the address the account was registered with. Best effort
  // (sendEmail never throws); the deletion itself is already complete.
  const email = ctx.user.email
  if (email) {
    const content = accountDeletedEmail({
      organizationName: ctx.org.name,
      deletedAt: new Date().toISOString(),
      subscriptionsCancelled: Boolean(ctx.org.stripe_subscription_id),
    })
    after(async () => {
      await sendEmail({ to: email, subject: content.subject, html: content.html })
    })
  }

  // The user no longer exists; clear this browser's session cookies.
  await ctx.supabase.auth.signOut({ scope: 'local' }).catch(() => undefined)

  return noStore(NextResponse.json({ ok: true }))
})
