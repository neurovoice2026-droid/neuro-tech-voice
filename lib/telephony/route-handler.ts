import 'server-only'
// Shared wrapper for every Twilio webhook route: signature validation (form
// body + exact public URL), optional purpose-bound call token, structured
// logging and a safe response when the handler fails.
//
// onError:
//   'retry'  → 500, so Twilio invokes the number's voiceFallbackUrl (inbound)
//              or records the failure in its debugger (status callbacks);
//   'hangup' → valid TwiML that ends the call cleanly (action/redirect URLs
//              have no Twilio-side fallback; a 5xx would play Twilio's
//              generic "application error" message to the caller).

import { createLogger, requestIdFrom, type Logger } from '@/lib/observability/logger'
import { readTwilioRequest, TwilioRequestError } from './twilio-request'
import { verifyCallToken, type CallTokenPurpose } from './tokens'
import { hangup, twimlResponse } from './twiml'

export interface TwilioRouteContext {
  params: Record<string, string>
  url: URL
  log: Logger
  /** calls.id from the verified `t` token (only when `token` is configured). */
  callId: string | null
}

export function twilioRoute(
  route: string,
  run: (ctx: TwilioRouteContext) => Promise<string | null>,
  opts: { onError: 'retry' | 'hangup'; token?: CallTokenPurpose },
): (request: Request) => Promise<Response> {
  return async function handler(request: Request): Promise<Response> {
    const requestId = requestIdFrom(request)
    const log = createLogger({ requestId, route })
    const url = new URL(request.url)

    let params: Record<string, string>
    try {
      params = (await readTwilioRequest(request)).params
    } catch (err) {
      if (err instanceof TwilioRequestError) {
        log.warn('twilio.request_rejected', { status: err.status, reason: err.message })
        return new Response(null, { status: err.status })
      }
      log.error('twilio.request_read_failed', err)
      return new Response(null, { status: 400 })
    }

    let callId: string | null = null
    if (opts.token) {
      callId = verifyCallToken(url.searchParams.get('t'), opts.token)
      if (!callId) {
        log.warn('twilio.call_token_invalid', { purpose: opts.token, callSid: params.CallSid ?? null })
        return new Response(null, { status: 403 })
      }
    }

    const l = log.child({ callSid: params.CallSid ?? null, ...(callId ? { callId } : {}) })
    try {
      const xml = await run({ params, url, log: l, callId })
      return xml === null ? new Response(null, { status: 204 }) : twimlResponse(xml)
    } catch (err) {
      l.error('twilio.handler_failed', err)
      if (opts.onError === 'retry') return new Response(null, { status: 500 })
      return twimlResponse(hangup())
    }
  }
}
