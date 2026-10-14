// POST /api/onboarding/business-type — step 0: which onboarding (and dashboard)
// the organization gets. Body { business_type: 'services' | 'ecommerce' }.
//
// The columns are written with the admin client: a DB trigger (migration 024)
// refuses business_type / business_type_selected_at / commerce_profile writes
// from the tenant JWT, so the choice can only be made through this route.
//
// The choice is made exactly once, server-side. The route accepts it only while
// `business_type` is still NULL (a new sign-up on Step 0); the one exception is
// the pre-024 backfill (`services` with no `business_type_selected_at`), which
// may confirm `services` so the backfill becomes an explicit choice. Anything
// else — switching to the other type, re-posting the chosen type, a legacy
// organization asking for the store flow — is refused with 409 `already_selected`,
// whether or not onboarding is completed: the services steps and the store
// steps do not check the type themselves, so a flip mid-onboarding would leave
// the organization with the other flow's agent, data and dashboard.

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
import { createAdminClient } from '@/lib/supabase/admin'

const BodySchema = z.object({
  business_type: z.enum(['services', 'ecommerce']),
})

/** Postgres "column does not exist" / PostgREST unknown column: migration 024 is not applied. */
function isMissingColumn(error: { code?: string } | null): boolean {
  return !!error && (error.code === '42703' || error.code === 'PGRST204')
}

export async function POST(request: Request) {
  const requestId = requestIdFrom(request)
  let log = createLogger({ requestId, route: 'onboarding.business_type' })
  try {
    assertSameOrigin(request)
    const { supabase, org } = await requireOrg()
    log = log.child({ orgId: org.id })
    const body = await parseJsonBody(request, BodySchema, 4 * 1024)

    // Reads stay on the user-scoped client (RLS-bounded); only the guarded write needs the admin.
    const { data: row, error: readErr } = await supabase
      .from('organizations')
      .select('business_type, business_type_selected_at, onboarding_step, onboarding_completed')
      .eq('id', org.id)
      .single()
    if (isMissingColumn(readErr)) {
      throw new RequestError('not_configured', 'Choosing a business type is not available yet.', 503)
    }
    if (readErr) throw new Error(`organizations read failed: ${readErr.message}`)

    if (row.onboarding_completed) {
      throw new RequestError(
        'precondition_failed',
        'The business type can no longer be changed once setup is complete.',
        409,
        { reason: 'onboarding_completed' },
      )
    }

    // One-time choice: an explicit selection is final, and a backfilled type can only be
    // confirmed, never changed. Only a NULL type (new sign-up) is open to either value.
    const alreadySelected =
      !!row.business_type_selected_at || (row.business_type != null && row.business_type !== body.business_type)
    if (alreadySelected) {
      throw new RequestError(
        'precondition_failed',
        'The business type has already been chosen and cannot be changed.',
        409,
        { reason: 'already_selected' },
      )
    }

    // A first choice starts its flow at step 1; confirming the legacy backfill keeps the
    // position the organization already reached in the service onboarding.
    const firstChoice = row.business_type == null
    const onboardingStep = firstChoice ? 1 : (row.onboarding_step ?? 1)

    const admin = createAdminClient()
    const { error: writeErr } = await admin
      .from('organizations')
      .update({
        business_type: body.business_type,
        business_type_selected_at: new Date().toISOString(),
        ...(firstChoice ? { onboarding_step: 1 } : {}),
      })
      .eq('id', org.id)
    if (writeErr) throw new Error(`organizations update failed: ${writeErr.message}`)

    log.info('onboarding.business_type_selected', { businessType: body.business_type, firstChoice })
    return NextResponse.json({ business_type: body.business_type, onboarding_step: onboardingStep })
  } catch (err) {
    if (err instanceof RequestError) return requestErrorResponse(err, requestId)
    return errorResponse(err, log, 'onboarding.business_type_failed', requestId)
  }
}
