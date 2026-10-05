// Cartesia call-event webhooks (call_started, call_completed, call_failed,
// post_call_analysis). Cartesia authenticates deliveries with a static shared
// secret (x-webhook-secret) and keeps webhook_request_id stable across its
// retries: we compare in constant time and dedupe on that id. Because
// managed-agent webhooks are not guaranteed, the maintenance job also polls
// Cartesia for fallback calls (lib/voice-providers/cartesia-poll.ts).
import { NextResponse } from 'next/server'
import { createLogger, requestIdFrom } from '@/lib/observability/logger'
import { emitProviderEvent } from '@/lib/observability/telemetry'
import { allowUnsignedWebhooks } from '@/lib/voice-providers/config'
import { ingestWebhookEvent, processAfterResponse } from '@/lib/voice-providers/webhook-ingest'
import { readCartesiaEnvelope, verifyCartesiaSecret } from '@/lib/cartesia/webhook'

const MAX_BODY_BYTES = 2 * 1024 * 1024
const HANDLED = new Set(['call_started', 'call_completed', 'call_failed', 'post_call_analysis'])

export async function POST(request: Request) {
  const requestId = requestIdFrom(request)
  const log = createLogger({ requestId, route: 'webhooks.cartesia', provider: 'cartesia' })

  const declared = Number(request.headers.get('content-length') ?? '0')
  if (declared > MAX_BODY_BYTES) return NextResponse.json({ error: 'payload_too_large' }, { status: 413 })

  const secret = (process.env.CARTESIA_WEBHOOK_SECRET ?? '').trim()
  if (!secret && !allowUnsignedWebhooks()) {
    log.error('webhook.secret_missing', null)
    emitProviderEvent({ system: 'cartesia', kind: 'webhook_verification_failed', ok: false, errorCode: 'not_configured' })
    return NextResponse.json({ error: 'not_configured' }, { status: 503 })
  }
  if (secret && !verifyCartesiaSecret(request.headers.get('x-webhook-secret'), secret)) {
    log.warn('webhook.secret_invalid')
    emitProviderEvent({ system: 'cartesia', kind: 'webhook_verification_failed', ok: false })
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }

  const raw = await request.text()
  if (raw.length > MAX_BODY_BYTES) return NextResponse.json({ error: 'payload_too_large' }, { status: 413 })
  let body: unknown
  try {
    body = JSON.parse(raw)
  } catch (err) {
    log.warn('webhook.invalid_json', { message: err instanceof Error ? err.message.slice(0, 100) : 'parse error' })
    return NextResponse.json({ error: 'invalid_json' }, { status: 400 })
  }

  const env = readCartesiaEnvelope(body)
  const l = log.child({ eventType: env.type, providerCallId: env.callId, externalAgentId: env.agentId })
  if (!HANDLED.has(env.type) || !env.callId) {
    l.info('webhook.ignored_event')
    return NextResponse.json({ received: true, ignored: true })
  }
  emitProviderEvent({ system: 'cartesia', kind: 'webhook_received', ok: true, details: { type: env.type } })

  try {
    const res = await ingestWebhookEvent({
      provider: 'cartesia',
      eventType: env.type,
      // webhook_request_id is stable across Cartesia's retries; fall back to
      // type + call id (one event of each type per call).
      dedupeKey: env.requestId ? `req:${env.requestId}` : `${env.type}:${env.callId}`,
      externalId: env.callId,
      payload: body,
    })
    if (res.status !== 'duplicate') processAfterResponse(res.id, l)
    l.info('webhook.accepted', { status: res.status })
    return NextResponse.json({ received: true, duplicate: res.status === 'duplicate' })
  } catch (err) {
    l.error('webhook.ingest_failed', err)
    return NextResponse.json({ error: 'temporarily_unavailable' }, { status: 503 })
  }
}
