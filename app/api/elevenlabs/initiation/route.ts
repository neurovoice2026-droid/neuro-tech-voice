// POST /api/elevenlabs/initiation — the conversation initiation webhook of
// agents with native numbers (platform_settings.workspace_overrides.
// conversation_initiation_client_data_webhook, lib/telephony/initiation-config.ts).
//
// Machine-to-machine (public prefix in proxy.ts): authenticated by the
// X-NTV-Tool-Key header, a workspace secret ElevenLabs resolves from the
// secret id in the agent config (ELEVENLABS_TOOL_SECRET, compared in constant
// time, the previous key accepted during a rotation). Fails closed: no key
// configured → 401. The request body is validated; the organization is
// resolved from the agent id only (lib/telephony/initiation.ts).
//
// It runs while the caller's phone is ringing: no provider call, a deadline,
// and an answer with neutral placeholders rather than an error whenever the
// request is authentic.
import { NextResponse } from 'next/server'
import { z } from 'zod'
import { createLogger, requestIdFrom } from '@/lib/observability/logger'
import { emitProviderEvent } from '@/lib/observability/telemetry'
import { checkToolKey } from '@/lib/elevenlabs/tools/secret-config'
import { INITIATION_KEY_HEADER } from '@/lib/elevenlabs/api/telephony'
import { handleInitiation } from '@/lib/telephony/initiation'
import { maskPhone, normalizeE164 } from '@/lib/phone/e164'

export const maxDuration = 10

const MAX_BODY_BYTES = 16 * 1024
const id = (max: number) => z.string().trim().regex(/^[A-Za-z0-9_-]+$/).max(max)
const phone = z.string().trim().max(64)

const Body = z.object({
  agent_id: id(128),
  caller_id: phone.nullish(),
  called_number: phone.nullish(),
  call_sid: id(64).nullish(),
  conversation_id: id(128).nullish(),
})

const NO_STORE = { 'Cache-Control': 'no-store' }

function masked(raw: string | null | undefined): string | null {
  const e164 = normalizeE164(raw ?? '')
  return e164 ? maskPhone(e164) : null
}

export async function POST(request: Request) {
  const requestId = requestIdFrom(request)
  const log = createLogger({ requestId, route: 'elevenlabs.initiation', provider: 'elevenlabs' })

  const key = checkToolKey(request.headers.get(INITIATION_KEY_HEADER))
  if (key !== 'valid') {
    if (key === 'not_configured') log.error('initiation.key_not_configured', null)
    else log.warn('initiation.unauthorized')
    emitProviderEvent({ system: 'elevenlabs', kind: 'webhook_verification_failed', ok: false, details: { path: 'elevenlabs/initiation', reason: key } })
    return NextResponse.json({ error: 'unauthorized' }, { status: 401, headers: NO_STORE })
  }

  const declared = Number(request.headers.get('content-length') ?? '0')
  if (declared > MAX_BODY_BYTES) return NextResponse.json({ error: 'payload_too_large' }, { status: 413, headers: NO_STORE })
  const raw = await request.text()
  if (raw.length > MAX_BODY_BYTES) return NextResponse.json({ error: 'payload_too_large' }, { status: 413, headers: NO_STORE })

  // JSON per the docs; form-encoded accepted as well (the format is not specified).
  let input: unknown
  const contentType = (request.headers.get('content-type') ?? '').toLowerCase()
  if (contentType.includes('application/x-www-form-urlencoded')) {
    input = Object.fromEntries(new URLSearchParams(raw))
  } else {
    try {
      input = raw ? JSON.parse(raw) : {}
    } catch (err) {
      log.warn('initiation.invalid_json', { message: err instanceof Error ? err.message.slice(0, 100) : 'parse error' })
      return NextResponse.json({ error: 'invalid_json' }, { status: 400, headers: NO_STORE })
    }
  }
  const parsed = Body.safeParse(input)
  if (!parsed.success) {
    log.warn('initiation.invalid_body', { issues: parsed.error.issues.slice(0, 5).map((i) => i.path.join('.')) })
    return NextResponse.json({ error: 'invalid_request' }, { status: 400, headers: NO_STORE })
  }

  const body = parsed.data
  const l = log.child({
    externalAgentId: body.agent_id,
    callSid: body.call_sid ?? null,
    conversationId: body.conversation_id ?? null,
    caller: masked(body.caller_id),
    called: masked(body.called_number),
  })
  const started = Date.now()
  const res = await handleInitiation(body, l)
  l.info('initiation.answered', { outcome: res.outcome, ms: Date.now() - started })
  return NextResponse.json(res.body, { status: 200, headers: NO_STORE })
}
