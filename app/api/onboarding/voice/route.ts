// POST /api/onboarding/voice — step 3 only advances the onboarding step.
// The voice itself is saved (and confirmed with the provider) by
// PUT /api/agent/voice; any voice fields sent here are ignored on purpose, so
// an unverified voice id can never be written through this route.

import { NextResponse } from 'next/server'
import { requireOrg } from '@/lib/api/auth'
import { RequestError, assertSameOrigin, errorResponse, requestErrorResponse } from '@/lib/api/http'
import { createLogger, requestIdFrom } from '@/lib/observability/logger'

export async function POST(request: Request) {
  const requestId = requestIdFrom(request)
  let log = createLogger({ requestId, route: 'onboarding.voice' })
  try {
    assertSameOrigin(request)
    const { supabase, org } = await requireOrg()
    log = log.child({ orgId: org.id })

    const { error } = await supabase.from('organizations').update({ onboarding_step: 4 }).eq('id', org.id)
    if (error) throw new Error(`organizations update failed: ${error.message}`)

    return NextResponse.json({ success: true })
  } catch (err) {
    if (err instanceof RequestError) return requestErrorResponse(err, requestId)
    return errorResponse(err, log, 'onboarding.voice_failed', requestId)
  }
}
