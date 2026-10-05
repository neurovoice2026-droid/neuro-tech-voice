// DELETE /api/voices/[voiceId] — deletes one of the org's own cloned voices
// (provider + registry). 409 while the org's agent uses it; library and default
// voices are platform-wide and cannot be deleted here (404).

import { NextResponse } from 'next/server'
import { requireOrg } from '@/lib/api/auth'
import { RequestError, assertSameOrigin } from '@/lib/api/http'
import { createLogger, requestIdFrom } from '@/lib/observability/logger'
import { EL_VOICE_ID_RE, deleteOrgClone, voiceErrorResponse } from '@/lib/voice-providers/voice-catalog'

export async function DELETE(request: Request, { params }: { params: Promise<{ voiceId: string }> }) {
  const requestId = requestIdFrom(request)
  let log = createLogger({ requestId, route: 'voices.delete' })
  try {
    assertSameOrigin(request)
    const { user, org } = await requireOrg()
    log = log.child({ orgId: org.id })
    const { voiceId } = await params
    if (!EL_VOICE_ID_RE.test(voiceId)) throw new RequestError('invalid_request', 'Invalid voice id.', 400)

    await deleteOrgClone({ orgId: org.id, userId: user.id, voiceId, log })
    return NextResponse.json({ deleted: true, voice_id: voiceId })
  } catch (err) {
    return voiceErrorResponse(err, log, 'voices.delete.failed', requestId)
  }
}
