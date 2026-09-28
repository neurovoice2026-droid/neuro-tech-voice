import { after, NextResponse, type NextRequest } from 'next/server'
import { ApiError, handleRoute, readBodyText } from '@/lib/api/http'
import { env, isElevenLabsWebhookConfigured, isSupabaseAdminConfigured } from '@/lib/env'
import { kvIncr } from '@/lib/kv'
import { clientIp, enforceRateLimit, RATE_LIMITS } from '@/lib/security/rate-limit'
import { handleInitiationFailure, handleTranscription } from './handlers'
import {
  mapInitiationFailureEvent,
  mapTranscriptionEvent,
  verifyElevenLabsSignature,
  WebhookEnvelopeSchema,
} from './payload'

// POST /api/elevenlabs/webhook — ElevenLabs post-call events.
// Fails closed: no secret configured → 503, bad signature → 401. Verified
// events are acknowledged with 200 right away (ElevenLabs disables webhooks
// that keep failing) and stored in after(). Redeliveries are dropped for 24 h.

export const runtime = 'nodejs'
export const maxDuration = 300

// Transcripts are small; post_call_audio carries the whole call as base64 and is ignored.
const MAX_BODY_BYTES = 5 * 1024 * 1024
const DEDUPE_SECONDS = 24 * 60 * 60

function received(extra?: Record<string, unknown>) {
  return NextResponse.json({ received: true, ...extra }, { headers: { 'Cache-Control': 'no-store' } })
}

export const POST = handleRoute(async (req: NextRequest) => {
  const secret = env.ELEVENLABS_WEBHOOK_SECRET
  if (!isElevenLabsWebhookConfigured() || !secret) {
    throw new ApiError(503, 'not_configured', 'ElevenLabs webhooks are not configured.')
  }
  if (!isSupabaseAdminConfigured()) {
    throw new ApiError(503, 'not_configured', 'The database is not configured.')
  }
  await enforceRateLimit(RATE_LIMITS.publicWebhook, clientIp(req))

  const declared = Number(req.headers.get('content-length'))
  if (Number.isFinite(declared) && declared > MAX_BODY_BYTES) {
    // Audio payloads: nothing to store, and a non-2xx would count toward auto-disabling the webhook.
    return received({ ignored: 'payload_too_large' })
  }

  let raw: string
  try {
    raw = await readBodyText(req, MAX_BODY_BYTES)
  } catch (error) {
    // Same as above for a chunked audio payload without a Content-Length.
    if (error instanceof ApiError && error.status === 413) return received({ ignored: 'payload_too_large' })
    throw error
  }
  if (!verifyElevenLabsSignature(raw, req.headers.get('elevenlabs-signature'), secret)) {
    throw new ApiError(401, 'invalid_signature', 'Invalid webhook signature.')
  }

  let json: unknown
  try {
    json = JSON.parse(raw)
  } catch {
    throw new ApiError(400, 'invalid_json', 'Request body must be valid JSON.')
  }
  const envelope = WebhookEnvelopeSchema.safeParse(json)
  if (!envelope.success) throw new ApiError(400, 'invalid_payload', 'Unrecognised webhook payload.')
  const { type, data, event_timestamp: eventTimestamp } = envelope.data

  if (type === 'post_call_transcription') {
    const event = mapTranscriptionEvent(data, eventTimestamp)
    if (!event) return received({ ignored: 'missing_ids' })
    if ((await kvIncr(`elevenlabs:webhook:${type}:${event.conversationId}`, DEDUPE_SECONDS)) > 1) {
      return received({ duplicate: true })
    }
    after(async () => {
      try {
        await handleTranscription(event)
      } catch (error) {
        console.error('[elevenlabs-webhook] transcription processing failed', event.conversationId, error instanceof Error ? error.message : error)
      }
    })
    return received()
  }

  if (type === 'call_initiation_failure') {
    const event = mapInitiationFailureEvent(data, eventTimestamp)
    if (!event) return received({ ignored: 'missing_ids' })
    if ((await kvIncr(`elevenlabs:webhook:${type}:${event.conversationId}`, DEDUPE_SECONDS)) > 1) {
      return received({ duplicate: true })
    }
    after(async () => {
      try {
        await handleInitiationFailure(event)
      } catch (error) {
        console.error('[elevenlabs-webhook] initiation failure processing failed', event.conversationId, error instanceof Error ? error.message : error)
      }
    })
    return received()
  }

  // post_call_audio and future event types: acknowledged, nothing to store.
  return received({ ignored: type })
})
