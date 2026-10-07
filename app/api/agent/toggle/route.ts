// POST /api/agent/toggle { is_active } → { agent, sync }. Activating an agent
// that has no external agent at its primary provider yet creates it (primary
// awaited, fallback after the response).
//
// Pausing must also reach ElevenLabs: calls to numbers imported natively into
// ElevenLabs never pass through our router (which refuses calls for a paused
// agent), so a pause or resume re-syncs the agents. A paused agent is synced
// as an "unavailable" variant (lib/elevenlabs/paused-agent.ts) that only tells
// the caller the business cannot take the call and hangs up; resuming pushes
// the normal configuration again.

import { NextResponse } from 'next/server'
import { z } from 'zod'
import { requireOrg } from '@/lib/api/auth'
import {
  RequestError,
  assertSameOrigin,
  errorResponse,
  parseJsonBody,
  requestErrorResponse,
} from '@/lib/api/http'
import { createLogger, requestIdFrom } from '@/lib/observability/logger'
import { RATE_LIMITS, enforceRateLimit } from '@/lib/security/rate-limit'
import {
  defaultAgentName,
  ensureAgent,
  hasExternalAgent,
  syncAgentProviders,
  type AgentSyncReport,
} from '@/lib/agents/ensure-agent'
import type { VoiceProvider } from '@/lib/voice-providers/errors'
import type { Agent } from '@/types'

export const maxDuration = 60

const ToggleSchema = z.strictObject({ is_active: z.boolean() })

export async function POST(request: Request) {
  const requestId = requestIdFrom(request)
  let log = createLogger({ requestId, route: 'agent.toggle' })
  try {
    assertSameOrigin(request)
    const { supabase, org } = await requireOrg()
    log = log.child({ orgId: org.id })
    const { is_active } = await parseJsonBody(request, ToggleSchema)

    const agent = await ensureAgent(org.id, defaultAgentName(org.name))
    log = log.child({ agentId: agent.id })
    const primaryProvider: VoiceProvider = agent.primary_provider === 'cartesia' ? 'cartesia' : 'elevenlabs'
    const stateChanged = agent.is_active !== is_active
    const needsCreate = is_active && !(await hasExternalAgent(supabase, org.id, agent.id, primaryProvider))
    // Only the ElevenLabs agent changes on a pause (paused variant); without one
    // there is nothing to push and nothing is created for a paused agent.
    const pushPause = stateChanged && (is_active || (await hasExternalAgent(supabase, org.id, agent.id, 'elevenlabs')))
    const push = pushPause || needsCreate
    // Provider pushes are bounded per org; checked before the write so a 429 changes nothing.
    if (push) {
      await enforceRateLimit(RATE_LIMITS.agentSync, org.id, 'Too many changes in a short time. Please wait a moment and try again.')
    }

    const { data: updated, error } = await supabase
      .from('agents')
      .update({ is_active })
      .eq('id', agent.id)
      .eq('org_id', org.id)
      .select('*')
      .single()
    if (error) throw new Error(`agents update failed: ${error.message}`)

    let sync: AgentSyncReport[] = []
    if (push) {
      sync = await syncAgentProviders({
        supabase,
        orgId: org.id,
        agentId: agent.id,
        primaryProvider,
        // A pause/resume changes the ElevenLabs body: bump so a sync already
        // in flight catches up instead of finishing with the old state.
        bump: stateChanged,
        primary: true,
        fallback: true,
        log,
      })
    }
    log.info('agent.toggle', { is_active, stateChanged, sync: sync.map((s) => `${s.provider}:${s.status}`) })

    let agentOut = updated as Agent
    if (sync.length) {
      // The sync may have recorded the new external agent id.
      const { data: fresh, error: readErr } = await supabase
        .from('agents')
        .select('*')
        .eq('id', agent.id)
        .eq('org_id', org.id)
        .single()
      if (readErr) throw new Error(`agents read failed: ${readErr.message}`)
      agentOut = fresh as Agent
    }

    return NextResponse.json({ agent: agentOut, sync })
  } catch (err) {
    if (err instanceof RequestError) return requestErrorResponse(err, requestId)
    return errorResponse(err, log, 'agent.toggle_failed', requestId)
  }
}
