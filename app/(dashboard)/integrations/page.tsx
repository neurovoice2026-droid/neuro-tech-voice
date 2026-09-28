import { redirect } from 'next/navigation'
import type { SupabaseClient } from '@supabase/supabase-js'
import { IntegrationsClient, type GoogleConnection } from '@/components/integrations/IntegrationsClient'
import { getOrgContext } from '@/lib/api/auth'
import { entitlementsFor, requiredPlanFor } from '@/lib/billing/entitlements'
import { isGoogleConfigured } from '@/lib/env'
import { isEncryptionConfigured } from '@/lib/security/crypto'
import type { GoogleIntegrationType } from '@/lib/workflows/types'

export const metadata = { title: 'Integrations' }

const GOOGLE_TYPES: GoogleIntegrationType[] = ['google_calendar', 'gmail', 'google_sheets', 'google_docs', 'google_drive']

interface IntegrationRow {
  type: string
  is_active: boolean
  account_email?: string | null
  connected_at: string | null
  config: Record<string, unknown> | null
}

async function loadIntegrations(supabase: SupabaseClient, orgId: string): Promise<IntegrationRow[] | null> {
  // Named columns only: the token columns aren't readable by users after migration 011.
  const select = (columns: string) => supabase.from('integrations').select(columns).eq('org_id', orgId)
  let result = await select('type, is_active, account_email, connected_at, config')
  // account_email arrives with migration 010.
  if (result.error?.code === '42703') result = await select('type, is_active, connected_at, config')
  if (result.error) {
    console.error('[integrations] page lookup failed', result.error.code, result.error.message)
    return null
  }
  return (result.data ?? []) as unknown as IntegrationRow[]
}

export default async function IntegrationsPage() {
  const ctx = await getOrgContext()
  if (!ctx) redirect('/login')

  const rows = await loadIntegrations(ctx.supabase, ctx.org.id)
  const connections = Object.fromEntries(
    GOOGLE_TYPES.map((type) => [type, { connected: false, needs_reconnect: false, account_email: null, connected_at: null }])
  ) as Record<GoogleIntegrationType, GoogleConnection>
  for (const row of rows ?? []) {
    if (row.type in connections) {
      connections[row.type as GoogleIntegrationType] = {
        connected: row.is_active,
        // Set when Google access was revoked or expired while in use (lib/google/client.ts).
        needs_reconnect: !row.is_active && typeof row.config?.last_error === 'string',
        account_email: row.account_email ?? null,
        connected_at: row.connected_at,
      }
    }
  }

  return (
    <IntegrationsClient
      connections={connections}
      legacyWebhookSaved={(rows ?? []).some((row) => row.type === 'webhook')}
      google={{
        allowed: entitlementsFor(ctx.org.plan).googleIntegrations,
        requiredPlan: requiredPlanFor('googleIntegrations'),
        available: isGoogleConfigured() && isEncryptionConfigured(),
      }}
      loaded={rows !== null}
    />
  )
}
