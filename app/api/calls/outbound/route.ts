import { randomUUID } from 'node:crypto'
import type { NextRequest } from 'next/server'
import { z } from 'zod'
import { ApiError, handleRoute, noStore, parseJson } from '@/lib/api/http'
import { requireOrgAgent, requireOrgContext } from '@/lib/api/auth'
import { callBlockReason, entitlementsFor } from '@/lib/billing/entitlements'
import { isTwilioConfigured } from '@/lib/env'
import { destinationRefusalMessage } from '@/lib/phone/destinations'
import { normalizeE164 } from '@/lib/phone/e164'
import { RATE_LIMITS, enforceRateLimit } from '@/lib/security/rate-limit'
import { createAdminClient } from '@/lib/supabase/admin'
import { UNCALLABLE_NUMBER_CODES, callDestinationRefusal, createOutboundCall } from '@/lib/twilio/calls'
import { twilioErrorInfo } from '@/lib/twilio/client'
import { activeOrgNumber } from '@/lib/twilio/numbers'
import { behaviorFor } from '@/lib/voice/session'
import { OUTBOUND_PURPOSE_KEY } from '@/lib/voice/session-loader'

// Places an outbound call from the org's number with its AI agent (paid
// plans). The call runs through the same router as inbound calls; the
// optional purpose is given to the agent as part of the call context.

export const runtime = 'nodejs'

const BodySchema = z.object({
  to_number: z.string().trim().min(5).max(32),
  purpose: z.string().trim().max(500).optional(),
})

const BLOCK_MESSAGES: Record<string, string> = {
  org_not_onboarded: 'Finish setting up your account before placing calls.',
  trial_expired: 'Your trial has ended. Choose a plan to place calls.',
  minutes_exhausted: 'You’ve used all the minutes in your plan. Upgrade to keep calling.',
}

export const POST = handleRoute(async (req: NextRequest) => {
  const ctx = await requireOrgContext()
  if (!entitlementsFor(ctx.org.plan).outboundCalls) {
    throw new ApiError(403, 'upgrade_required', 'Outbound calls are available on paid plans. Upgrade to let your agent place calls.')
  }
  await enforceRateLimit(RATE_LIMITS.outboundCall, ctx.org.id)

  const body = await parseJson(req, BodySchema)
  const to = normalizeE164(body.to_number)
  if (!to) {
    throw new ApiError(400, 'invalid_phone', 'Enter the number in international format, starting with + and the country code.')
  }
  if (!isTwilioConfigured()) {
    throw new ApiError(503, 'not_configured', 'Phone calls aren’t available yet.')
  }
  const blocked = callBlockReason(ctx.org)
  if (blocked) {
    throw new ApiError(403, blocked, BLOCK_MESSAGES[blocked] ?? 'Calls are paused for your account.')
  }

  const agent = await requireOrgAgent(ctx)
  if (!agent.is_active) {
    throw new ApiError(409, 'agent_inactive', 'Your agent is paused. Turn it on before placing calls.')
  }

  const supabase = createAdminClient()
  const [number, optOut] = await Promise.all([
    activeOrgNumber(ctx.supabase, ctx.org.id),
    supabase.from('sms_opt_outs').select('phone').eq('org_id', ctx.org.id).eq('phone', to).maybeSingle(),
  ])
  if (optOut.error) {
    console.error('[telephony] opt-out lookup failed', optOut.error.code, optOut.error.message)
    throw new ApiError(500, 'internal_error', 'We couldn’t check this number’s contact preferences. Please try again.')
  }
  if (optOut.data) {
    throw new ApiError(409, 'opted_out', 'This person asked not to be contacted by your business, so the call wasn’t placed.')
  }
  if (!number) {
    throw new ApiError(409, 'no_phone_number', 'You need an active phone number to place calls. Get one on the Phone Numbers page.')
  }
  if (number.number === to) {
    throw new ApiError(400, 'invalid_phone', 'That’s your agent’s own number.')
  }
  const refusal = callDestinationRefusal(to, number.number)
  if (refusal) throw new ApiError(400, 'destination_not_allowed', destinationRefusalMessage(refusal))

  const behavior = behaviorFor(agent, { isTest: false })
  const callId = randomUUID()
  const { error: insertError } = await supabase.from('calls').insert({
    id: callId,
    org_id: ctx.org.id,
    agent_id: agent.id,
    phone_number_id: number.id,
    direction: 'outbound',
    is_test: false,
    status: 'in-progress',
    from_number: number.number,
    to_number: to,
    caller_number: to,
    started_at: new Date().toISOString(),
    ...(body.purpose ? { extracted: { [OUTBOUND_PURPOSE_KEY]: body.purpose } } : {}),
  })
  if (insertError) {
    console.error('[telephony] outbound call row insert failed', insertError.code, insertError.message)
    throw new ApiError(500, 'internal_error', 'We couldn’t start the call. Please try again.')
  }

  try {
    const { sid } = await createOutboundCall({
      to,
      from: number.number,
      callId,
      voicemailDetection: behavior.voicemail_detection,
      // Ringing and a goodbye on top of the agent's own limit.
      timeLimitSeconds: behavior.max_duration_seconds + 60,
    })
    const { error } = await supabase
      .from('calls')
      .update({ twilio_call_sid: sid })
      .eq('id', callId)
      .eq('org_id', ctx.org.id)
      .is('twilio_call_sid', null)
    if (error) console.error('[telephony] storing outbound call sid failed', error.code, error.message)
    return noStore(Response.json({ success: true, call_id: callId, call_sid: sid }))
  } catch (error) {
    await supabase
      .from('calls')
      .update({ status: 'failed', end_reason: 'error', ended_at: new Date().toISOString() })
      .eq('id', callId)
      .eq('org_id', ctx.org.id)
    const { code } = twilioErrorInfo(error)
    if (code !== null && UNCALLABLE_NUMBER_CODES.has(code)) {
      throw new ApiError(400, 'uncallable_number', 'We can’t place a call to that number. Please check it and try again.')
    }
    throw new ApiError(502, 'call_failed', 'The call couldn’t be started. Please try again in a moment.')
  }
})
