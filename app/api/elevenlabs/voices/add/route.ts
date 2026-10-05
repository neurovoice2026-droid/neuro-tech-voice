// POST /api/elevenlabs/voices/add — legacy: { public_owner_id, voice_id, name? }
// → { voice_id } (the workspace id to give the agent). Compatibility wrapper:
// the library voice is re-validated server-side and provisioned once for the
// whole platform (deduplicated, rate-limited, audited). `name` is ignored: the
// library's own name is used. New code: PUT /api/agent/voice with library_ref.

import { NextResponse } from 'next/server'
import { z } from 'zod'
import { requireOrg } from '@/lib/api/auth'
import { assertSameOrigin, parseJsonBody } from '@/lib/api/http'
import { createLogger, requestIdFrom } from '@/lib/observability/logger'
import {
  assertVoiceEligible,
  libraryRefSchema,
  provisionLibraryVoice,
  voiceErrorResponse,
} from '@/lib/voice-providers/voice-catalog'

const BodySchema = libraryRefSchema.extend({
  name: z.string().max(200).optional(),
})

export async function POST(request: Request) {
  const requestId = requestIdFrom(request)
  let log = createLogger({ requestId, route: 'elevenlabs.voices.add' })
  try {
    assertSameOrigin(request)
    const { user, org } = await requireOrg()
    log = log.child({ orgId: org.id })
    const body = await parseJsonBody(request, BodySchema, 4 * 1024)
    const libraryRef = { publicOwnerId: body.public_owner_id, voiceId: body.voice_id }

    const eligible = await assertVoiceEligible(org.id, { voiceId: body.voice_id, libraryRef })
    if (!eligible.requiresProvisioning) return NextResponse.json({ voice_id: eligible.voiceId })
    const provisioned = await provisionLibraryVoice({
      orgId: org.id,
      userId: user.id,
      libraryRef,
      libraryVoice: eligible.libraryVoice,
      log,
    })
    return NextResponse.json({ voice_id: provisioned.voiceId })
  } catch (err) {
    return voiceErrorResponse(err, log, 'elevenlabs.voices.add.failed', requestId)
  }
}
