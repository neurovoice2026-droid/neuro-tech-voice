import { requireOrg } from '@/lib/api/auth'
import { RequestError } from '@/lib/api/http'
import { createLogger } from '@/lib/observability/logger'
import { defaultAgentName, ensureAgent } from '@/lib/agents/ensure-agent'
import { AgentPageClient } from '@/components/agent/AgentPageClient'
import type { PhoneNumber } from '@/types'

export default async function AgentPage() {
  let ctx: Awaited<ReturnType<typeof requireOrg>>
  try {
    ctx = await requireOrg()
  } catch (err) {
    // Signed out / no organization: the dashboard layout redirects; render nothing.
    if (err instanceof RequestError) return null
    throw err
  }
  const { supabase, org } = ctx

  // ensureAgent: the org always has exactly one agent to edit (older accounts
  // may lack one), created without duplicates even under concurrent requests.
  const [agent, phoneNumbersRes] = await Promise.all([
    ensureAgent(org.id, defaultAgentName(org.name)),
    supabase
      .from('phone_numbers')
      .select('*')
      .eq('org_id', org.id)
      .order('created_at', { ascending: false }),
  ])
  if (phoneNumbersRes.error) {
    createLogger({ orgId: org.id, route: 'page.agent' }).error('agent_page.phone_numbers_failed', phoneNumbersRes.error)
    throw new Error('Could not load your phone numbers.')
  }

  return (
    <AgentPageClient
      initialAgent={agent}
      phoneNumbers={(phoneNumbersRes.data ?? []) as PhoneNumber[]}
    />
  )
}
