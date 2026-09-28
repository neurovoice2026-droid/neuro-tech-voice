import { NextResponse } from 'next/server'
import { ApiError, handleRoute, noStore, parseJson } from '@/lib/api/http'
import { requireOrgContext } from '@/lib/api/auth'
import { enforceRateLimit, RATE_LIMITS } from '@/lib/security/rate-limit'
import { loadOrgAgent, saveAgentColumns } from '@/lib/voice/sync/agent-store'
import { agentToggleSchema } from '@/lib/voice/sync/schemas'

// Pauses or resumes the agent. The call router reads is_active on every call
// and answers paused agents with the "unavailable" message, so no provider
// needs to change.

export const runtime = 'nodejs'

export const POST = handleRoute(async (req) => {
  const ctx = await requireOrgContext()
  await enforceRateLimit(RATE_LIMITS.apiWrite, ctx.user.id)
  const { is_active } = await parseJson(req, agentToggleSchema, { maxBytes: 1024 })

  const agent = await loadOrgAgent(ctx.supabase, ctx.org.id)
  if (!agent) {
    throw new ApiError(404, 'agent_not_found', 'Your AI agent hasn’t been set up yet. Please finish onboarding first.')
  }

  await saveAgentColumns(ctx.supabase, { orgId: ctx.org.id, agentId: agent.id }, { update: { is_active }, derived: new Set() })
  return noStore(NextResponse.json({ agent: { ...agent, is_active } }))
})
