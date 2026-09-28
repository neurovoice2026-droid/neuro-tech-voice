import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { SettingsPageClient } from '@/components/settings/SettingsPageClient'
import { getOrgContext } from '@/lib/api/auth'
import { entitlementsFor, requiredPlanFor } from '@/lib/billing/entitlements'

export const metadata: Metadata = {
  title: 'Settings',
}

export default async function SettingsPage() {
  const ctx = await getOrgContext()
  if (!ctx) redirect('/login')
  const { org, user } = ctx

  return (
    <SettingsPageClient
      organization={{ name: org.name, timezone: org.timezone, sms_enabled: org.sms_enabled }}
      email={user.email}
      smsEntitled={entitlementsFor(org.plan).smsConfirmations}
      smsRequiredPlan={requiredPlanFor('smsConfirmations')}
    />
  )
}
