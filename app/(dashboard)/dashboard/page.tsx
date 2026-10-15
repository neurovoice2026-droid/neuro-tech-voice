import { Suspense } from 'react'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { DashboardClient } from '@/components/dashboard/DashboardClient'
import { CommerceDashboard } from '@/components/commerce/CommerceDashboard'
import type { Agent, Organization, Integration } from '@/types'

export default async function DashboardPage() {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: org } = await supabase
    .from('organizations')
    .select('*')
    .eq('user_id', user.id)
    .single()

  if (!org) redirect('/login')

  const [agentRes, integrationsRes, phoneRes] = await Promise.all([
    supabase
      .from('agents')
      .select('*')
      .eq('org_id', org.id)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle(),
    // Named columns: the token column is not readable by the owner's session (030).
    supabase
      .from('integrations')
      .select('id, org_id, type, config, is_active, connected_at, created_at')
      .eq('org_id', org.id),
    supabase
      .from('phone_numbers')
      .select('number')
      .eq('org_id', org.id)
      .eq('is_active', true)
      .limit(1)
      .maybeSingle(),
  ])

  // An e-commerce organization gets the store overview above the generic cards; every other
  // organization gets the dashboard exactly as before.
  if ((org as Organization).business_type === 'ecommerce') {
    return (
      <Suspense>
        <CommerceDashboard
          org={org as Organization}
          agent={(agentRes.data as Agent | null) ?? null}
          phoneNumber={phoneRes.data?.number ?? null}
        />
      </Suspense>
    )
  }

  return (
    <Suspense>
      <DashboardClient
        org={org as Organization}
        agent={(agentRes.data as Agent | null) ?? null}
        integrations={(integrationsRes.data as Integration[]) ?? []}
        phoneNumber={phoneRes.data?.number ?? null}
      />
    </Suspense>
  )
}
