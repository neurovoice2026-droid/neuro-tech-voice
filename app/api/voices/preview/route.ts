// POST /api/voices/preview — short TTS sample with a voice the org may use.
// Body: { voice_id, library_ref?: { public_owner_id, voice_id }, text?, language? }
// → audio/mpeg (no-store). Rate-limited per org (per minute + per day).
// A library voice that is not provisioned yet answers 409 voice_not_provisioned:
// the browser plays the voice's public previewUrl instead.

import { handleVoicePreview } from '@/lib/voice-providers/voice-catalog'

export async function POST(request: Request) {
  return handleVoicePreview(request, 'voices.preview')
}
