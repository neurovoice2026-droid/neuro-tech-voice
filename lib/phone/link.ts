import type { SupabaseClient } from '@supabase/supabase-js'
import { phoneNumbers as elPhoneNumbers } from '@/lib/elevenlabs/client'

/**
 * Ensures every phone number the org owns is imported into ElevenLabs and
 * assigned to the given agent, so inbound calls route to it. Re-imports a
 * number if its earlier import failed. Best-effort — never throws.
 */
export async function linkNumbersToAgent(
  supabase: SupabaseClient,
  orgId: string,
  localAgentId: string,
  elAgentId: string
): Promise<void> {
  const { data: nums } = await supabase
    .from('phone_numbers')
    .select('id, number, twilio_sid, elevenlabs_phone_number_id')
    .eq('org_id', orgId)

  for (const n of nums ?? []) {
    try {
      if (n.elevenlabs_phone_number_id) {
        await elPhoneNumbers.update(n.elevenlabs_phone_number_id as string, { agent_id: elAgentId })
        await supabase.from('phone_numbers').update({ agent_id: localAgentId }).eq('id', n.id)
      } else if (n.twilio_sid && !String(n.twilio_sid).startsWith('mock')) {
        const imported = await elPhoneNumbers.create({
          phone_number: n.number as string,
          label: `${orgId}-${n.number}`,
          agent_id: elAgentId,
          provider_config: {
            twilio: {
              account_sid: process.env.TWILIO_ACCOUNT_SID!,
              auth_token: process.env.TWILIO_AUTH_TOKEN!,
              phone_number_sid: n.twilio_sid as string,
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
