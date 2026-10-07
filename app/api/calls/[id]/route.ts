import { NextResponse } from 'next/server'
import { requireOrg } from '@/lib/api/auth'
import { apiError, assertSameOrigin, errorResponse, RequestError, requestErrorResponse } from '@/lib/api/http'
import { createLogger, requestIdFrom, type Logger } from '@/lib/observability/logger'
import { createAdminClient } from '@/lib/supabase/admin'
import { conversations as elConversations } from '@/lib/elevenlabs/client'
import { calls as cartesiaCalls } from '@/lib/cartesia/client'
import { isProviderError } from '@/lib/voice-providers/errors'
import { rateLimit, RATE_LIMITS } from '@/lib/security/rate-limit'
import {
  CALL_DETAIL_COLUMNS,
  dbError,
  findOrgCall,
  parseCallId,
  providerTargets,
  serializeCallDetail,
  type CallRow,
} from '@/lib/calls/serialize'
import type { VoiceProviderId } from '@/types'

type RouteParams = { params: Promise<{ id: string }> }

// GET /api/calls/[id] — one call of the signed-in org, by calls.id or by a
// provider call id (ElevenLabs conversation / Cartesia call). Ownership is the
// org_id filter on every lookup (plus RLS on the user-scoped client).
export async function GET(request: Request, { params }: RouteParams) {
  const requestId = requestIdFrom(request)
  let log = createLogger({ requestId, route: 'calls.get' })
  try {
    const { supabase, org } = await requireOrg()
    log = log.child({ orgId: org.id })
    const id = parseCallId((await params).id)
    const row = await findOrgCall<CallRow>(supabase, org.id, id, CALL_DETAIL_COLUMNS)
    if (!row) return apiError('not_found', 'Call not found', 404, { requestId })
    return NextResponse.json(serializeCallDetail(row))
  } catch (err) {
    if (err instanceof RequestError) return requestErrorResponse(err, requestId)
    return errorResponse(err, log, 'calls.get.failed', requestId)
  }
}

const DELETE_COLUMNS: string =
  'id, status, started_at, created_at, provider, provider_call_id, elevenlabs_conversation_id, cartesia_call_id'

type DeleteRow = Pick<
  CallRow,
  'id' | 'status' | 'started_at' | 'created_at' | 'provider' | 'provider_call_id' | 'elevenlabs_conversation_id' | 'cartesia_call_id'
>

const CALL_DELETE_LIMIT = RATE_LIMITS.callDelete
/** A live call cannot be deleted at the providers; older "live" rows are stale. */
const LIVE_GRACE_MS = 6 * 60 * 60 * 1000

type ProviderDeleteResult = { provider: VoiceProviderId; result: 'deleted' | 'already_gone' | 'skipped_not_configured' }

async function deleteAtProvider(
  provider: VoiceProviderId,
  externalId: string,
  ctx: { orgId: string; callId: string },
  log: Logger,
): Promise<ProviderDeleteResult> {
  try {
    if (provider === 'elevenlabs') await elConversations.delete(externalId, ctx)
    else await cartesiaCalls.delete(externalId, ctx)
    return { provider, result: 'deleted' }
  } catch (err) {
    if (isProviderError(err) && err.code === 'not_found') return { provider, result: 'already_gone' }
    if (isProviderError(err) && err.code === 'not_configured') {
      // This deployment has no key for that provider: nothing we can delete there.
      log.warn('calls.delete.provider_not_configured', { provider })
      return { provider, result: 'skipped_not_configured' }
    }
    throw err
  }
}

// DELETE /api/calls/[id] — deletes the call at the voice provider(s) first
// (transcript + audio), then our row. If a provider delete fails the row is
// kept so the user can retry, and nothing is reported as deleted.
export async function DELETE(request: Request, { params }: RouteParams) {
  const requestId = requestIdFrom(request)
  let log = createLogger({ requestId, route: 'calls.delete' })
  try {
    assertSameOrigin(request)
    const { supabase, user, org } = await requireOrg()
    log = log.child({ orgId: org.id })
    const id = parseCallId((await params).id)

    const limit = await rateLimit(CALL_DELETE_LIMIT, org.id)
    if (!limit.allowed) {
      return apiError('rate_limited', 'Too many deletions in a short time. Please wait a moment.', 429, {
        requestId,
        headers: { 'Retry-After': String(Math.max(1, Math.ceil((limit.resetAt - Date.now()) / 1000))) },
      })
    }

    const row = await findOrgCall<DeleteRow>(supabase, org.id, id, DELETE_COLUMNS)
    if (!row) return apiError('not_found', 'Call not found', 404, { requestId })
    log = log.child({ callId: row.id })

    const startedMs = Date.parse(row.started_at ?? row.created_at)
    const live = (row.status === 'in-progress' || row.status === 'ringing') && Date.now() - startedMs < LIVE_GRACE_MS
    if (live) {
      return apiError('conflict', 'This call is still in progress. You can delete it once it has ended.', 409, { requestId })
    }

    const results: ProviderDeleteResult[] = []
    for (const target of providerTargets(row)) {
      try {
        results.push(await deleteAtProvider(target.provider, target.externalId, { orgId: org.id, callId: row.id }, log))
      } catch (err) {
        log.error('calls.delete.provider_failed', err, { provider: target.provider })
        return apiError(
          'provider_error',
          'We could not delete this call at the voice provider, so the record was kept. Please try again in a moment.',
          502,
          { requestId, details: { provider: target.provider, ...(isProviderError(err) ? { code: err.code } : {}) } },
        )
      }
    }

    // Ownership was checked above (findOrgCall); tenants cannot delete call rows
    // directly (migration 011), so the row is removed server-side.
    const { error: deleteError } = await createAdminClient().from('calls').delete().eq('id', row.id).eq('org_id', org.id)
    if (deleteError) throw dbError('calls delete', deleteError)

    const { error: auditError } = await createAdminClient().from('audit_log').insert({
      org_id: org.id,
      actor_user_id: user.id,
      actor_kind: 'user',
      action: 'call.deleted',
      target_type: 'call',
      target_id: row.id,
      // provider_call_ids is the tombstone applyCallEvent checks, so a late
      // webhook or poll for this call cannot recreate the deleted row.
      details: { provider: row.provider, status: row.status, provider_deletes: results, provider_call_ids: providerTargets(row).map((t) => t.externalId) },
    })
    // The call is already gone; a missing audit row must not turn that into an error for the user.
    if (auditError) log.error('calls.delete.audit_failed', dbError('audit_log insert', auditError))

    log.info('calls.deleted', { providers: results })
    return NextResponse.json({ success: true })
  } catch (err) {
    if (err instanceof RequestError) return requestErrorResponse(err, requestId)
    return errorResponse(err, log, 'calls.delete.failed', requestId)
  }
}
