// Extracted from the old ElevenLabs webhook so the Telnyx one can reuse it
// rather than growing a second copy that drifts.

import type { SupabaseClient } from '@supabase/supabase-js'
import { sendEmail } from '@/lib/email/client'
import { usageAlertEmail } from '@/lib/email/templates'
import { PLANS, type Plan } from '@/types'

/** Email the org owner once when usage first crosses 80% of the monthly limit. */
export const USAGE_ALERT_THRESHOLD = 0.8

export async function maybeSendUsageAlert(
  supabase: SupabaseClient,
  orgId: string,
  minutesJustAdded: number
) {
  try {
    const { data: org } = await supabase
      .from('organizations')
      .select('user_id, plan, minutes_used, minutes_limit')
      .eq('id', orgId)
      .single()
    if (!org || !org.minutes_limit || org.minutes_limit <= 0) return

    const after = org.minutes_used ?? 0
    const before = after - minutesJustAdded
    const threshold = org.minutes_limit * USAGE_ALERT_THRESHOLD

    // Only fire on the call that first crosses the threshold (and not at 100%,
    // which is its own situation), so the owner gets exactly one heads-up.
    if (before >= threshold || after < threshold || after >= org.minutes_limit) return

    const { data: userRes } = await supabase.auth.admin.getUserById(org.user_id)
    const email = userRes?.user?.email
    if (!email) return

    await sendEmail({
      to: email,
      ...usageAlertEmail({
        minutesUsed: after,
        minutesLimit: org.minutes_limit,
        planName: PLANS[(org.plan ?? 'trial') as Plan]?.name,
      }),
    })
  } catch (err) {
    console.error('Usage alert failed:', err instanceof Error ? err.message : err)
  }
}
