// GET /api/voices — the voices this organization may pick for its agent.
//   ?source=workspace (default): the org's own custom voices + platform voices
//     (curated per language first). ElevenLabs default voices are retired on
//     2026-12-31 and no longer listed.
//   ?source=library: the public ElevenLabs Voice Library (filtered): phone
//     conversation voices by default (use_case=all for every use case),
//     accent, age, studio quality, featured and sort.
// Never lists the shared ElevenLabs workspace directly: it holds every
// customer's cloned voices (see lib/voice-providers/voice-catalog.ts).

import { NextResponse } from 'next/server'
import { z } from 'zod'
import { requireOrg } from '@/lib/api/auth'
import { LIBRARY_SORTS } from '@/lib/elevenlabs/api/voices'
import { createLogger, requestIdFrom } from '@/lib/observability/logger'
import { RATE_LIMITS, enforceRateLimit } from '@/lib/security/rate-limit'
import {
  ACCENT_RE,
  LIBRARY_AGES,
  LIBRARY_USE_CASES,
  languageSchema,
  listVoices,
  optionalParam,
  parseQuery,
  voiceErrorResponse,
} from '@/lib/voice-providers/voice-catalog'

const flag = z.enum(['true', 'false']).transform((v) => v === 'true')

const QuerySchema = z.object({
  source: optionalParam(z.enum(['workspace', 'library'])),
  search: optionalParam(z.string().trim().max(100)),
  language: optionalParam(languageSchema),
  gender: optionalParam(z.enum(['female', 'male', 'neutral'])),
  accent: optionalParam(z.string().trim().toLowerCase().regex(ACCENT_RE, 'Invalid accent.')),
  age: optionalParam(z.enum(LIBRARY_AGES)),
  use_case: optionalParam(z.enum(LIBRARY_USE_CASES)),
  high_quality: optionalParam(flag),
  featured: optionalParam(flag),
  sort: optionalParam(z.enum(LIBRARY_SORTS)),
  page_token: optionalParam(z.string().max(512)),
  page_size: optionalParam(z.coerce.number().int().min(1).max(100)),
})

export async function GET(request: Request) {
  const requestId = requestIdFrom(request)
  let log = createLogger({ requestId, route: 'voices.list' })
  try {
    const { org } = await requireOrg()
    log = log.child({ orgId: org.id })
    const q = parseQuery(request, QuerySchema)
    await enforceRateLimit([RATE_LIMITS.voiceCatalog], org.id)

    const page = await listVoices(org.id, {
      source: q.source ?? 'workspace',
      search: q.search,
      language: q.language,
      gender: q.gender,
      accent: q.accent,
      age: q.age,
      useCase: q.use_case,
      highQuality: q.high_quality,
      featured: q.featured,
      sort: q.sort,
      pageToken: q.page_token,
      pageSize: q.page_size,
    })
    return NextResponse.json(page, {
      headers: { 'Cache-Control': 'private, max-age=30', Vary: 'Cookie' },
    })
  } catch (err) {
    return voiceErrorResponse(err, log, 'voices.list.failed', requestId)
  }
}
