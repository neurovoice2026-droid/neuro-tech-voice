// Twilio call status callbacks (number statusCallback and outbound calls).
import { twilioRoute } from '@/lib/telephony/route-handler'
import { handleStatusCallback } from '@/lib/telephony/router'

export const POST = twilioRoute(
  'telephony.status',
  async ({ params, log }) => {
    await handleStatusCallback(params, log)
    return null
  },
  { onError: 'retry' },
)
