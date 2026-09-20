import { handleRoute, noStore } from '@/lib/api/http'
import { requireOrgContext } from '@/lib/api/auth'
import { isElevenLabsConfigured, isGatewayConfigured, isTwilioConfigured } from '@/lib/env'
import { RATE_LIMITS, enforceRateLimit } from '@/lib/security/rate-limit'
import { getTwilioClient, isTwilioNotFound, numberCapabilities, twilioErrorInfo } from '@/lib/twilio/client'
import { routingStatusFor } from '@/lib/twilio/numbers'
import { numberWebhookUrls } from '@/lib/twilio/webhooks'
import type { PhoneNumber } from '@/types'

// Read-only routing report for the signed-in organization's numbers: what
// the database says and what Twilio actually has configured. It changes
// nothing (use POST /api/phone/[id]/routing to repair) and never includes
// prompts, credentials or other organizations' data.

export const runtime = 'nodejs'

const MAX_NUMBERS = 10

type Row = Partial<PhoneNumber> & { id: string; number: string }

export const GET = handleRoute(async () => {
  const ctx = await requireOrgContext()
  await enforceRateLimit(RATE_LIMITS.apiWrite, ctx.user.id)

  const { data, error } = await ctx.supabase
    .from('phone_numbers')
    .select('*')
    .eq('org_id', ctx.org.id)
    .order('created_at', { ascending: false })
    .limit(MAX_NUMBERS)
  if (error) {
    console.error('[telephony] diagnose lookup failed', error.code, error.message)
    throw new Error('Phone number lookup failed')
  }

  const expected = numberWebhookUrls()
  const twilioConfigured = isTwilioConfigured()

  const numbers = await Promise.all(
    ((data ?? []) as Row[]).map(async (row) => {
      let twilio: Record<string, unknown> | null = null
      if (twilioConfigured && row.twilio_sid) {
        try {
          const live = await getTwilioClient().incomingPhoneNumbers(row.twilio_sid).fetch()
          twilio = {
            found: true,
            voice_url_matches: live.voiceUrl === expected.voiceUrl,
            voice_method_post: live.voiceMethod?.toUpperCase() === 'POST',
            voice_fallback_url_matches: live.voiceFallbackUrl === expected.voiceFallbackUrl,
            status_callback_matches: live.statusCallback === expected.statusCallback,
            sms_url_matches: live.smsUrl === expected.smsUrl,
            voice_application_set: !!live.voiceApplicationSid,
            trunk_set: !!live.trunkSid,
            capabilities: numberCapabilities(live.capabilities),
          }
        } catch (err) {
          if (isTwilioNotFound(err)) {
            twilio = { found: false }
          } else {
            const info = twilioErrorInfo(err)
            console.error('[telephony] diagnose fetch failed', info.status, info.code)
            twilio = { found: null, error: 'Could not read this number from the phone provider.' }
          }
        }
      }
      const liveOk =
        twilio === null
          ? null
          : twilio.found === true &&
            twilio.voice_url_matches === true &&
            twilio.voice_fallback_url_matches === true &&
            twilio.status_callback_matches === true &&
            twilio.sms_url_matches === true &&
            twilio.voice_application_set === false &&
            twilio.trunk_set === false
      const stored = routingStatusFor({
        routing_mode: row.routing_mode ?? null,
        voice_url: row.voice_url ?? null,
        routing_error: row.routing_error ?? null,
      })
      return {
        id: row.id,
        number: row.number,
        is_active: row.is_active ?? false,
        agent_assigned: !!row.agent_id,
        routing_mode: row.routing_mode ?? null,
        routing_status: stored,
        routing_synced_at: row.routing_synced_at ?? null,
        routing_error: row.routing_error ?? null,
        sms_capable: row.sms_capable ?? false,
        legacy_elevenlabs_import: !!row.elevenlabs_phone_number_id,
        has_provider_record: !!row.twilio_sid,
        twilio,
        needs_reconnect: stored === 'needs_reconnect' || liveOk === false,
      }
    })
  )

  return noStore(
    Response.json({
      configured: {
        twilio: twilioConfigured,
        voice_gateway: isGatewayConfigured(),
        elevenlabs_fallback: isElevenLabsConfigured(),
      },
      expected_webhooks: expected,
      numbers,
    })
  )
})
