import { randomUUID } from 'node:crypto'
import type { NextRequest } from 'next/server'
import { z } from 'zod'
import { ApiError, handleRoute, noStore, parseJson } from '@/lib/api/http'
import { requireOrgAgent, requireOrgContext } from '@/lib/api/auth'
import { entitlementsFor, isTrialExpired } from '@/lib/billing/entitlements'
import { isTwilioConfigured } from '@/lib/env'
import { kvGet, kvSet } from '@/lib/kv'
import { destinationRefusalMessage } from '@/lib/phone/destinations'
import { maskPhone, normalizeE164 } from '@/lib/phone/e164'
import { sha256Hex } from '@/lib/security/crypto'
import { RATE_LIMITS, enforceRateLimit } from '@/lib/security/rate-limit'
import { createAdminClient } from '@/lib/supabase/admin'
import { UNCALLABLE_NUMBER_CODES, callDestinationRefusal, createOutboundCall } from '@/lib/twilio/calls'
import { twilioErrorInfo } from '@/lib/twilio/client'
import { activeOrgNumber } from '@/lib/twilio/numbers'
import { TEST_CALL_NUMBERS_PER_DAY, nextTestCallNumbers } from './numbers'

// "Call my phone": the agent calls the owner from the org's own number, going
// through the same router as real calls (/api/telephony/outbound). Test calls
// are capped at 3 minutes and never billed, so they must not work as free
// outbound calling: an expired trial can't place them, people on the
// business's opt-out list are never called, destinations follow the same
// policy as paid calls, and one day's test calls reach at most a few numbers.

export const runtime = 'nodejs'

const BodySchema = z.object({ to_number: z.string().trim().min(5).max(32) })

/** 180 s agent cap (lib/voice/session.ts) plus ringing and goodbye. */
const TEST_CALL_TIME_LIMIT_SECONDS = 240
const DAY_SECONDS = 24 * 60 * 60

export const POST = handleRoute(async (req: NextRequest) => {
  const ctx = await requireOrgContext()
  if (isTrialExpired(ctx.org)) {
    throw new ApiError(403, 'trial_expired', 'Your trial has ended. Choose a plan to keep testing your agent.')
  }
  const body = await parseJson(req, BodySchema)
  const to = normalizeE164(body.to_number)
  if (!to) {
    throw new ApiError(400, 'invalid_phone', 'Enter your number in international format, starting with + and the country code (for example +40712345678).')
  }
  if (!isTwilioConfigured()) {
    throw new ApiError(503, 'not_configured', 'Phone calls aren’t available yet. Please try the test call in your browser instead.')
  }

  const agent = await requireOrgAgent(ctx)
  const number = await activeOrgNumber(ctx.supabase, ctx.org.id)
  if (!number) {
    throw new ApiError(409, 'no_phone_number', 'Your agent needs an active phone number to call you. Get one on the Phone Numbers page.')
  }
  if (number.number === to) {
    throw new ApiError(400, 'invalid_phone', 'That’s your agent’s own number. Enter the phone you want the agent to call.')
  }
  const refusal = callDestinationRefusal(to, number.number)
  if (refusal) throw new ApiError(400, 'destination_not_allowed', destinationRefusalMessage(refusal))

  const supabase = createAdminClient()
  const optOut = await supabase.from('sms_opt_outs').select('phone').eq('org_id', ctx.org.id).eq('phone', to).maybeSingle()
  if (optOut.error) {
    console.error('[telephony] opt-out lookup failed', optOut.error.code, optOut.error.message)
    throw new ApiError(500, 'internal_error', 'We couldn’t check this number’s contact preferences. Please try again.')
  }
  if (optOut.data) {
    throw new ApiError(409, 'opted_out', 'This number asked not to be contacted by your business, so the test call wasn’t placed.')
  }

  const day = new Date().toISOString().slice(0, 10)
  const numbersKey = `test-call:numbers:${ctx.org.id}:${day}`
  const known = (await kvGet<string[]>(numbersKey)) ?? []
  const numbers = nextTestCallNumbers(Array.isArray(known) ? known : [], sha256Hex(to).slice(0, 32))
  if (!numbers) {
    throw new ApiError(
      429,
      'test_numbers_limit',
      `Test calls can ring up to ${TEST_CALL_NUMBERS_PER_DAY} different numbers a day. Use a number you already tested today, or try again tomorrow.`
    )
  }
  await enforceRateLimit({ ...RATE_LIMITS.testCall, limit: entitlementsFor(ctx.org.plan).testCallsPerDay }, ctx.org.id)
  await kvSet(numbersKey, numbers, DAY_SECONDS)

  const callId = randomUUID()
  const { error: insertError } = await supabase.from('calls').insert({
    id: callId,
    org_id: ctx.org.id,
    agent_id: agent.id,
    phone_number_id: number.id,
    direction: 'outbound',
    is_test: true,
    status: 'in-progress',
    from_number: number.number,
    to_number: to,
    caller_number: to,
    started_at: new Date().toISOString(),
  })
  if (insertError) {
    console.error('[telephony] test call row insert failed', insertError.code, insertError.message)
    throw new ApiError(500, 'internal_error', 'We couldn’t start the test call. Please try again.')
  }

  try {
    const { sid } = await createOutboundCall({
      to,
      from: number.number,
      callId,
      voicemailDetection: false,
      timeLimitSeconds: TEST_CALL_TIME_LIMIT_SECONDS,
    })
    const { error } = await supabase
      .from('calls')
      .update({ twilio_call_sid: sid })
      .eq('id', callId)
      .eq('org_id', ctx.org.id)
      .is('twilio_call_sid', null)
    if (error) console.error('[telephony] storing test call sid failed', error.code, error.message)
    return noStore(Response.json({ success: true, call_id: callId, message: `Calling ${maskPhone(to)} now. Pick up to talk to your agent.` }))
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
