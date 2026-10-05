// TwiML for an answered outbound call placed by startOutboundCall(); the
// provider is chosen at answer time (same health/circuit rules as inbound).
import { twilioRoute } from '@/lib/telephony/route-handler'
import { routeOutboundConnect } from '@/lib/telephony/router'

export const POST = twilioRoute(
  'telephony.outbound_connect',
  ({ params, log, callId }) => routeOutboundConnect(callId as string, params, log),
  { onError: 'hangup', token: 'outbound_connect' },
)
