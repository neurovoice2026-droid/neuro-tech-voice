import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { agents as elAgents, isConfigured as elConfigured } from '@/lib/elevenlabs/client'
import { createAgentWithFallback, TTS_MODEL, LLM_MODEL } from '@/lib/elevenlabs/create-agent'
import { composeSystemPrompt } from '@/lib/elevenlabs/prompt'
import { linkNumbersToAgent } from '@/lib/phone/link'

export async function GET() {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: org } = await supabase
    .from('organizations')
    .select('id, name')
    .eq('user_id', user.id)
    .single()

  if (!org) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const { data: agent } = await supabase
    .from('agents')
    .select('*')
    .eq('org_id', org.id)
    .limit(1)
    .maybeSingle()

  // Safety net: accounts created before the onboarding-persistence fix may not
  // have an agent row yet. Auto-create a default one so the page always works.
  if (!agent) {
    const { data: created } = await supabase
      .from('agents')
      .insert({ org_id: org.id, name: org.name ? `${org.name} Agent` : 'My Agent' })
      .select('*')
      .single()
    return NextResponse.json(created ?? null)
  }

  return NextResponse.json(agent)
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

  // Find-or-create: update the org's agent, or create one if none exists yet.
  const { data: existing } = await supabase
    .from('agents')
    .select('id')
    .eq('org_id', org.id)
    .limit(1)
    .maybeSingle()

  let agent
  if (existing) {
    const { data, error } = await supabase
      .from('agents')
      .update(updates)
      .eq('id', existing.id)
      .select()
      .single()
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    agent = data
  } else {
    const { data, error } = await supabase
      .from('agents')
      .insert({ org_id: org.id, name: (updates.name as string) || 'My Agent', ...updates })
      .select()
      .single()
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    agent = data
  }

  // Self-heal: if this agent has no ElevenLabs agent yet, create one now so
  // calls/test-calls work (covers accounts from the pre-fix onboarding).
  if (elConfigured() && !agent.elevenlabs_agent_id && agent.name) {
    const { agent_id } = await createAgentWithFallback({
      name: agent.name,
      system_prompt: agent.system_prompt,
      first_message: agent.first_message,
      language: agent.language,
      voice_id: agent.voice_id,
      fallback_message: agent.fallback_message,
    })
    if (agent_id) {
      await supabase
        .from('agents')
        .update({ elevenlabs_agent_id: agent_id, is_active: true })
        .eq('id', agent.id)
      agent.elevenlabs_agent_id = agent_id
    }
  }

  // Ensure the org's phone number(s) route to this agent in ElevenLabs
  // (idempotent — fixes numbers bought during onboarding before the agent existed).
  if (elConfigured() && agent.elevenlabs_agent_id) {
    await linkNumbersToAgent(supabase, org.id, agent.id, agent.elevenlabs_agent_id)
  }

  // Sync to ElevenLabs if agent has elevenlabs_agent_id and relevant fields changed.
  // system_prompt/language/fallback_message all feed into the SAME composed
  // prompt (see lib/elevenlabs/prompt.ts), so any of the three requires
  // recomposing from the agent's full current state, not just the changed field,
  // otherwise a fallback_message-only edit would never reach ElevenLabs at all.
  const elId = agent.elevenlabs_agent_id
  const promptFieldsChanged =
    'system_prompt' in updates || 'language' in updates || 'fallback_message' in updates
  const needsSync = elConfigured() && elId && (
    promptFieldsChanged || 'first_message' in updates || 'voice_id' in updates || 'name' in updates
  )

  if (needsSync) {
    try {
      await elAgents.update(elId, {
        ...('name' in updates && { name: updates.name as string }),
        conversation_config: {
          agent: {
            ...(promptFieldsChanged && {
              prompt: {
                prompt: composeSystemPrompt({
                  system_prompt: agent.system_prompt,
                  language: agent.language,
                  fallback_message: agent.fallback_message,
                }),
                llm: LLM_MODEL,
              },
            }),
            ...(updates.first_message !== undefined && {
              first_message: updates.first_message as string,
            }),
            ...(updates.language !== undefined && {
              language: updates.language as string,
            }),
          },
          ...(updates.voice_id !== undefined && {
            tts: { voice_id: updates.voice_id as string, model_id: TTS_MODEL, expressive_mode: true },
          }),
        },
      })
    } catch {
      // Non-fatal — agent is updated in DB, ElevenLabs sync failed
    }
  }

  return NextResponse.json({ success: true, agent })
}
