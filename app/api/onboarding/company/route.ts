// POST /api/onboarding/company — step 1: company details. Also makes sure the
// org's agent row exists (no provider calls here; onboarding/complete syncs).

import { NextResponse } from 'next/server'
import { requireOrg } from '@/lib/api/auth'
import {
  RequestError,
  assertSameOrigin,
  errorResponse,
  parseJsonBody,
  requestErrorResponse,
} from '@/lib/api/http'
import { createLogger, requestIdFrom } from '@/lib/observability/logger'
import { OnboardingCompanySchema, defaultAgentName, ensureAgent } from '@/lib/agents/ensure-agent'

export async function POST(request: Request) {
  const requestId = requestIdFrom(request)
  let log = createLogger({ requestId, route: 'onboarding.company' })
  try {
    assertSameOrigin(request)
    const { supabase, org } = await requireOrg()
    log = log.child({ orgId: org.id })
    const body = await parseJsonBody(request, OnboardingCompanySchema)

    const { error } = await supabase
      .from('organizations')
      .update({
        name: body.name,
        industry: body.industry,
        website: body.website ?? null,
        ...(body.description !== undefined ? { description: body.description } : {}),
        onboarding_step: 2,
      })
      .eq('id', org.id)
    if (error) throw new Error(`organizations update failed: ${error.message}`)

    await ensureAgent(org.id, defaultAgentName(body.name))
    return NextResponse.json({ success: true })
  } catch (err) {
    if (err instanceof RequestError) return requestErrorResponse(err, requestId)
    return errorResponse(err, log, 'onboarding.company_failed', requestId)
  }
}
