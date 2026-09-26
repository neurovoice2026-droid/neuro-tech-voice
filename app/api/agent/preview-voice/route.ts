import { after } from 'next/server'
import { z } from 'zod'
import { handleRoute, parseJson, zUuid } from '@/lib/api/http'
import { requireOrgAgent, requireOrgContext } from '@/lib/api/auth'
import { cartesiaTtsModel } from '@/lib/cartesia/client'
import { enforceRateLimit, RATE_LIMITS, type RateLimitPolicy } from '@/lib/security/rate-limit'
import { creditsForTts, recordProviderUsage } from '@/lib/voice/budget'
import { normalizeAgentLanguage } from '@/lib/voice/languages'
import { voiceStyleFor } from '@/lib/voice/tone'
import { defaultCartesiaVoice } from '@/lib/voice/voice-map'
import { AGENT_TONES } from '@/types'
import { PREVIEW_MAX_CHARS, SPEED_MAX, SPEED_MIN, VOICE_LANGUAGE_CODES } from '@/components/voice/voice-options'
import { requireVoiceAccess } from '@/app/api/voices/_lib/catalog'
import { previewCacheKey, textPreviewObjectPath } from '@/app/api/voices/_lib/keys'
import { readCachedObject, VOICE_BUCKETS, writeCachedObject } from '@/app/api/voices/_lib/storage'
import { audioResponse, requireCartesia, synthesizeMp3, toVoiceApiError } from '@/app/api/voices/_lib/synthesis'

export const runtime = 'nodejs'

// POST /api/agent/preview-voice { text, voice_id?, speed?, tone?, language? } → audio/mpeg
// Speaks a greeting (or any short line) the way a call would: the agent's
// voice unless another is given, and the speed/emotion that tone and pace
// resolve to (voiceStyleFor). Identical requests are served from the
// voice-previews bucket, keyed by sha256(voice|model|language|speed|emotion|text).

// Cached previews are free but still look the voice up and read storage; this
// bounds one account without getting in the way of a pace slider. Shares the
// counter with GET /api/voices/[voiceId]/preview.
const PREVIEW_READ_POLICY: RateLimitPolicy = { name: 'voicePreviewRead', limit: 120, windowSeconds: 60 }

const bodySchema = z.object({
  text: z.string().trim().min(1, 'Please enter something to preview').max(PREVIEW_MAX_CHARS),
  // Older dashboard code still sends ElevenLabs voice ids (not UUIDs); those
  // fall back to the agent's Cartesia voice instead of failing the preview.
  voice_id: z.string().trim().max(64).nullish(),
  speed: z.number().min(SPEED_MIN).max(SPEED_MAX).nullish(),
  tone: z.enum(AGENT_TONES as unknown as [string, ...string[]]).nullish(),
  language: z
    .string()
    .trim()
    .toLowerCase()
    .refine((value) => VOICE_LANGUAGE_CODES.includes(value), 'Unsupported language')
    .nullish(),
})

export const POST = handleRoute(async (req) => {
  const ctx = await requireOrgContext()
  const body = await parseJson(req, bodySchema, { maxBytes: 8 * 1024 })
  const agent = await requireOrgAgent(ctx)
  requireCartesia()
  await enforceRateLimit(PREVIEW_READ_POLICY, ctx.user.id)

  const language = normalizeAgentLanguage(body.language ?? agent.language)
  const requested = body.voice_id && zUuid.safeParse(body.voice_id).success ? body.voice_id.toLowerCase() : null
  const voiceId = requested ?? agent.cartesia_voice_id ?? defaultCartesiaVoice(language).voice_id

  await requireVoiceAccess(ctx, voiceId).catch((error: unknown) => {
    throw toVoiceApiError(error, 'preview')
  })

  // Same resolution as live calls: an explicit pace wins over the tone's suggestion.
  const style = voiceStyleFor({
    tone: body.tone ?? agent.tone,
    language,
    speed: body.speed ?? agent.voice_speed,
    emotion: agent.voice_emotion,
  })
  const model = cartesiaTtsModel()
  const hash = previewCacheKey({ voiceId, model, language, speed: style.speed, emotion: style.emotion, text: body.text })
  // Greetings name the business: cached under the org (removed with the account)
  // and grouped by voice (removed with a deleted cloned voice).
  const path = textPreviewObjectPath(hash, ctx.org.id, voiceId)
  const headers = { 'Cache-Control': 'private, max-age=86400, immutable', 'X-Preview-Cache': 'hit' }

  const cached = await readCachedObject(VOICE_BUCKETS.previews, path)
  if (cached && cached.size > 0) {
    return audioResponse(cached, 'audio/mpeg', { ...headers, 'Content-Length': String(cached.size) })
  }

  await enforceRateLimit(RATE_LIMITS.voicePreview, ctx.org.id)
  // Not tied to req.signal: a preview abandoned mid-way (pace slider moved on)
  // is billed anyway, so finish it and cache it for the next listen.
  const audio = await synthesizeMp3({
    text: body.text,
    voiceId,
    language,
    speed: style.speed,
    emotion: style.emotion,
  }).catch((error: unknown) => {
    throw toVoiceApiError(error, 'preview')
  })

  after(async () => {
    await writeCachedObject(VOICE_BUCKETS.previews, path, audio, 'audio/mpeg')
    await recordProviderUsage([
      {
        provider: 'cartesia',
        kind: 'preview',
        quantity: body.text.length,
        credits: creditsForTts(body.text.length),
        org_id: ctx.org.id,
        meta: { source: 'agent_preview', agent_id: agent.id, voice_id: voiceId, model, language, speed: style.speed, emotion: style.emotion },
      },
    ])
  })

  return audioResponse(audio, 'audio/mpeg', { ...headers, 'X-Preview-Cache': 'miss', 'Content-Length': String(audio.byteLength) })
})
