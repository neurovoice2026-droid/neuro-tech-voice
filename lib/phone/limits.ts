import type { SupabaseClient } from '@supabase/supabase-js'
import { PLANS } from '@/types'
import type { Plan } from '@/types'

export type Allowance =
  | { allowed: true }
  | { allowed: false; error: string; status: number }

/**
 * Enforces the "numbers are included in the plan" model:
 * - trial/free users must upgrade before buying a real (paid) number,
 * - paid users can hold up to their plan's included number count.
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

  if (plan === 'trial' || plan === 'custom') {
    return plan === 'trial'
      ? { allowed: false, status: 402, error: 'Upgrade to a paid plan to add a phone number.' }
      : { allowed: true } // custom is negotiated — no hard cap
  }

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
