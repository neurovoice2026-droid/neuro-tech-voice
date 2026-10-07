import 'server-only'
// revoke_google: every Google grant the organization gave us (Calendar,
// Sheets, Docs, Gmail, Drive) is revoked at Google, then the stored refresh
// token is erased and the integration switched off. A transient revoke
// failure is retried twice (step retry); after that the token is erased
// anyway: nobody can use a grant whose refresh token no longer exists, and
// the owner can still remove the app from their Google account. Events the
// agent booked live in the owner's own calendar and are not touched.

import { GoogleRevokeError, revokeGoogleToken } from '../google-revoke'
import type { StepOutcome } from '../deletion-plan'
import type { StepContext } from '../job'

const RETRIES_BEFORE_ERASING = 2

export async function revokeGoogle(ctx: StepContext): Promise<StepOutcome> {
  const { data, error } = await ctx.db
    .from('integrations')
    .select('id, type, google_refresh_token')
    .eq('org_id', ctx.orgId)
    .not('google_refresh_token', 'is', null)
  if (error) throw new Error(`integrations read failed: ${error.message}`)
  const counts = { grants: 0, revoked: 0, already_invalid: 0, revoke_failed: 0 }
  let retryLater = 0
  for (const row of (data ?? []) as Array<{ id: string; type: string; google_refresh_token: string | null }>) {
    if (!row.google_refresh_token) continue
    counts.grants++
    try {
      const res = await revokeGoogleToken(row.google_refresh_token)
      if (res === 'revoked') counts.revoked++
      else counts.already_invalid++
    } catch (err) {
      const status = err instanceof GoogleRevokeError ? err.status : null
      if (ctx.attempts < RETRIES_BEFORE_ERASING) {
        retryLater++
        ctx.log.warn('account_deletion.google_revoke_retry', { integration: row.type, status })
        continue
      }
      counts.revoke_failed++
      ctx.log.error('account_deletion.google_revoke_failed', err, { integration: row.type, status })
    }
    const { error: clearErr } = await ctx.db
      .from('integrations')
      .update({ google_refresh_token: null, is_active: false })
      .eq('id', row.id)
      .eq('org_id', ctx.orgId)
    if (clearErr) throw new Error(`integrations update failed: ${clearErr.message}`)
  }
  if (retryLater) throw new Error(`${retryLater} Google grant(s) could not be revoked yet`)
  return { status: 'done', counts }
}
