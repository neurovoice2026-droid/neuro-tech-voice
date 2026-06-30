import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { sharedVoices, isConfigured } from '@/lib/elevenlabs/client'

// Add a shared/library voice to the workspace so it can be used by an agent.
// Returns the workspace voice_id (which may differ from the library one).
export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  if (!isConfigured()) {
    return NextResponse.json({ error: 'ElevenLabs not configured' }, { status: 503 })
  }

  const { public_owner_id, voice_id, name } = (await request.json()) as {
    public_owner_id?: string
    voice_id?: string
    name?: string
  }

  if (!public_owner_id || !voice_id) {
    return NextResponse.json({ error: 'public_owner_id and voice_id are required' }, { status: 400 })
  }

  try {
    const added = await sharedVoices.add(public_owner_id, voice_id, name ?? 'Library voice')
    return NextResponse.json({ voice_id: added.voice_id })
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Failed to add voice' },
      { status: 502 }
    )
  }
}
