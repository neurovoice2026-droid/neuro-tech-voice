// Browser test sessions of the signed-in owner's agent ("Talk to your agent",
// "Chat with your agent"): lib/voice-providers/web-test.ts.
//   GET  → what the test panel may offer (no provider call, nothing counted)
//   POST {mode: 'voice' | 'text'} → a one-time WebRTC conversation token for
//        the org's OWN agent (resolved server-side; the browser sends no id).
//        Refused once the org's server-side browser-test seconds budget is
//        spent (403 trial_limit, 429 daily_limit + Retry-After) or its browser
//        tests are blocked after an over-long session (403 web_test_blocked).
// Every response is private and never cached: the token is a bearer
// credential for one conversation.
import { NextResponse } from 'next/server'
import { z } from 'zod'
import { requireOrg } from '@/lib/api/auth'
import { RequestError, assertSameOrigin, errorResponse, parseJsonBody, requestErrorResponse } from '@/lib/api/http'
import { createLogger, requestIdFrom } from '@/lib/observability/logger'
import { WEB_TEST_MODES, clientIpKey, startWebTestSession, webTestAvailability } from '@/lib/voice-providers/web-test'

const NO_STORE = { 'Cache-Control': 'no-store, private' }

const Body = z.object({ mode: z.enum(WEB_TEST_MODES).default('voice') }).strict()

export async function GET(request: Request) {
  const requestId = requestIdFrom(request)
  let log = createLogger({ requestId, route: 'agent.web_session' })
  try {
    const { org } = await requireOrg()
    log = log.child({ orgId: org.id })
    return NextResponse.json(await webTestAvailability(org, log), { headers: NO_STORE })
  } catch (err) {
    if (err instanceof RequestError) return requestErrorResponse(err, requestId)
    return errorResponse(err, log, 'agent.web_session_status_failed', requestId)
  }
}

export async function POST(request: Request) {
  const requestId = requestIdFrom(request)
  let log = createLogger({ requestId, route: 'agent.web_session' })
  try {
    assertSameOrigin(request)
    const { org, user } = await requireOrg()
    log = log.child({ orgId: org.id })
    const body = await parseJsonBody(request, Body, 1024)
    const session = await startWebTestSession({ org, userId: user.id, mode: body.mode, ipKey: clientIpKey(request.headers) }, log)
    return NextResponse.json(session, { status: 201, headers: NO_STORE })
  } catch (err) {
    if (err instanceof RequestError) {
      const res = requestErrorResponse(err, requestId)
      res.headers.set('Cache-Control', NO_STORE['Cache-Control'])
      return res
    }
    const res = errorResponse(err, log, 'agent.web_session_failed', requestId)
    res.headers.set('Cache-Control', NO_STORE['Cache-Control'])
    return res
  }
}
