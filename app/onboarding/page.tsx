import { Suspense } from 'react'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { commerceStepOf, onboardingVariant } from '@/lib/commerce/business-type'
import { OnboardingWrapper } from '@/components/onboarding/OnboardingWrapper'
import { Step0BusinessType } from '@/components/onboarding/Step0BusinessType'
import { CommerceOnboardingWrapper } from '@/components/onboarding/commerce/CommerceOnboardingWrapper'
import type { Organization } from '@/types'

export default async function OnboardingPage() {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) redirect('/login')

  // '*' includes business_type, business_type_selected_at, onboarding_step and commerce_profile
  // once migration 024 is applied; before it, the row has no business_type column and
  // onboardingVariant() reads it as the service flow (so nothing here can break legacy orgs).
  const { data: org } = await supabase
    .from('organizations')
    .select('*')
    .eq('user_id', user.id)
    .single()

  if (!org) redirect('/login')
  if (org.onboarding_completed) redirect('/dashboard')

  // The server decides the flow from the row; the browser never picks it.
  const variant = onboardingVariant(org)

  if (variant === 'choose') {
    return <Step0BusinessType />
  }

  if (variant === 'ecommerce') {
    return (
      // useSearchParams (the Shopify return ?commerce=…) needs a Suspense boundary.
      <Suspense>
        <CommerceOnboardingWrapper
          initialStep={commerceStepOf(org.onboarding_step)}
          organization={org as Organization}
        />
      </Suspense>
    )
  }

  return (
    <OnboardingWrapper
      initialStep={org.onboarding_step ?? 1}
      organization={org as Organization}
    />
  )
}
