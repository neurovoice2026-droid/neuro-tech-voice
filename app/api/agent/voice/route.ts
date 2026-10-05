// PUT /api/agent/voice (PATCH kept as an alias for existing callers)
// Body: { voice_id, voice_name, library_ref?: { public_owner_id, voice_id } }
// → { agent, voice_sync_status: 'synced' | 'failed' | 'pending', error? }
//
// 1. The voice must be eligible for this org (never another tenant's clone).
// 2. A library voice is provisioned into the workspace first (deduplicated).
// 3. agents.voice_id/voice_name are written with the user's client (RLS);
//    voice_sync_status/voice_sync_error are platform-managed (service role).
// 4. With an ElevenLabs agent: full-config sync, and 'synced' ONLY when the
//    provider echoes the new voice id back. Without one yet (onboarding):
//    'pending' — the agent is created with this voice later.
// 5. The Cartesia fallback agent (if it exists) is re-synced after the response.

import { NextResponse } from 'next/server'
import { z } from 'zod'
import type { SupabaseClient } from '@supabase/supabase-js'
import { requireOrg } from '@/lib/api/auth'
import { RequestError, assertSameOrigin, parseJsonBody } from '@/lib/api/http'
import { createLogger, requestIdFrom, type Logger } from '@/lib/observability/logger'
import { deferBackground } from '@/lib/observability/telemetry'
import { RATE_LIMITS, enforceRateLimit } from '@/lib/security/rate-limit'
import { createAdminClient } from '@/lib/supabase/admin'
import { bumpRevision, providersFor, syncAgent, type ProviderSyncResult } from '@/lib/voice-providers/agent-sync'
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

type ApplyStatus = 'synced' | 'failed' | 'pending'
interface ApplyOutcome {
  status: ApplyStatus
  error: string | null
}

const SYNC_ATTEMPTS = 3

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

async function setVoiceSyncState(orgId: string, agentId: string, status: ApplyStatus | 'saving', error: string | null): Promise<void> {
  const { error: dbErr } = await createAdminClient()
    .from('agents')
    .update({ voice_sync_status: status, voice_sync_error: error, voice_sync_started_at: status === 'saving' ? new Date().toISOString() : null })
    .eq('id', agentId)
    .eq('org_id', orgId)
  if (dbErr) throw new Error(`agents voice_sync_status update failed: ${dbErr.message}`)
}

/** Maps the ElevenLabs sync result to a voice status; never 'synced' without the provider's confirmation. */
function confirmVoice(result: ProviderSyncResult | undefined, voiceId: string): ApplyOutcome {
  if (result?.status === 'ready' && result.appliedVoiceId === voiceId) return { status: 'synced', error: null }
  if (!result) return { status: 'failed', error: 'The voice could not be applied to your agent.' }
  if (result.status === 'in_progress') {
    return { status: 'failed', error: 'Another change to your agent is still being applied. Please try again in a moment.' }
  }
  if (result.status === 'skipped') return { status: 'failed', error: 'The voice provider is not configured on the platform.' }
  if (result.status === 'ready') {
    return { status: 'failed', error: 'The voice provider did not confirm this voice. It may have been retired; please choose another voice.' }
  }
  return { status: 'failed', error: cleanText(result.error ?? 'The voice could not be applied to your agent.', 300) }
}

async function applyVoice(supabase: SupabaseClient, agentId: string, voiceId: string, log: Logger): Promise<ApplyOutcome> {
  try {
    await bumpRevision(agentId)
    const { data: resources, error } = await supabase
      .from('agent_provider_resources')
      .select('provider, external_id')
      .eq('agent_id', agentId)
    if (error) throw new Error(`agent_provider_resources read failed: ${error.message}`)
    const hasExternal = (provider: string) => (resources ?? []).some((r) => r.provider === provider && !!r.external_id)

    let outcome: ApplyOutcome = { status: 'pending', error: null }
    if (hasExternal('elevenlabs')) {
      let result: ProviderSyncResult | undefined
      for (let attempt = 0; attempt < SYNC_ATTEMPTS; attempt++) {
        if (attempt > 0) await sleep(attempt * 1_000)
        // force: re-push even when the hash matches, so the response carries the applied voice to confirm.
        const results = await syncAgent(agentId, { providers: ['elevenlabs'], force: true, log })
        result = results.find((r) => r.provider === 'elevenlabs')
        if (result?.status !== 'in_progress') break
      }
      outcome = confirmVoice(result, voiceId)
    }

    if (hasExternal('cartesia') && (await providersFor(supabase, agentId)).includes('cartesia')) {
      deferBackground(
        syncAgent(agentId, { providers: ['cartesia'], log })
          .then((results) => log.info('agent.voice.cartesia_sync', { status: results[0]?.status ?? null }))
          .catch((err: unknown) => log.error('agent.voice.cartesia_sync_failed', err)),
      )
    }
    return outcome
  } catch (err) {
    // The voice is saved; applying it failed. Reported to the caller and stored, not hidden.
    log.error('agent.voice.apply_failed', err)
    return { status: 'failed', error: 'The voice was saved but could not be applied to your agent yet. Please try again.' }
  }
}

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
      .select('id')
      .eq('org_id', org.id)
      .order('created_at', { ascending: true })
      .limit(1)
      .maybeSingle()
    if (agentErr) throw new Error(`agents read failed: ${agentErr.message}`)
    if (!agentRow) throw new RequestError('not_found', 'Agent not found. Finish setting up your agent first.', 404)
    const agentId = agentRow.id as string
    log = log.child({ agentId })

    const eligible = await assertVoiceEligible(org.id, { voiceId: body.voice_id, libraryRef: toLibraryRef(body.library_ref) })
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

    // Platform-managed column (guard trigger): written only after the
    // eligibility check above, scoped by the authorized org.
    const { error: updErr } = await createAdminClient()
      .from('agents')
      .update({ voice_id: voiceId, voice_name: voiceName })
      .eq('id', agentId)
      .eq('org_id', org.id)
    if (updErr) throw new Error(`agents voice update failed: ${updErr.message}`)
    await setVoiceSyncState(org.id, agentId, 'saving', null)

    const outcome = await applyVoice(supabase, agentId, voiceId, log)
    await setVoiceSyncState(org.id, agentId, outcome.status, outcome.error)
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
