import 'server-only'
// Is an organization being deleted? Read by code that could re-create
// provider resources for it (agent sync, number binding) while the deletion
// job removes them. Fails open on a database without migration 021 (the
// column is missing: nothing can be in deletion there).

import type { SupabaseClient } from '@supabase/supabase-js'
import type { Logger } from '@/lib/observability/logger'

/** PostgREST / Postgres "undefined column" (migration 021 not applied yet). */
export function isMissingColumn(error: { code?: string } | null | undefined): boolean {
  return error?.code === '42703' || error?.code === 'PGRST204'
}

export async function isOrgBeingDeleted(db: SupabaseClient, orgId: string, log?: Logger): Promise<boolean> {
  const { data, error } = await db.from('organizations').select('deletion_requested_at').eq('id', orgId).maybeSingle()
  if (error) {
    if (isMissingColumn(error)) return false
    // The caller's own reads hit the same database: report, and let them decide on their own errors.
    log?.error('account_state.read_failed', error, { orgId })
    return false
  }
  return !!(data as { deletion_requested_at?: string | null } | null)?.deletion_requested_at
}
