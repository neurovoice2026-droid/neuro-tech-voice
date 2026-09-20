import type { NextRequest } from 'next/server'
import { ApiError, handleRoute, zUuid } from '@/lib/api/http'
import { requireOrgContext } from '@/lib/api/auth'
import { entitlementsFor, requiredPlanFor } from '@/lib/billing/entitlements'
import { PLANS } from '@/types'
import { dbError } from '../../_lib/db'
import { openRecording } from '../../_lib/providers'

// GET /api/calls/[id]/audio — streams a call recording through the app so
// provider credentials stay on the server and ownership is enforced. Sources,
// first available: Twilio recording → Cartesia call audio → ElevenLabs audio.
// Range requests are forwarded to Twilio, which supports seeking.

export const runtime = 'nodejs'

type Params = { params: Promise<{ id: string }> }

export const GET = handleRoute(async (req: NextRequest, routeCtx: Params) => {
  const { id: rawId } = await routeCtx.params
  const parsed = zUuid.safeParse(rawId)
  if (!parsed.success) throw new ApiError(400, 'invalid_id', 'That call id is not valid.')
  const id = parsed.data

  const ctx = await requireOrgContext()
  if (!entitlementsFor(ctx.org.plan).recordings) {
    const plan = PLANS[requiredPlanFor('recordings')].name
    throw new ApiError(403, 'upgrade_required', `Call recordings are available on ${plan} and above.`)
  }

  const { data: call, error } = await ctx.supabase
    .from('calls')
    .select('id, voice_provider, pipeline_mode, provider_call_id, elevenlabs_conversation_id, recording_sid, recording_url')
    .eq('id', id)
    .eq('org_id', ctx.org.id)
    .maybeSingle()
  if (error) throw dbError(error, 'load call for audio')
  if (!call || (!call.recording_url && !call.recording_sid)) {
    throw new ApiError(404, 'recording_not_found', 'There is no recording for this call.')
  }

  let stream
  try {
    stream = await openRecording(call, req.headers.get('range'))
  } catch (err) {
    console.error('[calls] recording fetch failed', id, err instanceof Error ? err.message : err)
    throw new ApiError(502, 'recording_unavailable', 'The recording couldn’t be loaded right now. Please try again shortly.')
  }
  if (!stream) throw new ApiError(404, 'recording_not_found', 'There is no recording for this call.')

  const headers = stream.headers
  headers.set('Cache-Control', 'private, max-age=3600')
  headers.set('Content-Disposition', `inline; filename="call-${id}.${headers.get('content-type') === 'audio/wav' ? 'wav' : 'mp3'}"`)
  headers.set('X-Content-Type-Options', 'nosniff')
  return new Response(stream.body, { status: stream.status, headers })
})
