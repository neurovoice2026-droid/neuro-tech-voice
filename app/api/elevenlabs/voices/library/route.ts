import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { sharedVoices, isConfigured } from '@/lib/elevenlabs/client'
import type { ElevenLabsVoice } from '@/types'

// Browse the ElevenLabs shared voice library (thousands of community voices).
// Returns voices carrying `public_owner_id` so the client can add them on select.
export async function GET(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  if (!isConfigured()) return NextResponse.json({ voices: [] })

  const { searchParams } = new URL(request.url)
  const search = searchParams.get('search') ?? undefined
  const language = searchParams.get('language') ?? undefined
  const gender = searchParams.get('gender') ?? undefined
  const page = Number(searchParams.get('page') ?? 0)

  try {
    const data = await sharedVoices.list({ page_size: 100, search, language, gender, page })
    const voices: (ElevenLabsVoice & { public_owner_id: string })[] = (data.voices ?? []).map((v) => ({
      voice_id: v.voice_id,
      public_owner_id: v.public_owner_id,
      name: v.name,
      category: v.category ?? 'library',
      description: v.description ?? null,
      preview_url: v.preview_url ?? null,
      labels: {
        language: v.language ?? '',
        accent: v.accent ?? '',
        gender: v.gender ?? '',
        age: v.age ?? '',
        use_case: v.use_case ?? '',
      },
    }))
    return NextResponse.json({ voices, has_more: data.has_more ?? false })
  } catch {
    return NextResponse.json({ voices: [], has_more: false })
  }
}
