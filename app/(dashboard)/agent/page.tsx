import { unstable_rethrow } from 'next/navigation'
import { UserX } from 'lucide-react'
import { requireOrg } from '@/lib/api/auth'
import { RequestError } from '@/lib/api/http'
import { createLogger } from '@/lib/observability/logger'
import { defaultAgentName, ensureAgent } from '@/lib/agents/ensure-agent'
import { AgentPageClient } from '@/components/agent/AgentPageClient'
import { EmptyState } from '@/components/shared/EmptyState'
import { PageContainer } from '@/components/shared/PageContainer'
import type { PhoneNumber } from '@/types'

export default async function AgentPage() {
  let ctx: Awaited<ReturnType<typeof requireOrg>>
  try {
    ctx = await requireOrg()
  } catch (err) {
    // Next.js control-flow signals (dynamic rendering, redirects) are not errors.
    unstable_rethrow(err)
    // Signed out / no organization: the dashboard layout redirects; render nothing.
    if (err instanceof RequestError && (err.status === 401 || err.status === 404)) return null
    // Account deletion in progress: nothing to edit any more.
    if (err instanceof RequestError && err.status === 403 && (err.details as { reason?: string } | undefined)?.reason === 'account_deleting') {
      return (
        <PageContainer width="narrow">
          <h1 className="sr-only">Agent</h1>
          <div role="status" className="mt-10">
            <EmptyState
              icon={UserX}
              title={err.message}
              description="Your agent no longer answers calls and its settings can no longer be changed."
            />
          </div>
        </PageContainer>
      )
    }
    // Anything else (e.g. the organization read failed) is a real error: log it
    // and let app/(dashboard)/error.tsx render it with a retry.
    createLogger({ route: 'page.agent' }).error('agent_page.require_org_failed', err)
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
      orgTimezone={ctx.org.timezone}
    />
  )
}
