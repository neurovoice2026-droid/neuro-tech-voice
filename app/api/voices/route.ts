// GET /api/voices — the voices this organization may pick for its agent.
//   ?source=workspace (default): the org's own clones + platform-provisioned
//     library voices + ElevenLabs default voices.
//   ?source=library: the public ElevenLabs Voice Library (filtered).
// Never lists the shared ElevenLabs workspace directly: it holds every
// customer's cloned voices (see lib/voice-providers/voice-catalog.ts).

import { NextResponse } from 'next/server'
import { z } from 'zod'
import { requireOrg } from '@/lib/api/auth'
import { createLogger, requestIdFrom } from '@/lib/observability/logger'
import { RATE_LIMITS, enforceRateLimit } from '@/lib/security/rate-limit'
import {
  languageSchema,
  listVoices,
  optionalParam,
  parseQuery,
  voiceErrorResponse,
} from '@/lib/voice-providers/voice-catalog'

const QuerySchema = z.object({
  source: optionalParam(z.enum(['workspace', 'library'])),
  search: optionalParam(z.string().trim().max(100)),
  language: optionalParam(languageSchema),
  gender: optionalParam(z.enum(['female', 'male'])),
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
