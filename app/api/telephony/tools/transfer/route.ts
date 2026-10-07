// Webhook tool `transfer_to_human` (ElevenLabs agent on an app-routed call).
// Authenticated by the workspace key header and the signed, purpose-bound
// per-call token header (see ../_lib/elevenlabs-tool.ts): the token binds the
// request to exactly one call, so the tool cannot redirect anyone else's call.
// The destination always comes from our database, never from the request.
//
// Expected failures (invalid or expired call token, call not transferable,
// transfers off, no destination, too many attempts) answer HTTP 200
// {ok:false, message}: the tool uses tool_error_handling_mode 'passthrough' and
// a response filter on {ok, message}, so the agent reads the guidance and
// offers to take a message. 4xx only for malformed or unauthenticated
// requests, with a generic body. Details stay in our logs.
import { z } from 'zod'
import { createLogger, requestIdFrom } from '@/lib/observability/logger'
import { RequestError, parseJsonBody } from '@/lib/api/http'
import { transferLiveCall } from '@/lib/telephony/router'
import { allowToolCall, authenticateToolRequest, sanitizeToolText, toolJson } from '../_lib/elevenlabs-tool'

const Body = z.object({
  /** Legacy tool config only (body token, before the reconcile switched it to headers). */
  call_token: z.string().min(10).max(512).optional(),
  reason: z.string().max(500).optional().default(''),
})

const FAILED = 'I could not transfer the call right now. Offer to take a message instead.'
const TOO_MANY = 'The transfer cannot be retried right now. Offer to take a message instead.'

export async function POST(request: Request) {
  const requestId = requestIdFrom(request)
  const log = createLogger({ requestId, route: 'tools.transfer' })
  let body: z.infer<typeof Body>
  try {
    body = await parseJsonBody(request, Body, 8 * 1024)
  } catch (err) {
    if (err instanceof RequestError) {
      log.warn('tools.transfer_bad_request', { code: err.code })
      return toolJson({ ok: false, message: FAILED }, err.status)
    }
    log.error('tools.transfer_body_failed', err)
    return toolJson({ ok: false, message: FAILED }, 400)
  }

  const auth = await authenticateToolRequest(request, { key: 'elevenlabs.transfer_tool', route: 'tools/transfer', log, legacyBodyToken: body.call_token })
  if (!auth.ok) return toolJson({ ok: false, message: FAILED }, auth.status)

  const l = log.child({ callId: auth.callId })
  if (!(await allowToolCall('transfer', auth.callId))) {
    l.warn('tools.transfer_rate_limited')
    return toolJson({ ok: false, message: TOO_MANY })
  }
  try {
    const res = await transferLiveCall(auth.callId, sanitizeToolText(body.reason), l)
    l.info('tools.transfer', { ok: res.ok, via: auth.via })
    return toolJson(res)
  } catch (err) {
    l.error('tools.transfer_failed', err)
    return toolJson({ ok: false, message: FAILED })
  }
}
