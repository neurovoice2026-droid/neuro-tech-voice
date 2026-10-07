import 'server-only'
// Outbound calls (dashboard "call a number" and "test call").
//   app_routed numbers: Twilio places the call; when answered, Twilio fetches
//     /api/telephony/twilio/outbound-connect and the router picks the healthy
//     provider exactly like an inbound call (ElevenLabs → Cartesia fallback).
//   native_elevenlabs numbers: ElevenLabs places the call (no failover).
// Validation (E.164, ownership, capabilities, agent state, plan minutes)
// happens before any external request; the caller route enforces auth,
// origin and rate limits. Both paths ring the callee for
// OUTBOUND_RING_TIMEOUT_S and open with the outbound greeting (AI disclosure
// and, when enabled, the recording notice), built by ./client-data.ts.
//
// Native outbound outcomes (POST /v1/convai/twilio/outbound-call):
//   • success with a conversation id → the row keeps ringing; the post-call
//     webhook (or conversation_reconcile) completes it;
//   • success=false or no conversation id → the row is failed
//     ('elevenlabs:outbound_rejected') and the user is told;
//   • timeout / network error → the request may have reached ElevenLabs and
//     the callee may be ringing: the row stays 'ringing' with
//     routing.outbound_uncertain, the user gets a neutral answer, and
//     conversation_reconcile finds the conversation by ntv_call_id (or settles
//     the row as failed after 2 h);
//   • any other provider error → failed ('elevenlabs:outbound_failed').

import { createAdminClient } from '@/lib/supabase/admin'
import { createLogger, type Logger } from '@/lib/observability/logger'
import { getTwilioClient, isTwilioConfigured } from '@/lib/twilio/client'
import * as el from '@/lib/elevenlabs/client'
import { OUTBOUND_RING_TIMEOUT_S } from '@/lib/elevenlabs/api/telephony'
import { publicBaseUrl } from '@/lib/voice-providers/config'
import { outboundRoutingInput, planRouting } from '@/lib/voice-providers/routing'
import { isProviderError } from '@/lib/voice-providers/errors'
import { RequestError } from '@/lib/api/http'
import { maskPhone, normalizeE164 } from '@/lib/phone/e164'
import { loadRoutingContext, type NumberRow } from './context'
import { signCallToken } from './tokens'
import { buildClientData } from './client-data'
import { callAllowance } from './quota'

export interface OutboundRequest {
  orgId: string
  toNumber: string
  phoneNumberId?: string | null
  purpose: 'outbound' | 'test'
}

export interface OutboundResult {
  callId: string
  routingMode: 'app_routed' | 'native_elevenlabs'
  /** queued: the provider accepted the call. unconfirmed: the request timed out; the call may still ring. */
  status: 'queued' | 'unconfirmed'
}

/** Provider free text in logs: numbers masked, one bounded line. */
function logSafe(text: unknown): string | null {
  if (typeof text !== 'string' || !text) return null
  return text.replace(/\+?\d[\d\s().-]{3,}\d/g, '[number]').replace(/\s+/g, ' ').slice(0, 160)
}

