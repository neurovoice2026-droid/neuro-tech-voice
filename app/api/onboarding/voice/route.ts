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

  const { voice_id, voice_name } = await request.json()

  // Update agent with voice
  const { error } = await supabase
    .from('agents')
    .update({ voice_id, voice_name })
    .eq('org_id', org.id)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  await supabase
    .from('organizations')
    .update({ onboarding_step: 4 })
    .eq('user_id', user.id)

  return NextResponse.json({ success: true })
}
