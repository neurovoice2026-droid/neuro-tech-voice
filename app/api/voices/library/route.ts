import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { models, isConfigured, type FishModel } from '@/lib/fish/client'

// A Fish public model as the picker lists it. Not the provider-neutral `Voice`
// (types/index.ts): that union names only Cartesia and ElevenLabs, and a Fish
// model has no gender, accents or app-relative preview route to fill it with.
// The preview is Fish's own rendered sample, which the model already carries.
function toVoice(m: FishModel, source: 'library') {
  return {
    provider: 'fish' as const,
    source,
    id: m._id,
    name: m.title,
    description: m.description ?? null,
    languages: m.languages,
    tags: m.tags,
    cover_image: m.cover_image ?? null,
    preview_url: m.samples?.find((s) => s.audio)?.audio ?? null,
  }
}

// Browse Fish Audio's public model catalogue.
//
// One real simplification over the ElevenLabs equivalent: there is no "add to
// workspace" step. An ElevenLabs shared voice had to be copied into the
// account before it could be used, which is why the old flow had a separate
// /voices/add endpoint. A Fish public model is usable directly by its id, so
// selecting a voice is now just storing that id — the add endpoint is gone
// rather than reimplemented.
export async function GET(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  if (!isConfigured()) return NextResponse.json({ voices: [], has_more: false })

  const { searchParams } = new URL(request.url)
  const search = searchParams.get('search') ?? undefined
  const language = searchParams.get('language') ?? undefined
  // Fish paginates from 1; the client counts from 0.
  const page = Number(searchParams.get('page') ?? 0) + 1

  try {
    const data = await models.list({
      page_size: 100,
      page_number: page,
      title: search,
      language,
      sort_by: search ? 'score' : 'task_count',
    })

    return NextResponse.json({
      voices: (data.items ?? []).map((m) => toVoice(m, 'library')),
      has_more: data.has_more ?? false,
    })
  } catch (err) {
    console.error('Failed to browse voice library:', err instanceof Error ? err.message : err)
    return NextResponse.json({ voices: [], has_more: false })
  }
}
