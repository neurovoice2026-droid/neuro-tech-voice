// GET /api/voices/limits → { custom_voices: { allowed, required_plan, used, limit } }
// What this organization may do with custom voices (cloning and Voice Design),
// so the dashboard can explain a disabled button. Nothing about the shared
// workspace's own quota is exposed.

import { NextResponse } from 'next/server'
import { requireOrg } from '@/lib/api/auth'
import { createLogger, requestIdFrom } from '@/lib/observability/logger'
import { RATE_LIMITS, enforceRateLimit } from '@/lib/security/rate-limit'
import { createAdminClient } from '@/lib/supabase/admin'
import {
  countCustomVoices,
  customVoicesAllowed,
  maxCustomVoicesPerOrg,
  requiredPlanForCustomVoices,
} from '@/lib/voice-providers/voice-capacity'
import { voiceErrorResponse } from '@/lib/voice-providers/voice-catalog'

export async function GET(request: Request) {
  const requestId = requestIdFrom(request)
  let log = createLogger({ requestId, route: 'voices.limits' })
  try {
    const { org } = await requireOrg()
    log = log.child({ orgId: org.id })
    await enforceRateLimit([RATE_LIMITS.voiceCatalog], org.id)
    const used = await countCustomVoices(createAdminClient(), org.id)
    return NextResponse.json(
      {
        custom_voices: {
          allowed: customVoicesAllowed(org.plan),
          required_plan: requiredPlanForCustomVoices(),
          used,
          limit: maxCustomVoicesPerOrg(),
        },
      },
      { headers: { 'Cache-Control': 'private, no-store' } },
    )
  } catch (err) {
    return voiceErrorResponse(err, log, 'voices.limits.failed', requestId)
  }
}
