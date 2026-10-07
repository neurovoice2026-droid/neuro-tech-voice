// POST /api/elevenlabs/voices/add — REMOVED (410 Gone).
// It provisioned a library voice into the shared workspace and returned its
// id WITHOUT applying it to the caller's agent, so it could be used to spend
// the shared workspace's monthly voice add/edit quota. No client uses it: the
// voice pickers (onboarding step 3 and the agent's Voice tab) call
// PUT /api/agent/voice with library_ref, which provisions the voice (rate
// limit, per-organization caps, workspace headroom) AND applies it to the
// organization's own agent in one step.

import { apiError } from '@/lib/api/http'
import { requestIdFrom } from '@/lib/observability/logger'

export async function POST(request: Request) {
  return apiError('not_found', 'This endpoint was removed. Use PUT /api/agent/voice with library_ref.', 410, {
    requestId: requestIdFrom(request),
    details: { replacement: 'PUT /api/agent/voice' },
    headers: { 'Cache-Control': 'no-store' },
  })
}
