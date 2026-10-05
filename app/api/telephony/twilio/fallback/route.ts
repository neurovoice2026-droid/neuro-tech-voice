// Twilio voiceFallbackUrl: the inbound webhook errored or timed out. The
// router is idempotent on CallSid, so this never connects a call twice.
import { twilioRoute } from '@/lib/telephony/route-handler'
import { handleVoiceFallback } from '@/lib/telephony/router'

export const POST = twilioRoute('telephony.fallback', ({ params, log }) => handleVoiceFallback(params, log), { onError: 'hangup' })
