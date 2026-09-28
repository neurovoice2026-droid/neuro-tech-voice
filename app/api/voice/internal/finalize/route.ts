import { after, NextResponse, type NextRequest } from 'next/server'
import { ApiError, handleRoute, noStore, validationError } from '@/lib/api/http'
import { readVerifiedInternalBody } from '@/lib/security/signing'
import { enforceRateLimit, RATE_LIMITS } from '@/lib/security/rate-limit'
import { isSupabaseAdminConfigured } from '@/lib/env'
import { createAdminClient } from '@/lib/supabase/admin'
import { finalizeCall, FinalizeRequestSchema } from '@/lib/voice/post-call'
import type { FinalizeRequest } from '@/lib/voice/contracts'

// POST /api/voice/internal/finalize — the gateway reports a finished call.
// Answers 202 as soon as the body is verified and the call exists; storing the
// transcript, metering and the OpenAI analysis continue in after(). The work
// is idempotent on call_id, so the gateway's retries are harmless.

export const runtime = 'nodejs'
// Analysis on OpenAI's flex tier can take a while; after() shares this budget.
export const maxDuration = 300

export const POST = handleRoute(async (req: NextRequest) => {
  const raw = await readVerifiedInternalBody(req)

  let json: unknown
  try {
    json = JSON.parse(raw)
  } catch {
    throw new ApiError(400, 'invalid_json', 'Request body must be valid JSON.')
  }
  const parsed = FinalizeRequestSchema.safeParse(json)
  if (!parsed.success) throw validationError(parsed.error)
  const body = parsed.data as FinalizeRequest

  await enforceRateLimit(RATE_LIMITS.gatewayInternal, body.session_id)

  if (body.session_id !== body.call_id) {
    throw new ApiError(400, 'session_mismatch', 'session_id must match call_id.')
  }
  if (!isSupabaseAdminConfigured()) {
    throw new ApiError(503, 'not_configured', 'The database is not configured.')
  }

  const { data: call, error } = await createAdminClient()
    .from('calls')
    .select('id')
    .eq('id', body.call_id)
    .maybeSingle()
  if (error) {
    console.error('[finalize] call lookup failed', body.call_id, error.code, error.message)
    throw new ApiError(500, 'internal_error', 'Could not load the call.')
  }
  if (!call) throw new ApiError(404, 'call_not_found', 'Call not found.')

  after(async () => {
    try {
      await finalizeCall(body)
    } catch (err) {
      console.error('[finalize] post-call processing failed', body.call_id, err instanceof Error ? err.message : err)
    }
  })

  return noStore(NextResponse.json({ ok: true }, { status: 202 }))
})
