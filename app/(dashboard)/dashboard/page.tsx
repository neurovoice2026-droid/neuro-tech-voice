import { Suspense } from 'react'
import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { getOrgAgent, getOrgContext } from '@/lib/api/auth'
import { DashboardClient, DashboardSkeleton } from '@/components/dashboard/DashboardClient'
import type { SetupSnapshot } from '@/components/dashboard/DashboardWelcome'
import { PLANS, type Integration } from '@/types'

export const metadata: Metadata = {
  title: 'Dashboard',
}

export default function DashboardPage() {
  return (
    <Suspense fallback={<DashboardSkeleton />}>
      <DashboardData />
    </Suspense>
  )
}

async function DashboardData() {
  // Cached per request: the layout's lookup is reused, not repeated.
  const ctx = await getOrgContext()
  if (!ctx) redirect('/login')

  const [agent, integrationsRes, phoneRes, firstCallRes] = await Promise.all([
    getOrgAgent(ctx),
    // Only what the status card reads; token columns are never selectable from the browser session.
    ctx.supabase.from('integrations').select('type, is_active').eq('org_id', ctx.org.id),
    ctx.supabase
      .from('phone_numbers')
      .select('number')
      .eq('org_id', ctx.org.id)
      .eq('is_active', true)
      .order('created_at', { ascending: true })
      .limit(1)
      .maybeSingle(),
    // The setup checklist's "first real call": one the agent answered, not a refused or test call.
    ctx.supabase
      .from('calls')
      .select('id')
      .eq('org_id', ctx.org.id)
      .eq('direction', 'inbound')
      .eq('status', 'completed')
      .eq('is_test', false)
      .limit(1),
  ])

  if (integrationsRes.error) {
    console.error('[dashboard] integrations lookup failed', integrationsRes.error.code, integrationsRes.error.message)
  }
  if (phoneRes.error) {
    console.error('[dashboard] phone number lookup failed', phoneRes.error.code, phoneRes.error.message)
  }

  const integrations = (integrationsRes.data ?? []) as Pick<Integration, 'type' | 'is_active'>[]
  const phoneNumber = (phoneRes.data as { number: string } | null)?.number ?? null
  // Any failed lookup leaves the checklist to read its own data in the browser.
  const setup: SetupSnapshot | null =
    integrationsRes.error || phoneRes.error || firstCallRes.error
      ? null
      : {
          orgId: ctx.org.id,
          plan: Object.prototype.hasOwnProperty.call(PLANS, ctx.org.plan) ? ctx.org.plan : 'trial',
          agentName: agent?.name || 'Your agent',
          voiceName: agent?.cartesia_voice_name || agent?.voice_name || null,
          hasVoice: Boolean(agent?.cartesia_voice_id || agent?.voice_id),
          phoneNumber,
          calendarConnected: integrations.some((i) => i.type === 'google_calendar' && i.is_active),
          hasFirstCall: (firstCallRes.data?.length ?? 0) > 0,
        }
  if (firstCallRes.error) {
    console.error('[dashboard] first call lookup failed', firstCallRes.error.code, firstCallRes.error.message)
  }

  return <DashboardClient org={ctx.org} agent={agent} integrations={integrations} phoneNumber={phoneNumber} setup={setup} />
}
