// Live smoke test (scripts/live-smoke-test.mjs): places ONE real outbound
// call from an organization's number to a number the operator controls.
// Requires the admin token AND an explicit confirmation string that repeats
// the destination ("CALL +40..."), and is rate limited per organization.
import { NextResponse } from 'next/server'
import { z } from 'zod'
import { requireAdmin } from '@/lib/api/auth'
import { RequestError, assertSameOrigin, errorResponse, parseJsonBody, requestErrorResponse } from '@/lib/api/http'
import { createLogger, requestIdFrom } from '@/lib/observability/logger'
import { createAdminClient } from '@/lib/supabase/admin'
import { RATE_LIMITS, enforceRateLimit } from '@/lib/security/rate-limit'
import { e164 } from '@/lib/voice-providers/settings'
import { startOutboundCall } from '@/lib/telephony/outbound'
import { maskPhone } from '@/lib/phone/e164'

const Body = z.object({
  org_id: z.uuid(),
  to_number: e164,
  phone_number_id: z.uuid().optional(),
  confirm: z.string().max(40),
})

export async function POST(request: Request) {
  const requestId = requestIdFrom(request)
  let log = createLogger({ requestId, route: 'admin.voice.test_call' })
  try {
    assertSameOrigin(request)
    const admin = await requireAdmin(request)
    const body = await parseJsonBody(request, Body, 4 * 1024)
    if (body.confirm !== `CALL ${body.to_number}`) {
      throw new RequestError('invalid_request', 'Confirmation must be exactly "CALL <to_number>".', 400)
    }
    log = log.child({ orgId: body.org_id, to: maskPhone(body.to_number) })
    await enforceRateLimit(RATE_LIMITS.testCall, body.org_id)
    const res = await startOutboundCall({ orgId: body.org_id, toNumber: body.to_number, phoneNumberId: body.phone_number_id ?? null, purpose: 'test' }, log)
    const { error } = await createAdminClient().from('audit_log').insert({
      org_id: body.org_id,
      actor_user_id: admin.userId,
      actor_kind: admin.kind === 'token' ? 'admin_token' : 'admin_user',
      action: 'voice.smoke_test_call',
      target_type: 'call',
      target_id: res.callId,
      details: { to: maskPhone(body.to_number), routing_mode: res.routingMode },
    })
    if (error) log.error('admin.audit_write_failed', error)
    return NextResponse.json({ call_id: res.callId, routing_mode: res.routingMode }, { status: 202 })
  } catch (err) {
    if (err instanceof RequestError) return requestErrorResponse(err, requestId)
    return errorResponse(err, log, 'admin.test_call_failed', requestId)
  }
}
