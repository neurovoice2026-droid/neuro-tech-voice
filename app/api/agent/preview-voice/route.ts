// POST /api/agent/preview-voice — kept for existing callers ({ text, voice_id }).
// Same pipeline as POST /api/voices/preview: auth, same-origin, rate limits,
// voice eligibility (no other tenant's voices), text clipped to 200 chars.

import { handleVoicePreview } from '@/lib/voice-providers/voice-catalog'

export async function POST(request: Request) {
  return handleVoicePreview(request, 'agent.preview_voice')
}
