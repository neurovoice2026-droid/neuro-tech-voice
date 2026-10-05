// <Dial action> callback for every dialed leg (Cartesia SIP fallback,
// after-hours forward, final-failure handoff, human transfer).
import { twilioRoute } from '@/lib/telephony/route-handler'
import { handleDialComplete } from '@/lib/telephony/router'
import { hangup } from '@/lib/telephony/twiml'

const LEGS = new Set(['cartesia', 'handoff', 'after_hours', 'transfer'])

export const POST = twilioRoute(
  'telephony.dial_complete',
  async ({ params, log, callId, url }) => {
    const leg = url.searchParams.get('leg') ?? ''
    if (!LEGS.has(leg)) {
      log.warn('telephony.dial_complete_unknown_leg', { leg: leg.slice(0, 20) })
      return hangup()
    }
    return handleDialComplete(callId as string, leg, params, log)
  },
  { onError: 'hangup', token: 'dial_complete' },
)
