import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { AgentPageClient } from '@/components/agent/AgentPageClient'
import { parseAgentTab } from '@/components/agent/agent-tabs'
import type { AgentOrgSummary, LinkedPhoneNumber } from '@/components/agent/types'
import { getOrgAgent, getOrgContext } from '@/lib/api/auth'
import { entitlementsFor } from '@/lib/billing/entitlements'

export const metadata: Metadata = {
  title: 'Agent',
}

export default async function AgentPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const ctx = await getOrgContext()
  if (!ctx) redirect('/login')

  const [agent, numbersResult, params] = await Promise.all([
    getOrgAgent(ctx),
    ctx.supabase
      .from('phone_numbers')
      .select('id, number, friendly_name, is_active')
      .eq('org_id', ctx.org.id)
      .order('created_at', { ascending: false }),
    searchParams,
  ])

  if (numbersResult.error) {
    console.error('[agent] phone number lookup failed', numbersResult.error.code, numbersResult.error.message)
  }

  const { org } = ctx
  const orgSummary: AgentOrgSummary = {
    id: org.id,
    name: org.name,
    industry: org.industry,
    description: org.description,
    plan: org.plan,
    timezone: org.timezone,
    sms_enabled: org.sms_enabled,
  }

  // An org without an agent row gets one from GET /api/agent (created with the
  // service role); the client shows onboarding guidance until then.
  return (
    <AgentPageClient
      initialAgent={agent}
      org={orgSummary}
      entitlements={entitlementsFor(org.plan)}
      phoneNumbers={(numbersResult.data ?? []) as LinkedPhoneNumber[]}
      initialTab={parseAgentTab(params.tab)}
    />
  )
}
