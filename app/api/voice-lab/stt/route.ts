import { after, NextResponse } from 'next/server'
import { z } from 'zod'
import { ApiError, handleRoute, parseJson } from '@/lib/api/http'
import { requireOrgContext, type OrgContext } from '@/lib/api/auth'
import { cartesia } from '@/lib/cartesia/client'
import { enforceRateLimit, RATE_LIMITS } from '@/lib/security/rate-limit'
import { creditsForBatchStt, recordProviderUsage } from '@/lib/voice/budget'
import { AUDIO_CONTENT_TYPES, STT_AUDIO_FORMATS, STT_MAX_BYTES, VOICE_LANGUAGE_CODES } from '@/components/voice/voice-options'
import { detectAudioFormat, wavDurationSeconds } from '@/app/api/voices/_lib/audio-format'
import { parseUploadPath } from '@/app/api/voices/_lib/keys'
import { downloadObject, removeObjects, requireStorage, VOICE_BUCKETS } from '@/app/api/voices/_lib/storage'
import { requireCartesia, toVoiceApiError } from '@/app/api/voices/_lib/synthesis'
import { quotaExceeded, sttDoesNotFit } from '../_lib/errors'
import { billableSeconds, canConsume, quotaHeaders, quotaState } from '../_lib/quota'
import { acquireToolSlot, requireActiveTrial } from '../_lib/inflight'
import { getToolQuota } from '../_lib/usage'

export const runtime = 'nodejs'
// Storage download + Cartesia batch transcription (60 s client timeout).
export const maxDuration = 120

// POST /api/voice-lab/stt { storage_path, language, duration_hint? } → { text, words, duration, language }
// Transcribes an uploaded file with Cartesia ink-whisper (batch) and charges
// the seconds against the plan's monthly allowance. The upload is deleted
// once it has been transcribed or rejected.

const bodySchema = z.object({
  storage_path: z.string().trim().min(1).max(200),
  language: z
    .string()
    .trim()
    .toLowerCase()
    .refine((value) => VOICE_LANGUAGE_CODES.includes(value), 'Unsupported language'),
  // Measured by the browser from the file's metadata. Only used to refuse a
  // file that clearly doesn't fit the allowance before paying for it.
  duration_hint: z.number().min(0).max(24 * 3600).nullish(),
})

export const POST = handleRoute(async (req) => {
  const ctx = await requireOrgContext()
  requireActiveTrial(ctx.org)
  const body = await parseJson(req, bodySchema)
  requireCartesia()
  requireStorage()

  const upload = parseUploadPath(ctx.org.id, body.storage_path, STT_AUDIO_FORMATS)
  if (!upload) throw new ApiError(400, 'invalid_upload', 'This upload isn’t valid. Please upload the file again.')
  const discard = () => removeObjects(VOICE_BUCKETS.labUploads, [body.storage_path])

  await enforceRateLimit(RATE_LIMITS.sttTool, ctx.org.id)

  // Checked before, charged after: one transcription at a time keeps parallel requests from all passing the check.
  const release = await acquireToolSlot(ctx.org.id, 'stt_tool')
  try {
    return await transcribe(ctx, body, discard)
  } finally {
    await release()
  }
})

async function transcribe(
  ctx: OrgContext,
  body: z.infer<typeof bodySchema>,
  discard: () => Promise<unknown>
): Promise<Response> {
  const quota = await getToolQuota(ctx, 'stt_tool')
  const hint = typeof body.duration_hint === 'number' ? body.duration_hint : 0
  if (!canConsume(quota.state, hint)) {
    await discard()
    throw hint > 0 ? sttDoesNotFit(quota, hint) : quotaExceeded(quota)
  }

  const stored = await downloadObject(VOICE_BUCKETS.labUploads, body.storage_path)
  if (!stored) throw new ApiError(404, 'upload_not_found', 'We couldn’t find the uploaded file. Please upload it again.')
  if (stored.size === 0 || stored.size > STT_MAX_BYTES) {
    await discard()
    throw new ApiError(413, 'file_too_large', 'Files must be between 1 byte and 25 MB.')
  }

  const bytes = new Uint8Array(await stored.arrayBuffer())
  const format = detectAudioFormat(bytes.subarray(0, 16))
  if (!format || !STT_AUDIO_FORMATS.includes(format)) {
    await discard()
    throw new ApiError(415, 'unsupported_audio_format', 'This file isn’t a WAV, MP3, M4A, OGG, WebM or FLAC recording.')
  }

  const measured = format === 'wav' ? wavDurationSeconds(bytes) : null
  if (measured !== null && !canConsume(quota.state, measured)) {
    await discard()
    throw sttDoesNotFit(quota, measured)
  }

  let result: Awaited<ReturnType<typeof cartesia.stt.transcribe>>
  try {
    result = await cartesia.stt.transcribe({
      file: new Blob([bytes], { type: AUDIO_CONTENT_TYPES[format] }),
      filename: `recording.${format}`,
      language: body.language,
      wordTimestamps: true,
      // Long recordings take a while; stays inside the route's 120 s limit after the download.
      timeoutMs: 100_000,
    })
  } catch (error) {
    const apiError = toVoiceApiError(error, 'stt')
    // Keep the file after a temporary provider problem so "Try again" doesn't re-upload.
    if (apiError.status < 500) await discard()
    throw apiError
  }

  const seconds = billableSeconds(result.duration, measured ?? (hint > 0 ? hint : null))
  await recordProviderUsage([
    {
      provider: 'cartesia',
      kind: 'stt_tool',
      quantity: seconds,
      credits: creditsForBatchStt(seconds),
      org_id: ctx.org.id,
      meta: { model: 'ink-whisper', language: body.language, format, bytes: stored.size, duration_source: result.duration ? 'provider' : measured ? 'wav_header' : 'browser' },
    },
  ])
  after(() => discard())

  const nextState = quotaState(quota.state.limit, quota.state.used + seconds)
  return NextResponse.json(
    {
      text: result.text,
      words: result.words,
      duration: seconds,
      language: result.language ?? body.language,
    },
    { headers: { 'Cache-Control': 'no-store', ...quotaHeaders(nextState, quota.period) } }
  )
}
