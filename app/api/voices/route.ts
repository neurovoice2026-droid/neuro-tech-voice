import { NextResponse } from 'next/server'
import { voices, isConfigured } from '@/lib/elevenlabs/client'
import type { ElevenLabsVoice } from '@/types'

export async function GET(request: Request) {
  if (!isConfigured()) {
    return NextResponse.json([], {
      headers: { 'Cache-Control': 'public, max-age=60' },
    })
  }

  const { searchParams } = new URL(request.url)
  const search = searchParams.get('search') ?? undefined
  const category = searchParams.get('category') ?? undefined
  const pageSize = Number(searchParams.get('page_size') ?? 50)

  try {
    const data = await voices.search({
      page_size: Math.min(pageSize, 100),
      search,
      category,
      sort: 'name',
      sort_direction: 'asc',
    })

    const formatted: ElevenLabsVoice[] = (data.voices ?? []).map((v) => ({
      voice_id: v.voice_id,
      name: v.name,
      category: v.category ?? 'premade',
      description: v.description ?? null,
      preview_url: v.preview_url ?? null,
      labels: v.labels ?? {},
    }))

    return NextResponse.json(formatted, {
      headers: { 'Cache-Control': 'public, max-age=3600' },
    })
  } catch {
    return NextResponse.json([], {
      headers: { 'Cache-Control': 'public, max-age=60' },
    })
  }
}
