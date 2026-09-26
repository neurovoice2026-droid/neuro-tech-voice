import type { NextRequest } from 'next/server'
import { handleRoute, zUuid } from '@/lib/api/http'
import { createAdminClient } from '@/lib/supabase/admin'
import { CALL_SID_REGEX, RECORDING_SID_REGEX } from '@/lib/twilio/client'
import { readVerifiedTwilioForm } from '@/lib/twilio/signature'
import { loadCallById, loadCallByTwilioSid } from '@/lib/voice/session-loader'

// Recording status callback. The stored URL is always the app's own audio
// proxy (/api/calls/{id}/audio), which checks the org and plan before
// streaming from Twilio; the Twilio media URL never leaves the server.

export const runtime = 'nodejs'

const noContent = () => new Response(null, { status: 204 })

export const POST = handleRoute(async (req: NextRequest) => {
  const form = await readVerifiedTwilioForm(req)
  const recordingSid = form.RecordingSid ?? ''
  const status = form.RecordingStatus ?? ''
  if (!RECORDING_SID_REGEX.test(recordingSid)) return noContent()

  const callSid = CALL_SID_REGEX.test(form.CallSid ?? '') ? form.CallSid : null
  const callIdParam = zUuid.safeParse(req.nextUrl.searchParams.get('call_id'))
  const call = callIdParam.success ? await loadCallById(callIdParam.data) : callSid ? await loadCallByTwilioSid(callSid) : null
  if (!call || (callSid && call.twilio_call_sid && call.twilio_call_sid !== callSid)) {
    console.warn('[telephony] recording callback for an unknown call', recordingSid)
    return noContent()
  }

  if (status !== 'completed') {
    if (status === 'absent' || status === 'failed') {
      console.warn('[telephony] recording not available', call.id, status, form.ErrorCode ?? '')
    }
    return noContent()
  }

  const duration = Number.parseInt(form.RecordingDuration ?? '', 10)
  const { error } = await createAdminClient()
    .from('calls')
    .update({
      recording_sid: recordingSid,
      recording_duration_seconds: Number.isFinite(duration) && duration >= 0 ? duration : null,
      recording_url: `/api/calls/${call.id}/audio`,
    })
    .eq('id', call.id)
    .eq('org_id', call.org_id)
  if (error) {
    console.error('[telephony] recording update failed', error.code, error.message)
    throw new Error('Recording update failed')
  }
  return noContent()
})
