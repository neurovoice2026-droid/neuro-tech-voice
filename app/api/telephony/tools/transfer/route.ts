// Webhook tool `transfer_to_human` (ElevenLabs agent on an app-routed call).
// Authenticated by the signed, purpose-bound call token the router injected
// as a dynamic variable (ntv_call_token): it binds the request to exactly one
// call, so the tool cannot be used to redirect anyone else's call.
// Always answers 200 with { ok, message } — the agent reads `message` aloud
// (paraphrased); details stay in our logs.
import { NextResponse } from 'next/server'
import { z } from 'zod'
import { createLogger, requestIdFrom } from '@/lib/observability/logger'
import { RequestError, parseJsonBody } from '@/lib/api/http'
import { verifyCallToken } from '@/lib/telephony/tokens'
import { transferLiveCall } from '@/lib/telephony/router'

const Body = z.object({
  call_token: z.string().min(10).max(512),
  reason: z.string().trim().max(500).optional().default(''),
})

const FAILED = 'I could not transfer the call right now. Offer to take a message instead.'

export async function POST(request: Request) {
  const requestId = requestIdFrom(request)
  const log = createLogger({ requestId, route: 'tools.transfer' })
  let body: z.infer<typeof Body>
  try {
    body = await parseJsonBody(request, Body, 8 * 1024)
  } catch (err) {
    if (err instanceof RequestError) {
      log.warn('tools.transfer_bad_request', { code: err.code })
      return NextResponse.json({ ok: false, message: FAILED }, { status: err.status })
    }
    log.error('tools.transfer_body_failed', err)
    return NextResponse.json({ ok: false, message: FAILED }, { status: 400 })
  }
  const callId = verifyCallToken(body.call_token, 'transfer')
  if (!callId) {
    log.warn('tools.transfer_token_invalid')
    return NextResponse.json({ ok: false, message: FAILED }, { status: 401 })
  }
  const l = log.child({ callId })
  try {
    const res = await transferLiveCall(callId, body.reason, l)
    l.info('tools.transfer', { ok: res.ok })
    return NextResponse.json(res, { headers: { 'Cache-Control': 'no-store' } })
  } catch (err) {
    l.error('tools.transfer_failed', err)
    return NextResponse.json({ ok: false, message: FAILED }, { headers: { 'Cache-Control': 'no-store' } })
  }
}
