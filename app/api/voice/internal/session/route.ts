import { after, type NextRequest } from 'next/server'
import { z } from 'zod'
import { ApiError, handleRoute, noStore, validationError, zUuid } from '@/lib/api/http'
import { env } from '@/lib/env'
import { kvSet } from '@/lib/kv'
import { RATE_LIMITS, enforceRateLimit } from '@/lib/security/rate-limit'
import { readVerifiedInternalBody, verifySessionToken } from '@/lib/security/signing'
import { createAdminClient } from '@/lib/supabase/admin'
import { CALL_SID_REGEX } from '@/lib/twilio/client'
import { buildSessionForCall, loadAgent, loadCallById, loadOrganization } from '@/lib/voice/session-loader'
import type { SessionRequest, VoiceSessionConfig } from '@/lib/voice/contracts'

// Gateway → app: exchanges the signed session token from <Stream><Parameter>
// (or the browser WebSocket URL) for the full VoiceSessionConfig. The request
// itself is HMAC-signed; the token binds the call row, org, agent, channel
// and mode chosen by the router.

export const runtime = 'nodejs'

// Empty strings and missing ids mean "none" (browser sessions have no Twilio ids).
const emptyToNull = (value: unknown) => (value === '' || value === undefined ? null : value)

const BodySchema = z.object({
  session_token: z.string().min(16).max(1024),
  call_sid: z.preprocess(emptyToNull, z.string().regex(CALL_SID_REGEX, 'Invalid call SID').nullable()),
  stream_sid: z.preprocess(emptyToNull, z.string().max(64).nullable()),
}) satisfies z.ZodType<SessionRequest, unknown>

const STREAM_SID_TTL_SECONDS = 4 * 60 * 60

export const POST = handleRoute(async (req: NextRequest) => {
  const raw = await readVerifiedInternalBody(req)
  let json: unknown
  try {
    json = JSON.parse(raw)
  } catch {
    throw new ApiError(400, 'invalid_json', 'Request body must be valid JSON.')
  }
  const parsed = BodySchema.safeParse(json)
  if (!parsed.success) throw validationError(parsed.error)
  const body = parsed.data

  const payload = verifySessionToken(body.session_token, env.VOICE_GATEWAY_SECRET ?? '')
  if (!payload || !zUuid.safeParse(payload.sid).success) {
    throw new ApiError(401, 'invalid_token', 'The session token is invalid or expired.')
  }
  // The caller hears nothing until this answers: the rate limit and the three
  // lookups run together (the token already names the org and agent); the
  // call is checked against them right after.
  const [, call, org, agent] = await Promise.all([
    enforceRateLimit(RATE_LIMITS.gatewayInternal, payload.sid),
    loadCallById(payload.sid),
    loadOrganization(payload.org),
    loadAgent(payload.org, payload.agt),
  ])
  if (!call || call.org_id !== payload.org) {
    throw new ApiError(404, 'call_not_found', 'Call not found.')
  }
  if (call.ended_at || call.status !== 'in-progress') {
    throw new ApiError(409, 'call_ended', 'This call has already ended.')
  }

  let twilioCallSid = call.twilio_call_sid
  if (payload.ch === 'twilio') {
    if (!body.call_sid) throw new ApiError(400, 'validation_error', 'call_sid is required for phone calls.')
    if (twilioCallSid && twilioCallSid !== body.call_sid) {
      throw new ApiError(403, 'call_mismatch', 'The session token belongs to a different call.')
    }
    twilioCallSid = body.call_sid
  }

  if (!org || !agent || agent.id !== payload.agt) {
    throw new ApiError(404, 'agent_not_found', 'The agent for this call no longer exists.')
  }

  const config: VoiceSessionConfig = await buildSessionForCall({
    call: { ...call, twilio_call_sid: twilioCallSid },
    org,
    agent,
    channel: payload.ch,
    mode: payload.mode,
  })

  after(async () => {
    if (twilioCallSid && !call.twilio_call_sid) {
      const { error } = await createAdminClient()
        .from('calls')
        .update({ twilio_call_sid: twilioCallSid })
        .eq('id', call.id)
        .eq('org_id', call.org_id)
        .is('twilio_call_sid', null)
      if (error) console.error('[voice] storing twilio_call_sid failed', error.code, error.message)
    }
    // No column for the media stream id; kept briefly for support lookups.
    if (body.stream_sid) {
      await kvSet(`call:stream-sid:${call.id}`, body.stream_sid, STREAM_SID_TTL_SECONDS).catch(() => undefined)
    }
  })

  return noStore(Response.json(config))
})
