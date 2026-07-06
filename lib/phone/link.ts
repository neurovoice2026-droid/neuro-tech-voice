import type { SupabaseClient } from '@supabase/supabase-js'
import { phoneNumbers as elPhoneNumbers } from '@/lib/elevenlabs/client'

/**
 * Ensures every phone number the org owns is imported into ElevenLabs and
 * assigned to the given agent, so inbound calls route to it. Best-effort —
 * never throws.
 *
 * Two bugs compounded here historically, in order discovered:
 * 1. An earlier version force-set a hand-written static Twilio voiceUrl
 *    (lib/phone/webhook.ts, deleted) - Twilio confirmed with a real 404 on
 *    that exact URL, so it was simply wrong, not a config/region issue.
 * 2. The real bug: ElevenLabs' phone-number import request was shaped wrong.
 *    Twilio credentials were nested under provider_config.twilio.{account_sid,
 *    auth_token, phone_number_sid} - that shape doesn't exist in ElevenLabs'
 *    API at all (confirmed against their reference: it's flat top-level
 *    `sid`/`token`, no provider_config wrapper). Every past import silently
 *    never sent valid Twilio credentials, so ElevenLabs never had real access
 *    to configure anything on the Twilio side, regardless of agent_id.
 *
 * Also: a plain PATCH that only changes agent_id on an already-imported
 * number is not known to retrigger ElevenLabs' auto webhook configuration
 * (which their docs describe as an import-time behavior), so whenever a
 * number needs to move to a different agent, it's deleted from ElevenLabs and
 * re-imported fresh with the new agent_id already attached, rather than
 * patched in place.
 */
export async function linkNumbersToAgent(
  supabase: SupabaseClient,
  orgId: string,
  localAgentId: string,
  elAgentId: string
): Promise<void> {
  const { data: nums } = await supabase
    .from('phone_numbers')
    .select('id, number, twilio_sid, elevenlabs_phone_number_id, agent_id')
    .eq('org_id', orgId)

  for (const n of nums ?? []) {
    const twilioSid = n.twilio_sid && !String(n.twilio_sid).startsWith('mock') ? (n.twilio_sid as string) : null

    // Already linked to this exact agent in our own records - this function
    // runs on every agent save, so skip the (heavy) delete+reimport dance
    // entirely when there's nothing to actually fix.
    if (n.elevenlabs_phone_number_id && n.agent_id === localAgentId) continue

    try {
      // Already imported but assigned to a stale/different (or no) agent -
      // delete and re-import fresh so ElevenLabs reconfigures the webhook.
      if (n.elevenlabs_phone_number_id) {
        try {
          await elPhoneNumbers.delete(n.elevenlabs_phone_number_id as string)
        } catch (e) {
          console.error(`Failed to delete stale ElevenLabs phone number ${n.number} before reimport:`, e)
        }
        await supabase.from('phone_numbers').update({ elevenlabs_phone_number_id: null }).eq('id', n.id)
      }

      if (twilioSid) {
        const imported = await elPhoneNumbers.create({
          phone_number: n.number as string,
          label: `${orgId}-${n.number}`,
          provider: 'twilio',
          agent_id: elAgentId,
          sid: process.env.TWILIO_ACCOUNT_SID!,
          token: process.env.TWILIO_AUTH_TOKEN!,
        })
        await supabase
          .from('phone_numbers')
          .update({ elevenlabs_phone_number_id: imported.phone_number_id, agent_id: localAgentId })
          .eq('id', n.id)
      }
    } catch (e) {
      console.error('Failed to link phone number to agent:', e)
    }
  }
}
