import 'server-only'
// block_activity: nothing is deleted yet; new activity is stopped so nothing
// re-creates what the next steps remove.
//   1. organizations.deletion_requested_at (requireOrg refuses every tenant
//      API call, syncAgent never recreates the provider agents);
//   2. the agent is paused in the database (the router and the initiation
//      webhook answer calls with the "unavailable" line until the numbers are
//      released in the next steps);
//   3. the sign-in is banned (no new session; deleted for good at the end).

import type { StepOutcome } from '../deletion-plan'
import type { StepContext } from '../job'

/** Supabase ban duration: until the sign-in is deleted by the last step. */
export const DELETION_BAN_DURATION = '876000h'

export async function blockActivity(ctx: StepContext): Promise<StepOutcome> {
  const nowIso = new Date(ctx.now()).toISOString()
  const { error: markErr } = await ctx.db
    .from('organizations')
    .update({ deletion_requested_at: nowIso })
    .eq('id', ctx.orgId)
    .is('deletion_requested_at', null)
  if (markErr) throw new Error(`organizations mark failed: ${markErr.message}`)

  const { data: paused, error: pauseErr } = await ctx.db
    .from('agents')
    .update({ is_active: false })
    .eq('org_id', ctx.orgId)
    .eq('is_active', true)
    .select('id')
  if (pauseErr) throw new Error(`agents pause failed: ${pauseErr.message}`)

  let signInBlocked = 0
  if (ctx.userId) {
    const { error } = await ctx.db.auth.admin.updateUserById(ctx.userId, { ban_duration: DELETION_BAN_DURATION })
    if (error && error.status !== 404) throw new Error(`sign-in block failed (${error.status ?? 'unknown'})`)
    signInBlocked = error ? 0 : 1
  }
  return { status: 'done', counts: { agents_paused: (paused ?? []).length, sign_in_blocked: signInBlocked } }
}
