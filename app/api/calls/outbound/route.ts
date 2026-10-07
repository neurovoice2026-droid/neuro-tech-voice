// Places an outbound AI call from one of the org's numbers.
// app_routed numbers: Twilio dials, the router picks the healthy provider at
// answer time (ElevenLabs → Cartesia). native_elevenlabs: ElevenLabs dials.
import { NextResponse } from 'next/server'
import { z } from 'zod'
import { requireOrg } from '@/lib/api/auth'
import { RequestError, assertSameOrigin, errorResponse, parseJsonBody, requestErrorResponse } from '@/lib/api/http'
import { createLogger, requestIdFrom } from '@/lib/observability/logger'
import { RATE_LIMITS, enforceRateLimit } from '@/lib/security/rate-limit'
import { e164 } from '@/lib/voice-providers/settings'
import { startOutboundCall } from '@/lib/telephony/outbound'

/** The provider did not confirm in time: the call may still ring, so never invite an immediate retry. */
const UNCONFIRMED_MESSAGE = 'The call request was sent but not confirmed yet. Check the Calls page in a minute before trying again.'

const Body = z.object({
  to_number: e164,
  phone_number_id: z.uuid().optional(),
})

export async function POST(request: Request) {
  const requestId = requestIdFrom(request)
  let log = createLogger({ requestId, route: 'calls.outbound' })
  try {
    assertSameOrigin(request)
    const { org } = await requireOrg()
    log = log.child({ orgId: org.id })
    const body = await parseJsonBody(request, Body, 4 * 1024)
    await enforceRateLimit(RATE_LIMITS.outboundCall, org.id, 'Outbound call limit reached. Please try again later.')
    const res = await startOutboundCall({ orgId: org.id, toNumber: body.to_number, phoneNumberId: body.phone_number_id ?? null, purpose: 'outbound' }, log)
    return NextResponse.json(
      {
        call_id: res.callId,
        routing_mode: res.routingMode,
        status: res.status,
        ...(res.status === 'unconfirmed' ? { message: UNCONFIRMED_MESSAGE } : {}),
      },
      { status: 202 },
    )
  } catch (err) {
    if (err instanceof RequestError) return requestErrorResponse(err, requestId)
    return errorResponse(err, log, 'calls.outbound_failed', requestId)
  }
}
