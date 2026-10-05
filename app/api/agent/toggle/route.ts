// POST /api/agent/toggle { is_active } → { agent, sync }. Activating an agent
// that has no external agent at its primary provider yet creates it (primary
// awaited, fallback after the response).

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

    const { data: updated, error } = await supabase
      .from('agents')
      .update({ is_active })
      .eq('id', agent.id)
      .eq('org_id', org.id)
      .select('*')
      .single()
    if (error) throw new Error(`agents update failed: ${error.message}`)

    let sync: AgentSyncReport[] = []
    const primaryProvider: VoiceProvider = agent.primary_provider === 'cartesia' ? 'cartesia' : 'elevenlabs'
    if (is_active && !(await hasExternalAgent(supabase, org.id, agent.id, primaryProvider))) {
      sync = await syncAgentProviders({
        supabase,
        orgId: org.id,
        agentId: agent.id,
        primaryProvider,
        bump: false,
        primary: true,
        fallback: true,
        log,
      })
    }
    log.info('agent.toggle', { is_active, sync: sync.map((s) => `${s.provider}:${s.status}`) })

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
