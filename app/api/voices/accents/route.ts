// GET /api/voices/accents?language=ro — accents available in the public Voice
// Library for one agent language: [{ value, label }], `value` being the
// `accent` filter of GET /api/voices?source=library. Public catalogue data
// (GET /v1/voices/accents), cached 24 h per language on the server.

import { NextResponse } from 'next/server'
import { z } from 'zod'
import { requireOrg } from '@/lib/api/auth'
import { listAccents } from '@/lib/elevenlabs/api/voices'
import { createLogger, requestIdFrom } from '@/lib/observability/logger'
import { RATE_LIMITS, enforceRateLimit } from '@/lib/security/rate-limit'
import { ACCENT_RE, languageSchema, parseQuery, voiceErrorResponse } from '@/lib/voice-providers/voice-catalog'

const QuerySchema = z.object({ language: languageSchema })

const TTL_MS = 24 * 3600_000
const cache = new Map<string, { at: number; accents: Array<{ value: string; label: string }> }>()

export async function GET(request: Request) {
  const requestId = requestIdFrom(request)
  let log = createLogger({ requestId, route: 'voices.accents' })
  try {
    const { org } = await requireOrg()
    log = log.child({ orgId: org.id })
    const q = parseQuery(request, QuerySchema)
    await enforceRateLimit([RATE_LIMITS.voiceCatalog], org.id)

    const hit = cache.get(q.language)
    let accents = hit && Date.now() - hit.at < TTL_MS ? hit.accents : null
    if (!accents) {
      const res = await listAccents({ language: q.language })
      const seen = new Set<string>()
      accents = (res.accents ?? [])
        .filter((a) => typeof a.accent === 'string' && ACCENT_RE.test(a.accent.toLowerCase()))
        .filter((a) => !a.language || a.language.toLowerCase().split(/[-_]/)[0] === q.language)
        .map((a) => ({ value: a.accent.toLowerCase(), label: (typeof a.name === 'string' && a.name.trim() ? a.name.trim() : a.accent).slice(0, 60) }))
        .filter((a) => (seen.has(a.value) ? false : (seen.add(a.value), true)))
        .sort((a, b) => a.label.localeCompare(b.label))
        .slice(0, 100)
      cache.set(q.language, { at: Date.now(), accents })
    }
    return NextResponse.json({ accents }, { headers: { 'Cache-Control': 'private, max-age=3600', Vary: 'Cookie' } })
  } catch (err) {
    return voiceErrorResponse(err, log, 'voices.accents.failed', requestId)
  }
}
