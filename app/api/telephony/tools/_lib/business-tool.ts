// Shared request handling for the in-call business tools
// (check_availability, book_appointment, take_message). Private folder: not
// a route.
//
// Order: body (size-limited JSON object) → platform authentication (workspace
// key + per-call tool token, ./elevenlabs-tool.ts) → per-call budget → call
// context resolved from the token's call id (org, agent, settings; ended
// calls rejected) → the tool. The body is the model's arguments only: no id,
// org, calendar, recipient or phone number in it is ever trusted.
//
// Status codes: 401 only for unauthenticated requests (generic body); 400 /
// 413 / 415 for malformed bodies; every expected failure is HTTP 200
// {ok:false, message} with safe guidance (tool_error_handling_mode
// 'passthrough' lets the agent read it).

import { NextResponse } from 'next/server'
import { z } from 'zod'
import { createLogger, requestIdFrom, type Logger } from '@/lib/observability/logger'
import { RequestError, parseJsonBody } from '@/lib/api/http'
import type { PlatformToolKey } from '@/lib/elevenlabs/tools/definitions'
import { contextFailureMessage, loadToolCallContext, type ToolCallContext } from '@/lib/voice-tools/call-context'
import type { ToolAnswer } from '@/lib/voice-tools/invocations'
import { allowToolCall, authenticateToolRequest } from './elevenlabs-tool'

const Args = z.record(z.string(), z.unknown())

/** JSON answer for a tool request: never cached. */
export function answerJson(body: ToolAnswer, status = 200): NextResponse {
  return NextResponse.json(body, { status, headers: { 'Cache-Control': 'no-store' } })
}

const GENERIC_FAILURE = 'This could not be done right now. Apologise briefly, repeat the details back to the caller and tell them the team will follow up.'
const TOO_MANY = 'This tool has been used too many times on this call. Do not call it again; take the caller’s details by voice instead.'

export interface BusinessToolRoute {
  key: PlatformToolKey
  /** Rate-limit bucket suffix and log name, e.g. 'check_availability'. */
  tool: string
  /** Requests per call per 10 minutes. */
  perCallLimit: number
  run: (ctx: ToolCallContext, args: Record<string, unknown>, log: Logger) => Promise<ToolAnswer>
}

export async function handleBusinessToolRequest(request: Request, route: BusinessToolRoute): Promise<NextResponse> {
  const requestId = requestIdFrom(request)
  const log = createLogger({ requestId, route: `tools.${route.tool}` })
  let args: Record<string, unknown>
  try {
    args = await parseJsonBody(request, Args, 8 * 1024)
  } catch (err) {
    if (err instanceof RequestError) {
      log.warn('tools.bad_request', { code: err.code })
      return answerJson({ ok: false, message: GENERIC_FAILURE }, err.status)
    }
    log.error('tools.body_failed', err)
    return answerJson({ ok: false, message: GENERIC_FAILURE }, 400)
  }

  const auth = await authenticateToolRequest(request, { key: route.key, route: `tools/${route.tool}`, log })
  if (!auth.ok) {
    return answerJson({ ok: false, message: auth.status === 200 ? contextFailureMessage('not_found') : GENERIC_FAILURE }, auth.status)
  }
  const l = log.child({ callId: auth.callId })
  if (!(await allowToolCall(route.tool, auth.callId, route.perCallLimit, 600))) {
    l.warn('tools.rate_limited')
    return answerJson({ ok: false, message: TOO_MANY })
  }
  try {
    const ctx = await loadToolCallContext(auth.callId, { log: l })
    if (typeof ctx === 'string') {
      l.warn('tools.context_unavailable', { reason: ctx })
      return answerJson({ ok: false, message: contextFailureMessage(ctx) })
    }
    const answer = await route.run(ctx, args, l.child({ orgId: ctx.org.id, agentId: ctx.agent.id }))
    return answerJson(answer)
  } catch (err) {
    l.error('tools.failed', err)
    return answerJson({ ok: false, message: GENERIC_FAILURE })
  }
}
