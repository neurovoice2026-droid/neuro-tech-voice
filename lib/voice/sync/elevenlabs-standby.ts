import 'server-only'
import type { Agent, ProviderSyncEntry } from '@/types'
import { ApiError } from '@/lib/api/http'
import { isElevenLabsConfigured } from '@/lib/env'
import { agents as elAgents, ElevenLabsError } from '@/lib/elevenlabs/client'
import {
  buildElevenLabsStandbyConfig,
  createStandbyAgent,
  updateStandbyAgent,
  type StandbyAgentInput,
} from '@/lib/elevenlabs/create-agent'
import { configHash } from '@/lib/voice/sync/hash'
import { isEntryCurrent } from '@/lib/voice/sync/cartesia-agent'
import type { AgentSyncContext, SyncOrg } from '@/lib/voice/sync/context'

// Keeps the ElevenLabs standby agent in step with the agent row. It is only a
// fallback, so a failure here never blocks a save; it is recorded in
// provider_sync.elevenlabs and retried by the daily resync.

/**
 * Hash from stored rows only. The fallback voice depends on the Cartesia
 * voice's gender, which needs an API call, so the hash names its source (the
 * explicit ElevenLabs voice or the Cartesia voice id) instead of the resolved id.
 */
export function elevenLabsSyncHash(agent: Agent, org: SyncOrg, ctx: AgentSyncContext): string {
  const config = buildElevenLabsStandbyConfig({ agent, org, ctx, voiceGender: null })
  const twin = ctx.elevenLabsTwinVoiceId?.trim()
  const legacy = !agent.cartesia_voice_id && agent.voice_id?.trim()
  const voiceSource = twin
    ? `elevenlabs:${twin}`
    : legacy
      ? `elevenlabs:${legacy}`
      : `cartesia:${agent.cartesia_voice_id ?? 'default'}`
  return configHash({
    ...config,
    conversation_config: { ...config.conversation_config, tts: { ...config.conversation_config.tts, voice_id: voiceSource } },
  })
}

export function describeElevenLabsSyncError(error: unknown): string {
  if (error instanceof ApiError && error.code === 'not_configured') return 'ElevenLabs isn’t set up on the server yet.'
  if (error instanceof ElevenLabsError) {
    if (error.status === 401 || error.status === 403) {
      return 'The backup voice provider didn’t accept our account credentials. Please contact support.'
    }
    if (error.status === 0 || error.status === 408 || error.status === 429 || error.status >= 500) {
      return 'The backup voice provider didn’t respond in time. We’ll try again automatically.'
    }
    if (error.status === 400 || error.status === 422) {
      return 'The backup voice provider didn’t accept these agent settings. Please review your agent settings or contact support.'
    }
  }
  return 'Something went wrong while updating the backup voice agent. We’ll try again automatically.'
}

export interface ElevenLabsSyncResult {
  entry: ProviderSyncEntry
  elevenLabsAgentId: string | null
}

/**
 * Creates or updates the standby agent. Never throws; the outcome goes to provider_sync.
 * `voiceGenderResolved: false` means the Cartesia voice lookup failed, so the
 * fallback voice may have the wrong gender: the push still happens, but no
 * hash is recorded and the next save or the daily resync pushes again.
 */
export async function syncElevenLabsStandby(input: {
  agent: Agent
  org: SyncOrg
  ctx: AgentSyncContext
  voiceGender?: StandbyAgentInput['voiceGender']
  voiceGenderResolved?: boolean
  force?: boolean
  now?: Date
}): Promise<ElevenLabsSyncResult> {
  const { agent, org, ctx } = input
  const previous = agent.provider_sync?.elevenlabs
  const keep = { synced_at: previous?.synced_at ?? null, hash: previous?.hash ?? null, version_id: null }

  if (!isElevenLabsConfigured()) {
    return { entry: { status: 'disabled', error: null, ...keep }, elevenLabsAgentId: agent.elevenlabs_agent_id }
  }

  try {
    const hash = elevenLabsSyncHash(agent, org, ctx)
    if (!input.force && agent.elevenlabs_agent_id && previous && isEntryCurrent(previous, hash)) {
      return { entry: { ...previous, status: 'synced' }, elevenLabsAgentId: agent.elevenlabs_agent_id }
    }

    const config = buildElevenLabsStandbyConfig({ agent, org, ctx, voiceGender: input.voiceGender ?? null })
    let agentId = agent.elevenlabs_agent_id
    if (agentId) {
      try {
        await updateStandbyAgent(agentId, config)
      } catch (error) {
        if (!(error instanceof ElevenLabsError && error.status === 404)) throw error
        console.warn('[elevenlabs]', 'standby agent missing upstream, creating a new one', agentId)
        agentId = await createStandbyAgent(config)
      }
    } else {
      agentId = await createStandbyAgent(config)
    }

    // Only a gender-matched premade voice depends on the lookup that failed.
    const genderDecides = !ctx.elevenLabsTwinVoiceId?.trim() && !(!agent.cartesia_voice_id && agent.voice_id?.trim())
    const voiceProvisional = input.voiceGenderResolved === false && genderDecides
    return {
      entry: {
        status: 'synced',
        synced_at: (input.now ?? new Date()).toISOString(),
        error: null,
        hash: voiceProvisional ? null : hash,
        version_id: null,
      },
      elevenLabsAgentId: agentId,
    }
  } catch (error) {
    console.error('[elevenlabs]', 'standby agent sync failed', {
      agent: agent.id,
      message: error instanceof Error ? error.message : String(error),
      status: error instanceof ElevenLabsError ? error.status : null,
    })
    return {
      entry: { status: 'error', error: describeElevenLabsSyncError(error), ...keep },
      elevenLabsAgentId: agent.elevenlabs_agent_id,
    }
  }
}

/** Deletes the standby agent; one that is already gone counts as deleted. */
export async function deleteElevenLabsAgent(elevenLabsAgentId: string): Promise<void> {
  try {
    await elAgents.delete(elevenLabsAgentId)
  } catch (error) {
    if (error instanceof ElevenLabsError && error.status === 404) return
    throw error
  }
}
