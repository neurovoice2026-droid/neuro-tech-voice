// POST /api/onboarding/agent — step 2: agent name, language, prompt, greeting
// and personality. Saved locally only; onboarding/complete pushes the agent
// to the providers.

import { NextResponse } from 'next/server'
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
  OnboardingAgentSchema,
  blankToNull,
  defaultAgentName,
  ensureAgent,
  mergeMetadata,
} from '@/lib/agents/ensure-agent'

export async function POST(request: Request) {
  const requestId = requestIdFrom(request)
  let log = createLogger({ requestId, route: 'onboarding.agent' })
  try {
    assertSameOrigin(request)
    const { supabase, org } = await requireOrg()
    log = log.child({ orgId: org.id })
    const body = await parseJsonBody(request, OnboardingAgentSchema)

    const agent = await ensureAgent(org.id, defaultAgentName(org.name))
    const patch: Record<string, unknown> = {
      name: body.name,
      language: body.language,
      system_prompt: blankToNull(body.system_prompt ?? null),
    }
    if (body.first_message !== undefined) patch.first_message = blankToNull(body.first_message)
    if (body.personality) patch.metadata = mergeMetadata(agent.metadata, { personality: body.personality })

    const { error } = await supabase.from('agents').update(patch).eq('id', agent.id).eq('org_id', org.id)
    if (error) throw new Error(`agents update failed: ${error.message}`)

    const { error: orgErr } = await supabase.from('organizations').update({ onboarding_step: 3 }).eq('id', org.id)
    if (orgErr) throw new Error(`organizations update failed: ${orgErr.message}`)

    return NextResponse.json({ success: true, agent_id: agent.id })
  } catch (err) {
    if (err instanceof RequestError) return requestErrorResponse(err, requestId)
    return errorResponse(err, log, 'onboarding.agent_failed', requestId)
  }
}
