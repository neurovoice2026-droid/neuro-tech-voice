import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { agents as elAgents, isConfigured as elConfigured } from '@/lib/elevenlabs/client'

export async function PATCH(request: Request) {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { voice_id, voice_name } = (await request.json()) as {
    voice_id: string
    voice_name: string
  }

  const { data: org } = await supabase
    .from('organizations')
    .select('id')
    .eq('user_id', user.id)
    .single()

  if (!org) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const { data: agent, error } = await supabase
    .from('agents')
    .update({ voice_id, voice_name })
    .eq('org_id', org.id)
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // Sync to ElevenLabs
  if (elConfigured() && agent.elevenlabs_agent_id) {
    try {
      await elAgents.update(agent.elevenlabs_agent_id, {
        conversation_config: { tts: { voice_id, model_id: 'eleven_turbo_v2_5' } },
      })
    } catch {
      // Non-fatal
    }
  }

  return NextResponse.json({ success: true })
}
