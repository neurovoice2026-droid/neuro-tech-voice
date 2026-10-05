// GET /api/voices/fallback?language=xx — Cartesia voices the fallback agent can
// use for that language (default: the agent's language), plus the voice the
// fallback agent would use right now:
// → { voices: [{ voiceId, name, gender, language, hasPreview }],
//     current: { voiceId, source: 'agent' | 'platform_map' | 'auto' | null } }

import { NextResponse } from 'next/server'
import { z } from 'zod'
import type { SupabaseClient } from '@supabase/supabase-js'
import { requireOrg } from '@/lib/api/auth'
import { apiError } from '@/lib/api/http'
import * as ct from '@/lib/cartesia/client'
import { createLogger, requestIdFrom, type Logger } from '@/lib/observability/logger'
import { RATE_LIMITS, enforceRateLimit } from '@/lib/security/rate-limit'
import { resolveFallbackVoice } from '@/lib/voice-providers/adapters'
import { AGENT_COLUMNS, buildAgentSpec, type AgentRow } from '@/lib/voice-providers/agent-spec'
import { isProviderError } from '@/lib/voice-providers/errors'
import {
  languageSchema,
  listFallbackVoices,
  optionalParam,
  parseQuery,
  voiceErrorResponse,
} from '@/lib/voice-providers/voice-catalog'
import { normalizeAgentLanguage } from '@/lib/voice/languages'

const QuerySchema = z.object({
  language: optionalParam(languageSchema),
})

type CurrentFallback = { voiceId: string | null; source: 'agent' | 'platform_map' | 'auto' | null }

async function currentFallback(supabase: SupabaseClient, agent: AgentRow | null, language: string, log: Logger): Promise<CurrentFallback> {
  if (!agent) return { voiceId: null, source: null }
  try {
    const spec = await buildAgentSpec(supabase, agent)
    const resolved = await resolveFallbackVoice({ ...spec, language })
    return { voiceId: resolved.voiceId, source: resolved.source }
  } catch (err) {
    // The list is still useful without it; the reason is logged, the UI shows "not set".
    if (isProviderError(err) && err.code === 'validation') log.info('voices.fallback.no_voice_for_language', { language })
    else log.error('voices.fallback.current_failed', err, { language })
    return { voiceId: null, source: null }
  }
}

export async function GET(request: Request) {
  const requestId = requestIdFrom(request)
  let log = createLogger({ requestId, route: 'voices.fallback' })
  try {
    const { supabase, org } = await requireOrg()
    log = log.child({ orgId: org.id })
    const q = parseQuery(request, QuerySchema)
    if (!ct.isConfigured()) {
      return apiError('not_configured', 'The fallback voice provider is not configured.', 503, { requestId })
    }
    await enforceRateLimit([RATE_LIMITS.voiceCatalog], org.id)

    const { data, error } = await supabase
      .from('agents')
      .select(AGENT_COLUMNS)
      .eq('org_id', org.id)
      .order('created_at', { ascending: true })
      .limit(1)
      .maybeSingle()
    if (error) throw new Error(`agents read failed: ${error.message}`)
    const agent = (data as AgentRow | null) ?? null
    const language = q.language ?? normalizeAgentLanguage(agent?.language)

    const [voices, current] = await Promise.all([
      listFallbackVoices(language),
      currentFallback(supabase, agent, language, log),
    ])
    return NextResponse.json(
      { voices, current },
      { headers: { 'Cache-Control': 'private, max-age=60', Vary: 'Cookie' } },
    )
  } catch (err) {
    return voiceErrorResponse(err, log, 'voices.fallback.failed', requestId)
  }
}
