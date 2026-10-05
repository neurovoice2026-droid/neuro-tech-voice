// Twilio voice webhook for `app_routed` numbers: every inbound call is routed
// here first (working hours, ElevenLabs primary, Cartesia fallback).
// A failure answers 5xx so Twilio invokes the number's voiceFallbackUrl.
import { twilioRoute } from '@/lib/telephony/route-handler'
import { routeInboundCall } from '@/lib/telephony/router'

export const POST = twilioRoute('telephony.inbound', ({ params, log }) => routeInboundCall(params, log), { onError: 'retry' })
