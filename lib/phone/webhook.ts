import { getTwilioClient } from '@/lib/twilio/client'

// ElevenLabs' native Twilio integration is documented to auto-configure a
// number's voice webhook on import, but that doesn't reliably happen in
// practice (this file exists because of it - see app/api/phone/diagnose,
// which was built as a manual workaround for exactly this). If the webhook
// never gets set, Twilio has no instructions for an inbound call: it doesn't
// ring, doesn't error, it just goes nowhere. So every code path that
// imports/reassigns a number to an agent now sets this explicitly and
// unconditionally instead of trusting ElevenLabs to have done it.
const EL_INBOUND_URL = 'https://api.us.elevenlabs.io/twilio/inbound_call'

/** Idempotent - safe to call every time a number is imported or reassigned. */
export async function ensureTwilioVoiceWebhook(twilioSid: string): Promise<void> {
  await getTwilioClient()
    .incomingPhoneNumbers(twilioSid)
    .update({ voiceUrl: EL_INBOUND_URL, voiceMethod: 'POST' })
}
