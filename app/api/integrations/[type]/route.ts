import { NextResponse, type NextRequest } from 'next/server'
import { z } from 'zod'
import { ApiError, handleRoute, noStore } from '@/lib/api/http'
import { requireOrgContext } from '@/lib/api/auth'
import { disconnectGoogleIntegration, isGoogleIntegrationType } from '@/lib/google/client'
import { enforceRateLimit, RATE_LIMITS } from '@/lib/security/rate-limit'
import { createAdminClient } from '@/lib/supabase/admin'
import { resyncOrgAgentsAfterResponse } from '@/lib/voice/sync'
import type { IntegrationType } from '@/types'

export const runtime = 'nodejs'
// Disconnecting Google Calendar re-syncs the provider agents after the response.
export const maxDuration = 60

type Params = { params: Promise<{ type: string }> }

const integrationTypeSchema = z.enum(['google_calendar', 'gmail', 'google_sheets', 'google_docs', 'google_drive', 'webhook'])

/** Never the token columns: they aren't selectable by users after migration 011. */
const STATUS_COLUMNS = 'type, is_active, account_email, scopes, connected_at, config'
const LEGACY_STATUS_COLUMNS = 'type, is_active, connected_at, config'

function parseType(raw: string): IntegrationType {
  const parsed = integrationTypeSchema.safeParse(raw)
  if (!parsed.success) throw new ApiError(404, 'integration_not_found', 'That integration doesn’t exist.')
  return parsed.data
}

// Connection status for one integration type ({ connected, integration }).
export const GET = handleRoute(async (_req: NextRequest, { params }: Params) => {
  const type = parseType((await params).type)
  const ctx = await requireOrgContext()
  const select = (columns: string) =>
    ctx.supabase.from('integrations').select(columns).eq('org_id', ctx.org.id).eq('type', type).maybeSingle()
  let { data, error } = await select(STATUS_COLUMNS)
  // Migration 010 (account_email, scopes) not applied yet.
  if (error?.code === '42703') ({ data, error } = await select(LEGACY_STATUS_COLUMNS))
  if (error) {
    console.error('[integrations] status lookup failed', type, error.code, error.message)
    throw new ApiError(500, 'integration_unavailable', 'We couldn’t check this connection. Please try again.')
  }
  const row = data as { is_active?: boolean } | null
  return noStore(NextResponse.json({ connected: !!row?.is_active, integration: data ?? null }))
})

// Webhooks used to be saved here, but nothing ever sent to that address.
// They're set up per workflow now, signed and retried, so this answers with
// directions instead of storing a URL that would never be used.
export const POST = handleRoute(async (_req: NextRequest, { params }: Params) => {
  const type = parseType((await params).type)
  await requireOrgContext()
  if (type === 'webhook') {
    throw new ApiError(
      400,
      'use_workflows',
      'Webhooks are set up inside a workflow. Open Workflows and add a “Send webhook” step.'
    )
  }
  throw new ApiError(400, 'use_google_connect', 'Connect Google services from the Integrations page.')
})

// Disconnect. When the last Google service goes, Google's access is revoked
// too (lib/google/client.ts), so no token with access to the account is left.
export const DELETE = handleRoute(async (_req: NextRequest, { params }: Params) => {
  const type = parseType((await params).type)
  const ctx = await requireOrgContext()
  await enforceRateLimit(RATE_LIMITS.apiWrite, ctx.user.id)

  if (isGoogleIntegrationType(type)) {
    try {
      const { revoked } = await disconnectGoogleIntegration(ctx.org.id, type)
      // Booking tools depend on the calendar connection.
      if (type === 'google_calendar') await resyncOrgAgentsAfterResponse(ctx.org.id, 'disconnecting Google Calendar')
      return noStore(NextResponse.json({ connected: false, revoked_google_access: revoked }))
    } catch (error) {
      console.error('[integrations] Google disconnect failed', type, error instanceof Error ? error.message : error)
      throw new ApiError(500, 'disconnect_failed', 'We couldn’t disconnect this right now. Please try again.')
    }
  }

  // The legacy saved webhook address (never used for sending).
  const { error } = await createAdminClient().from('integrations').delete().eq('org_id', ctx.org.id).eq('type', type)
  if (error) {
    console.error('[integrations] disconnect failed', type, error.code, error.message)
    throw new ApiError(500, 'disconnect_failed', 'We couldn’t remove this right now. Please try again.')
  }
  return noStore(NextResponse.json({ connected: false }))
})
