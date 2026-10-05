import { requireOrg } from '@/lib/api/auth'
import { apiError, errorResponse, RequestError, requestErrorResponse } from '@/lib/api/http'
import { createLogger, requestIdFrom, type Logger } from '@/lib/observability/logger'
import { conversations as elConversations } from '@/lib/elevenlabs/client'
import { calls as cartesiaCalls } from '@/lib/cartesia/client'
import { isProviderError } from '@/lib/voice-providers/errors'
import { rateLimit, RATE_LIMITS } from '@/lib/security/rate-limit'
import { findOrgCall, parseCallId, servingProvider, type CallRow } from '@/lib/calls/serialize'

const AUDIO_COLUMNS: string =
  'id, provider, provider_call_id, elevenlabs_conversation_id, cartesia_call_id, has_recording, recording_status'

type AudioRow = Pick<
  CallRow,
  'id' | 'provider' | 'provider_call_id' | 'elevenlabs_conversation_id' | 'cartesia_call_id' | 'has_recording' | 'recording_status'
>

const AUDIO_LIMIT = RATE_LIMITS.callAudio
const DEFAULT_TYPE = { elevenlabs: 'audio/mpeg', cartesia: 'audio/wav' } as const
const EXTENSION: Record<string, string> = { 'audio/mpeg': 'mp3', 'audio/mp3': 'mp3', 'audio/wav': 'wav', 'audio/x-wav': 'wav', 'audio/wave': 'wav', 'audio/ogg': 'ogg' }

/**
 * Recordings are buffered so byte ranges can be served (a phone call is a few
 * MB at most); anything larger than this is refused rather than held in memory.
 */
const MAX_RECORDING_BYTES = 50 * 1024 * 1024

function notAvailable(requestId: string) {
  return apiError('not_found', 'No recording is available for this call.', 404, { requestId })
}

function tooLarge(requestId: string) {
  return apiError('provider_error', 'This recording is too large to play here.', 502, { requestId })
}

/** Reads the whole upstream body; null when it exceeds `max` bytes. */
async function readCapped(body: ReadableStream<Uint8Array>, max: number, log: Logger): Promise<Uint8Array<ArrayBuffer> | null> {
  const reader = body.getReader()
  const chunks: Uint8Array[] = []
  let total = 0
  for (;;) {
    const { done, value } = await reader.read()
    if (done) break
    total += value.byteLength
    if (total > max) {
      await reader.cancel().catch((err: unknown) => log.warn('calls.audio.cancel_failed', { error: String(err) }))
      return null
    }
    chunks.push(value)
  }
  const out = new Uint8Array(total)
  let offset = 0
  for (const chunk of chunks) {
    out.set(chunk, offset)
    offset += chunk.byteLength
  }
  return out
}

type ByteRange = { start: number; end: number }

/**
 * Parses a single `Range: bytes=a-b | a- | -n` header against `size`.
 * Returns the inclusive range, or null when it is malformed, multi-range or
 * unsatisfiable (→ 416).
 */
function parseByteRange(header: string, size: number): ByteRange | null {
  const m = /^bytes=(\d*)-(\d*)$/i.exec(header.trim())
  if (!m || (m[1] === '' && m[2] === '') || size <= 0) return null
  const first = m[1] === '' ? null : Number(m[1])
  const last = m[2] === '' ? null : Number(m[2])
  if ((first !== null && !Number.isSafeInteger(first)) || (last !== null && !Number.isSafeInteger(last))) return null
  if (first === null) {
    // Suffix range: the last `last` bytes.
    if (!last) return null
    return { start: Math.max(0, size - last), end: size - 1 }
  }
  if (first >= size || (last !== null && last < first)) return null
  return { start: first, end: last === null ? size - 1 : Math.min(last, size - 1) }
}

