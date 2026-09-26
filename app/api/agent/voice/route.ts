import { NextResponse } from 'next/server'
import { ApiError, handleRoute, noStore, parseJson } from '@/lib/api/http'
import { requireOrgContext } from '@/lib/api/auth'
import { enforceRateLimit, RATE_LIMITS } from '@/lib/security/rate-limit'
import { syncAgentAfterResponse } from '@/lib/voice/sync'
import { loadOrgAgent, saveAgentColumns } from '@/lib/voice/sync/agent-store'
import { agentVoiceSchema } from '@/lib/voice/sync/schemas'
import { resolveSelectableVoice } from '@/lib/voice/sync/voices'

// Sets the agent's Cartesia voice. The id must be a voice Cartesia serves
// and, for a cloned voice, one this organisation owns. The providers are
// updated after the response.

export const runtime = 'nodejs'
// Covers the provider sync that runs in after().
export const maxDuration = 60

export const PATCH = handleRoute(async (req) => {
  const ctx = await requireOrgContext()
  await enforceRateLimit(RATE_LIMITS.apiWrite, ctx.user.id)
  const body = await parseJson(req, agentVoiceSchema, { maxBytes: 2048 })

  const agent = await loadOrgAgent(ctx.supabase, ctx.org.id)
  if (!agent) {
    throw new ApiError(404, 'agent_not_found', 'Your AI agent hasn’t been set up yet. Please finish onboarding first.')
  }

  const voice = await resolveSelectableVoice(ctx.supabase, ctx.org.id, body.cartesia_voice_id)
  const cartesia_voice_name = body.cartesia_voice_name?.trim() || voice.name
  await saveAgentColumns(
    ctx.supabase,
    { orgId: ctx.org.id, agentId: agent.id },
    { update: { cartesia_voice_id: voice.id, cartesia_voice_name }, derived: new Set() }
  )

  const saved = { ...agent, cartesia_voice_id: voice.id, cartesia_voice_name }
  const provider_sync = await syncAgentAfterResponse(saved)
  return noStore(NextResponse.json({ agent: { ...saved, provider_sync }, provider_sync }))
})
