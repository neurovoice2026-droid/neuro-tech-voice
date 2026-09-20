import { NextResponse } from 'next/server'
import { ApiError, handleRoute, noStore, parseJson } from '@/lib/api/http'
import { requireOrgContext, type OrgContext } from '@/lib/api/auth'
import { isSupabaseAdminConfigured } from '@/lib/env'
import { kvDel, kvIncr } from '@/lib/kv'
import { enforceRateLimit, RATE_LIMITS } from '@/lib/security/rate-limit'
import { createAdminClient } from '@/lib/supabase/admin'
import type { Agent } from '@/types'
import { syncAgentAfterResponse } from '@/lib/voice/sync'
import { loadOrgAgent, saveAgentColumns } from '@/lib/voice/sync/agent-store'
import { buildAgentUpdate } from '@/lib/voice/sync/agent-update'
import { providerAgentName } from '@/lib/voice/sync/compose'
import { agentPatchSchema, patchAffectsProviders } from '@/lib/voice/sync/schemas'
import { resolveSelectableVoice } from '@/lib/voice/sync/voices'

// The organisation's single AI agent. GET returns it (creating a default one
// for accounts that never got a row); PATCH saves settings with the user's
// own session, then pushes them to the voice providers after the response.

export const runtime = 'nodejs'
// Covers the provider sync that runs in after().
export const maxDuration = 60

const NOT_SET_UP = 'Your AI agent hasn’t been set up yet. Please finish onboarding first.'

const CREATE_LOCK_TTL_SECONDS = 15
const CREATE_WAIT_STEPS = 6
const CREATE_WAIT_MS = 500

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

/**
 * Accounts created before onboarding persisted the agent may have no row. The
 * service role creates it (provider columns stay server-owned). The agents
 * table has no one-per-org constraint, so a short per-org lock keeps two tabs
 * loading at once from creating two agents: the second waits for the first.
 */
async function createDefaultAgent(ctx: OrgContext): Promise<Agent> {
  const client = isSupabaseAdminConfigured() ? createAdminClient() : ctx.supabase
  const lockKey = `lock:agent-create:${ctx.org.id}`
  const holders = await kvIncr(lockKey, CREATE_LOCK_TTL_SECONDS)
  if (holders > 1) {
    for (let step = 0; step < CREATE_WAIT_STEPS; step++) {
      await sleep(CREATE_WAIT_MS)
      const created = await loadOrgAgent(client, ctx.org.id)
      if (created) return created
    }
    throw new ApiError(409, 'agent_setup_in_progress', 'Your agent is still being set up. Please refresh in a moment.')
  }

  try {
    const existing = await loadOrgAgent(client, ctx.org.id)
    if (existing) return existing

    const name = providerAgentName(ctx.org.name ? `${ctx.org.name} Agent` : 'My Agent', null)
    const { error } = await client.from('agents').insert({ org_id: ctx.org.id, name })
    if (error) {
      console.error('[agent]', 'default agent creation failed', error.code, error.message)
      throw new ApiError(500, 'agent_create_failed', 'We couldn’t set up your agent. Please try again.')
    }
    const created = await loadOrgAgent(client, ctx.org.id)
    if (!created) throw new ApiError(500, 'agent_create_failed', 'We couldn’t set up your agent. Please try again.')
    return created
  } finally {
    await kvDel(lockKey)
  }
}

export const GET = handleRoute(async () => {
  const ctx = await requireOrgContext()
  const agent = (await loadOrgAgent(ctx.supabase, ctx.org.id)) ?? (await createDefaultAgent(ctx))
  return noStore(NextResponse.json({ agent, provider_sync: agent.provider_sync }))
})

export const PATCH = handleRoute(async (req) => {
  const ctx = await requireOrgContext()
  await enforceRateLimit(RATE_LIMITS.apiWrite, ctx.user.id)
  const patch = await parseJson(req, agentPatchSchema)

  const current = await loadOrgAgent(ctx.supabase, ctx.org.id)
  if (!current) throw new ApiError(404, 'agent_not_found', NOT_SET_UP)

  let verifiedVoiceName: string | null = null
  const voiceChanged = patch.cartesia_voice_id !== undefined && patch.cartesia_voice_id !== current.cartesia_voice_id
  if (voiceChanged && patch.cartesia_voice_id) {
    // Clone ownership is readable through the user's own RLS policy.
    verifiedVoiceName = (await resolveSelectableVoice(ctx.supabase, ctx.org.id, patch.cartesia_voice_id)).name
  }

  const plan = buildAgentUpdate(patch, current, verifiedVoiceName)
  if (Object.keys(plan.update).length === 0) {
    return noStore(NextResponse.json({ agent: current, provider_sync: current.provider_sync }))
  }

  await saveAgentColumns(ctx.supabase, { orgId: ctx.org.id, agentId: current.id }, plan)
  const saved = await loadOrgAgent(ctx.supabase, ctx.org.id)
  if (!saved) throw new ApiError(404, 'agent_not_found', NOT_SET_UP)

  const provider_sync = patchAffectsProviders(patch) ? await syncAgentAfterResponse(saved) : saved.provider_sync
  return noStore(NextResponse.json({ agent: { ...saved, provider_sync }, provider_sync }))
})
