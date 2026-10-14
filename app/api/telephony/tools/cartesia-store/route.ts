// Webhook tool `store_assistant` for the Cartesia fallback agent (e-commerce
// vertical): the six store tools behind one `action` parameter. Auth: static
// bearer token (CARTESIA_TOOL_SECRET); the call is resolved from the called
// number and the caller id (lib/voice-tools/cartesia-call.ts), never from the
// arguments. Same handlers, idempotency and answers as the ElevenLabs tools.
import { NextResponse } from 'next/server'
import { z } from 'zod'
import { createAdminClient } from '@/lib/supabase/admin'
import { createLogger, requestIdFrom } from '@/lib/observability/logger'
import { RequestError, parseJsonBody } from '@/lib/api/http'
import { emitProviderEvent } from '@/lib/observability/telemetry'
import { contextFailureMessage, loadToolCallContext } from '@/lib/voice-tools/call-context'
import { findLiveCartesiaCall } from '@/lib/voice-tools/cartesia-call'
import { COMMERCE_TOOL_HANDLERS, isCommerceToolName } from '@/lib/commerce/tools/handlers'
import { allowToolCall } from '../_lib/elevenlabs-tool'
import { answerJson } from '../_lib/business-tool'
import { cartesiaToolAuthorized } from '../_lib/cartesia-tool'

const Body = z
  .object({
    called_number: z.string().max(64).optional(),
    caller_number: z.string().max(64).optional(),
    action: z.string().max(64),
  })
  .catchall(z.unknown())

const FAILED = 'This could not be done right now. Apologise briefly and tell the customer the store team will follow up.'

export async function POST(request: Request) {
  const requestId = requestIdFrom(request)
  const log = createLogger({ requestId, route: 'tools.cartesia_store', provider: 'cartesia' })
  if (!cartesiaToolAuthorized(request)) {
    emitProviderEvent({ system: 'cartesia', kind: 'webhook_verification_failed', ok: false, details: { path: 'tools/cartesia-store' } })
    log.warn('tools.store_unauthorized')
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }
  let body: z.infer<typeof Body>
  try {
    body = await parseJsonBody(request, Body, 8 * 1024)
  } catch (err) {
    if (err instanceof RequestError) return answerJson({ ok: false, message: FAILED }, err.status)
    log.error('tools.store_body_failed', err)
    return answerJson({ ok: false, message: FAILED }, 400)
  }
  try {
    const { called_number: calledNumber, caller_number: callerNumber, action, ...args } = body
    if (!isCommerceToolName(action)) return answerJson({ ok: false, message: 'Unknown action. Use one of: get_order_status, get_order_items, get_product_availability, record_cod_confirmation, record_callback_request, mark_do_not_call.' })
    const db = createAdminClient()
    const callId = await findLiveCartesiaCall(db, { calledNumber: calledNumber ?? null, callerNumber: callerNumber ?? null })
    if (!callId) {
      log.warn('tools.store_call_not_found')
      return answerJson({ ok: false, message: contextFailureMessage('not_found') })
    }
    const l = log.child({ callId })
    if (!(await allowToolCall(`store_${action}`, callId, 12, 600))) {
      l.warn('tools.rate_limited', { action })
      return answerJson({ ok: false, message: 'This tool has been used too many times on this call. Do not call it again.' })
    }
    const ctx = await loadToolCallContext(callId, { db, log: l })
    if (typeof ctx === 'string') {
      l.warn('tools.context_unavailable', { reason: ctx })
      return answerJson({ ok: false, message: contextFailureMessage(ctx) })
    }
    return answerJson(await COMMERCE_TOOL_HANDLERS[action](ctx, args, l.child({ orgId: ctx.org.id, agentId: ctx.agent.id })))
  } catch (err) {
    log.error('tools.store_failed', err)
    return answerJson({ ok: false, message: FAILED })
  }
}
