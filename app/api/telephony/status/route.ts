import { after, type NextRequest } from 'next/server'
import { handleRoute, zUuid } from '@/lib/api/http'
import { recordCallUsage } from '@/lib/billing/usage'
import { createAdminClient } from '@/lib/supabase/admin'
import { CALL_SID_REGEX } from '@/lib/twilio/client'
import { readVerifiedTwilioForm } from '@/lib/twilio/signature'
import { isTerminalTwilioStatus, planStatusCallback } from '@/lib/twilio/status'
import { fireMissedCallWorkflows, wasHandedOffToElevenLabs, wasStreamStarted } from '@/lib/voice/router'
import { loadCallById, loadCallByTwilioSid } from '@/lib/voice/session-loader'

// Call status callback (the number's status_callback for inbound calls,
// statusCallback with ?call_id= for calls the app places). Stores the final
// status, duration and end time, bills answered calls once per Twilio call
// (idempotency key call:twilio:<CallSid>) and marks unanswered calls missed.

export const runtime = 'nodejs'
// Billing and call_missed workflows (waits and webhook retries) run in after().
export const maxDuration = 300

const noContent = () => new Response(null, { status: 204 })

export const POST = handleRoute(async (req: NextRequest) => {
  const form = await readVerifiedTwilioForm(req)
  const twilioStatus = form.CallStatus
  if (!isTerminalTwilioStatus(twilioStatus)) return noContent()

  const callSid = CALL_SID_REGEX.test(form.CallSid ?? '') ? form.CallSid : null
  const callIdParam = zUuid.safeParse(req.nextUrl.searchParams.get('call_id'))
  const call = callIdParam.success
    ? await loadCallById(callIdParam.data)
    : callSid
      ? await loadCallByTwilioSid(callSid)
      : null
  if (!call) return noContent()
  if (callSid && call.twilio_call_sid && call.twilio_call_sid !== callSid) {
    console.warn('[telephony] status callback CallSid does not match the call', call.id)
    return noContent()
  }

  const gatewayMode = call.pipeline_mode === 'cartesia_self' || call.pipeline_mode === 'cartesia_managed'
  const [streamStarted, handedOff] = await Promise.all([
    gatewayMode ? wasStreamStarted(call.id).catch(() => false) : false,
    // Only the app's own fallback paths set this, and they always mark fallback_used.
    call.fallback_used ? wasHandedOffToElevenLabs(call.id).catch(() => false) : false,
  ])
  const plan = planStatusCallback({
    twilioStatus,
    durationSeconds: Number.parseInt(form.CallDuration ?? '0', 10),
    row: call,
    streamStarted,
    handedOff,
    now: new Date(),
  })

  const supabase = createAdminClient()
  const { error } = await supabase
    .from('calls')
    .update({
      ...plan.update,
      ...(call.twilio_call_sid || !callSid ? {} : { twilio_call_sid: callSid }),
      // The billing decision, stored before billing runs in after(): the daily
      // cron bills calls left with seconds but no usage_recorded_at.
      ...(plan.bill && callSid ? { billable_seconds: plan.update.duration_seconds } : {}),
    })
    .eq('id', call.id)
    .eq('org_id', call.org_id)
  if (error) {
    // Twilio retries on 5xx; a failed write is worth a retry.
    console.error('[telephony] status update failed', error.code, error.message)
    throw new Error('Call status update failed')
  }

  if (plan.bill && callSid) {
    after(async () => {
      try {
        await recordCallUsage({
          orgId: call.org_id,
          callId: call.id,
          idempotencyKey: `call:twilio:${callSid}`,
          // After a hand-over ElevenLabs served the call, whatever the gateway leg wrote last.
          voiceProvider: handedOff ? 'elevenlabs' : call.voice_provider,
          pipelineMode: handedOff ? 'elevenlabs' : call.pipeline_mode,
          billableSeconds: plan.update.duration_seconds,
        })
      } catch (err) {
        console.error('[telephony] usage recording failed', call.id, err instanceof Error ? err.message : err)
      }
    })
  }

  if (plan.missed) {
    // Only the first writer of the outcome wins, so a retried callback or a
    // late finalize can't double-fire call_missed.
    const { data: marked, error: markError } = await supabase
      .from('calls')
      .update({ outcome: 'missed' })
      .eq('id', call.id)
      .eq('org_id', call.org_id)
      .is('outcome', null)
      .select('id')
    if (markError) console.error('[telephony] missed outcome update failed', markError.code, markError.message)
    if (!markError && (marked ?? []).length > 0 && plan.fireMissedWorkflows) {
      fireMissedCallWorkflows({ ...call, ...plan.update })
    }
  }

  return noContent()
})
