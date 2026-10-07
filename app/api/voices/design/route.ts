// POST /api/voices/design { description (20–1000 chars), text? (100–1000), language? }
// → { previews: [{ generated_voice_id, audio_base_64, media_type, duration_secs }], text, expires_at }
// Voice Design previews for this organization. Plan-gated (custom voices),
// blocked at the per-org custom-voice cap (saving would fail anyway) and when
// the shared workspace is full, rate-limited (every call costs credits). The
// generated ids are recorded server-side for this org: POST
// /api/voices/design/save only accepts those.

import { NextResponse } from 'next/server'
import { z } from 'zod'
import { requireOrg } from '@/lib/api/auth'
import { RequestError, assertSameOrigin, parseJsonBody } from '@/lib/api/http'
import * as el from '@/lib/elevenlabs/client'
import { createLogger, requestIdFrom } from '@/lib/observability/logger'
import { enforceRateLimit } from '@/lib/security/rate-limit'
import { createAdminClient } from '@/lib/supabase/admin'
import { assertCustomVoiceCap, assertCustomVoicePlan, assertWorkspaceVoiceCapacity } from '@/lib/voice-providers/voice-capacity'
import { languageSchema, orgAgentLanguage, voiceErrorResponse } from '@/lib/voice-providers/voice-catalog'
import { DESIGN_DESCRIPTION, DESIGN_TEXT, VOICE_DESIGN_RATE_LIMITS, designVoicePreviews } from '@/lib/voice-providers/voice-design'

export const maxDuration = 60

const BodySchema = z
  .object({
    description: z.string().trim().min(DESIGN_DESCRIPTION.min, `Describe the voice in at least ${DESIGN_DESCRIPTION.min} characters.`).max(DESIGN_DESCRIPTION.max),
    text: z.preprocess((v) => (typeof v === 'string' && v.trim() === '' ? undefined : v), z.string().trim().min(DESIGN_TEXT.min).max(DESIGN_TEXT.max).optional()),
    language: languageSchema.optional(),
  })
  .strict()

export async function POST(request: Request) {
  const requestId = requestIdFrom(request)
  let log = createLogger({ requestId, route: 'voices.design' })
  try {
    assertSameOrigin(request)
    const { supabase, user, org } = await requireOrg()
    log = log.child({ orgId: org.id })
    const body = await parseJsonBody(request, BodySchema, 8 * 1024)
    assertCustomVoicePlan(org.plan)
    if (!el.isConfigured()) throw new RequestError('not_configured', 'Voice design is not available on the platform right now.', 503)
    await assertCustomVoiceCap(createAdminClient(), org.id)
    await enforceRateLimit(
      [VOICE_DESIGN_RATE_LIMITS.burst, VOICE_DESIGN_RATE_LIMITS.daily],
      org.id,
      'You have designed many voices today. Please try again later.',
    )
    await assertWorkspaceVoiceCapacity('design', log)

    const language = body.language ?? (await orgAgentLanguage(supabase, org.id))
    const result = await designVoicePreviews({ orgId: org.id, userId: user.id, description: body.description, text: body.text, language, log })
    return NextResponse.json(result, { headers: { 'Cache-Control': 'private, no-store' } })
  } catch (err) {
    return voiceErrorResponse(err, log, 'voices.design.failed', requestId)
  }
}
