// GET /api/elevenlabs/voices — legacy shape { voices: ElevenLabsVoice[] }.
// Thin compatibility wrapper over the voice catalog: the org's own clones,
// platform-provisioned library voices and ElevenLabs default voices. It no
// longer lists the shared workspace (which holds every customer's clones).
// New code: GET /api/voices?source=workspace.

import { NextResponse } from 'next/server'
import { requireOrg } from '@/lib/api/auth'
import { createLogger, requestIdFrom } from '@/lib/observability/logger'
import { RATE_LIMITS, enforceRateLimit } from '@/lib/security/rate-limit'
import { listVoices, toLegacyVoice, voiceErrorResponse } from '@/lib/voice-providers/voice-catalog'
import type { VoiceOption } from '@/types'

const MAX_PAGES = 3

export async function GET(request: Request) {
  const requestId = requestIdFrom(request)
  let log = createLogger({ requestId, route: 'elevenlabs.voices' })
  try {
    const { org } = await requireOrg()
    log = log.child({ orgId: org.id })
    await enforceRateLimit([RATE_LIMITS.voiceCatalog], org.id)

    const voices: VoiceOption[] = []
    let pageToken: string | null = null
    for (let i = 0; i < MAX_PAGES; i++) {
      const page: Awaited<ReturnType<typeof listVoices>> = await listVoices(org.id, { source: 'workspace', pageSize: 100, pageToken })
      voices.push(...page.voices)
      if (!page.next_page_token) break
      pageToken = page.next_page_token
    }
    return NextResponse.json(
      { voices: voices.map(toLegacyVoice) },
      { headers: { 'Cache-Control': 'private, max-age=30', Vary: 'Cookie' } },
    )
  } catch (err) {
    return voiceErrorResponse(err, log, 'elevenlabs.voices.failed', requestId)
  }
}