// GET /api/calls/[id]/audio — serves the recording from the provider that
// served the call, with byte-range support (206) so the player can seek.
// Ownership comes from our DB row (org-scoped lookup); the provider URL and
// key never reach the browser.
export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const requestId = requestIdFrom(request)
  let log = createLogger({ requestId, route: 'calls.audio' })
  try {
    const { supabase, org } = await requireOrg()
    log = log.child({ orgId: org.id })
    const id = parseCallId((await params).id)

    const row = await findOrgCall<AudioRow>(supabase, org.id, id, AUDIO_COLUMNS)
    if (!row) return apiError('not_found', 'Call not found', 404, { requestId })
    log = log.child({ callId: row.id })
    if (row.recording_status === 'unavailable' || row.recording_status === 'deleted') return notAvailable(requestId)

    // Provider-specific id first: provider_call_id holds whichever provider
    // reported first, which differs from the serving one after a failover.
    const provider = servingProvider(row)
    const externalId =
      provider === 'elevenlabs'
        ? (row.elevenlabs_conversation_id ?? row.provider_call_id)
        : provider === 'cartesia'
          ? (row.cartesia_call_id ?? row.provider_call_id)
          : null
    if (!provider || !externalId) return notAvailable(requestId)

    const limit = await rateLimit(AUDIO_LIMIT, org.id)
    if (!limit.allowed) {
      return apiError('rate_limited', 'Too many recording requests. Please wait a moment.', 429, {
        requestId,
        headers: { 'Retry-After': String(Math.max(1, Math.ceil((limit.resetAt - Date.now()) / 1000))) },
      })
    }

    const ctx = { orgId: org.id, callId: row.id }
    let upstream: Response
    try {
      upstream = provider === 'elevenlabs'
        ? await elConversations.audio(externalId, ctx)
        : await cartesiaCalls.audio(externalId, ctx)
    } catch (err) {
      if (isProviderError(err) && err.code === 'not_found') {
        log.info('calls.audio.not_found', { provider })
        return notAvailable(requestId)
      }
      throw err
    }
    if (!upstream.body) return notAvailable(requestId)

    const declared = upstream.headers.get('content-length')
    if (declared && /^\d+$/.test(declared) && Number(declared) > MAX_RECORDING_BYTES) {
      log.warn('calls.audio.too_large', { provider, bytes: Number(declared) })
      await upstream.body.cancel().catch((err: unknown) => log.warn('calls.audio.cancel_failed', { error: String(err) }))
      return tooLarge(requestId)
    }
    let bytes: Uint8Array<ArrayBuffer> | null
    try {
      bytes = await readCapped(upstream.body, MAX_RECORDING_BYTES, log)
    } catch (err) {
      log.error('calls.audio.read_failed', err, { provider })
      return apiError('provider_error', 'The recording could not be loaded right now. Please try again.', 502, { requestId })
    }
    if (!bytes) {
      log.warn('calls.audio.too_large', { provider })
      return tooLarge(requestId)
    }
    const size = bytes.byteLength

    const upstreamType = (upstream.headers.get('content-type') ?? '').split(';')[0].trim().toLowerCase()
    const contentType = upstreamType.startsWith('audio/') ? upstreamType : DEFAULT_TYPE[provider]
    const headers = new Headers({
      'Content-Type': contentType,
      'Cache-Control': 'private, no-store',
      'Content-Disposition': `inline; filename="call-${row.id}.${EXTENSION[contentType] ?? 'audio'}"`,
      'X-Content-Type-Options': 'nosniff',
      // Without range support Chromium treats the media as a stream and cannot seek.
      'Accept-Ranges': 'bytes',
    })

    const rangeHeader = request.headers.get('range')
    if (rangeHeader === null) {
      headers.set('Content-Length', String(size))
      return new Response(bytes, { status: 200, headers })
    }
    const range = parseByteRange(rangeHeader, size)
    if (!range) {
      return apiError('invalid_request', 'The requested range is not satisfiable.', 416, {
        requestId,
        headers: { 'Content-Range': `bytes */${size}`, 'Accept-Ranges': 'bytes', 'Cache-Control': 'private, no-store' },
      })
    }
    headers.set('Content-Range', `bytes ${range.start}-${range.end}/${size}`)
    headers.set('Content-Length', String(range.end - range.start + 1))
    return new Response(bytes.subarray(range.start, range.end + 1), { status: 206, headers })
  } catch (err) {
    if (err instanceof RequestError) return requestErrorResponse(err, requestId)
    return errorResponse(err, log, 'calls.audio.failed', requestId)
  }
}
