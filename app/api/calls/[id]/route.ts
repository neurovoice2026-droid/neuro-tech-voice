import { NextResponse, type NextRequest } from 'next/server'
import { ApiError, handleRoute, noStore, zUuid } from '@/lib/api/http'
import { requireOrgContext } from '@/lib/api/auth'
import { entitlementsFor, requiredPlanFor } from '@/lib/billing/entitlements'
import { isSupabaseAdminConfigured } from '@/lib/env'
import { enforceRateLimit, RATE_LIMITS } from '@/lib/security/rate-limit'
import { createAdminClient } from '@/lib/supabase/admin'
import { dbError } from '../_lib/db'
import { deleteProviderCopies } from '../_lib/providers'
import { CALL_DETAIL_COLUMNS } from '../_lib/query'

// GET    /api/calls/[id] — one call with transcript, analysis, linked bookings,
//        messages and tool actions. recording_url is set only when a recording
//        exists and the plan includes recordings.
// DELETE /api/calls/[id] — ownership first, then every provider copy
//        (Twilio recording, Cartesia call, ElevenLabs conversation), then the row.

export const runtime = 'nodejs'

type Params = { params: Promise<{ id: string }> }

const DETAIL_SELECT: string = `${CALL_DETAIL_COLUMNS}, agents(name, lead_fields)`
const STALE_IN_PROGRESS_MS = 6 * 60 * 60 * 1000

async function callIdFrom(ctx: Params): Promise<string> {
  const { id } = await ctx.params
  const parsed = zUuid.safeParse(id)
  if (!parsed.success) throw new ApiError(400, 'invalid_id', 'That call id is not valid.')
  return parsed.data
}

function isMissingRelation(error: { code?: string } | null): boolean {
  return error?.code === '42P01' || error?.code === 'PGRST205'
}

export const GET = handleRoute(async (_req: NextRequest, routeCtx: Params) => {
  const id = await callIdFrom(routeCtx)
  const ctx = await requireOrgContext()
  const db = ctx.supabase

  const { data, error } = await db
    .from('calls')
    .select(DETAIL_SELECT)
    .eq('id', id)
    .eq('org_id', ctx.org.id)
    .maybeSingle()
  if (error) throw dbError(error, 'load call')
  if (!data) throw new ApiError(404, 'call_not_found', 'We couldn’t find that call.')

  const [bookings, messages, tools] = await Promise.all([
    db
      .from('bookings')
      .select('id, service, caller_name, starts_at, ends_at, timezone, status, created_at')
      .eq('org_id', ctx.org.id)
      .eq('call_id', id)
      .order('created_at', { ascending: true })
      .limit(50),
    db
      .from('agent_messages')
      .select('id, recipient_name, caller_name, callback_number, body, urgency, status, created_at')
      .eq('org_id', ctx.org.id)
      .eq('call_id', id)
      .order('created_at', { ascending: true })
      .limit(50),
    db
      .from('tool_invocations')
      .select('id, tool_name, ok, result_summary, latency_ms, created_at')
      .eq('org_id', ctx.org.id)
      .eq('call_id', id)
      .order('created_at', { ascending: true })
      .limit(200),
  ])
  for (const [label, res] of [['bookings', bookings], ['messages', messages], ['tool invocations', tools]] as const) {
    if (res.error && !isMissingRelation(res.error)) throw dbError(res.error, `load call ${label}`)
  }

  const { agents, ...call } = data as unknown as Record<string, unknown> & {
    agents?: { name?: string | null; lead_fields?: unknown } | null
    recording_url: string | null
    recording_sid: string | null
  }
  const entitlements = entitlementsFor(ctx.org.plan)
  const recordingAvailable = !!(call.recording_url || call.recording_sid)
  const leadFields = Array.isArray(agents?.lead_fields)
    ? (agents.lead_fields as unknown[])
        .filter((f): f is { key: string; label: string } =>
          !!f && typeof f === 'object' && typeof (f as { key?: unknown }).key === 'string' && typeof (f as { label?: unknown }).label === 'string'
        )
        .map((f) => ({ key: f.key, label: f.label }))
    : []

  return noStore(
    NextResponse.json({
      ...call,
      agent_name: agents?.name ?? null,
      recording_url: recordingAvailable && entitlements.recordings ? `/api/calls/${id}/audio` : null,
      recording_available: recordingAvailable,
      recordings_entitled: entitlements.recordings,
      recordings_required_plan: requiredPlanFor('recordings'),
      integrations_entitled: entitlements.googleIntegrations,
      integrations_required_plan: requiredPlanFor('googleIntegrations'),
      lead_fields: leadFields,
      bookings: bookings.data ?? [],
      messages: messages.data ?? [],
      tool_invocations: tools.data ?? [],
    })
  )
})

export const DELETE = handleRoute(async (_req: NextRequest, routeCtx: Params) => {
  const id = await callIdFrom(routeCtx)
  const ctx = await requireOrgContext()
  await enforceRateLimit(RATE_LIMITS.apiWrite, ctx.user.id)

  const { data: call, error } = await ctx.supabase
    .from('calls')
    .select('id, status, started_at, voice_provider, pipeline_mode, provider_call_id, elevenlabs_conversation_id, recording_sid')
    .eq('id', id)
    .eq('org_id', ctx.org.id)
    .maybeSingle()
  if (error) throw dbError(error, 'load call for delete')
  if (!call) throw new ApiError(404, 'call_not_found', 'We couldn’t find that call.')

  // A live call still writes its transcript and usage to this row. Rows stuck
  // "in progress" for hours (a crashed session) can be removed.
  const startedAt = Date.parse(call.started_at ?? '')
  if (call.status === 'in-progress' && Number.isFinite(startedAt) && Date.now() - startedAt < STALE_IN_PROGRESS_MS) {
    throw new ApiError(409, 'call_in_progress', 'This call is still going. You can delete it once it has ended.')
  }

  if (!isSupabaseAdminConfigured()) {
    throw new ApiError(503, 'not_configured', 'Deleting calls is not available right now.')
  }

  const failed = await deleteProviderCopies(call)
  if (failed.length > 0) {
    throw new ApiError(
      502,
      'provider_delete_failed',
      'We couldn’t remove the recording or transcript kept by our voice provider, so nothing was deleted. Please try again in a minute.'
    )
  }

  const { error: deleteError } = await createAdminClient()
    .from('calls')
    .delete()
    .eq('id', id)
    .eq('org_id', ctx.org.id)
  if (deleteError) throw dbError(deleteError, 'delete call')

  return noStore(NextResponse.json({ success: true }))
})
