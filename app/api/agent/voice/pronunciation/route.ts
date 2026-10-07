// GET /api/agent/voice/pronunciation → { rules, max_rules }
// PUT /api/agent/voice/pronunciation { rules: [{ term, say_as, case_sensitive?, word_boundaries? }] }
//   → { rules, max_rules, sync: { status, error } | null }
// The organization's pronunciation rules ("say this word as …"): saved as a
// new version of its own ElevenLabs pronunciation dictionary, then pushed to
// its agent (tts.pronunciation_dictionary_locators). Dictionary ids never
// leave the server. Rate-limited (each save creates provider versions) and
// audited (counts only: the rules hold names).

import { NextResponse } from 'next/server'
import { z } from 'zod'
import { requireOrg } from '@/lib/api/auth'
import { RequestError, assertSameOrigin, parseJsonBody } from '@/lib/api/http'
import { hasExternalAgent, runAgentSync } from '@/lib/agents/ensure-agent'
import * as el from '@/lib/elevenlabs/client'
import { createLogger, requestIdFrom } from '@/lib/observability/logger'
import { enforceRateLimit, RATE_LIMITS } from '@/lib/security/rate-limit'
import { bumpRevision } from '@/lib/voice-providers/agent-sync'
import { PRONUNCIATION_SAVE_LIMIT, savePronunciationRules } from '@/lib/voice-providers/pronunciation'
import { PRONUNCIATION_LIMITS, PronunciationRulesSchema, readPronunciation } from '@/lib/voice-providers/pronunciation-rules'
import { voiceErrorResponse } from '@/lib/voice-providers/voice-catalog'

export const maxDuration = 60

const BodySchema = z.object({ rules: PronunciationRulesSchema }).strict()

async function loadAgent(supabase: Awaited<ReturnType<typeof requireOrg>>['supabase'], orgId: string) {
  const { data, error } = await supabase
    .from('agents')
    .select('id, pronunciation')
    .eq('org_id', orgId)
    .order('created_at', { ascending: true })
    .limit(1)
    .maybeSingle()
  if (error) throw new Error(`agents read failed: ${error.message}`)
  if (!data) throw new RequestError('not_found', 'Agent not found. Finish setting up your agent first.', 404)
  return { id: data.id as string, state: readPronunciation(data.pronunciation) }
}

export async function GET(request: Request) {
  const requestId = requestIdFrom(request)
  let log = createLogger({ requestId, route: 'agent.voice.pronunciation' })
  try {
    const { supabase, org } = await requireOrg()
    log = log.child({ orgId: org.id })
    await enforceRateLimit([RATE_LIMITS.voiceCatalog], org.id)
    const agent = await loadAgent(supabase, org.id)
    return NextResponse.json(
      { rules: agent.state?.rules ?? [], max_rules: PRONUNCIATION_LIMITS.maxRules },
      { headers: { 'Cache-Control': 'private, no-store' } },
    )
  } catch (err) {
    return voiceErrorResponse(err, log, 'agent.voice.pronunciation.read_failed', requestId)
  }
}

export async function PUT(request: Request) {
  const requestId = requestIdFrom(request)
  let log = createLogger({ requestId, route: 'agent.voice.pronunciation' })
  try {
    assertSameOrigin(request)
    const { supabase, user, org } = await requireOrg()
    log = log.child({ orgId: org.id })
    const body = await parseJsonBody(request, BodySchema, 64 * 1024)
    if (!el.isConfigured()) throw new RequestError('not_configured', 'Pronunciation rules are not available on the platform right now.', 503)
    const agent = await loadAgent(supabase, org.id)
    log = log.child({ agentId: agent.id })
    await enforceRateLimit([PRONUNCIATION_SAVE_LIMIT], org.id, 'Too many saves. Please wait a moment and try again.')

    const { state, changed } = await savePronunciationRules({ orgId: org.id, agentId: agent.id, userId: user.id, rules: body.rules, log })
    let sync: { status: string; error: string | null } | null = null
    if (changed) {
      try {
        await bumpRevision(agent.id)
      } catch (err) {
        log.error('agent.revision_bump_failed', err)
      }
      // The Cartesia fallback has no pronunciation dictionary: only the ElevenLabs agent is pushed.
      if (await hasExternalAgent(supabase, org.id, agent.id, 'elevenlabs')) {
        const [report] = await runAgentSync(agent.id, { providers: ['elevenlabs'], log })
        sync = report ? { status: report.status, error: report.error } : null
      } else {
        sync = { status: 'pending', error: null }
      }
    }
    return NextResponse.json({ rules: state?.rules ?? [], max_rules: PRONUNCIATION_LIMITS.maxRules, sync })
  } catch (err) {
    return voiceErrorResponse(err, log, 'agent.voice.pronunciation.save_failed', requestId)
  }
}
