// POST /api/calls/[id]/feedback {feedback: 'like' | 'dislike' | null}
// The owner's thumbs up/down on how the agent handled a call. Stored on our
// row (calls.owner_feedback) and forwarded to ElevenLabs for that call's own
// conversation (POST /v1/convai/conversations/{id}/feedback), best effort:
// a provider failure never loses the local value. The conversation id comes
// from the org-scoped row, never from the browser.
import { NextResponse } from 'next/server'
import { z } from 'zod'
import { requireOrg } from '@/lib/api/auth'
import { apiError, assertSameOrigin, errorResponse, parseJsonBody, RequestError, requestErrorResponse } from '@/lib/api/http'
import { createLogger, requestIdFrom } from '@/lib/observability/logger'
import { createAdminClient } from '@/lib/supabase/admin'
import { enforceRateLimit } from '@/lib/security/rate-limit'
import { isProviderError } from '@/lib/voice-providers/errors'
import { sendConversationFeedback } from '@/lib/elevenlabs/api/conversations'
import { CALL_FEEDBACK_LIMIT } from '@/lib/calls/limits'
import { dbError, elevenLabsConversationId, findOrgCall, parseCallId, type CallRow } from '@/lib/calls/serialize'

type RouteParams = { params: Promise<{ id: string }> }

const Body = z.strictObject({ feedback: z.enum(['like', 'dislike']).nullable() })

const COLUMNS: string = 'id, status, provider, provider_call_id, elevenlabs_conversation_id, is_test'
type Row = Pick<CallRow, 'id' | 'status' | 'provider' | 'provider_call_id' | 'elevenlabs_conversation_id' | 'is_test'>

export async function POST(request: Request, { params }: RouteParams) {
  const requestId = requestIdFrom(request)
  let log = createLogger({ requestId, route: 'calls.feedback' })
  try {
    assertSameOrigin(request)
    const { supabase, org } = await requireOrg()
    log = log.child({ orgId: org.id })
    const id = parseCallId((await params).id)
    const body = await parseJsonBody(request, Body, 1024)
    await enforceRateLimit(CALL_FEEDBACK_LIMIT, org.id, 'Too many feedback changes in a short time. Please wait a moment.')

    const row = await findOrgCall<Row>(supabase, org.id, id, COLUMNS)
    if (!row) return apiError('not_found', 'Call not found', 404, { requestId })
    log = log.child({ callId: row.id })

    // Tenants cannot write calls rows (guard trigger): the server writes the org's own row.
    const { error } = await createAdminClient()
      .from('calls')
      .update({ owner_feedback: body.feedback, owner_feedback_at: body.feedback ? new Date().toISOString() : null })
      .eq('id', row.id)
      .eq('org_id', org.id)
    if (error) throw dbError('calls feedback update', error)

    let forwarded = false
    const conversationId = elevenLabsConversationId(row)
    if (conversationId) {
      try {
        await sendConversationFeedback(conversationId, body.feedback, { orgId: org.id, callId: row.id })
        forwarded = true
      } catch (err) {
        // Best effort: the owner's feedback is stored locally either way.
        log.warn('calls.feedback.forward_failed', { code: isProviderError(err) ? err.code : 'unknown' })
      }
    }
    log.info('calls.feedback', { feedback: body.feedback, forwarded })
    return NextResponse.json({ feedback: body.feedback, forwarded })
  } catch (err) {
    if (err instanceof RequestError) return requestErrorResponse(err, requestId)
    return errorResponse(err, log, 'calls.feedback.failed', requestId)
  }
}
