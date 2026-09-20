import { redirect } from 'next/navigation'
import { getOrgContext, getSessionUser } from '@/lib/api/auth'
import { DashboardShell } from '@/components/dashboard/DashboardShell'
import { MissingOrganization } from '@/components/shared/MissingOrganization'

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  // React cache(): the page below reuses this same user + organization lookup
  // instead of repeating the Auth call and the organizations query.
  const ctx = await getOrgContext()
  if (!ctx) {
    if (!(await getSessionUser())) redirect('/login')
    // Signed in, but the organization row the sign-up trigger creates is
    // missing. Redirecting anywhere would bounce between /login, /dashboard
    // and /onboarding, so explain and offer a way out instead.
    return <MissingOrganization area="dashboard" />
  }
  if (!ctx.org.onboarding_completed) redirect('/onboarding')

  // Pages load the agent themselves; the shell only needs the number banner.
  const activeNumbers = await ctx.supabase
    .from('phone_numbers')
    .select('id', { count: 'exact', head: true })
    .eq('org_id', ctx.org.id)
    .eq('is_active', true)

  if (activeNumbers.error) {
    // Only drives the "add a number" banner; don't take the dashboard down for it.
    console.error('[dashboard] active number count failed', activeNumbers.error.code)
  }

  return (
    <DashboardShell
      org={ctx.org}
      userEmail={ctx.user.email ?? ''}
      // Unknown (query failed) counts as having a number, so nobody is told
      // their agent can't take calls because of a transient error.
      hasPhoneNumber={activeNumbers.error ? true : (activeNumbers.count ?? 0) > 0}
    >
      {children}
    </DashboardShell>
  )
}
