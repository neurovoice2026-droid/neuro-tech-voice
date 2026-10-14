import { createClient } from '@/lib/supabase/server'
import { onboardingVariant, type BusinessTypeFields, type OnboardingVariant } from '@/lib/commerce/business-type'
import { OnboardingTopBar } from '@/components/onboarding/OnboardingTopBar'

/**
 * The top bar's step list follows the organization's business type (the same row the page
 * branches on). Signed-out visitors are redirected by the page; the bar then only needs a default.
 */
async function topBarVariant(): Promise<OnboardingVariant> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return 'services'
  // '*' rather than the two columns: before migration 024 the columns do not exist and the
  // whole select would fail; a row without them reads as the service flow (onboardingVariant).
  const { data: org } = await supabase.from('organizations').select('*').eq('user_id', user.id).maybeSingle()
  return onboardingVariant(org as BusinessTypeFields | null)
}

export default async function OnboardingLayout({ children }: { children: React.ReactNode }) {
  const variant = await topBarVariant()
  return (
    <div className="min-h-dvh bg-white">
      <OnboardingTopBar variant={variant} />
      {/* pt-14 clears the fixed 56 px top bar; pb-32 clears the sticky step actions on phones. */}
      <main className="pt-14">
        <div className="mx-auto w-full max-w-[640px] px-4 pt-10 pb-32 md:pt-14">{children}</div>
      </main>
    </div>
  )
}
