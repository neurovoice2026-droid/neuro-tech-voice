import { redirect } from 'next/navigation'
import type { SupabaseClient } from '@supabase/supabase-js'
import { WorkflowsClient } from '@/components/workflows/WorkflowsClient'
import type { WorkflowCapabilities } from '@/components/workflows/meta'
import { getOrgContext } from '@/lib/api/auth'
import { entitlementsFor, requiredPlanFor } from '@/lib/billing/entitlements'
import { isGoogleConfigured } from '@/lib/env'
import { isEncryptionConfigured } from '@/lib/security/crypto'
import { WORKFLOW_SUMMARY_COLUMNS, toWorkflowSummary } from '@/lib/workflows/service'
import type { GoogleIntegrationType, WorkflowSummary } from '@/lib/workflows/types'

export const metadata = { title: 'Workflows' }

const GOOGLE_TYPES: GoogleIntegrationType[] = ['google_calendar', 'gmail', 'google_sheets', 'google_docs', 'google_drive']

async function loadWorkflows(supabase: SupabaseClient, orgId: string): Promise<WorkflowSummary[] | null> {
  const { data, error } = await supabase
    .from('workflows')
    .select(WORKFLOW_SUMMARY_COLUMNS)
    .eq('org_id', orgId)
    .order('created_at', { ascending: false })
  if (error) {
    console.error('[workflows] page list failed', error.code, error.message)
    return null
  }
  return ((data ?? []) as unknown as Record<string, unknown>[]).map(toWorkflowSummary)
}

async function loadConnections(supabase: SupabaseClient, orgId: string): Promise<WorkflowCapabilities['connections']> {
  const connections = Object.fromEntries(
    GOOGLE_TYPES.map((type) => [type, { connected: false, account_email: null }])
  ) as WorkflowCapabilities['connections']

  // Token columns are never selected; account_email only exists after migration 010.
  const select = (columns: string) => supabase.from('integrations').select(columns).eq('org_id', orgId)
  let result = await select('type, is_active, account_email')
  if (result.error?.code === '42703') result = await select('type, is_active')
  if (result.error) {
    console.error('[workflows] integrations lookup failed', result.error.code, result.error.message)
    return connections
  }
  for (const row of (result.data ?? []) as unknown as { type: string; is_active: boolean; account_email?: string | null }[]) {
    if (row.type in connections) {
      connections[row.type as GoogleIntegrationType] = { connected: row.is_active, account_email: row.account_email ?? null }
    }
  }
  return connections
}

export default async function WorkflowsPage() {
  const ctx = await getOrgContext()
  if (!ctx) redirect('/login')

  const [workflows, connections] = await Promise.all([
    loadWorkflows(ctx.supabase, ctx.org.id),
    loadConnections(ctx.supabase, ctx.org.id),
  ])
  const entitlements = entitlementsFor(ctx.org.plan)

  const capabilities: WorkflowCapabilities = {
    google: {
      allowed: entitlements.googleIntegrations,
      requiredPlan: requiredPlanFor('googleIntegrations'),
      available: isGoogleConfigured() && isEncryptionConfigured(),
    },
    sms: { allowed: entitlements.smsConfirmations, requiredPlan: requiredPlanFor('smsConfirmations') },
    connections,
  }

  return <WorkflowsClient initialWorkflows={workflows} capabilities={capabilities} />
}
