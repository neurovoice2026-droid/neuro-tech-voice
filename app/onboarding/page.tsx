import { redirect } from 'next/navigation'
import { getOrgAgent, getOrgContext, getSessionUser } from '@/lib/api/auth'
import { MissingOrganization } from '@/components/shared/MissingOrganization'
import { CheckoutActivation } from '@/components/onboarding/CheckoutActivation'
import { OnboardingWrapper } from '@/components/onboarding/OnboardingWrapper'
import type { ExistingAgentDraft, OnboardingOrganization } from './_lib/onboarding-state'

export default async function OnboardingPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  const { checkout } = await searchParams
  const paid = checkout === 'success'
  const ctx = await getOrgContext()
  if (!ctx) {
    if (!(await getSessionUser())) redirect('/login')
    // Signed in without an organization row: /login would send them to /dashboard and back here.
    return <MissingOrganization area="onboarding" />
  }
  const { org, supabase } = ctx
  if (org.onboarding_completed) redirect(paid ? '/dashboard?welcome=true' : '/dashboard')
  // Back from Stripe Checkout before its webhook finished onboarding: wait for it here.
  if (paid) return <CheckoutActivation />

  // Everything below only pre-fills the wizard: a failed lookup is logged and
  // the owner simply starts from blank fields.
  const [agent, phone, calendar] = await Promise.all([
    getOrgAgent(ctx).catch((error: unknown) => {
      console.error('[onboarding] agent lookup failed', error)
      return null
    }),
    supabase
      .from('phone_numbers')
      .select('id')
      .eq('org_id', org.id)
      .eq('is_active', true)
      .limit(1),
    supabase
      .from('integrations')
      .select('id')
      .eq('org_id', org.id)
      .eq('type', 'google_calendar')
      .eq('is_active', true)
      .limit(1),
  ])
  if (phone.error) console.error('[onboarding] phone number lookup failed', phone.error.code, phone.error.message)
  if (calendar.error) console.error('[onboarding] calendar lookup failed', calendar.error.code, calendar.error.message)

  const organization: OnboardingOrganization = {
    id: org.id,
    name: org.name,
    industry: org.industry,
    website: org.website,
    description: org.description,
    timezone: org.timezone,
  }

  const existingAgent: ExistingAgentDraft | null = agent
    ? {
        name: agent.name,
        language: agent.language,
        system_prompt: agent.system_prompt,
        first_message: agent.first_message,
        tone: agent.tone,
        cartesia_voice_id: agent.cartesia_voice_id,
        cartesia_voice_name: agent.cartesia_voice_name,
      }
    : null

  return (
    <OnboardingWrapper
      initialStep={org.onboarding_step ?? 1}
      organization={organization}
      existingAgent={existingAgent}
      hasPhoneNumber={(phone.data?.length ?? 0) > 0}
      calendarConnected={(calendar.data?.length ?? 0) > 0}
    />
  )
}
