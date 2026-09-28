import { z } from 'zod'
import { handleRoute, parseJson, zUuid } from '@/lib/api/http'
import { requireOrgContext } from '@/lib/api/auth'
import { cartesia, cartesiaTtsModel } from '@/lib/cartesia/client'
import { enforceRateLimit, RATE_LIMITS } from '@/lib/security/rate-limit'
import { creditsForTts, recordProviderUsage } from '@/lib/voice/budget'
import { SPEED_MAX, SPEED_MIN, TTS_TOOL_MAX_CHARS, VOICE_LANGUAGE_CODES } from '@/components/voice/voice-options'
import { requireVoiceAccess } from '@/app/api/voices/_lib/catalog'
import { requireCartesia, toVoiceApiError } from '@/app/api/voices/_lib/synthesis'
import { quotaExceeded } from '../_lib/errors'
import { canConsume, quotaHeaders, quotaState } from '../_lib/quota'
import { acquireToolSlot, requireActiveTrial } from '../_lib/inflight'
import { getToolQuota } from '../_lib/usage'

export const runtime = 'nodejs'
export const maxDuration = 60

// POST /api/voice-lab/tts { text ≤ 1000, voice_id, language, speed?, format } → audio file
// Counts characters against the plan's monthly text-to-speech allowance and
// streams the audio back (long WAV files exceed what could be buffered).

const bodySchema = z.object({
  text: z.string().trim().min(1, 'Please enter some text').max(TTS_TOOL_MAX_CHARS),
  voice_id: zUuid,
  language: z
    .string()
    .trim()
    .toLowerCase()
    .refine((value) => VOICE_LANGUAGE_CODES.includes(value), 'Unsupported language'),
  speed: z.number().min(SPEED_MIN).max(SPEED_MAX).nullish(),
  format: z.enum(['mp3', 'wav']).default('mp3'),
})

export const POST = handleRoute(async (req) => {
  const ctx = await requireOrgContext()
  requireActiveTrial(ctx.org)
  const body = await parseJson(req, bodySchema, { maxBytes: 16 * 1024 })
  requireCartesia()
  await enforceRateLimit(RATE_LIMITS.ttsTool, ctx.org.id)

  const voiceId = body.voice_id.toLowerCase()
  const access = await requireVoiceAccess(ctx, voiceId).catch((error: unknown) => {
    throw toVoiceApiError(error, 'tts')
  })

  const characters = body.text.length
  const speed = typeof body.speed === 'number' && Math.abs(body.speed - 1) > 0.001 ? Math.round(body.speed * 100) / 100 : null
  // Checked before, charged after: one clip at a time, so a burst of parallel
  // requests can't all pass the check against the same total. The slot is
  // freed once the characters are recorded, before the audio streams.
  const release = await acquireToolSlot(ctx.org.id, 'tts_tool')
  let quota: Awaited<ReturnType<typeof getToolQuota>>
  let upstream: Response
  try {
    quota = await getToolQuota(ctx, 'tts_tool')
    if (!canConsume(quota.state, characters)) {
      throw quotaExceeded(
        quota,
        `This text is ${characters.toLocaleString('en-US')} characters and you have ${quota.state.remaining.toLocaleString('en-US')} left.`
      )
    }
    try {
      upstream = await cartesia.tts.bytes({
        transcript: body.text,
        voiceId,
        language: body.language,
        format: body.format,
        speed,
      })
    } catch (error) {
      throw toVoiceApiError(error, 'tts')
    }
    await recordProviderUsage([
      {
        provider: 'cartesia',
        kind: 'tts_tool',
        quantity: characters,
        credits: creditsForTts(characters),
        org_id: ctx.org.id,
        meta: { voice_id: voiceId, clone: access.kind === 'clone', language: body.language, format: body.format, speed, model: cartesiaTtsModel() },
      },
    ])
  } finally {
    await release()
  }

  const nextState = quotaState(quota.state.limit, quota.state.used + characters)
  const contentType = body.format === 'wav' ? 'audio/wav' : 'audio/mpeg'
  return new Response(upstream.body, {
    status: 200,
    headers: {
      'Content-Type': contentType,
      'Content-Disposition': `inline; filename="speech.${body.format}"`,
      'Cache-Control': 'no-store',
      'X-Content-Type-Options': 'nosniff',
      ...quotaHeaders(nextState, quota.period),
    },
  })
})
