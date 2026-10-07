// POST /api/admin/voice/tts-history { apply?: false (default), older_than_days?: 7, limit?: 500 }
// Text-to-speech items of the shared workspace's speech history older than N
// days (voice previews were stored there before zero retention was asked
// for). Dry run by default: counts per voice category only (no text, no voice
// names). apply=true deletes up to `limit` items (irreversible), audited.
// Platform admins only.

import { NextResponse } from 'next/server'
import { z } from 'zod'
import { requireAdmin } from '@/lib/api/auth'
import { RequestError, assertSameOrigin, errorResponse, parseJsonBody, requestErrorResponse } from '@/lib/api/http'
import * as el from '@/lib/elevenlabs/client'
import { createLogger, requestIdFrom } from '@/lib/observability/logger'
import { createAdminClient } from '@/lib/supabase/admin'
import { purgeOldTtsHistory } from '@/lib/voice-providers/tts-history'

export const maxDuration = 300

const Body = z
  .object({
    apply: z.boolean().optional().default(false),
    older_than_days: z.number().int().min(1).max(365).optional().default(7),
    limit: z.number().int().min(1).max(5000).optional().default(500),
  })
  .strict()

export async function POST(request: Request) {
  const requestId = requestIdFrom(request)
  const log = createLogger({ requestId, route: 'admin.voice.tts_history' })
  try {
    assertSameOrigin(request)
    const admin = await requireAdmin(request)
    const body = await parseJsonBody(request, Body, 4 * 1024)
    if (!el.isConfigured()) throw new RequestError('not_configured', 'ElevenLabs is not configured.', 503)
    const report = await purgeOldTtsHistory({ olderThanDays: body.older_than_days, apply: body.apply, limit: body.limit, log })
    if (body.apply) {
      const { error } = await createAdminClient().from('audit_log').insert({
        actor_user_id: admin.userId,
        actor_kind: admin.kind === 'token' ? 'admin_token' : 'admin_user',
        action: 'voice.tts_history.purged',
        details: { older_than_days: body.older_than_days, matched: report.matched, deleted: report.deleted, failed: report.failed },
      })
      if (error) log.error('admin.audit_write_failed', error)
    }
    return NextResponse.json(report, { headers: { 'Cache-Control': 'no-store' } })
  } catch (err) {
    if (err instanceof RequestError) return requestErrorResponse(err, requestId)
    return errorResponse(err, log, 'admin.voice.tts_history_failed', requestId)
  }
}
