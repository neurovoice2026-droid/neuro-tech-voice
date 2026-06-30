import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { OnboardingWrapper } from '@/components/onboarding/OnboardingWrapper'
import type { Organization } from '@/types'

export default async function OnboardingPage() {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) redirect('/login')

  const { data: org } = await supabase
    .from('organizations')
    .select('*')
    .eq('user_id', user.id)
    .single()

  if (!org) redirect('/login')
  if (org.onboarding_completed) redirect('/dashboard')

  return (
    <OnboardingWrapper
      initialStep={org.onboarding_step ?? 1}
      organization={org as Organization}
    />
  )
}
