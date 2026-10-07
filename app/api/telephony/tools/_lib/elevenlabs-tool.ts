// Shared authentication and responses for the ElevenLabs platform webhook
// tools (app/api/telephony/tools/*). Private folder: not a route.
//
// Every platform tool request carries two headers (lib/elevenlabs/tools/webhook-tool.ts):
//   X-NTV-Tool-Key    the workspace secret (ELEVENLABS_TOOL_SECRET), compared in
//                     constant time (current key, or the previous one during a
//                     rotation): proves the request comes from our workspace;
//   X-NTV-Call-Token  the per-call 'tool' token: binds the request to ONE call,
//                     so a tool can never act on another tenant's call.
// Nothing from the body (LLM-provided) is ever trusted for identity.
//
// Status codes: 401 only when the request is not authenticated (no or wrong
// workspace key, no credentials at all), with a generic body. A valid workspace
// request with an invalid/expired call token gets 200 {ok:false, message}, so
// the agent follows the guidance (offer to take a message) instead of failing.

import { NextResponse } from 'next/server'
import { verifyCallToken } from '@/lib/telephony/tokens'
import { emitProviderEvent } from '@/lib/observability/telemetry'
import type { Logger } from '@/lib/observability/logger'
import { rateLimit, type RateLimitRule } from '@/lib/security/rate-limit'
import { CALL_TOKEN_HEADER, TOOL_KEY_HEADER } from '@/lib/elevenlabs/tools/webhook-tool'
import { checkToolKey, toolSecretRequired } from '@/lib/elevenlabs/tools/secret-config'
import type { PlatformToolKey } from '@/lib/elevenlabs/tools/definitions'
import { isReadyRow, pinnedResourceId, readResourceRow } from '@/lib/voice-providers/platform-resources'

export type ToolAuth =
  | { ok: true; callId: string; via: 'header' | 'legacy_body' }
  | { ok: false; status: 401; reason: 'missing_credentials' | 'bad_tool_key' | 'tool_key_not_configured' }
  | { ok: false; status: 200; reason: 'invalid_call_token' }

/** JSON answer for a tool request: never cached. */
export function toolJson(body: { ok: boolean; message: string }, status = 200): NextResponse {
  return NextResponse.json(body, { status, headers: { 'Cache-Control': 'no-store' } })
}

const LEGACY_RECHECK_MS = 30_000
const legacyState = new Map<PlatformToolKey, { open: boolean; at: number }>()

/** Test helper. */
export function resetLegacyToolAuthState(): void {
  legacyState.clear()
}

/**
 * Before this platform version, the transfer tool sent the call token in its
 * BODY (ntv_call_token, purpose 'transfer'). Until the reconcile PATCHes the
 * existing workspace tool to header authentication, those requests are still
 * accepted, so transfers keep working right after a deploy. Open only while a
 * stored tool exists whose config is not ours yet (details.auth !== 'headers');
 * once closed it stays closed on this instance. Fails closed.
 */
export async function legacyBodyAuthAllowed(key: PlatformToolKey, log: Logger): Promise<boolean> {
  const cached = legacyState.get(key)
  if (cached && (!cached.open || Date.now() - cached.at < LEGACY_RECHECK_MS)) return cached.open
  let open = false
  try {
    const row = await readResourceRow(key)
    const pinned = pinnedResourceId(key)
    const reconciled = isReadyRow(row) && row.details.auth === 'headers' && (!pinned || row.external_id === pinned)
    open = !reconciled && (isReadyRow(row) || !!pinned)
  } catch (err) {
    log.error('tools.legacy_auth_check_failed', err, { key })
    return false
  }
  legacyState.set(key, { open, at: Date.now() })
  return open
}

/**
 * Authenticates a platform tool request. `legacyBodyToken` is the body
 * call_token a not-yet-reconciled transfer tool still sends (see above).
 */
export async function authenticateToolRequest(
  request: Request,
  opts: { key: PlatformToolKey; route: string; log: Logger; legacyBodyToken?: string | null },
): Promise<ToolAuth> {
  const token = request.headers.get(CALL_TOKEN_HEADER)
  if (token) {
    const keyCheck = checkToolKey(request.headers.get(TOOL_KEY_HEADER))
    if (keyCheck === 'invalid' || (keyCheck === 'not_configured' && toolSecretRequired())) {
      const reason = keyCheck === 'invalid' ? 'bad_tool_key' : 'tool_key_not_configured'
      emitProviderEvent({ system: 'elevenlabs', kind: 'webhook_verification_failed', ok: false, details: { path: opts.route, reason } })
      opts.log.warn('tools.unauthorized', { reason })
      return { ok: false, status: 401, reason }
    }
    const callId = verifyCallToken(token, 'tool')
    if (!callId) {
      opts.log.warn('tools.call_token_invalid')
      return { ok: false, status: 200, reason: 'invalid_call_token' }
    }
    return { ok: true, callId, via: 'header' }
  }
  if (opts.legacyBodyToken && (await legacyBodyAuthAllowed(opts.key, opts.log))) {
    const callId = verifyCallToken(opts.legacyBodyToken, 'transfer')
    if (!callId) {
      opts.log.warn('tools.legacy_call_token_invalid')
      return { ok: false, status: 200, reason: 'invalid_call_token' }
    }
    opts.log.info('tools.legacy_body_auth', { route: opts.route })
    return { ok: true, callId, via: 'legacy_body' }
  }
  emitProviderEvent({ system: 'elevenlabs', kind: 'webhook_verification_failed', ok: false, details: { path: opts.route, reason: 'missing_credentials' } })
  opts.log.warn('tools.unauthorized', { reason: 'missing_credentials' })
  return { ok: false, status: 401, reason: 'missing_credentials' }
}

/**
 * Per-call budget for a tool that acts on the live call (Twilio API calls):
 * a looping agent cannot hammer the carrier. Never throws (the DB-backed
 * limiter falls back to memory); false = over the budget.
 */
export async function allowToolCall(tool: string, callId: string, limit = 6, windowSeconds = 600): Promise<boolean> {
  const rule: RateLimitRule = { name: `tool_${tool}`, limit, windowSeconds }
  return (await rateLimit(rule, callId)).allowed
}

/** LLM-written free text stored with the call: one line, no long digit runs (phone/card numbers), capped. */
export function sanitizeToolText(raw: string, max = 200): string {
  return raw
    .replace(/\p{Cc}/gu, ' ')
    .replace(/\+?\d[\d\s().-]{4,}\d/g, '[number]')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, max)
}
