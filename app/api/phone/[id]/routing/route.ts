// POST /api/phone/[id]/routing — re-applies the number's routing binding
// (Twilio webhooks / provider imports) after a failure or config change.
import { NextResponse } from 'next/server'
import { z } from 'zod'
import { requireOrg } from '@/lib/api/auth'
import { RequestError, assertSameOrigin, errorResponse, requestErrorResponse } from '@/lib/api/http'
import { createLogger, requestIdFrom, type Logger } from '@/lib/observability/logger'
import { RATE_LIMITS, enforceRateLimit } from '@/lib/security/rate-limit'
import { applyNumberRouting } from '@/lib/telephony/binding'
import { syncAgent } from '@/lib/voice-providers/agent-sync'

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const requestId = requestIdFrom(request)
  let log: Logger = createLogger({ requestId, route: 'phone.routing' })
  try {
    assertSameOrigin(request)
    const { supabase, org } = await requireOrg()
    const parsed = z.uuid().safeParse((await params).id)
    if (!parsed.success) throw new RequestError('not_found', 'Number not found.', 404)
    const id = parsed.data
    log = log.child({ orgId: org.id, phoneNumberId: id })
    await enforceRateLimit(RATE_LIMITS.agentSync, org.id)

    const { data: num, error } = await supabase.from('phone_numbers').select('id, agent_id').eq('id', id).eq('org_id', org.id).maybeSingle()
    if (error) throw new Error(`phone_numbers read failed: ${error.message}`)
    if (!num) throw new RequestError('not_found', 'Number not found.', 404)

    // Make sure the agents exist first (the Cartesia import needs the fallback agent).
    if (num.agent_id) await syncAgent(num.agent_id as string, { log })
    const result = await applyNumberRouting(id, log)
    return NextResponse.json(result, { status: result.status === 'failed' ? 502 : 200 })
  } catch (err) {
    if (err instanceof RequestError) return requestErrorResponse(err, requestId)
    return errorResponse(err, log, 'phone.routing_failed', requestId)
  }
}
