import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { conversations, isConfigured as elConfigured } from '@/lib/elevenlabs/client'

// Streams a call recording from ElevenLabs through our server so the audio key
// is never exposed and we can enforce org ownership. `id` is the conversation id.
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params

  const { data: org } = await supabase
    .from('organizations')
    .select('id')
    .eq('user_id', user.id)
    .single()

  if (!org) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  if (!elConfigured()) return NextResponse.json({ error: 'Audio unavailable' }, { status: 503 })

  try {
    // Ownership check: the conversation's agent must belong to this org.
    const conv = await conversations.get(id)
    const { data: agent } = await supabase
      .from('agents')
      .select('id')
      .eq('elevenlabs_agent_id', conv.agent_id)
      .eq('org_id', org.id)
      .maybeSingle()

    if (!agent) return NextResponse.json({ error: 'Not found' }, { status: 404 })

    const audio = await conversations.getAudio(id)
    return new Response(audio.body, {
      headers: {
        'Content-Type': audio.headers.get('content-type') ?? 'audio/mpeg',
        'Cache-Control': 'private, max-age=3600',
      },
    })
  } catch {
    return NextResponse.json({ error: 'Recording not found' }, { status: 404 })
  }
}
