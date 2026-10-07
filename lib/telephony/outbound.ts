import 'server-only'
// Outbound calls (dashboard "call a number" and "test call").
//   app_routed numbers: Twilio places the call; when answered, Twilio fetches
//     /api/telephony/twilio/outbound-connect and the router picks the healthy
//     provider exactly like an inbound call (ElevenLabs → Cartesia fallback).
//   native_elevenlabs numbers: ElevenLabs places the call (no failover).
// Validation (E.164, ownership, capabilities, agent state) happens before any
// external request; the caller route enforces auth, origin and rate limits.

import { createAdminClient } from '@/lib/supabase/admin'
import { createLogger, type Logger } from '@/lib/observability/logger'
import { getTwilioClient, isTwilioConfigured } from '@/lib/twilio/client'
import * as el from '@/lib/elevenlabs/client'
import { publicBaseUrl } from '@/lib/voice-providers/config'
import { outboundRoutingInput, planRouting } from '@/lib/voice-providers/routing'
import { RequestError } from '@/lib/api/http'
import { maskPhone, normalizeE164 } from '@/lib/phone/e164'
import { loadRoutingContext, type NumberRow } from './context'
import { signCallToken } from './tokens'

export interface OutboundRequest {
  orgId: string
  toNumber: string
  phoneNumberId?: string | null
  purpose: 'outbound' | 'test'
}

export interface OutboundResult {
  callId: string
  routingMode: 'app_routed' | 'native_elevenlabs'
  status: 'queued'
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
    const { data: call, error: insErr } = await db.from('calls').insert({ ...baseRow, provider: 'elevenlabs', routing_reason: 'primary' }).select('id').single()
    if (insErr) throw new Error(`calls insert failed: ${insErr.message}`)
    let res: Awaited<ReturnType<typeof el.twilio.outboundCall>>
    const callToken = signCallToken(call.id as string, 'transfer', 4 * 3600)
    try {
      res = await el.twilio.outboundCall(
        {
          agent_id: ctx.externalIds.elevenlabs,
          agent_phone_number_id: number.elevenlabs_phone_number_id,
          to_number: to,
          conversation_initiation_client_data: { user_id: req.orgId, dynamic_variables: {
            ntv_call_id: call.id as string,
            // Signed so the post-call webhook can be matched to this row (a
            // bare ntv_call_id is never trusted).
            ntv_call_token: callToken,
            // Same token as a secret variable (never sent to the LLM; tool headers).
            secret__ntv_call_token: callToken,
            // ElevenLabs places and controls this call: native transfer tool.
            ntv_routing_mode: 'native',
            after_hours: 'false',
            business_name: ctx.org.name ?? '',
            // Gates voicemail_detection to outbound calls (prompt rule).
            ntv_call_direction: 'outbound',
          } },
        },
        { orgId: req.orgId, agentId: ctx.agent.id, callId: call.id as string },
      )
    } catch (err) {
      const { error: failErr } = await db.from('calls').update({ status: 'failed', lifecycle_rank: 30, routing_reason: 'no_provider', failover_reason: 'elevenlabs:outbound_failed' }).eq('id', call.id)
      if (failErr) l.error('outbound.fail_update_failed', failErr)
      throw err
    }
    const { error: updErr } = await db
      .from('calls')
      .update({ provider_call_id: res.conversation_id, elevenlabs_conversation_id: res.conversation_id, twilio_call_sid: res.callSid })
      .eq('id', call.id)
    if (updErr) l.error('outbound.native_update_failed', updErr)
    l.info('outbound.native_started', { callId: call.id })
    return { callId: call.id as string, routingMode: 'native_elevenlabs', status: 'queued' }
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
      timeout: 30,
      timeLimit: Math.max(60, Math.min(4 * 3600, ctx.agent.maxDurationSeconds)),
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
