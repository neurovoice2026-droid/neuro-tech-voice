import { after, NextResponse } from 'next/server'
import { ApiError, handleRoute, zUuid } from '@/lib/api/http'
import { requireOrgContext } from '@/lib/api/auth'
import { cartesia, CartesiaError, cartesiaTtsModel } from '@/lib/cartesia/client'
import { isSupabaseAdminConfigured } from '@/lib/env'
import { kvDel } from '@/lib/kv'
import { enforceRateLimit, RATE_LIMITS } from '@/lib/security/rate-limit'
import { createAdminClient } from '@/lib/supabase/admin'
import { syncAgentProviders } from '@/lib/voice/sync'
import { defaultCartesiaVoice, elevenLabsFallbackVoice } from '@/lib/voice/voice-map'
import { findOrgClone } from '../_lib/catalog'
import { deleteElevenLabsVoice } from '../_lib/elevenlabs-voices'
import { sampleFor } from '@/components/voice/voice-samples'
import { previewCacheKey, sampleObjectPath, textPreviewFolder, voiceMetaKey } from '../_lib/keys'
import { removeFolder, removeObjects, VOICE_BUCKETS } from '../_lib/storage'
import { requireCartesia, toVoiceApiError } from '../_lib/synthesis'

export const runtime = 'nodejs'

// DELETE /api/voices/{voiceId} → deletes one of the organisation's cloned
// voices: at Cartesia first (so it can never be used again), then its
// ElevenLabs twin and the source recording. The consent record stays, marked
// deleted. Agents that were speaking with it switch to the default voice for
// their language and are re-synced to the providers.

interface AgentVoiceRow {
  id: string
  language: string | null
  voice_id: string | null
}

export const DELETE = handleRoute(async (_req, { params }: { params: Promise<{ voiceId: string }> }) => {
  const { voiceId: rawId } = await params
  const ctx = await requireOrgContext()
  const parsed = zUuid.safeParse(rawId)
  if (!parsed.success) throw new ApiError(404, 'voice_not_found', 'We couldn’t find this voice in your account.')
  const voiceId = parsed.data.toLowerCase()

  await enforceRateLimit(RATE_LIMITS.apiWrite, ctx.user.id)
  const clone = await findOrgClone(ctx, voiceId)
  if (!clone) throw new ApiError(404, 'voice_not_found', 'We couldn’t find this voice in your account.')
  if (!isSupabaseAdminConfigured()) {
    throw new ApiError(503, 'not_configured', 'Voices can’t be deleted right now because storage isn’t configured.')
  }
  requireCartesia()

  try {
    await cartesia.voices.delete(voiceId)
  } catch (error) {
    // Already gone upstream (for example a retry after a partial failure): carry on.
    if (!(error instanceof CartesiaError && error.status === 404)) throw toVoiceApiError(error, 'clone')
  }

  const admin = createAdminClient()
  const { error: markError } = await admin
    .from('voice_clones')
    .update({ status: 'deleted', source_storage_path: null })
    .eq('org_id', ctx.org.id)
    .eq('id', clone.id)
  if (markError) {
    console.error('[voices] marking clone deleted failed', markError.code, markError.message)
    throw new ApiError(500, 'internal_error', 'The voice was removed, but we couldn’t update your account. Please try again.')
  }
  await kvDel(voiceMetaKey(voiceId))

  // Agents using the clone get the language default so calls keep a working voice.
  const { data: agentRows, error: agentsError } = await admin
    .from('agents')
    .select('id, language, voice_id')
    .eq('org_id', ctx.org.id)
    .eq('cartesia_voice_id', voiceId)
  if (agentsError) {
    console.error('[voices] finding agents that use a deleted clone failed', agentsError.code, agentsError.message)
    throw new ApiError(500, 'internal_error', 'The voice was deleted, but we couldn’t update your agent. Please pick a new voice on the Agent page.')
  }

  const gender = clone.gender === 'masculine' ? 'masculine' : 'feminine'
  const resetAgents: { id: string; voice: { id: string; name: string } }[] = []
  for (const agent of (agentRows ?? []) as AgentVoiceRow[]) {
    const fallback = defaultCartesiaVoice(agent.language ?? 'en', gender)
    const patch: Record<string, string> = { cartesia_voice_id: fallback.voice_id, cartesia_voice_name: fallback.name }
    if (clone.elevenlabs_voice_id && agent.voice_id === clone.elevenlabs_voice_id) {
      const standby = elevenLabsFallbackVoice(clone.gender)
      patch.voice_id = standby.voice_id
      patch.voice_name = standby.name
    }
    const { error } = await admin.from('agents').update(patch).eq('org_id', ctx.org.id).eq('id', agent.id)
    if (error) {
      console.error('[voices] resetting agent voice failed', error.code, error.message)
      throw new ApiError(500, 'internal_error', 'The voice was deleted, but we couldn’t update your agent. Please pick a new voice on the Agent page.')
    }
    resetAgents.push({ id: agent.id, voice: { id: fallback.voice_id, name: fallback.name } })
  }

  after(async () => {
    const tasks: Promise<unknown>[] = []
    if (clone.elevenlabs_voice_id) tasks.push(deleteElevenLabsVoice(clone.elevenlabs_voice_id))
    if (clone.source_storage_path) tasks.push(removeObjects(VOICE_BUCKETS.clips, [clone.source_storage_path]))
    // Audio generated in the clone's voice: its "hear this voice" sample and
    // every greeting or pace preview.
    const sample = sampleFor(clone.language)
    const sampleHash = previewCacheKey({ voiceId, model: cartesiaTtsModel(), language: sample.language, speed: null, emotion: null, text: sample.text })
    tasks.push(removeObjects(VOICE_BUCKETS.previews, [sampleObjectPath(sampleHash, ctx.org.id)]))
    tasks.push(removeFolder(VOICE_BUCKETS.previews, textPreviewFolder(ctx.org.id, voiceId)))
    for (const agent of resetAgents) {
      tasks.push(
        syncAgentProviders(agent.id).catch((error: unknown) => {
          console.error('[voices] agent re-sync after clone deletion failed', agent.id, error instanceof Error ? error.message : error)
        })
      )
    }
    await Promise.all(tasks)
  })

  return NextResponse.json({
    ok: true,
    // The dashboard shows which voice the agent switched to.
    replacement: resetAgents[0]?.voice ?? null,
  })
})
