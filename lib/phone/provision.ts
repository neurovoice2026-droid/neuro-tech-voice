import type { SupabaseClient } from '@supabase/supabase-js'
import { getTwilioClient } from '@/lib/twilio/client'
import { phoneNumbers as elPhoneNumbers, isConfigured as elConfigured } from '@/lib/elevenlabs/client'

export interface ProvisionPhoneNumberParams {
  orgId: string
  number: string
  country?: string
  agentId?: string | null
  stripeSubscriptionId?: string | null
}

/**
 * Actually buys a number from Twilio, imports it into ElevenLabs, and records
 * it in our DB. Called only after payment has been confirmed (from the
 * Stripe webhook) - never directly from a request a customer can trigger
 * without having paid.
 */
export async function provisionPhoneNumber(
  supabase: SupabaseClient,
  { orgId, number, country, agentId, stripeSubscriptionId }: ProvisionPhoneNumberParams
) {
  let elevenlabsAgentId: string | null = null
  let localAgentId: string | null = agentId ?? null

  if (agentId) {
    const { data: agent } = await supabase
      .from('agents')
      .select('elevenlabs_agent_id')
      .eq('id', agentId)
      .eq('org_id', orgId)
      .single()
    elevenlabsAgentId = agent?.elevenlabs_agent_id ?? null
  } else {
    const { data: agent } = await supabase
      .from('agents')
      .select('id, elevenlabs_agent_id')
      .eq('org_id', orgId)
      .limit(1)
      .single()
    if (agent) {
      elevenlabsAgentId = agent.elevenlabs_agent_id
      localAgentId = agent.id
    }
  }

  // Step 1: Provision the bare number from Twilio.
  const twilio = getTwilioClient()
  const purchased = await twilio.incomingPhoneNumbers.create({ phoneNumber: number })

  // Step 2: Import into ElevenLabs (assigns the agent + owns inbound handling)
  let elevenlabsPhoneNumberId: string | null = null
  if (elConfigured()) {
    try {
      const elPhone = await elPhoneNumbers.create({
        phone_number: purchased.phoneNumber,
        label: `${orgId}-${purchased.friendlyName ?? number}`,
        provider: 'twilio',
        agent_id: elevenlabsAgentId ?? undefined,
        sid: process.env.TWILIO_ACCOUNT_SID!,
        token: process.env.TWILIO_AUTH_TOKEN!,
      })
      elevenlabsPhoneNumberId = elPhone.phone_number_id
    } catch (err) {
      console.error('ElevenLabs phone import failed:', err)
    }
  }

  // Step 3: Save to our DB
  const { data: phoneRecord, error: dbError } = await supabase
    .from('phone_numbers')
    .insert({
      org_id: orgId,
      twilio_sid: purchased.sid,
      number: purchased.phoneNumber,
      friendly_name: purchased.friendlyName,
      country: country ?? 'US',
      is_active: true,
      is_verified: true,
      elevenlabs_phone_number_id: elevenlabsPhoneNumberId,
      agent_id: localAgentId,
      stripe_subscription_id: stripeSubscriptionId ?? null,
    })
    .select()
    .single()

  if (dbError) throw new Error(dbError.message)

  return phoneRecord
}
