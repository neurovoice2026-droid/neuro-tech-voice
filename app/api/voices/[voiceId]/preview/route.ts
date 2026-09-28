import { after } from 'next/server'
import { ApiError, handleRoute, zUuid } from '@/lib/api/http'
import { requireOrgContext } from '@/lib/api/auth'
import { cartesia, cartesiaTtsModel, CartesiaError } from '@/lib/cartesia/client'
import { kvDel } from '@/lib/kv'
import { enforceRateLimit, RATE_LIMITS, type RateLimitPolicy } from '@/lib/security/rate-limit'
import { creditsForTts, recordProviderUsage } from '@/lib/voice/budget'
import { requireVoiceAccess, type VoiceAccess } from '../../_lib/catalog'
import { previewCacheKey, sampleObjectPath, voiceMetaKey } from '../../_lib/keys'
import { sampleFor } from '@/components/voice/voice-samples'
import { readCachedObject, VOICE_BUCKETS, writeCachedObject } from '../../_lib/storage'
import { audioResponse, requireCartesia, synthesizeMp3, toVoiceApiError } from '../../_lib/synthesis'

export const runtime = 'nodejs'

// GET /api/voices/{voiceId}/preview → audio the picker plays.
// 1. Public voices with a Cartesia preview file: streamed through (free; the
//    file URL needs our API key, so it never reaches the browser).
// 2. Everything else (about two thirds of the library, and every clone): a
//    short sample in the voice's language, synthesised once, cached in the
//    voice-previews bucket by hash and metered as kind 'preview'.

const CACHE_HEADERS = { 'Cache-Control': 'private, max-age=86400' }

// Every uncached id costs an upstream voice lookup, so one account can't walk
// random ids through Cartesia. Far above what clicking through a picker needs.
const PREVIEW_READ_POLICY: RateLimitPolicy = { name: 'voicePreviewRead', limit: 120, windowSeconds: 60 }

async function streamProviderPreview(voiceId: string): Promise<Response | null> {
  try {
    const upstream = await cartesia.voices.fetchPreview(voiceId)
    const headers: Record<string, string> = { ...CACHE_HEADERS }
    const length = upstream.headers.get('content-length')
    if (length && /^\d+$/.test(length)) headers['Content-Length'] = length
    const type = upstream.headers.get('content-type')?.split(';')[0].trim()
    return audioResponse(upstream.body ?? new Uint8Array(), type?.startsWith('audio/') ? type : 'audio/wav', headers)
  } catch (error) {
    // The file can disappear between the metadata read and the download.
    if (error instanceof CartesiaError && (error.errorCode === 'preview_not_found' || error.status === 404)) {
      await kvDel(voiceMetaKey(voiceId))
      return null
    }
    throw toVoiceApiError(error, 'preview')
  }
}

async function synthesizedSample(orgId: string, access: VoiceAccess): Promise<Response> {
  const sample = sampleFor(access.language)
  const model = cartesiaTtsModel()
  const hash = previewCacheKey({
    voiceId: access.voiceId,
    model,
    language: sample.language,
    speed: null,
    emotion: null,
    text: sample.text,
  })
  // Clone samples belong to the org (removed with the account); library samples are shared.
  const path = sampleObjectPath(hash, access.kind === 'clone' ? orgId : null)

  const cached = await readCachedObject(VOICE_BUCKETS.previews, path)
  if (cached && cached.size > 0) {
    return audioResponse(cached, 'audio/mpeg', { ...CACHE_HEADERS, 'Content-Length': String(cached.size) })
  }

  await enforceRateLimit(RATE_LIMITS.voicePreview, orgId)
  const audio = await synthesizeMp3({
    text: sample.text,
    voiceId: access.voiceId,
    language: sample.language,
    speed: null,
    emotion: null,
  }).catch((error: unknown) => {
    throw toVoiceApiError(error, 'preview')
  })

  after(async () => {
    await writeCachedObject(VOICE_BUCKETS.previews, path, audio, 'audio/mpeg')
    await recordProviderUsage([
      {
        provider: 'cartesia',
        kind: 'preview',
        quantity: sample.text.length,
        credits: creditsForTts(sample.text.length),
        org_id: orgId,
        meta: { source: 'voice_sample', voice_id: access.voiceId, model, language: sample.language, clone: access.kind === 'clone' },
      },
    ])
  })

  return audioResponse(audio, 'audio/mpeg', { ...CACHE_HEADERS, 'Content-Length': String(audio.byteLength) })
}

export const GET = handleRoute(async (_req, { params }: { params: Promise<{ voiceId: string }> }) => {
  const { voiceId: rawId } = await params
  const ctx = await requireOrgContext()
  const parsed = zUuid.safeParse(rawId)
  if (!parsed.success) throw new ApiError(404, 'voice_not_found', 'This voice isn’t available.')
  const voiceId = parsed.data.toLowerCase()

  requireCartesia()
  await enforceRateLimit(PREVIEW_READ_POLICY, ctx.user.id)
  const access = await requireVoiceAccess(ctx, voiceId).catch((error: unknown) => {
    throw toVoiceApiError(error, 'preview')
  })

  if (access.kind === 'public' && access.meta.has_preview_file) {
    const streamed = await streamProviderPreview(voiceId)
    if (streamed) return streamed
  }
  return synthesizedSample(ctx.org.id, access)
})
