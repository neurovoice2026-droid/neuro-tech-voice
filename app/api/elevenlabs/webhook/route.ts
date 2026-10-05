// ElevenLabs post-call webhooks (post_call_transcription, post_call_audio,
// call_initiation_failure).
//   • HMAC signature over the RAW body (ElevenLabs-Signature: t=..,v0=..),
//     30-minute tolerance — fails closed when no secret is configured;
//   • persisted with a unique (provider, type:conversation_id) key, so
//     provider retries are idempotent; processing happens after the 2xx;
//   • a later/partial event (audio) never downgrades a completed call
//     (lib/voice-providers/call-merge.ts).
import { NextResponse } from 'next/server'
import { createLogger, requestIdFrom } from '@/lib/observability/logger'
import { emitProviderEvent } from '@/lib/observability/telemetry'
import { allowUnsignedWebhooks } from '@/lib/voice-providers/config'
import { ingestWebhookEvent, processAfterResponse } from '@/lib/voice-providers/webhook-ingest'
import { elevenLabsDedupeKey, readEnvelope, verifyElevenLabsSignature } from '@/lib/elevenlabs/webhook'

// post_call_audio carries base64 audio; we do not subscribe to it, but bound
// what we read regardless (the platform caps bodies at 4.5 MB anyway).
const MAX_BODY_BYTES = 4 * 1024 * 1024
const HANDLED = new Set(['post_call_transcription', 'post_call_audio', 'call_initiation_failure'])

export async function POST(request: Request) {
  const requestId = requestIdFrom(request)
  const log = createLogger({ requestId, route: 'webhooks.elevenlabs', provider: 'elevenlabs' })

  const declared = Number(request.headers.get('content-length') ?? '0')
  if (declared > MAX_BODY_BYTES) return NextResponse.json({ error: 'payload_too_large' }, { status: 413 })
  const raw = await request.text()
  if (raw.length > MAX_BODY_BYTES) return NextResponse.json({ error: 'payload_too_large' }, { status: 413 })

  const secret = (process.env.ELEVENLABS_WEBHOOK_SECRET ?? '').trim()
  if (!secret && !allowUnsignedWebhooks()) {
    log.error('webhook.secret_missing', null)
    emitProviderEvent({ system: 'elevenlabs', kind: 'webhook_verification_failed', ok: false, errorCode: 'not_configured' })
    return NextResponse.json({ error: 'not_configured' }, { status: 503 })
  }
  if (secret) {
    const check = verifyElevenLabsSignature(raw, request.headers.get('elevenlabs-signature'), secret)
    if (!check.ok) {
      log.warn('webhook.signature_invalid', { reason: check.reason })
      emitProviderEvent({ system: 'elevenlabs', kind: 'webhook_verification_failed', ok: false, details: { reason: check.reason } })
      return NextResponse.json({ error: 'invalid_signature' }, { status: 401 })
    }
  }

  let body: unknown
  try {
    body = JSON.parse(raw)
  } catch (err) {
    log.warn('webhook.invalid_json', { message: err instanceof Error ? err.message.slice(0, 100) : 'parse error' })
    return NextResponse.json({ error: 'invalid_json' }, { status: 400 })
  }

  const env = readEnvelope(body)
  const l = log.child({ eventType: env.type, conversationId: env.conversationId, externalAgentId: env.agentId })
  if (!HANDLED.has(env.type) || !env.conversationId) {
    l.info('webhook.ignored_event')
    return NextResponse.json({ received: true, ignored: true })
  }
  emitProviderEvent({ system: 'elevenlabs', kind: 'webhook_received', ok: true, details: { type: env.type } })

  try {
    const res = await ingestWebhookEvent({
      provider: 'elevenlabs',
      eventType: env.type,
      dedupeKey: elevenLabsDedupeKey(env),
      externalId: env.conversationId,
      payload: body,
    })
    if (res.status !== 'duplicate') processAfterResponse(res.id, l)
    l.info('webhook.accepted', { status: res.status })
    return NextResponse.json({ received: true, duplicate: res.status === 'duplicate' })
  } catch (err) {
    // Not stored: answer 5xx so ElevenLabs retries the delivery.
    l.error('webhook.ingest_failed', err)
    return NextResponse.json({ error: 'temporarily_unavailable' }, { status: 503 })
  }
}
