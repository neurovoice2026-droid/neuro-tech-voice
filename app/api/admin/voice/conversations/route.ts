// POST /api/admin/voice/conversations { limit?: 1–100, sweep?: true }
// Runs the lost-webhook recovery now (the maintenance step
// `conversation_reconcile`): ElevenLabs calls without a final provider result
// are looked up (stored conversation id, or ntv_call_id on the org's own
// agent) and applied through the webhook merge path once final; native
// inbound conversations missing from our calls are swept. Bounded like the
// maintenance step. Responds with counts only. Admin only, same-origin,
// rate limited.
import { NextResponse } from 'next/server'
import { z } from 'zod'
import { requireAdmin } from '@/lib/api/auth'
import { RequestError, assertSameOrigin, errorResponse, parseJsonBody, requestErrorResponse } from '@/lib/api/http'
import { createLogger, requestIdFrom } from '@/lib/observability/logger'
import { enforceRateLimit, type RateLimitRule } from '@/lib/security/rate-limit'
import { reconcileElevenLabsConversations } from '@/lib/voice-providers/conversation-reconcile'

export const maxDuration = 300

const Body = z.strictObject({
  limit: z.number().int().min(1).max(100).optional(),
  sweep: z.boolean().optional().default(true),
})

const RECONCILE_ADMIN_LIMIT: RateLimitRule = { name: 'admin_voice_conversations', limit: 20, windowSeconds: 3_600 }

export async function POST(request: Request) {
  const requestId = requestIdFrom(request)
  const log = createLogger({ requestId, route: 'admin.voice.conversations' })
  try {
    assertSameOrigin(request)
    const admin = await requireAdmin(request)
    const body = await parseJsonBody(request, Body, 2 * 1024)
    await enforceRateLimit(RECONCILE_ADMIN_LIMIT, 'platform', 'Too many reconciliation runs. Please wait a moment.')
    const report = await reconcileElevenLabsConversations({ limit: body.limit, sweep: body.sweep, log })
    log.info('admin.conversations_reconcile', { by: admin.kind, applied: report.applied, swept: report.swept.applied })
    return NextResponse.json(report, { headers: { 'Cache-Control': 'no-store' } })
  } catch (err) {
    if (err instanceof RequestError) return requestErrorResponse(err, requestId)
    return errorResponse(err, log, 'admin.conversations_failed', requestId)
  }
}
