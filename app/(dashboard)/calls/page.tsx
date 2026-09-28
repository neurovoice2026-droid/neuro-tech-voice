import { Suspense } from 'react'
import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { CallsPageClient, CallsPageSkeleton } from '@/components/calls/CallsPageClient'
import type { OutboundCallSetup } from '@/components/calls/outbound-call'
import { getOrgAgent, getOrgContext } from '@/lib/api/auth'
import { entitlementsFor, requiredPlanFor } from '@/lib/billing/entitlements'
import { isTwilioConfigured } from '@/lib/env'
import { activeOrgNumber } from '@/lib/twilio/numbers'

export const metadata: Metadata = {
  title: 'Calls',
}

// The list reads its filters from the URL (useSearchParams), so it renders
// inside a Suspense boundary; the fallback mirrors the final layout.
export default function CallsPage() {
  return (
    <Suspense fallback={<CallsPageSkeleton />}>
      <CallsData />
    </Suspense>
  )
}

async function CallsData() {
  // Cached per request: the layout's lookup is reused, not repeated.
  const ctx = await getOrgContext()
  if (!ctx) redirect('/login')

  const [agent, number] = await Promise.all([
    getOrgAgent(ctx),
    activeOrgNumber(ctx.supabase, ctx.org.id).catch(() => null),
  ])
  // What "Call a customer" needs; the outbound route checks all of it again.
  const outbound: OutboundCallSetup = {
    entitled: entitlementsFor(ctx.org.plan).outboundCalls,
    requiredPlan: requiredPlanFor('outboundCalls'),
    configured: isTwilioConfigured(),
    phoneNumber: number?.number ?? null,
    agentActive: agent ? agent.is_active : null,
  }
  return <CallsPageClient outbound={outbound} />
}
