// GET /api/elevenlabs/voices/library?search=&language=&gender=&page= — legacy
// shape { voices: (ElevenLabsVoice & { public_owner_id })[], has_more }.
// Compatibility wrapper over the voice catalog's filtered Voice Library
// listing (no live-moderated or custom-rate voices, minimum notice period).
// `voice_id` is always the LIBRARY id here; POST /api/elevenlabs/voices/add
// turns it into a usable workspace id. New code: GET /api/voices?source=library.

import { NextResponse } from 'next/server'
import { z } from 'zod'
import { requireOrg } from '@/lib/api/auth'
import { createLogger, requestIdFrom } from '@/lib/observability/logger'
import { RATE_LIMITS, enforceRateLimit } from '@/lib/security/rate-limit'
import {
  languageSchema,
  libraryPageToken,
  listVoices,
  optionalParam,
  parseQuery,
  toLegacyVoice,
  voiceErrorResponse,
} from '@/lib/voice-providers/voice-catalog'

const QuerySchema = z.object({
  search: optionalParam(z.string().trim().max(100)),
  language: optionalParam(languageSchema),
  gender: optionalParam(z.enum(['female', 'male', 'neutral'])),
  page: optionalParam(z.coerce.number().int().min(0).max(1_000)),
})

export async function GET(request: Request) {
  const requestId = requestIdFrom(request)
  let log = createLogger({ requestId, route: 'elevenlabs.voices.library' })
  try {
    const { org } = await requireOrg()
    log = log.child({ orgId: org.id })
    const q = parseQuery(request, QuerySchema)
    await enforceRateLimit([RATE_LIMITS.voiceCatalog], org.id)

    const page = await listVoices(org.id, {
      source: 'library',
      search: q.search,
      language: q.language,
      gender: q.gender,
      // Legacy callers keep the unfiltered use cases they had before.
      useCase: 'all',
      pageSize: 100,
      pageToken: libraryPageToken(q.page ?? 0),
    })
    const voices = page.voices.map((v) => ({
      ...toLegacyVoice(v),
      voice_id: v.libraryRef?.voiceId ?? v.voiceId,
      public_owner_id: v.libraryRef?.publicOwnerId ?? '',
      category: v.category ?? 'library',
    }))
    return NextResponse.json(
      { voices, has_more: page.next_page_token !== null },
      { headers: { 'Cache-Control': 'private, max-age=60', Vary: 'Cookie' } },
    )
  } catch (err) {
    return voiceErrorResponse(err, log, 'elevenlabs.voices.library.failed', requestId)
  }
}
