import type { SupabaseClient } from '@supabase/supabase-js'
import { phoneNumbers as elPhoneNumbers } from '@/lib/elevenlabs/client'

/**
 * Ensures every phone number the org owns is imported into ElevenLabs and
 * assigned to the given agent, so inbound calls route to it. Best-effort —
 * never throws.
 *
 * IMPORTANT: ElevenLabs only auto-configures the Twilio voice webhook during
 * import (their documented behavior - "ElevenLabs automatically configures
 * the Twilio phone number with the correct settings"). A plain PATCH that
 * only changes agent_id on an already-imported number does NOT reliably
 * retrigger that configuration. So whenever a number needs to move to a
 * different agent, it's deleted from ElevenLabs and re-imported fresh with
 * the new agent_id already attached, rather than patched in place. An
 * earlier version of this function called a hand-set static webhook URL
 * instead (lib/phone/webhook.ts) - that produced Twilio's generic
 * "application error" tone for at least one real number, so don't reintroduce
 * a hardcoded ElevenLabs URL here without solid evidence it's correct for
 * the account in question.
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
          agent_id: elAgentId,
          provider_config: {
            twilio: {
              account_sid: process.env.TWILIO_ACCOUNT_SID!,
              auth_token: process.env.TWILIO_AUTH_TOKEN!,
              phone_number_sid: twilioSid,
            },
          },
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
