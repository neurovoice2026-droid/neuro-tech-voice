import { unstable_rethrow } from 'next/navigation'
import { requireOrg } from '@/lib/api/auth'
import { RequestError } from '@/lib/api/http'
import { createLogger } from '@/lib/observability/logger'
import { SettingsPageClient } from '@/components/settings/SettingsPageClient'

export default async function SettingsPage() {
  let ctx: Awaited<ReturnType<typeof requireOrg>>
  try {
    ctx = await requireOrg({ allowDeleting: true })
  } catch (err) {
    // Next.js control-flow signals (dynamic rendering, redirects) are not errors.
    unstable_rethrow(err)
    // Signed out / no organization: the dashboard layout redirects; render nothing.
    if (err instanceof RequestError && (err.status === 401 || err.status === 404)) return null
    createLogger({ route: 'page.settings' }).error('settings_page.require_org_failed', err)
    throw err
  }
  const { user, org } = ctx
  return (
    <SettingsPageClient
      businessName={org.name}
      email={user.email ?? null}
      plan={org.plan}
      deletionRequested={!!org.deletion_requested_at}
    />
  )
}
