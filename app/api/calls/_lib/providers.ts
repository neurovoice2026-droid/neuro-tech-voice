import 'server-only'
import { cartesia, CartesiaError } from '@/lib/cartesia/client'
import { conversations, ElevenLabsError } from '@/lib/elevenlabs/client'
import { isCartesiaConfigured, isElevenLabsConfigured, isTwilioConfigured } from '@/lib/env'
import { deleteRecording, fetchRecordingMedia } from '@/lib/twilio/calls'

// Provider copies of a call: Twilio recordings, Cartesia Managed Agent call
// records, ElevenLabs conversations. Used by the recording proxy and by call
// deletion. Credentials never leave the server and upstream bodies never reach
// the client.

const RECORDING_SID_RE = /^RE[0-9a-fA-F]{32}$/
const PROVIDER_ID_RE = /^[A-Za-z0-9_-]{1,128}$/

export interface CallProviderRefs {
  id: string
  voice_provider: string | null
  pipeline_mode: string | null
  provider_call_id: string | null
  elevenlabs_conversation_id: string | null
  recording_sid: string | null
}

export class ProviderRequestError extends Error {
  constructor(readonly provider: 'twilio' | 'cartesia' | 'elevenlabs', readonly status: number) {
    super(`${provider} request failed with status ${status}`)
    this.name = 'ProviderRequestError'
  }
}

export function cartesiaCallIdOf(call: CallProviderRefs): string | null {
  if (call.voice_provider !== 'cartesia' || call.pipeline_mode !== 'cartesia_managed') return null
  return call.provider_call_id && PROVIDER_ID_RE.test(call.provider_call_id) ? call.provider_call_id : null
}

export function elevenLabsConversationIdOf(call: CallProviderRefs): string | null {
  const id = call.elevenlabs_conversation_id ?? (call.voice_provider === 'elevenlabs' ? call.provider_call_id : null)
  return id && PROVIDER_ID_RE.test(id) ? id : null
}

export function twilioRecordingSidOf(call: CallProviderRefs): string | null {
  return call.recording_sid && RECORDING_SID_RE.test(call.recording_sid) ? call.recording_sid : null
}

// ─── Recording media ─────────────────────────────────────────────────────────

export interface RecordingStream {
  body: ReadableStream<Uint8Array>
  status: 200 | 206
  headers: Headers
}

function streamHeaders(upstream: Response, fallbackType: string): Headers {
  const headers = new Headers()
  headers.set('Content-Type', upstream.headers.get('content-type')?.split(';')[0] || fallbackType)
  for (const name of ['content-length', 'content-range', 'accept-ranges']) {
    const value = upstream.headers.get(name)
    if (value) headers.set(name, value)
  }
  return headers
}

async function twilioRecording(recordingSid: string, range: string | null): Promise<RecordingStream | null> {
  const res = await fetchRecordingMedia(recordingSid, { range, format: 'mp3' })
  if (res.status === 404) return null
  if ((res.status !== 200 && res.status !== 206) || !res.body) {
    await res.body?.cancel().catch(() => undefined)
    throw new ProviderRequestError('twilio', res.status)
  }
  return { body: res.body, status: res.status, headers: streamHeaders(res, 'audio/mpeg') }
}

async function cartesiaRecording(callId: string): Promise<RecordingStream | null> {
  try {
    const res = await cartesia.calls.audio(callId)
    if (!res.body) return null
    return { body: res.body, status: 200, headers: streamHeaders(res, 'audio/wav') }
  } catch (error) {
    if (error instanceof CartesiaError && error.status === 404) return null
    throw error
  }
}

async function elevenLabsRecording(conversationId: string): Promise<RecordingStream | null> {
  try {
    const res = await conversations.getAudio(conversationId)
    if (!res.body) return null
    return { body: res.body, status: 200, headers: streamHeaders(res, 'audio/mpeg') }
  } catch (error) {
    if (error instanceof ElevenLabsError && (error.status === 404 || error.status === 422)) return null
    throw error
  }
}

/**
 * First available copy: Twilio recording → Cartesia call audio → ElevenLabs
 * conversation audio. null when none of them has audio for this call.
 */
export async function openRecording(call: CallProviderRefs, range: string | null): Promise<RecordingStream | null> {
  const sid = twilioRecordingSidOf(call)
  if (sid && isTwilioConfigured()) {
    const stream = await twilioRecording(sid, range)
    if (stream) return stream
  }
  const cartesiaId = cartesiaCallIdOf(call)
  if (cartesiaId && isCartesiaConfigured()) {
    const stream = await cartesiaRecording(cartesiaId)
    if (stream) return stream
  }
  const conversationId = elevenLabsConversationIdOf(call)
  if (conversationId && isElevenLabsConfigured()) {
    const stream = await elevenLabsRecording(conversationId)
    if (stream) return stream
  }
  return null
}

// ─── Deletion ────────────────────────────────────────────────────────────────

export type ProviderName = 'twilio' | 'cartesia' | 'elevenlabs'

function notConfigured(provider: string, callId: string): void {
  // Without credentials the copy can never be reached from the app; blocking the
  // owner's delete forever would not remove it either, so log it for the operator.
  console.warn('[calls]', `${provider} is not configured; its copy of the call was not deleted`, callId)
}

/**
 * Deletes every provider copy of a call. "Already gone" counts as success.
 * Returns the providers whose delete request failed, so the row isn't removed
 * while audio or a transcript still exists elsewhere and the owner can retry.
 */
export async function deleteProviderCopies(call: CallProviderRefs): Promise<ProviderName[]> {
  const failed: ProviderName[] = []
  const tasks: Promise<void>[] = []

  const sid = twilioRecordingSidOf(call)
  if (sid) {
    tasks.push(
      (async () => {
        if (!isTwilioConfigured()) {
          notConfigured('Twilio', call.id)
          return
        }
        try {
          // Resolves when the recording is already gone.
          await deleteRecording(sid)
        } catch {
          // lib/twilio/calls.ts logs the Twilio status and code.
          console.error('[calls] Twilio recording delete failed', call.id)
          failed.push('twilio')
        }
      })()
    )
  }

  const cartesiaId = cartesiaCallIdOf(call)
  if (cartesiaId) {
    tasks.push(
      (async () => {
        if (!isCartesiaConfigured()) {
          notConfigured('Cartesia', call.id)
          return
        }
        try {
          await cartesia.calls.delete(cartesiaId)
        } catch (error) {
          if (error instanceof CartesiaError && error.status === 404) return
          console.error('[calls] Cartesia call delete failed', call.id, error instanceof CartesiaError ? error.status : error)
          failed.push('cartesia')
        }
      })()
    )
  }

  const conversationId = elevenLabsConversationIdOf(call)
  if (conversationId) {
    tasks.push(
      (async () => {
        if (!isElevenLabsConfigured()) {
          notConfigured('ElevenLabs', call.id)
          return
        }
        try {
          await conversations.delete(conversationId)
        } catch (error) {
          if (error instanceof ElevenLabsError && error.status === 404) return
          console.error('[calls] ElevenLabs conversation delete failed', call.id, error instanceof ElevenLabsError ? error.status : error)
          failed.push('elevenlabs')
        }
      })()
    )
  }

  await Promise.all(tasks)
  return failed
}
