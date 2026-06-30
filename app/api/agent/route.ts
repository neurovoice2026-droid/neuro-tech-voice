import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { agents as elAgents, isConfigured as elConfigured } from '@/lib/elevenlabs/client'

export async function GET() {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: org } = await supabase
    .from('organizations')
    .select('id')
    .eq('user_id', user.id)
    .single()

  if (!org) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const { data: agent } = await supabase
    .from('agents')
    .select('*')
    .eq('org_id', org.id)
    .single()

  return NextResponse.json(agent ?? null)
}

export async function PATCH(request: Request) {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: org } = await supabase
    .from('organizations')
    .select('id')
    .eq('user_id', user.id)
    .single()

  if (!org) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const body = await request.json() as Record<string, unknown>

  // Only allow patching known agent columns
  const allowed = [
    'name', 'language', 'system_prompt', 'first_message', 'fallback_message',
    'is_active', 'working_hours', 'voice_id', 'voice_name', 'metadata',
  ]
  const updates: Record<string, unknown> = {}
  for (const key of allowed) {
    if (key in body) updates[key] = body[key]
  }

  const { data: agent, error } = await supabase
    .from('agents')
    .update(updates)
    .eq('org_id', org.id)
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // Sync to ElevenLabs if agent has elevenlabs_agent_id and relevant fields changed
  const elId = agent.elevenlabs_agent_id
  const needsSync = elConfigured() && elId && (
    'system_prompt' in updates || 'first_message' in updates ||
    'language' in updates || 'voice_id' in updates || 'name' in updates
  )

  if (needsSync) {
    try {
      await elAgents.update(elId, {
        ...('name' in updates && { name: updates.name as string }),
        conversation_config: {
          agent: {
            ...(updates.system_prompt !== undefined && {
              prompt: { prompt: updates.system_prompt as string },
            }),
            ...(updates.first_message !== undefined && {
              first_message: updates.first_message as string,
            }),
            ...(updates.language !== undefined && {
              language: updates.language as string,
            }),
          },
          ...(updates.voice_id !== undefined && {
            tts: { voice_id: updates.voice_id as string },
          }),
        },
      })
    } catch {
      // Non-fatal — agent is updated in DB, ElevenLabs sync failed
    }
  }

  return NextResponse.json({ success: true, agent })
}
