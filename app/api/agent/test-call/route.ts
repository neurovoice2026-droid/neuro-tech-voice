import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { twilioIntegration, isConfigured as elConfigured } from '@/lib/elevenlabs/client'

export async function POST(request: Request) {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: org } = await supabase
    .from('organizations')
    .select('id')
    .eq('user_id', user.id)
    .single()

  if (!org) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const { to_number } = (await request.json()) as { to_number: string }

  if (!to_number) {
    return NextResponse.json({ error: 'Phone number is required' }, { status: 400 })
  }

  if (!elConfigured()) {
    return NextResponse.json({ error: 'ElevenLabs not configured' }, { status: 503 })
  }

  // Get agent + phone number
  const [{ data: agent }, { data: phoneNumber }] = await Promise.all([
    supabase
      .from('agents')
      .select('elevenlabs_agent_id, name')
      .eq('org_id', org.id)
      .single(),
    supabase
      .from('phone_numbers')
      .select('elevenlabs_phone_number_id')
      .eq('org_id', org.id)
      .eq('is_active', true)
      .limit(1)
      .maybeSingle(),
  ])

  if (!agent?.elevenlabs_agent_id) {
    return NextResponse.json({ error: 'Agent not configured with ElevenLabs' }, { status: 400 })
  }

  if (!phoneNumber?.elevenlabs_phone_number_id) {
    return NextResponse.json({ error: 'No phone number linked to ElevenLabs' }, { status: 400 })
  }

  try {
    const result = await twilioIntegration.outboundCall({
      agent_id: agent.elevenlabs_agent_id,
      agent_phone_number_id: phoneNumber.elevenlabs_phone_number_id,
      to_number,
    })

    return NextResponse.json({
      success: true,
      conversation_id: result.conversation_id,
      message: `Test call initiated to ${to_number} from agent "${agent.name}"`,
    })
  } catch (err) {
    console.error('Test call error:', err)
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Failed to initiate test call' },
      { status: 500 }
    )
  }
}
