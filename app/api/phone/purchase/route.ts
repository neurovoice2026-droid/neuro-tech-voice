import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getTwilioClient } from '@/lib/twilio/client'
import { phoneNumbers as elPhoneNumbers, isConfigured as elConfigured } from '@/lib/elevenlabs/client'

export async function POST(request: Request) {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: org } = await supabase
    .from('organizations')
    .select('id')
    .eq('user_id', user.id)
    .single()

  if (!org) return NextResponse.json({ error: 'Organization not found' }, { status: 404 })

  const { number, country, agent_id } = (await request.json()) as {
    number: string
    country?: string
    agent_id?: string
  }

  if (!number) {
    return NextResponse.json({ error: 'Phone number is required' }, { status: 400 })
  }

  // Get agent's elevenlabs_agent_id
  let elevenlabsAgentId: string | null = null
  let localAgentId: string | null = agent_id ?? null

  if (agent_id) {
    const { data: agent } = await supabase
      .from('agents')
      .select('elevenlabs_agent_id')
      .eq('id', agent_id)
      .eq('org_id', org.id)
      .single()
    elevenlabsAgentId = agent?.elevenlabs_agent_id ?? null
  } else {
    const { data: agent } = await supabase
      .from('agents')
      .select('id, elevenlabs_agent_id')
      .eq('org_id', org.id)
      .limit(1)
      .single()
    if (agent) {
      elevenlabsAgentId = agent.elevenlabs_agent_id
      localAgentId = agent.id
    }
  }

  try {
    // Step 1: Provision the bare number from Twilio.
    const twilio = getTwilioClient()
    const purchased = await twilio.incomingPhoneNumbers.create({
      phoneNumber: number,
    })

    // Step 2: Import into ElevenLabs (assigns the agent + owns inbound handling)
    let elevenlabsPhoneNumberId: string | null = null

    if (elConfigured()) {
      try {
        const elPhone = await elPhoneNumbers.create({
          phone_number: purchased.phoneNumber,
          label: `${org.id}-${purchased.friendlyName ?? number}`,
          agent_id: elevenlabsAgentId ?? undefined,
          provider_config: {
            twilio: {
              account_sid: process.env.TWILIO_ACCOUNT_SID!,
              auth_token: process.env.TWILIO_AUTH_TOKEN!,
              phone_number_sid: purchased.sid,
            },
          },
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
        org_id: org.id,
        twilio_sid: purchased.sid,
        number: purchased.phoneNumber,
        friendly_name: purchased.friendlyName,
        country: country ?? 'US',
        is_active: true,
        is_verified: true,
        elevenlabs_phone_number_id: elevenlabsPhoneNumberId,
        agent_id: localAgentId,
      })
      .select()
      .single()

    if (dbError) throw new Error(dbError.message)

    return NextResponse.json({
      success: true,
      phone_number: phoneRecord,
    })
  } catch (err) {
    if (process.env.NODE_ENV === 'development') {
      return NextResponse.json({
        success: true,
        phone_number: {
          id: crypto.randomUUID(),
          number,
          twilio_sid: `mock-${Date.now()}`,
          elevenlabs_phone_number_id: null,
          _mock: true,
        },
      })
    }
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Failed to purchase number' },
      { status: 500 }
    )
  }
}
