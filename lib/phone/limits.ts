import type { SupabaseClient } from '@supabase/supabase-js'
import { PLANS } from '@/types'
import type { Plan } from '@/types'

export type Allowance =
  | { allowed: true }
  | { allowed: false; error: string; status: number }

/**
 * Enforces the "numbers are included in the plan" model. Every tier — including
 * the free trial — can hold up to its plan's included number count (trial = 1).
 * Buying beyond the limit requires upgrading. Custom has no hard cap.
 */
export async function checkNumberAllowance(
  supabase: SupabaseClient,
  orgId: string
): Promise<Allowance> {
  const { data: org } = await supabase
    .from('organizations')
    .select('plan')
    .eq('id', orgId)
    .single()

  const plan = (org?.plan ?? 'trial') as Plan

  if (plan === 'custom') return { allowed: true } // negotiated — no hard cap

  const { count } = await supabase
    .from('phone_numbers')
    .select('id', { count: 'exact', head: true })
    .eq('org_id', orgId)

  const limit = PLANS[plan].max_phone_numbers
  if ((count ?? 0) >= limit) {
    return {
      allowed: false,
      status: 402,
      error: `Your ${PLANS[plan].name} plan includes ${limit} number${limit !== 1 ? 's' : ''}. Upgrade your plan to add more.`,
    }
  }

  return { allowed: true }
}
