// "Call me now": the agent calls the owner's phone so they can hear it end to
// end (same routing as a real call). Strictly rate limited.
import { NextResponse } from 'next/server'
import { z } from 'zod'
import { requireOrg } from '@/lib/api/auth'
import { RequestError, assertSameOrigin, errorResponse, parseJsonBody, requestErrorResponse } from '@/lib/api/http'
import { createLogger, requestIdFrom } from '@/lib/observability/logger'
import { RATE_LIMITS, enforceRateLimit } from '@/lib/security/rate-limit'
import { e164 } from '@/lib/voice-providers/settings'
import { startOutboundCall } from '@/lib/telephony/outbound'

const Body = z.object({
  to_number: e164,
  phone_number_id: z.uuid().optional(),
})

export async function POST(request: Request) {
  const requestId = requestIdFrom(request)
  let log = createLogger({ requestId, route: 'agent.test_call' })
  try {
    assertSameOrigin(request)
    const { org } = await requireOrg()
    log = log.child({ orgId: org.id })
    const body = await parseJsonBody(request, Body, 4 * 1024)
    await enforceRateLimit(RATE_LIMITS.testCall, org.id, 'You have reached the test call limit. Please wait a few minutes.')
    const res = await startOutboundCall({ orgId: org.id, toNumber: body.to_number, phoneNumberId: body.phone_number_id ?? null, purpose: 'test' }, log)
    return NextResponse.json(
      {
        call_id: res.callId,
        routing_mode: res.routingMode,
        status: res.status,
        message:
          res.status === 'unconfirmed'
            ? 'The call request was sent but not confirmed yet. If your phone does not ring within a minute, check the Calls page before trying again.'
            : 'Calling you now. Answer to talk to your agent.',
      },
      { status: 202 },
    )
  } catch (err) {
    if (err instanceof RequestError) return requestErrorResponse(err, requestId)
    return errorResponse(err, log, 'agent.test_call_failed', requestId)
  }
}
