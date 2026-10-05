// GET /api/voices/fallback/preview?voice_id=<cartesia voice id>
// Proxies the voice's preview file (it needs the platform API key, so the
// browser cannot fetch it directly). Only public / platform-mapped voices;
// 404 when the voice has no preview.

import { z } from 'zod'
import { requireOrg } from '@/lib/api/auth'
import { apiError } from '@/lib/api/http'
import * as ct from '@/lib/cartesia/client'
import { createLogger, requestIdFrom } from '@/lib/observability/logger'
import { RATE_LIMITS, enforceRateLimit } from '@/lib/security/rate-limit'
import {
  CARTESIA_VOICE_ID_RE,
  getAllowedFallbackVoice,
  parseQuery,
  voiceErrorResponse,
} from '@/lib/voice-providers/voice-catalog'

const QuerySchema = z.object({
  voice_id: z.string().trim().regex(CARTESIA_VOICE_ID_RE, 'Invalid voice id.'),
})

function audioContentType(raw: string | null): string {
  const base = (raw ?? '').split(';')[0].trim().toLowerCase()
  return /^audio\/[a-z0-9.+-]{1,40}$/.test(base) ? base : 'audio/wav'
}

export async function GET(request: Request) {
  const requestId = requestIdFrom(request)
  let log = createLogger({ requestId, route: 'voices.fallback.preview' })
  try {
    const { org } = await requireOrg()
    log = log.child({ orgId: org.id })
    const q = parseQuery(request, QuerySchema)
    if (!ct.isConfigured()) {
      return apiError('not_configured', 'The fallback voice provider is not configured.', 503, { requestId })
    }
    await enforceRateLimit([RATE_LIMITS.ttsPreview], org.id)

    const voice = await getAllowedFallbackVoice(q.voice_id)
    if (!voice.preview_file_url) return apiError('not_found', 'This voice has no preview.', 404, { requestId })

    const upstream = await ct.voices.previewAudio(voice.preview_file_url)
    if (!upstream.body) {
      log.error('voices.fallback.preview_empty', undefined, { voiceId: voice.id })
      return apiError('provider_error', 'The voice preview could not be loaded.', 502, { requestId })
    }
    const headers = new Headers({
      'Content-Type': audioContentType(upstream.headers.get('content-type')),
      'Cache-Control': 'private, no-store',
      'Content-Disposition': 'inline',
      'X-Content-Type-Options': 'nosniff',
    })
    // fetch() decodes compressed bodies, so the upstream length only holds without content-encoding.
    const length = upstream.headers.get('content-length')
    if (length && /^\d{1,10}$/.test(length) && !upstream.headers.get('content-encoding')) headers.set('Content-Length', length)
    return new Response(upstream.body, { status: 200, headers })
  } catch (err) {
    return voiceErrorResponse(err, log, 'voices.fallback.preview_failed', requestId)
  }
}
