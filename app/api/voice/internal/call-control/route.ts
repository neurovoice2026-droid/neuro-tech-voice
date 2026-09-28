import type { NextRequest } from 'next/server'
import { z } from 'zod'
import { ApiError, handleRoute, noStore, validationError, zE164, zUuid } from '@/lib/api/http'
import { entitlementsFor } from '@/lib/billing/entitlements'
import { isTwilioConfigured } from '@/lib/env'
import { RATE_LIMITS, enforceRateLimit } from '@/lib/security/rate-limit'
import { readVerifiedInternalBody } from '@/lib/security/signing'
import { createAdminClient } from '@/lib/supabase/admin'
import { callDestinationRefusal, hangupCall, startRecording, transferCall } from '@/lib/twilio/calls'
import type { CallControlResponse } from '@/lib/voice/contracts'
import { orgNumberOf } from '@/lib/voice/router'
import { loadCallById, loadOrganization } from '@/lib/voice/session-loader'

// Gateway → app: live call control. Twilio credentials live only in the app,
// so the gateway asks here to hang up, transfer or start recording. Business
// failures answer 200 { ok: false, error } so the gateway can tell the model
// what happened; authentication and validation failures use HTTP errors.

export const runtime = 'nodejs'

const BodySchema = z.object({
  session_id: zUuid,
  call_id: zUuid,
  action: z.enum(['hangup', 'transfer', 'start_recording']),
  to_e164: zE164.optional(),
})

function answer(body: CallControlResponse): Response {
  return noStore(Response.json(body))
}

export const POST = handleRoute(async (req: NextRequest) => {
  const raw = await readVerifiedInternalBody(req)
  let json: unknown
  try {
    json = JSON.parse(raw)
  } catch {
    throw new ApiError(400, 'invalid_json', 'Request body must be valid JSON.')
  }
  const parsed = BodySchema.safeParse(json)
  if (!parsed.success) throw validationError(parsed.error)
  const body = parsed.data
  if (body.call_id !== body.session_id) {
    throw new ApiError(400, 'validation_error', 'call_id must equal session_id.')
  }
  await enforceRateLimit(RATE_LIMITS.gatewayInternal, body.session_id)

  const call = await loadCallById(body.call_id)
  if (!call) throw new ApiError(404, 'call_not_found', 'Call not found.')
  // Browser test calls have no phone leg; the gateway ends those itself.
  if (!call.twilio_call_sid) return answer({ ok: false, error: 'not_a_phone_call' })
  if (!isTwilioConfigured()) return answer({ ok: false, error: 'not_configured' })
  const supabase = createAdminClient()

  switch (body.action) {
    case 'hangup': {
      // Set first: the <Connect action> that follows must read this as deliberate.
      if (!call.end_reason) {
        const { error } = await supabase
          .from('calls')
          .update({ end_reason: 'agent_hangup' })
          .eq('id', call.id)
          .eq('org_id', call.org_id)
          .is('end_reason', null)
        if (error) console.error('[voice] hangup end_reason update failed', error.code, error.message)
      }
      try {
        await hangupCall(call.twilio_call_sid)
        return answer({ ok: true })
      } catch {
        return answer({ ok: false, error: 'provider_error' })
      }
    }

    case 'transfer': {
      if (!body.to_e164) return answer({ ok: false, error: 'missing_destination' })
      // Only numbers the owner allowed for live transfers, whatever the model asked for.
      const { data: contact, error: contactError } = await supabase
        .from('escalation_contacts')
        .select('id')
        .eq('org_id', call.org_id)
        .eq('transfer_enabled', true)
        .eq('phone', body.to_e164)
        .limit(1)
        .maybeSingle()
      if (contactError) {
        console.error('[voice] transfer contact lookup failed', contactError.code, contactError.message)
        return answer({ ok: false, error: 'lookup_failed' })
      }
      if (!contact) return answer({ ok: false, error: 'destination_not_allowed' })
      const callerId = orgNumberOf(call)
      if (!callerId) return answer({ ok: false, error: 'no_caller_id' })
      // Premium-rate or out-of-policy numbers are never bridged, even for an allowed contact.
      const refusal = callDestinationRefusal(body.to_e164, callerId)
      if (refusal) {
        console.warn('[voice] transfer destination refused by policy', refusal)
        return answer({ ok: false, error: 'destination_not_allowed' })
      }

      const previousEndReason = call.end_reason
      const { error: markError } = await supabase
        .from('calls')
        .update({ end_reason: 'transferred' })
        .eq('id', call.id)
        .eq('org_id', call.org_id)
      if (markError) {
        console.error('[voice] transfer end_reason update failed', markError.code, markError.message)
        return answer({ ok: false, error: 'lookup_failed' })
      }
      try {
        await transferCall({
          callSid: call.twilio_call_sid,
          callId: call.id,
          to: body.to_e164,
          callerId,
          contactId: (contact as { id: string }).id,
        })
        return answer({ ok: true })
      } catch {
        // The stream keeps running: undo the mark so a later failure isn't read as a transfer.
        await supabase
          .from('calls')
          .update({ end_reason: previousEndReason })
          .eq('id', call.id)
          .eq('org_id', call.org_id)
          .eq('end_reason', 'transferred')
        return answer({ ok: false, error: 'provider_error' })
      }
    }

    case 'start_recording': {
      if (call.recording_sid) return answer({ ok: true })
      const org = await loadOrganization(call.org_id)
      if (!org || !entitlementsFor(org.plan).recordings) return answer({ ok: false, error: 'not_entitled' })
      try {
        const { sid } = await startRecording({ callSid: call.twilio_call_sid, callId: call.id })
        const { error } = await supabase
          .from('calls')
          .update({ recording_sid: sid })
          .eq('id', call.id)
          .eq('org_id', call.org_id)
          .is('recording_sid', null)
        if (error) console.error('[voice] recording sid update failed', error.code, error.message)
        return answer({ ok: true })
      } catch {
        return answer({ ok: false, error: 'provider_error' })
      }
    }
  }
})
