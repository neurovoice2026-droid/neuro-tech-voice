// Redirect target appended after the ElevenLabs <Connect><Stream>: runs when
// the media stream closes while the caller is still connected.
import { twilioRoute } from '@/lib/telephony/route-handler'
import { handleStreamEnded } from '@/lib/telephony/router'

export const POST = twilioRoute(
  'telephony.stream_ended',
  ({ params, log, callId }) => handleStreamEnded(callId as string, params, log),
  { onError: 'hangup', token: 'stream_ended' },
)
