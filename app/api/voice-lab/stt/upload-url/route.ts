import { NextResponse } from 'next/server'
import { z } from 'zod'
import { ApiError, handleRoute, noStore, parseJson } from '@/lib/api/http'
import { requireOrgContext } from '@/lib/api/auth'
import { enforceRateLimit, RATE_LIMITS } from '@/lib/security/rate-limit'
import { AUDIO_CONTENT_TYPES, STT_AUDIO_FORMATS, STT_MAX_BYTES, formatBytes } from '@/components/voice/voice-options'
import { declaredAudioFormat } from '@/app/api/voices/_lib/audio-format'
import { newUploadPath } from '@/app/api/voices/_lib/keys'
import { createSignedUpload, requireStorage, VOICE_BUCKETS } from '@/app/api/voices/_lib/storage'
import { requireCartesia } from '@/app/api/voices/_lib/synthesis'
import { quotaExceeded } from '../../_lib/errors'
import { requireActiveTrial } from '../../_lib/inflight'
import { canConsume } from '../../_lib/quota'
import { getToolQuota } from '../../_lib/usage'

export const runtime = 'nodejs'

// POST /api/voice-lab/stt/upload-url { name, size, type }
// Files up to 25 MB go straight from the browser to a private storage path
// (Vercel caps request bodies at 4.5 MB); POST /api/voice-lab/stt follows.

const bodySchema = z.object({
  name: z.string().trim().min(1).max(200),
  size: z.number().int().positive(),
  type: z.string().trim().max(100).default(''),
})

export const POST = handleRoute(async (req) => {
  const ctx = await requireOrgContext()
  requireActiveTrial(ctx.org)
  const body = await parseJson(req, bodySchema)
  await enforceRateLimit(RATE_LIMITS.apiWrite, ctx.user.id)
  // Each URL lets the browser store up to 25 MB until the daily cleanup.
  await enforceRateLimit(RATE_LIMITS.voiceLabUpload, ctx.org.id)
  requireCartesia()
  requireStorage()

  if (body.size > STT_MAX_BYTES) {
    throw new ApiError(413, 'file_too_large', `Files can be up to ${formatBytes(STT_MAX_BYTES)}. Please upload a shorter recording.`)
  }
  const format = declaredAudioFormat({ name: body.name, type: body.type }, STT_AUDIO_FORMATS)
  if (!format) {
    throw new ApiError(415, 'unsupported_audio_format', 'Please upload a WAV, MP3, M4A, OGG, WebM or FLAC file.')
  }

  // Say so before a 25 MB upload rather than after it.
  const quota = await getToolQuota(ctx, 'stt_tool')
  if (!canConsume(quota.state, 0)) throw quotaExceeded(quota)

  const upload = await createSignedUpload(VOICE_BUCKETS.labUploads, newUploadPath(ctx.org.id, format))
  return noStore(
    NextResponse.json({
      ...upload,
      content_type: AUDIO_CONTENT_TYPES[format],
      max_bytes: STT_MAX_BYTES,
    })
  )
})
