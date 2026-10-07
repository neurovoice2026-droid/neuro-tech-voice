// POST /api/calls/[id]/reanalyze — re-runs the AI analysis of one ElevenLabs
// call with the agent's CURRENT success criteria and data-collection fields
// (POST /v1/convai/conversations/{id}/analysis/run), then refreshes the call
// from the response. Billed to the platform (analysis LLM): rate limited per
// organization. The conversation id comes from the org-scoped row; the
// conversation is read first and must belong to the org's own agent before
// anything is spent on it.
import { NextResponse } from 'next/server'
import { requireOrg } from '@/lib/api/auth'
import { apiError, assertSameOrigin, errorResponse, RequestError, requestErrorResponse } from '@/lib/api/http'
import { createLogger, requestIdFrom } from '@/lib/observability/logger'
import { createAdminClient } from '@/lib/supabase/admin'
import { enforceRateLimit } from '@/lib/security/rate-limit'
import { FINAL_CONVERSATION_STATUSES, getConversation, runConversationAnalysis } from '@/lib/elevenlabs/api/conversations'
import { normalizeElevenLabsEvent, readEnvelope } from '@/lib/elevenlabs/webhook'
import { applyReanalysis } from '@/lib/voice-providers/call-reanalysis'
import { isLiveStatus } from '@/lib/calls/labels'
import { CALL_REANALYZE_LIMITS } from '@/lib/calls/limits'
import {
  CALL_DETAIL_COLUMNS,
  elevenLabsConversationId,
  findOrgCall,
  parseCallId,
  serializeCallDetail,
  type CallRow,
} from '@/lib/calls/serialize'

export const maxDuration = 90

type RouteParams = { params: Promise<{ id: string }> }

/** The org owns this ElevenLabs agent (shared workspace: never trust the conversation alone). */
async function orgOwnsAgent(orgId: string, externalAgentId: string): Promise<boolean> {
  const { data, error } = await createAdminClient()
    .from('agent_provider_resources')
    .select('org_id')
    .eq('provider', 'elevenlabs')
    .eq('external_id', externalAgentId)
    .maybeSingle()
  if (error) throw new Error(`agent_provider_resources read failed: ${error.message}`)
  return data?.org_id === orgId
}

export async function POST(request: Request, { params }: RouteParams) {
  const requestId = requestIdFrom(request)
  let log = createLogger({ requestId, route: 'calls.reanalyze' })
  try {
    assertSameOrigin(request)
    const { supabase, org } = await requireOrg()
    log = log.child({ orgId: org.id })
    const id = parseCallId((await params).id)

    const row = await findOrgCall<CallRow & { outcome: string | null }>(supabase, org.id, id, CALL_DETAIL_COLUMNS)
    if (!row) return apiError('not_found', 'Call not found', 404, { requestId })
    log = log.child({ callId: row.id })
    if (row.retention_applied_at) {
      return apiError('conflict', 'This call’s transcript was removed by your retention setting, so it cannot be analysed again.', 409, { requestId })
    }
    if (isLiveStatus(row.status)) return apiError('conflict', 'This call is still in progress.', 409, { requestId })
    const conversationId = elevenLabsConversationId(row)
    if (!conversationId) return apiError('conflict', 'Only calls answered by the ElevenLabs agent can be analysed again.', 409, { requestId })

    await enforceRateLimit(CALL_REANALYZE_LIMITS, org.id, 'Too many analyses in a short time. Please try again later.')

    const ctx = { orgId: org.id, callId: row.id }
    const current = await getConversation(conversationId, ctx)
    if (!(await orgOwnsAgent(org.id, current.agent_id))) {
      log.error('calls.reanalyze.foreign_conversation', null, { conversationAgent: current.agent_id })
      return apiError('not_found', 'Call not found', 404, { requestId })
    }
    if (!FINAL_CONVERSATION_STATUSES.has(current.status)) {
      return apiError('conflict', 'The voice provider is still processing this call. Try again in a few minutes.', 409, { requestId })
    }

    const details = await runConversationAnalysis(conversationId, ctx)
    if (details.agent_id !== current.agent_id) throw new Error('re-analysis returned another agent')
    const event = normalizeElevenLabsEvent(readEnvelope({ type: 'post_call_transcription', data: details }))
    if (!event) throw new Error('re-analysis response could not be normalized')
    await applyReanalysis({ id: row.id, org_id: org.id, outcome: row.outcome, call_metadata: row.call_metadata, retention_applied_at: row.retention_applied_at }, event, log)

    const fresh = await findOrgCall<CallRow>(supabase, org.id, { value: row.id, isUuid: true }, CALL_DETAIL_COLUMNS)
    return NextResponse.json(fresh ? serializeCallDetail(fresh) : { id: row.id })
  } catch (err) {
    if (err instanceof RequestError) return requestErrorResponse(err, requestId)
    return errorResponse(err, log, 'calls.reanalyze.failed', requestId)
  }
}
