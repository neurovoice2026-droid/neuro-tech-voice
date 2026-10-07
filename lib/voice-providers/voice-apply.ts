import 'server-only'
// Applies a voice to an organization's agent: the one server path shared by
// PUT /api/agent/voice (tenant choice) and the platform migrations (retired
// default voices, removed library voices).
//
// 1. agents.voice_id/voice_name are platform-managed (guard trigger): written
//    with the service role, scoped by the authorized org, only after the
//    caller checked the voice (eligibility, or a curated platform voice).
// 2. voice_sync_status 'saving' while the push runs.
// 3. With an ElevenLabs agent: full-config sync (forced), and 'synced' ONLY
//    when the provider echoes the new voice id back; retried while another
//    sync holds the lease. Without one yet (onboarding): 'pending'.
// 4. The Cartesia fallback agent (if it exists) is re-synced after the response.

import type { SupabaseClient } from '@supabase/supabase-js'
import { createAdminClient } from '@/lib/supabase/admin'
import type { Logger } from '@/lib/observability/logger'
import { deferBackground } from '@/lib/observability/telemetry'
import { bumpRevision, providersFor, syncAgent, type ProviderSyncResult } from './agent-sync'

export type ApplyStatus = 'synced' | 'failed' | 'pending'

export interface ApplyOutcome {
  status: ApplyStatus
  error: string | null
}

const SYNC_ATTEMPTS = 3

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

/** Clean, product-level text (sync errors are already sanitized; this bounds them). */
function clip(text: string, max = 300): string {
  const flat = text.replace(/\p{Cc}/gu, ' ').replace(/\s+/g, ' ').trim()
  return flat.length > max ? flat.slice(0, max).trim() : flat
}

export async function setVoiceSyncState(orgId: string, agentId: string, status: ApplyStatus | 'saving', error: string | null): Promise<void> {
  const { error: dbErr } = await createAdminClient()
    .from('agents')
    .update({ voice_sync_status: status, voice_sync_error: error, voice_sync_started_at: status === 'saving' ? new Date().toISOString() : null })
    .eq('id', agentId)
    .eq('org_id', orgId)
  if (dbErr) throw new Error(`agents voice_sync_status update failed: ${dbErr.message}`)
}

/** Maps the ElevenLabs sync result to a voice status; never 'synced' without the provider's confirmation. */
export function confirmVoice(result: ProviderSyncResult | undefined, voiceId: string): ApplyOutcome {
  if (result?.status === 'ready' && result.appliedVoiceId === voiceId) return { status: 'synced', error: null }
  if (!result) return { status: 'failed', error: 'The voice could not be applied to your agent.' }
  if (result.status === 'in_progress') {
    return { status: 'failed', error: 'Another change to your agent is still being applied. Please try again in a moment.' }
  }
  if (result.status === 'skipped') return { status: 'failed', error: 'The voice provider is not configured on the platform.' }
  if (result.status === 'ready') {
    return { status: 'failed', error: 'The voice provider did not confirm this voice. It may have been retired; please choose another voice.' }
  }
  return { status: 'failed', error: clip(result.error ?? 'The voice could not be applied to your agent.') }
}

/** Pushes the saved voice to the providers (see the header). `db` reads agent_provider_resources. */
async function pushVoice(db: SupabaseClient, agentId: string, voiceId: string, log: Logger): Promise<ApplyOutcome> {
  try {
    await bumpRevision(agentId)
    const { data: resources, error } = await db
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

    if (hasExternal('cartesia') && (await providersFor(db, agentId)).includes('cartesia')) {
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

/**
 * Saves and applies an already-checked voice to the org's agent. `readClient`
 * is the caller's client for the RLS-bounded reads (the tenant's own client in
 * routes; the service role in maintenance, scoped by the org).
 */
export async function applyAgentVoice(params: {
  orgId: string
  agentId: string
  voiceId: string
  voiceName: string
  readClient?: SupabaseClient
  /**
   * Platform migrations: only replace this exact current voice (null = no
   * voice). A tenant's choice made meanwhile is never overwritten: the call
   * then returns null and changes nothing.
   */
  expectedCurrentVoiceId?: string | null
  log: Logger
}): Promise<ApplyOutcome | null> {
  const { orgId, agentId, voiceId, log } = params
  let update = createAdminClient()
    .from('agents')
    .update({ voice_id: voiceId, voice_name: clip(params.voiceName, 100) || 'Voice' })
    .eq('id', agentId)
    .eq('org_id', orgId)
  if (params.expectedCurrentVoiceId !== undefined) {
    update = params.expectedCurrentVoiceId === null ? update.is('voice_id', null) : update.eq('voice_id', params.expectedCurrentVoiceId)
  }
  const { data: updated, error: updErr } = await update.select('id')
  if (updErr) throw new Error(`agents voice update failed: ${updErr.message}`)
  if (!updated?.length) {
    if (params.expectedCurrentVoiceId !== undefined) return null
    throw new Error('agents voice update matched no row')
  }
  await setVoiceSyncState(orgId, agentId, 'saving', null)

  const outcome = await pushVoice(params.readClient ?? createAdminClient(), agentId, voiceId, log)
  await setVoiceSyncState(orgId, agentId, outcome.status, outcome.error)
  return outcome
}
