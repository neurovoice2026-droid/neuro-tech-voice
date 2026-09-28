import 'server-only'
import { after } from 'next/server'
import { ApiError } from '@/lib/api/http'
import { cartesia, CartesiaError, isCartesiaQuotaError } from '@/lib/cartesia/client'
import { isCartesiaConfigured } from '@/lib/env'
import { markBudgetExhausted } from '@/lib/voice/budget'

// Cartesia TTS for previews and the Voice Lab, plus one translation of
// provider failures into messages an owner can act on. Raw upstream bodies
// never reach the browser; the details go to the server log.

export type VoiceAction = 'preview' | 'tts' | 'stt' | 'clone' | 'catalog'

export function requireCartesia(): void {
  if (!isCartesiaConfigured()) {
    throw new ApiError(503, 'not_configured', 'Voices aren’t available yet: the voice provider isn’t configured on this server.')
  }
}

const PAUSED: Record<VoiceAction, string> = {
  preview: 'Voice previews are paused for now. Your phone agent keeps answering calls; please try again later.',
  tts: 'Audio generation is paused for now. Your phone agent keeps answering calls; please try again later.',
  stt: 'Transcription is paused for now. Your phone agent keeps answering calls; please try again later.',
  clone: 'Voice cloning is paused for now. Your phone agent keeps answering calls; please try again later.',
  catalog: 'Voices can’t be loaded right now. Your phone agent keeps answering calls; please try again later.',
}

const UNAVAILABLE: Record<VoiceAction, string> = {
  preview: 'We couldn’t play this preview right now. Please try again in a moment.',
  tts: 'We couldn’t generate the audio right now. Please try again in a moment.',
  stt: 'We couldn’t transcribe this file right now. Please try again in a moment.',
  clone: 'We couldn’t create the voice right now. Please try again in a moment.',
  catalog: 'We couldn’t load voices right now. Please try again in a moment.',
}

/**
 * Maps any failure from a Cartesia call to an ApiError. ApiErrors (for example
 * not_configured) pass through; unknown errors are rethrown for handleRoute.
 */
export function toVoiceApiError(error: unknown, action: VoiceAction): ApiError {
  if (error instanceof ApiError) return error
  if (!(error instanceof CartesiaError)) throw error

  const log = `${error.endpoint} ${error.status} ${error.errorCode ?? ''} ${error.requestId ?? ''}`.trim()

  if (isCartesiaQuotaError(error)) {
    console.error('[cartesia] credits exhausted during', action, log)
    // TTS/STT quota means model credits ran out: live calls switch to Managed Agents.
    after(() => markBudgetExhausted('model_credits'))
    return new ApiError(503, 'voice_capacity_reached', PAUSED[action])
  }

  switch (error.errorCode) {
    case 'voice_not_found':
      return new ApiError(422, 'voice_unavailable', 'This voice is no longer available. Please choose another voice.')
    case 'language_not_supported':
      return new ApiError(422, 'language_not_supported', 'This voice can’t speak the selected language. Please pick another language or voice.')
    case 'voice_model_mismatch':
      return new ApiError(422, 'voice_unavailable', 'This voice can’t be used for generation right now. Please choose another voice.')
    case 'plan_upgrade_required':
      console.error('[cartesia] provider plan does not allow', action, log)
      return new ApiError(
        503,
        'provider_plan_required',
        action === 'clone'
          ? 'Voice cloning is temporarily unavailable on our side. Your plan isn’t affected, and our team has been alerted.'
          : 'This feature is temporarily unavailable on our side. Your plan isn’t affected, and our team has been alerted.'
      )
    case 'file_too_large':
      return new ApiError(413, 'file_too_large', 'This audio file is too large. Please use a shorter recording.')
    case 'unsupported_audio_format':
      return new ApiError(422, 'unsupported_audio_format', 'We couldn’t read this audio file. Please use WAV, MP3, OGG, WebM or FLAC.')
    case 'concurrency_limited':
      return new ApiError(503, 'voice_busy', 'Our voice service is busy right now. Please try again in a few seconds.', { 'Retry-After': '5' })
  }

  if (error.status === 401 || error.status === 403) {
    console.error('[cartesia] API key rejected during', action, log)
    return new ApiError(503, 'not_configured', 'The voice provider rejected our credentials. Our team has been alerted.')
  }
  if (error.status === 429) {
    return new ApiError(503, 'voice_busy', 'Our voice service is busy right now. Please try again in a few seconds.', { 'Retry-After': '5' })
  }
  if (error.status === 404) {
    return new ApiError(422, 'voice_unavailable', 'This voice is no longer available. Please choose another voice.')
  }
  if (error.status === 400 || error.status === 422) {
    console.warn('[cartesia] request rejected during', action, log, error.message.slice(0, 200))
    return new ApiError(422, 'unsupported_request', action === 'stt'
      ? 'We couldn’t transcribe this file. Please check it is a clear recording in a supported format.'
      : 'The voice provider couldn’t process this request. Try a different voice, language or text.')
  }

  console.error('[cartesia] upstream failure during', action, log)
  return new ApiError(502, 'provider_error', UNAVAILABLE[action])
}

/** Hard cap for buffered audio (previews are ~20 s of 128 kbps MP3 at most). */
const MAX_BUFFERED_BYTES = 2 * 1024 * 1024

/** Synthesises a short MP3 fully into memory, for caching. Not retried: billed per character. */
export async function synthesizeMp3(input: {
  text: string
  voiceId: string
  language: string
  speed: number | null
  emotion: string | null
  signal?: AbortSignal
}): Promise<Uint8Array<ArrayBuffer>> {
  const res = await cartesia.tts.bytes({
    transcript: input.text,
    voiceId: input.voiceId,
    language: input.language,
    format: 'mp3',
    speed: input.speed,
    emotion: input.emotion,
    signal: input.signal,
  })
  const buffer = new Uint8Array(await res.arrayBuffer())
  if (buffer.byteLength === 0) {
    throw new CartesiaError({ status: 502, errorCode: 'invalid_response', endpoint: 'POST /tts/bytes', message: 'Cartesia returned empty audio' })
  }
  if (buffer.byteLength > MAX_BUFFERED_BYTES) {
    throw new CartesiaError({ status: 502, errorCode: 'invalid_response', endpoint: 'POST /tts/bytes', message: 'Cartesia returned more audio than expected for a preview' })
  }
  return buffer
}

export function audioResponse(
  body: BodyInit,
  contentType: string,
  headers: Record<string, string> = {}
): Response {
  return new Response(body, {
    status: 200,
    headers: {
      'Content-Type': contentType,
      'X-Content-Type-Options': 'nosniff',
      ...headers,
    },
  })
}
