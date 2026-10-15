import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { DashboardShell } from '@/components/dashboard/DashboardShell'
import { minutesBannerState } from '@/components/billing/minutes-logic'
import type { Agent, Organization } from '@/types'

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: org } = await supabase
    .from('organizations')
    .select('*')
    .eq('user_id', user.id)
    .single()

  if (!org) redirect('/login')
  if (!org.onboarding_completed) redirect('/onboarding')

  const { data: agent } = await supabase
    .from('agents')
    .select('*')
    .eq('org_id', org.id)
    .order('created_at', { ascending: true })
    .limit(1)
    .maybeSingle()

  const { count: activeNumbers } = await supabase
    .from('phone_numbers')
    .select('id', { count: 'exact', head: true })
    .eq('org_id', org.id)
    .eq('is_active', true)

  // Out of minutes / running low, decided here where the minute-cap switch
  // (VOICE_TRIAL_MINUTES_ENFORCED) is known: the same rule as the call paths.
  const minutesBanner = minutesBannerState({
    plan: org.plan as string | null,
    minutes_used: org.minutes_used as number | null,
    minutes_limit: org.minutes_limit as number | null,
    extra_minutes_balance: (org.extra_minutes_balance as number | null | undefined) ?? null,
    auto_topup_enabled: (org.auto_topup_enabled as boolean | null | undefined) ?? null,
    business_type: (org.business_type as Organization['business_type']) ?? null,
  })

  return (
    <DashboardShell
      org={org as Organization}
      agent={agent as Agent | null}
      userEmail={user.email ?? ''}
      hasPhoneNumber={(activeNumbers ?? 0) > 0}
      minutesBanner={minutesBanner}
    >
      {children}
    </DashboardShell>
  )
}
