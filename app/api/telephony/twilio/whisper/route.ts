// <Dial><Number url> of a human transfer: the TwiML spoken to the person who
// answered (the caller's reason), before Twilio bridges the caller in.
// Twilio-signed request + signed 'whisper' call token (twilioRoute).
import { twilioRoute } from '@/lib/telephony/route-handler'
import { handleWhisper } from '@/lib/telephony/whisper-handler'

export const POST = twilioRoute(
  'telephony.whisper',
  async ({ log, callId }) => handleWhisper(callId as string, log),
  { onError: 'hangup', token: 'whisper' },
)
