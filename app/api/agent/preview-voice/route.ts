import { createClient } from '@/lib/supabase/server'
import { textToSpeech, isConfigured, ElevenLabsError } from '@/lib/elevenlabs/client'

export async function POST(request: Request) {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return new Response('Unauthorized', { status: 401 })

  const { text, voice_id } = (await request.json()) as {
    text: string
    voice_id: string
  }

  if (!text || !voice_id) {
    return new Response('Missing text or voice_id', { status: 400 })
  }

  if (!isConfigured()) {
    return new Response('ElevenLabs not configured', { status: 503 })
  }

  try {
    const audio = await textToSpeech(voice_id, text.slice(0, 200))
    return new Response(audio, {
      headers: { 'Content-Type': 'audio/mpeg' },
    })
  } catch (err) {
    const detail = err instanceof ElevenLabsError
      ? `ElevenLabs ${err.status} on ${err.path}: ${err.body.slice(0, 300)}`
      : err instanceof Error ? err.message : 'Unknown error'
    console.error('TTS preview failed:', detail)
    return new Response(detail, { status: 502 })
  }
}
