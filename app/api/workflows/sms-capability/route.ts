// GET /api/workflows/sms-capability → whether the org can text callers from
// one of its own numbers (Twilio SMS capability, cached for a day on the
// number). The workflow builder offers "Text the caller" only when it can.
import { NextResponse } from 'next/server'
import { requireOrg } from '@/lib/api/auth'
import { errorResponse, RequestError, requestErrorResponse } from '@/lib/api/http'
import { createLogger, requestIdFrom } from '@/lib/observability/logger'
import { createAdminClient } from '@/lib/supabase/admin'
import { enforceRateLimit } from '@/lib/security/rate-limit'
import { orgSmsAvailability } from '@/lib/sms/capability'

/** Each check may call Twilio for stale numbers. */
const SMS_CAPABILITY_LIMIT = { name: 'sms_capability', limit: 30, windowSeconds: 600 }

export async function GET(request: Request) {
  const requestId = requestIdFrom(request)
  let log = createLogger({ requestId, route: 'workflows.sms_capability' })
  try {
    const { org } = await requireOrg()
    log = log.child({ orgId: org.id })
    await enforceRateLimit(SMS_CAPABILITY_LIMIT, org.id)
    return NextResponse.json(await orgSmsAvailability(createAdminClient(), org.id, log))
  } catch (err) {
    if (err instanceof RequestError) return requestErrorResponse(err, requestId)
    return errorResponse(err, log, 'workflows.sms_capability_failed', requestId)
  }
}
