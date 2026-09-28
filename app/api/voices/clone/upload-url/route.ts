import { NextResponse } from 'next/server'
import { z } from 'zod'
import { ApiError, handleRoute, noStore, parseJson } from '@/lib/api/http'
import { requireOrgContext } from '@/lib/api/auth'
import { enforceRateLimit, RATE_LIMITS } from '@/lib/security/rate-limit'
import {
  AUDIO_CONTENT_TYPES,
  CLONE_AUDIO_FORMATS,
  CLONE_MAX_BYTES,
  formatBytes,
} from '@/components/voice/voice-options'
import { declaredAudioFormat } from '../../_lib/audio-format'
import { newUploadPath } from '../../_lib/keys'
import { createSignedUpload, requireStorage, VOICE_BUCKETS } from '../../_lib/storage'
import { requireCartesia } from '../../_lib/synthesis'
import { requireCloneSlot, requireCloningEntitlement } from '../_lib/guards'

export const runtime = 'nodejs'

// POST /api/voices/clone/upload-url { name, size, type }
// Recordings can be up to 15 MB, far above Vercel's 4.5 MB request limit, so
// the browser uploads straight to a private storage path first and then calls
// POST /api/voices/clone with that path.

const bodySchema = z.object({
  name: z.string().trim().min(1).max(200),
  size: z.number().int().positive(),
  type: z.string().trim().max(100).default(''),
})

export const POST = handleRoute(async (req) => {
  const ctx = await requireOrgContext()
  requireCloningEntitlement(ctx)
  const body = await parseJson(req, bodySchema)
  await enforceRateLimit(RATE_LIMITS.apiWrite, ctx.user.id)
  requireCartesia()
  requireStorage()

  if (body.size > CLONE_MAX_BYTES) {
    throw new ApiError(413, 'file_too_large', `Recordings can be up to ${formatBytes(CLONE_MAX_BYTES)}. Please use a shorter clip.`)
  }
  const format = declaredAudioFormat({ name: body.name, type: body.type }, CLONE_AUDIO_FORMATS)
  if (!format) {
    throw new ApiError(415, 'unsupported_audio_format', 'Please upload a WAV, MP3, OGG, WebM or FLAC recording.')
  }
  await requireCloneSlot(ctx)

  const upload = await createSignedUpload(VOICE_BUCKETS.clips, newUploadPath(ctx.org.id, format))
  return noStore(
    NextResponse.json({
      ...upload,
      content_type: AUDIO_CONTENT_TYPES[format],
      max_bytes: CLONE_MAX_BYTES,
    })
  )
})
