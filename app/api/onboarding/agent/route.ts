import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

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

  const body = await request.json()
  const { name, language, system_prompt, first_message } = body

  // Upsert: update existing agent or create first one for this org
  const { data: existing } = await supabase
    .from('agents')
    .select('id')
    .eq('org_id', org.id)
    .limit(1)
    .single()

  let agentId: string

  if (existing) {
    const { error } = await supabase
      .from('agents')
      .update({ name, language, system_prompt: system_prompt || null, first_message })
      .eq('id', existing.id)

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    agentId = existing.id
  } else {
    const { data: newAgent, error } = await supabase
      .from('agents')
      .insert({ org_id: org.id, name, language, system_prompt: system_prompt || null, first_message })
      .select('id')
      .single()

    if (error || !newAgent) return NextResponse.json({ error: error?.message }, { status: 500 })
    agentId = newAgent.id
  }

  await supabase
    .from('organizations')
    .update({ onboarding_step: 3 })
    .eq('user_id', user.id)

  return NextResponse.json({ success: true, agent_id: agentId })
}