export async function startOutboundCall(req: OutboundRequest, log: Logger = createLogger()): Promise<OutboundResult> {
  const to = normalizeE164(req.toNumber)
  if (!to) throw new RequestError('invalid_request', 'Enter the number in international format, e.g. +40712345678.', 400)
  const db = createAdminClient()

  let q = db
    .from('phone_numbers')
    .select('id, org_id, agent_id, number, is_active, routing_mode, supports_inbound, supports_outbound, cartesia_phone_number_id, elevenlabs_phone_number_id, routing_status')
    .eq('org_id', req.orgId)
    .eq('is_active', true)
  if (req.phoneNumberId) q = q.eq('id', req.phoneNumberId)
  const { data: numbers, error } = await q.order('created_at', { ascending: true }).limit(1)
  if (error) throw new Error(`phone_numbers read failed: ${error.message}`)
  const number = numbers?.[0] as (NumberRow & { elevenlabs_phone_number_id: string | null; routing_status: string }) | undefined
  if (!number) throw new RequestError('precondition_failed', 'You need an active phone number to place calls.', 409)
  if (!number.supports_outbound) throw new RequestError('precondition_failed', 'This phone number cannot place outbound calls.', 409)
  if (to === number.number) throw new RequestError('invalid_request', 'You cannot call your own agent line from itself.', 400)

  const ctx = await loadRoutingContext(number)
  if (!ctx.agent) throw new RequestError('precondition_failed', 'Set up your agent before placing calls.', 409)
  if (!ctx.agent.is_active) throw new RequestError('precondition_failed', 'Your agent is paused. Activate it to place calls.', 409)
  // Plan without overage (trial): no call once the included minutes are used up.
  const allowance = callAllowance(ctx.org.usage)
  if (!allowance.allowed) {
    throw new RequestError('precondition_failed', 'You have used all the call minutes included in your plan. Upgrade your plan to place more calls.', 409)
  }
  const timeLimit = typeof allowance.capSeconds === 'number' ? Math.min(ctx.agent.maxDurationSeconds, allowance.capSeconds) : ctx.agent.maxDurationSeconds
  const l = log.child({ orgId: req.orgId, agentId: ctx.agent.id, to: maskPhone(to), purpose: req.purpose })

  const baseRow = {
    org_id: req.orgId,
    agent_id: ctx.agent.id,
    phone_number_id: number.id,
    direction: 'outbound',
    caller_number: to,
    from_number: number.number,
    to_number: to,
    status: 'ringing',
    lifecycle_rank: 10,
    started_at: new Date().toISOString(),
    primary_provider: ctx.agent.primary,
    routing: { attempts: [], purpose: req.purpose },
  }

  if (number.routing_mode === 'native_elevenlabs') {
    if (!ctx.externalIds.elevenlabs || !number.elevenlabs_phone_number_id) {
      throw new RequestError('precondition_failed', 'This number is not connected to your ElevenLabs agent yet.', 409)
    }
    // routing.mode 'native': the initiation webhook recognises the row (idempotency by call).
    const routing = { ...baseRow.routing, mode: 'native' }
    const { data: call, error: insErr } = await db.from('calls').insert({ ...baseRow, routing, provider: 'elevenlabs', routing_reason: 'primary' }).select('id').single()
    if (insErr) throw new Error(`calls insert failed: ${insErr.message}`)
    const callId = call.id as string
    const clientData = buildClientData({
      callId,
      orgId: req.orgId,
      direction: 'outbound',
      // ElevenLabs places and controls this call: native transfer tool.
      routingMode: 'native',
      afterHours: false,
      businessName: ctx.org.name ?? '',
      agent: { name: ctx.agent.name, language: ctx.agent.language, recordingNotice: ctx.agent.recordingNotice === true, maxDurationSeconds: ctx.agent.maxDurationSeconds },
      endUserNumber: to,
      allowedOverrides: ctx.elevenLabsOverrides,
      capSeconds: allowance.capSeconds,
    })
    let res: Awaited<ReturnType<typeof el.twilio.outboundCall>>
    try {
      res = await el.twilio.outboundCall(
        {
          agent_id: ctx.externalIds.elevenlabs,
          agent_phone_number_id: number.elevenlabs_phone_number_id,
          to_number: to,
          conversation_initiation_client_data: clientData,
          telephony_call_config: { ringing_timeout_secs: OUTBOUND_RING_TIMEOUT_S },
        },
        { orgId: req.orgId, agentId: ctx.agent.id, callId },
      )
    } catch (err) {
      if (isProviderError(err) && (err.code === 'timeout' || err.code === 'network')) {
        // The request may have reached ElevenLabs and the callee may be
        // ringing: never report a definite failure (or invite a second call).
        const { error: markErr } = await db
          .from('calls')
          .update({ routing: { ...routing, outbound_uncertain: true, outbound_error: err.code } })
          .eq('id', callId)
        if (markErr) l.error('outbound.uncertain_update_failed', markErr)
        l.warn('outbound.native_unconfirmed', { callId, code: err.code })
        return { callId, routingMode: 'native_elevenlabs', status: 'unconfirmed' }
      }
      const { error: failErr } = await db.from('calls').update({ status: 'failed', lifecycle_rank: 30, routing_reason: 'no_provider', failover_reason: 'elevenlabs:outbound_failed' }).eq('id', callId)
      if (failErr) l.error('outbound.fail_update_failed', failErr)
      throw err
    }
    if (!res?.success || !res.conversation_id) {
      // Not placed (or not trackable): no webhook will ever come for it.
      const { error: failErr } = await db
        .from('calls')
        .update({
          status: 'failed',
          lifecycle_rank: 30,
          routing_reason: 'no_provider',
          failover_reason: 'elevenlabs:outbound_rejected',
          termination_reason: 'The voice provider did not place the call',
          ended_at: new Date().toISOString(),
          ...(res?.callSid ? { twilio_call_sid: res.callSid } : {}),
        })
        .eq('id', callId)
      if (failErr) l.error('outbound.fail_update_failed', failErr)
      l.error('outbound.native_rejected', null, { callId, success: res?.success ?? null, hasConversation: !!res?.conversation_id, providerMessage: logSafe(res?.message) })
      throw new RequestError('provider_error', 'The call could not be placed. Please try again.', 502)
    }
    const { error: updErr } = await db
      .from('calls')
      .update({ provider_call_id: res.conversation_id, elevenlabs_conversation_id: res.conversation_id, twilio_call_sid: res.callSid })
      .eq('id', callId)
    if (updErr) l.error('outbound.native_update_failed', updErr)
    l.info('outbound.native_started', { callId })
    return { callId, routingMode: 'native_elevenlabs', status: 'queued' }
  }

  // app_routed: refuse early if no provider could take the call when answered.
  if (!ctx.routingInput) throw new RequestError('precondition_failed', 'Your agent is not ready to take calls.', 409)
  const plan = planRouting(outboundRoutingInput(ctx.routingInput))
  if (plan.kind !== 'connect') {
    throw new RequestError('precondition_failed', 'No voice provider is available right now. Please try again in a few minutes.', 409)
  }
  const base = publicBaseUrl()
  if (!base || !isTwilioConfigured()) throw new RequestError('not_configured', 'Calling is not configured on the platform.', 503)

  const { data: call, error: insErr } = await db.from('calls').insert(baseRow).select('id').single()
  if (insErr) throw new Error(`calls insert failed: ${insErr.message}`)
  const callId = call.id as string
  const token = signCallToken(callId, 'outbound_connect', 2 * 3600)
  try {
    const created = await getTwilioClient().calls.create({
      to,
      from: number.number,
      url: `${base}/api/telephony/twilio/outbound-connect?t=${encodeURIComponent(token)}`,
      method: 'POST',
      statusCallback: `${base}/api/telephony/twilio/status`,
      statusCallbackMethod: 'POST',
      statusCallbackEvent: ['initiated', 'ringing', 'answered', 'completed'],
      timeout: OUTBOUND_RING_TIMEOUT_S,
      timeLimit: Math.max(60, Math.min(4 * 3600, timeLimit)),
    })
    const { error: updErr } = await db.from('calls').update({ twilio_call_sid: created.sid }).eq('id', callId)
    if (updErr) l.error('outbound.sid_update_failed', updErr)
  } catch (err) {
    const { error: failErr } = await db.from('calls').update({ status: 'failed', lifecycle_rank: 30, routing_reason: 'no_provider', failover_reason: 'twilio:create_failed' }).eq('id', callId)
    if (failErr) l.error('outbound.fail_update_failed', failErr)
    l.error('outbound.twilio_create_failed', err)
    const code = (err as { code?: number }).code
    // Twilio 21210/21212 invalid From, 21215 geo permissions, 21211 invalid To.
    if (code === 21215) throw new RequestError('precondition_failed', 'Calls to this country are not enabled for the platform.', 409)
    if (code === 21211) throw new RequestError('invalid_request', 'The destination number is not valid.', 400)
    throw new RequestError('provider_error', 'The call could not be placed. Please try again.', 502)
  }
  l.info('outbound.started', { callId })
  return { callId, routingMode: 'app_routed', status: 'queued' }
}
