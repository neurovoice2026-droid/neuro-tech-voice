import 'server-only'
import { env, isElevenLabsConfigured } from '@/lib/env'

// Paired ElevenLabs instant clone for the fallback path: when a call falls
// back to ElevenLabs, the caller still hears the owner's voice instead of a
// stock one. Best effort by design: Cartesia is the primary voice, so a
// failure here is logged and the clone simply has no ElevenLabs twin.

const ELEVENLABS_API = 'https://api.elevenlabs.io'
const ADD_TIMEOUT_MS = 45_000
const DELETE_TIMEOUT_MS = 15_000

function describe(error: unknown): string {
  if (error instanceof Error) return `${error.name}: ${error.message.slice(0, 160)}`
  return String(error).slice(0, 160)
}

/** POST /v1/voices/add (multipart `name` + `files`). Returns the voice id, or null on any failure. */
export async function addElevenLabsClone(input: {
  name: string
  clip: Blob
  filename: string
  description: string
}): Promise<string | null> {
  const key = env.ELEVENLABS_API_KEY
  if (!isElevenLabsConfigured() || !key) return null
  try {
    const form = new FormData()
    form.append('name', input.name)
    form.append('description', input.description)
    form.append('files', input.clip, input.filename)
    const res = await fetch(`${ELEVENLABS_API}/v1/voices/add`, {
      method: 'POST',
      headers: { 'xi-api-key': key },
      body: form,
      signal: AbortSignal.timeout(ADD_TIMEOUT_MS),
      cache: 'no-store',
    })
    if (!res.ok) {
      // Status only: ElevenLabs bodies can echo request details.
      await res.arrayBuffer().catch(() => undefined)
      console.warn('[elevenlabs] paired clone was not created', res.status)
      return null
    }
    const data = (await res.json()) as { voice_id?: unknown }
    return typeof data.voice_id === 'string' && data.voice_id ? data.voice_id : null
  } catch (error) {
    console.warn('[elevenlabs] paired clone was not created', describe(error))
    return null
  }
}

/** DELETE /v1/voices/{id}. A missing voice counts as deleted. */
export async function deleteElevenLabsVoice(voiceId: string): Promise<boolean> {
  const key = env.ELEVENLABS_API_KEY
  if (!isElevenLabsConfigured() || !key) return false
  try {
    const res = await fetch(`${ELEVENLABS_API}/v1/voices/${encodeURIComponent(voiceId)}`, {
      method: 'DELETE',
      headers: { 'xi-api-key': key },
      signal: AbortSignal.timeout(DELETE_TIMEOUT_MS),
      cache: 'no-store',
    })
    await res.arrayBuffer().catch(() => undefined)
    if (res.ok || res.status === 404) return true
    console.warn('[elevenlabs] paired clone was not deleted', res.status)
    return false
  } catch (error) {
    console.warn('[elevenlabs] paired clone was not deleted', describe(error))
    return false
  }
}
