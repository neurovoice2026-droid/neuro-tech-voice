// POST /api/commerce/onboarding/step — persists the resume position of the
// store onboarding ({ step: 1..6 }). Only the position is stored: every
// step's content is written by its own route, so a stale or skipped position
// can never make the UI claim something that is not saved.

import { NextResponse } from 'next/server'
import { z } from 'zod'
import { requireOrg } from '@/lib/api/auth'
import {
  RequestError,
  assertSameOrigin,
  errorResponse,
  parseJsonBody,
  requestErrorResponse,
} from '@/lib/api/http'
import { createLogger, requestIdFrom } from '@/lib/observability/logger'
import { TOTAL_COMMERCE_ONBOARDING_STEPS } from '@/lib/commerce/business-type'

const StepSchema = z.object({
  step: z.number().int().min(1).max(TOTAL_COMMERCE_ONBOARDING_STEPS),
})

export async function POST(request: Request) {
  const requestId = requestIdFrom(request)
  let log = createLogger({ requestId, route: 'commerce.onboarding.step' })
  try {
    assertSameOrigin(request)
    const { supabase, org } = await requireOrg()
    log = log.child({ orgId: org.id })
    const body = await parseJsonBody(request, StepSchema, 1024)

    const { data: row, error: readErr } = await supabase
      .from('organizations')
      .select('business_type, onboarding_completed')
      .eq('id', org.id)
      .single()
    if (readErr) throw new Error(`organizations read failed: ${readErr.message}`)
    if (row.business_type !== 'ecommerce') {
      throw new RequestError('precondition_failed', 'This setup is only available to online stores.', 409, {
        reason: 'not_ecommerce',
      })
    }
    if (row.onboarding_completed) {
      throw new RequestError('precondition_failed', 'Setup is already complete.', 409, { reason: 'onboarding_completed' })
    }

    // onboarding_step is not a guarded column: the tenant client writes it, as the service flow does.
    const { error: writeErr } = await supabase.from('organizations').update({ onboarding_step: body.step }).eq('id', org.id)
    if (writeErr) throw new Error(`organizations update failed: ${writeErr.message}`)

    return NextResponse.json({ onboarding_step: body.step })
  } catch (err) {
    if (err instanceof RequestError) return requestErrorResponse(err, requestId)
    return errorResponse(err, log, 'commerce.onboarding.step_failed', requestId)
  }
}
