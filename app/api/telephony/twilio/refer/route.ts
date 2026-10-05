// <Dial referUrl>: the Cartesia fallback agent requested a SIP REFER
// transfer. Only the business's configured transfer number is honoured.
import { twilioRoute } from '@/lib/telephony/route-handler'
import { handleRefer } from '@/lib/telephony/router'

export const POST = twilioRoute(
  'telephony.refer',
  ({ params, log, callId }) => handleRefer(callId as string, params, log),
  { onError: 'hangup', token: 'refer' },
)
