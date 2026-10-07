// POST /api/voices/design/save { generated_voice_id, name } → 201 { voice: VoiceOption }
// Saves one of THIS organization's Voice Design previews (recorded server-side
// by POST /api/voices/design, unexpired, not saved yet) as its own custom
// voice. Plan-gated, capped per org (with clones), workspace capacity
// preflight, rate-limited, audited.

import { NextResponse } from 'next/server'
import { z } from 'zod'
import { requireOrg } from '@/lib/api/auth'
import { RequestError, assertSameOrigin, parseJsonBody } from '@/lib/api/http'
import * as el from '@/lib/elevenlabs/client'
import { createLogger, requestIdFrom } from '@/lib/observability/logger'
import { enforceRateLimit } from '@/lib/security/rate-limit'
import { createAdminClient } from '@/lib/supabase/admin'
import { assertCustomVoiceCap, assertCustomVoicePlan, assertWorkspaceVoiceCapacity } from '@/lib/voice-providers/voice-capacity'
import { voiceErrorResponse } from '@/lib/voice-providers/voice-catalog'
import { VOICE_DESIGN_RATE_LIMITS, saveDesignedVoice } from '@/lib/voice-providers/voice-design'

export const maxDuration = 60

const BodySchema = z
  .object({
    generated_voice_id: z.string().trim().regex(/^[A-Za-z0-9_-]{6,128}$/, 'Invalid preview.'),
    name: z.string().trim().min(1, 'Give the voice a name.').max(100),
  })
  .strict()

export async function POST(request: Request) {
  const requestId = requestIdFrom(request)
  let log = createLogger({ requestId, route: 'voices.design.save' })
  try {
    assertSameOrigin(request)
    const { user, org } = await requireOrg()
    log = log.child({ orgId: org.id })
    const body = await parseJsonBody(request, BodySchema, 4 * 1024)
    assertCustomVoicePlan(org.plan)
    if (!el.isConfigured()) throw new RequestError('not_configured', 'Voice design is not available on the platform right now.', 503)
    await assertCustomVoiceCap(createAdminClient(), org.id)
    await enforceRateLimit([VOICE_DESIGN_RATE_LIMITS.save], org.id, 'You have saved many voices today. Please try again later.')
    await assertWorkspaceVoiceCapacity('design', log)

    const result = await saveDesignedVoice({ orgId: org.id, userId: user.id, generatedVoiceId: body.generated_voice_id, name: body.name, log })
    return NextResponse.json({ voice: result.voice }, { status: 201 })
  } catch (err) {
    return voiceErrorResponse(err, log, 'voices.design.save_failed', requestId)
  }
}
