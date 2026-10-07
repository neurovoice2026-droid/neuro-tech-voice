// PUT /api/agent/voice (PATCH kept as an alias for existing callers)
// Body: { voice_id, voice_name, library_ref?: { public_owner_id, voice_id } }
// → { agent, voice_sync_status: 'synced' | 'failed' | 'pending', error? }
//
// 1. The voice must be eligible for this org (never another tenant's clone).
//    A retiring voice (ElevenLabs default voices, library voices with a
//    lifecycle notice) is refused as a NEW choice; the agent's current voice
//    can always be re-saved (Retry).
// 2. A library voice is provisioned into the workspace first (deduplicated).
// 3. Save + full-config sync + echo check: lib/voice-providers/voice-apply.ts,
//    the same path the platform migrations use.
//
// GET /api/agent/voice → the current voice's kind and notice (retirement
// banner): { voice_id, voice_name, kind, notice }.

import { NextResponse } from 'next/server'
import { z } from 'zod'
import { requireOrg } from '@/lib/api/auth'
import { RequestError, assertSameOrigin, parseJsonBody } from '@/lib/api/http'
import { createLogger, requestIdFrom } from '@/lib/observability/logger'
import { RATE_LIMITS, enforceRateLimit } from '@/lib/security/rate-limit'
import { applyAgentVoice } from '@/lib/voice-providers/voice-apply'
import { agentVoiceStatus } from '@/lib/voice-providers/voice-status'
import {
  assertVoiceEligible,
  cleanText,
  elVoiceIdSchema,
  libraryRefSchema,
  provisionLibraryVoice,
  toLibraryRef,
  voiceErrorResponse,
} from '@/lib/voice-providers/voice-catalog'
import type { Agent } from '@/types'

export const maxDuration = 60

const BodySchema = z.object({
  voice_id: elVoiceIdSchema,
  voice_name: z.string().trim().min(1).max(100),
  library_ref: libraryRefSchema.nullish(),
})

async function handle(request: Request): Promise<Response> {
  const requestId = requestIdFrom(request)
  let log = createLogger({ requestId, route: 'agent.voice' })
  try {
    assertSameOrigin(request)
    const { supabase, user, org } = await requireOrg()
    log = log.child({ orgId: org.id })
    const body = await parseJsonBody(request, BodySchema, 8 * 1024)
    await enforceRateLimit([RATE_LIMITS.agentSync], org.id)

    const { data: agentRow, error: agentErr } = await supabase
      .from('agents')
      .select('id, voice_id')
      .eq('org_id', org.id)
      .order('created_at', { ascending: true })
      .limit(1)
      .maybeSingle()
    if (agentErr) throw new Error(`agents read failed: ${agentErr.message}`)
    if (!agentRow) throw new RequestError('not_found', 'Agent not found. Finish setting up your agent first.', 404)
    const agentId = agentRow.id as string
    log = log.child({ agentId })

    const eligible = await assertVoiceEligible(org.id, {
      voiceId: body.voice_id,
      libraryRef: toLibraryRef(body.library_ref),
      currentVoiceId: (agentRow.voice_id as string | null) ?? null,
    })
    let voiceId = eligible.voiceId
    if (eligible.requiresProvisioning && eligible.libraryRef) {
      const provisioned = await provisionLibraryVoice({
        orgId: org.id,
        userId: user.id,
        libraryRef: eligible.libraryRef,
        libraryVoice: eligible.libraryVoice,
        log,
      })
      voiceId = provisioned.voiceId
    }
    const voiceName = cleanText(body.voice_name, 100) || eligible.name

    const outcome = await applyAgentVoice({ orgId: org.id, agentId, voiceId, voiceName, readClient: supabase, log })
    if (!outcome) throw new Error('agents voice update matched no row')
    log.info('agent.voice.updated', { voiceId, kind: eligible.kind, status: outcome.status })

    const { data: agent, error: readErr } = await supabase.from('agents').select('*').eq('id', agentId).single()
    if (readErr) throw new Error(`agents read failed: ${readErr.message}`)
    return NextResponse.json({
      agent: agent as Agent,
      voice_sync_status: outcome.status,
      ...(outcome.error ? { error: outcome.error } : {}),
    })
  } catch (err) {
    return voiceErrorResponse(err, log, 'agent.voice.failed', requestId)
  }
}

export async function PUT(request: Request) {
  return handle(request)
}

/** Alias kept for existing callers (hooks/useAgent.ts). */
export async function PATCH(request: Request) {
  return handle(request)
}

export async function GET(request: Request) {
  const requestId = requestIdFrom(request)
  let log = createLogger({ requestId, route: 'agent.voice.status' })
  try {
    const { supabase, org } = await requireOrg()
    log = log.child({ orgId: org.id })
    await enforceRateLimit([RATE_LIMITS.voiceCatalog], org.id)
    const { data: agentRow, error } = await supabase
      .from('agents')
      .select('id, voice_id, voice_name')
      .eq('org_id', org.id)
      .order('created_at', { ascending: true })
      .limit(1)
      .maybeSingle()
    if (error) throw new Error(`agents read failed: ${error.message}`)
    if (!agentRow) throw new RequestError('not_found', 'Agent not found. Finish setting up your agent first.', 404)
    const status = await agentVoiceStatus({
      orgId: org.id,
      agent: { id: agentRow.id as string, voice_id: (agentRow.voice_id as string | null) ?? null, voice_name: (agentRow.voice_name as string | null) ?? null },
      log: log.child({ agentId: agentRow.id }),
    })
    return NextResponse.json(status, { headers: { 'Cache-Control': 'private, no-store' } })
  } catch (err) {
    return voiceErrorResponse(err, log, 'agent.voice.status_failed', requestId)
  }
}
