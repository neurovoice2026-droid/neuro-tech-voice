import { NextResponse } from 'next/server'
import { z } from 'zod'
import { ApiError, handleRoute, noStore, parseJson } from '@/lib/api/http'
import { requireOrgContext } from '@/lib/api/auth'
import { RATE_LIMITS, enforceRateLimit } from '@/lib/security/rate-limit'
import { resyncOrgAgentAfterResponse } from './agent-resync'
import { canonicalTimeZone } from './timezone'

export const runtime = 'nodejs'
// Covers the agent provider sync that runs after the response.
export const maxDuration = 60

const bodySchema = z
  .object({
    name: z.string().trim().min(1, 'Add your organization name').max(100, 'Keep the name under 100 characters').optional(),
    timezone: z.string().max(64).optional(),
    sms_enabled: z.boolean().optional(),
  })
  .strict()
  .refine((body) => Object.keys(body).length > 0, { message: 'Nothing to update' })

const RETURN_COLUMNS = 'id, name, timezone, sms_enabled, updated_at'

export const PATCH = handleRoute(async (req) => {
  const ctx = await requireOrgContext()
  await enforceRateLimit(RATE_LIMITS.apiWrite, ctx.user.id)
  const body = await parseJson(req, bodySchema)

  const patch: { name?: string; timezone?: string; sms_enabled?: boolean } = {}
  if (body.name !== undefined) patch.name = body.name
  if (body.sms_enabled !== undefined) patch.sms_enabled = body.sms_enabled
  if (body.timezone !== undefined) {
    const zone = canonicalTimeZone(body.timezone)
    if (!zone) throw new ApiError(400, 'validation_error', 'Choose a time zone from the list.')
    patch.timezone = zone
  }

  // Name, time zone and the SMS switch are owner-editable columns, so the
  // session client (RLS: update own organization) is the right client.
  const { data, error } = await ctx.supabase
    .from('organizations')
    .update(patch)
    .eq('id', ctx.org.id)
    .select(RETURN_COLUMNS)
    .single()

  if (error) {
    if (error.code === '42703') {
      console.error('[settings] organizations is missing columns from migration 010')
      throw new ApiError(503, 'not_configured', 'Time zone and SMS settings aren’t available yet. Please try again later.')
    }
    console.error('[settings] organization update failed', error.code, error.message)
    throw new ApiError(500, 'update_failed', 'We couldn’t save your settings. Please try again.')
  }

  // The business name and time zone are part of the agent's configuration at
  // the voice providers (greeting, instructions, booking times).
  if (patch.name !== undefined || patch.timezone !== undefined) {
    await resyncOrgAgentAfterResponse(ctx, 'settings change')
  }

  return noStore(NextResponse.json({ organization: data }))
})
