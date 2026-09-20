import { randomUUID } from 'node:crypto'
import { after, type NextRequest } from 'next/server'
import { ApiError, handleRoute, noStore } from '@/lib/api/http'
import { requireOrgAgent, requireOrgContext } from '@/lib/api/auth'
import { entitlementsFor, isTrialExpired } from '@/lib/billing/entitlements'
import { env, gatewayWsUrl, isGatewayConfigured } from '@/lib/env'
import { RATE_LIMITS, enforceRateLimit } from '@/lib/security/rate-limit'
import { signSessionToken } from '@/lib/security/signing'
import { createAdminClient } from '@/lib/supabase/admin'
import { resolvePipelineMode } from '@/lib/voice/mode'

// Starts an in-browser test call: pre-creates the test call row and returns
// the gateway WebSocket URL with a signed token that expires in 60 seconds.
// Test calls are never billed; the daily allowance depends on the plan.

export const runtime = 'nodejs'

const BROWSER_TOKEN_TTL_SECONDS = 60
const STALE_TEST_CALL_MS = 15 * 60 * 1000

export const POST = handleRoute(async (_req: NextRequest) => {
  const ctx = await requireOrgContext()
  // Test calls spend provider credits: they end with the trial.
  if (isTrialExpired(ctx.org)) {
    throw new ApiError(403, 'trial_expired', 'Your trial has ended. Choose a plan to keep testing your agent.')
  }
  if (!isGatewayConfigured()) {
    throw new ApiError(
      503,
      'gateway_not_configured',
      "Testing in the browser isn't available yet. You can still test your agent by having it call your phone."
    )
  }
  const agent = await requireOrgAgent(ctx)
  const allowance = entitlementsFor(ctx.org.plan).testCallsPerDay
  await enforceRateLimit({ ...RATE_LIMITS.testCall, limit: allowance }, ctx.org.id)

  const decision = await resolvePipelineMode({ agent, channel: 'browser' })
  if (decision.reason === 'no_provider') {
    console.error('[voice] browser test call: no voice pipeline is available', decision.skipped.map((s) => `${s.mode}:${s.reason}`).join(','))
    throw new ApiError(503, 'voice_unavailable', 'Your agent’s voice service is unavailable right now. Please try again in a few minutes.')
  }

  const supabase = createAdminClient()
  // A browser that never connected leaves its test row open; close stale ones
  // (test calls are capped at 3 minutes) so they don't linger as in progress.
  after(async () => {
    const { error: staleError } = await supabase
      .from('calls')
      .update({ status: 'failed', end_reason: 'error', ended_at: new Date().toISOString() })
      .eq('org_id', ctx.org.id)
      .eq('is_test', true)
      .eq('status', 'in-progress')
      .is('twilio_call_sid', null)
      .is('ended_at', null)
      .lt('started_at', new Date(Date.now() - STALE_TEST_CALL_MS).toISOString())
    if (staleError) console.error('[voice] closing stale test calls failed', staleError.code, staleError.message)
  })

  const callId = randomUUID()
  const { error } = await supabase
    .from('calls')
    .insert({
      id: callId,
      org_id: ctx.org.id,
      agent_id: agent.id,
      direction: 'inbound',
      is_test: true,
      status: 'in-progress',
      voice_provider: decision.mode === 'elevenlabs' ? 'elevenlabs' : 'cartesia',
      pipeline_mode: decision.mode,
      fallback_reason: decision.fallback ? decision.reason : null,
      started_at: new Date().toISOString(),
    })
  if (error) {
    console.error('[voice] test call row insert failed', error.code, error.message)
    throw new ApiError(500, 'internal_error', 'We couldn’t start the test call. Please try again.')
  }

  const token = signSessionToken(
    {
      v: 1,
      sid: callId,
      org: ctx.org.id,
      agt: agent.id,
      ch: 'browser',
      mode: decision.mode,
      exp: Math.floor(Date.now() / 1000) + BROWSER_TOKEN_TTL_SECONDS,
    },
    env.VOICE_GATEWAY_SECRET as string
  )

  return noStore(
    Response.json({
      ws_url: `${gatewayWsUrl('/browser')}?token=${encodeURIComponent(token)}`,
      call_id: callId,
      mode: decision.mode,
    })
  )
})
