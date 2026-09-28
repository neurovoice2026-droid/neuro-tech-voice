import { NextResponse } from 'next/server'
import { ApiError, handleRoute, noStore } from '@/lib/api/http'
import { requireOrgContext } from '@/lib/api/auth'
import { isCartesiaConfigured, isElevenLabsConfigured, isSupabaseAdminConfigured } from '@/lib/env'
import { enforceRateLimit, type RateLimitPolicy } from '@/lib/security/rate-limit'
import { syncAgentProviders } from '@/lib/voice/sync'
import { loadOrgAgent } from '@/lib/voice/sync/agent-store'

// GET: the agent's provider sync state (the dashboard polls it after a save).
// POST: a manual "update now" that pushes the full configuration to every
// configured provider and waits for the result.

export const runtime = 'nodejs'
// First sync on an account also registers the shared calling tools.
export const maxDuration = 60

/** Each manual sync makes several provider calls; a few per ten minutes is plenty. */
const AGENT_SYNC_LIMIT: RateLimitPolicy = { name: 'agentSync', limit: 6, windowSeconds: 10 * 60 }

const NOT_SET_UP = 'Your AI agent hasn’t been set up yet. Please finish onboarding first.'

export const GET = handleRoute(async () => {
  const ctx = await requireOrgContext()
  const agent = await loadOrgAgent(ctx.supabase, ctx.org.id)
  if (!agent) throw new ApiError(404, 'agent_not_found', NOT_SET_UP)
  return noStore(NextResponse.json({ provider_sync: agent.provider_sync }))
})

export const POST = handleRoute(async () => {
  const ctx = await requireOrgContext()
  await enforceRateLimit(AGENT_SYNC_LIMIT, ctx.org.id)

  const agent = await loadOrgAgent(ctx.supabase, ctx.org.id)
  if (!agent) throw new ApiError(404, 'agent_not_found', NOT_SET_UP)

  if (!isCartesiaConfigured() && !isElevenLabsConfigured()) {
    throw new ApiError(503, 'not_configured', 'No voice provider is set up on the server yet, so there is nothing to update.')
  }
  if (!isSupabaseAdminConfigured()) {
    throw new ApiError(503, 'not_configured', 'Voice agent updates are temporarily unavailable. Please contact support.')
  }

  const provider_sync = await syncAgentProviders(agent.id, { force: true })
  return noStore(NextResponse.json({ provider_sync }))
})
