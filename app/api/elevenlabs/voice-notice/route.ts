// POST /api/elevenlabs/voice-notice — ElevenLabs workspace webhook for the
// event `voice_library_removal_notice` (types voice_removal_notice,
// voice_removal_notice_withdrawn, voice_removed). Dedicated HMAC webhook (its
// own secret: ELEVENLABS_VOICE_NOTICE_WEBHOOK_SECRET), verified exactly like
// the post-call webhook (lib/elevenlabs/webhook.ts verifyElevenLabsSignature)
// and fails closed without a secret. A delivery only triggers the lifecycle
// check of the named voices after the response; the daily poll stays the
// source of truth. Manual setup: docs/elevenlabs/F.md.

import { NextResponse } from 'next/server'
import { verifyElevenLabsSignature } from '@/lib/elevenlabs/webhook'
import { createLogger, requestIdFrom } from '@/lib/observability/logger'
import { deferBackground, emitProviderEvent } from '@/lib/observability/telemetry'
import { allowUnsignedWebhooks } from '@/lib/voice-providers/config'
import { VOICE_NOTICE_TYPES, payloadShape, processVoiceNotice, readVoiceNotice, recordVoiceNotice } from '@/lib/voice-providers/voice-notice'

const MAX_BODY_BYTES = 256 * 1024

export async function POST(request: Request) {
  const requestId = requestIdFrom(request)
  const log = createLogger({ requestId, route: 'webhooks.elevenlabs.voice_notice', provider: 'elevenlabs' })

  const declared = Number(request.headers.get('content-length') ?? '0')
  if (declared > MAX_BODY_BYTES) return NextResponse.json({ error: 'payload_too_large' }, { status: 413 })
  const raw = await request.text()
  if (raw.length > MAX_BODY_BYTES) return NextResponse.json({ error: 'payload_too_large' }, { status: 413 })

  const secret = (process.env.ELEVENLABS_VOICE_NOTICE_WEBHOOK_SECRET ?? '').trim()
  if (!secret && !allowUnsignedWebhooks()) {
    log.error('voice_notice.secret_missing', null)
    emitProviderEvent({ system: 'elevenlabs', kind: 'webhook_verification_failed', ok: false, errorCode: 'not_configured' })
    return NextResponse.json({ error: 'not_configured' }, { status: 503 })
  }
  if (secret) {
    const check = verifyElevenLabsSignature(raw, request.headers.get('elevenlabs-signature'), secret)
    if (!check.ok) {
      log.warn('voice_notice.signature_invalid', { reason: check.reason })
      emitProviderEvent({ system: 'elevenlabs', kind: 'webhook_verification_failed', ok: false, details: { reason: check.reason } })
      return NextResponse.json({ error: 'invalid_signature' }, { status: 401 })
    }
  }

  let body: unknown
  try {
    body = JSON.parse(raw)
  } catch (err) {
    log.warn('voice_notice.invalid_json', { message: err instanceof Error ? err.message.slice(0, 100) : 'parse error' })
    return NextResponse.json({ error: 'invalid_json' }, { status: 400 })
  }

  const notice = readVoiceNotice(body)
  // Keys only (never values): the payload format is undocumented.
  log.info('voice_notice.received', { type: notice.type, voices: notice.voiceIds.length, shape: payloadShape(body) })
  if (!VOICE_NOTICE_TYPES.has(notice.type)) return NextResponse.json({ received: true, ignored: true })

  try {
    const { id, isNew } = await recordVoiceNotice(notice)
    if (isNew) deferBackground(processVoiceNotice(id, notice, log))
    return NextResponse.json({ received: true, duplicate: !isNew })
  } catch (err) {
    // Not stored: 5xx so ElevenLabs retries the delivery.
    log.error('voice_notice.ingest_failed', err)
    return NextResponse.json({ error: 'temporarily_unavailable' }, { status: 503 })
  }
}
