import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { DashboardShell } from '@/components/dashboard/DashboardShell'
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
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  const { count: activeNumbers } = await supabase
    .from('phone_numbers')
    .select('id', { count: 'exact', head: true })
    .eq('org_id', org.id)
    .eq('is_active', true)

  return (
    <DashboardShell
      org={org as Organization}
      agent={agent as Agent | null}
      userEmail={user.email ?? ''}
      hasPhoneNumber={(activeNumbers ?? 0) > 0}
    >
      {children}
    </DashboardShell>
  )
}
