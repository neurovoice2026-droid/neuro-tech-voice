// Webhook tool `take_message` for the Cartesia fallback agent (slice B2).
// Auth: static bearer token (CARTESIA_TOOL_SECRET) configured on the tool.
// The call, and so the organisation and the alert recipients, is resolved
// from the called number and the caller id (body fields bound to the Cartesia
// system variables, like get_call_context), never from the message
// parameters. Those fields are not signed, so the match is strict
// (lib/voice-tools/cartesia-call.ts): an in-progress Cartesia call on that
// org's line, started within the last 60 minutes, with BOTH numbers matching.
// Same handler, idempotency and e-mail alert as the ElevenLabs tool.
import { NextResponse } from 'next/server'
import { z } from 'zod'
import { createAdminClient } from '@/lib/supabase/admin'
import { createLogger, requestIdFrom } from '@/lib/observability/logger'
import { RequestError, parseJsonBody } from '@/lib/api/http'
import { emitProviderEvent } from '@/lib/observability/telemetry'
import { contextFailureMessage, loadToolCallContext } from '@/lib/voice-tools/call-context'
import { findLiveCartesiaCall } from '@/lib/voice-tools/cartesia-call'
import { takeMessageTool } from '@/lib/voice-tools/message-tools'
import { allowToolCall } from '../_lib/elevenlabs-tool'
import { answerJson } from '../_lib/business-tool'
import { cartesiaToolAuthorized } from '../_lib/cartesia-tool'

const Body = z
  .object({
    called_number: z.string().max(64).optional(),
    caller_number: z.string().max(64).optional(),
  })
  .catchall(z.unknown())

const FAILED = "The message couldn't be saved right now. Repeat the details back to the caller (they are kept in the call record) and tell them the team will call back."

export async function POST(request: Request) {
  const requestId = requestIdFrom(request)
  const log = createLogger({ requestId, route: 'tools.cartesia_message', provider: 'cartesia' })
  if (!cartesiaToolAuthorized(request)) {
    emitProviderEvent({ system: 'cartesia', kind: 'webhook_verification_failed', ok: false, details: { path: 'tools/cartesia-message' } })
    log.warn('tools.message_unauthorized')
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }
  let body: z.infer<typeof Body>
  try {
    body = await parseJsonBody(request, Body, 8 * 1024)
  } catch (err) {
    if (err instanceof RequestError) return answerJson({ ok: false, message: FAILED }, err.status)
    log.error('tools.message_body_failed', err)
    return answerJson({ ok: false, message: FAILED }, 400)
  }

  try {
    const { called_number: calledNumber, caller_number: callerNumber, ...args } = body
    const db = createAdminClient()
    const callId = await findLiveCartesiaCall(db, { calledNumber: calledNumber ?? null, callerNumber: callerNumber ?? null })
    if (!callId) {
      log.warn('tools.message_call_not_found')
      return answerJson({ ok: false, message: contextFailureMessage('not_found') })
    }
    const l = log.child({ callId })
    if (!(await allowToolCall('take_message', callId, 5, 600))) {
      l.warn('tools.rate_limited')
      return answerJson({ ok: false, message: 'Do not call take_message again on this call; take the caller’s details by voice instead.' })
    }
    const ctx = await loadToolCallContext(callId, { db, log: l })
    if (typeof ctx === 'string') {
      l.warn('tools.context_unavailable', { reason: ctx })
      return answerJson({ ok: false, message: contextFailureMessage(ctx) })
    }
    return answerJson(await takeMessageTool(ctx, args, l.child({ orgId: ctx.org.id, agentId: ctx.agent.id }), 'cartesia'))
  } catch (err) {
    log.error('tools.message_failed', err)
    return answerJson({ ok: false, message: FAILED })
  }
}
