import { requireOrg } from '@/lib/api/auth'
import { apiError, errorResponse, RequestError, requestErrorResponse } from '@/lib/api/http'
import { createLogger, requestIdFrom } from '@/lib/observability/logger'
import { createAdminClient } from '@/lib/supabase/admin'
import { conversations as elConversations } from '@/lib/elevenlabs/client'
import { calls as cartesiaCalls } from '@/lib/cartesia/client'
import { isProviderError } from '@/lib/voice-providers/errors'
import { rateLimit, RATE_LIMITS } from '@/lib/security/rate-limit'
import { findOrgCall, parseCallId, servingProvider, type CallRow } from '@/lib/calls/serialize'

const AUDIO_COLUMNS: string =
  'id, provider, provider_call_id, elevenlabs_conversation_id, cartesia_call_id, has_recording, recording_status'

type AudioRow = Pick<
  CallRow,
  'id' | 'provider' | 'provider_call_id' | 'elevenlabs_conversation_id' | 'cartesia_call_id' | 'has_recording' | 'recording_status'
>

const AUDIO_LIMIT = RATE_LIMITS.callAudio
const DEFAULT_TYPE = { elevenlabs: 'audio/mpeg', cartesia: 'audio/wav' } as const
const EXTENSION: Record<string, string> = { 'audio/mpeg': 'mp3', 'audio/mp3': 'mp3', 'audio/wav': 'wav', 'audio/x-wav': 'wav', 'audio/wave': 'wav', 'audio/ogg': 'ogg' }

function notAvailable(requestId: string) {
  return apiError('not_found', 'No recording is available for this call.', 404, { requestId })
}

// GET /api/calls/[id]/audio — streams the recording from the provider that
// served the call (constant memory, any length). Range headers are ignored
// (RFC 9110 §14.2 allows it): every request gets the full 200 body, so one
// playback costs one upstream download and one rate-limit token. The player
// seeks by fetching the whole recording once into a Blob.
// Ownership comes from our DB row (org-scoped lookup); the provider URL and
// key never reach the browser.
export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const requestId = requestIdFrom(request)
  let log = createLogger({ requestId, route: 'calls.audio' })
  try {
    const { supabase, org } = await requireOrg()
    log = log.child({ orgId: org.id })
    const id = parseCallId((await params).id)

    const row = await findOrgCall<AudioRow>(supabase, org.id, id, AUDIO_COLUMNS)
    if (!row) return apiError('not_found', 'Call not found', 404, { requestId })
    log = log.child({ callId: row.id })
    if (row.recording_status === 'unavailable' || row.recording_status === 'deleted') return notAvailable(requestId)

    // Provider-specific id first: provider_call_id holds whichever provider
    // reported first, which differs from the serving one after a failover.
    const provider = servingProvider(row)
    const externalId =
      provider === 'elevenlabs'
        ? (row.elevenlabs_conversation_id ?? row.provider_call_id)
        : provider === 'cartesia'
          ? (row.cartesia_call_id ?? row.provider_call_id)
          : null
    if (!provider || !externalId) return notAvailable(requestId)

    const limit = await rateLimit(AUDIO_LIMIT, org.id)
    if (!limit.allowed) {
      return apiError('rate_limited', 'Too many recording requests. Please wait a moment.', 429, {
        requestId,
        headers: { 'Retry-After': String(Math.max(1, Math.ceil((limit.resetAt - Date.now()) / 1000))) },
      })
    }

    const ctx = { orgId: org.id, callId: row.id }
    let upstream: Response
    try {
      upstream = provider === 'elevenlabs'
        ? await elConversations.audio(externalId, ctx)
        : await cartesiaCalls.audio(externalId, ctx)
    } catch (err) {
      if (isProviderError(err) && err.code === 'not_found') {
        log.info('calls.audio.not_found', { provider })
        // Remember it (deleted by retention or elsewhere): the call view stops
        // offering a player that always fails, and no rate-limit token is spent
        // on it again. The row was already scoped to this org above.
        const { error: updErr } = await createAdminClient()
          .from('calls')
          .update({ has_recording: false, recording_status: 'unavailable' })
          .eq('id', row.id)
          .eq('org_id', org.id)
        if (updErr) log.error('calls.audio.mark_unavailable_failed', new Error(updErr.message))
        return notAvailable(requestId)
      }
      throw err
    }
    if (!upstream.body) return notAvailable(requestId)

    const upstreamType = (upstream.headers.get('content-type') ?? '').split(';')[0].trim().toLowerCase()
    const contentType = upstreamType.startsWith('audio/') ? upstreamType : DEFAULT_TYPE[provider]
    const headers = new Headers({
      'Content-Type': contentType,
      'Cache-Control': 'private, no-store',
      'Content-Disposition': `inline; filename="call-${row.id}.${EXTENSION[contentType] ?? 'audio'}"`,
      'X-Content-Type-Options': 'nosniff',
    })
    // fetch() decodes a compressed body but keeps the encoded length, so the
    // length is only forwarded for an unencoded upstream body.
    const length = upstream.headers.get('content-length')
    const encoding = (upstream.headers.get('content-encoding') ?? 'identity').trim().toLowerCase()
    if (length && /^\d+$/.test(length) && encoding === 'identity') headers.set('Content-Length', length)
    return new Response(upstream.body, { status: 200, headers })
  } catch (err) {
    if (err instanceof RequestError) return requestErrorResponse(err, requestId)
    return errorResponse(err, log, 'calls.audio.failed', requestId)
  }
}
