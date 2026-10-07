// POST /api/admin/voice/convai-settings { dry_run?: true, embedding_retention_days?: 1–365 }
// Aligns the workspace's conversation_embedding_retention_days
// (GET/PATCH /v1/convai/settings) with the platform privacy policy
// (ELEVENLABS_EMBEDDING_RETENTION_DAYS, default 30 = the shortest retention a
// tenant can pick). Dry run by default. The PATCH is WORKSPACE-WIDE: it is a
// read-modify-write of the whole settings object, read back afterwards, and
// any other field that changed is reported. Admin only, same-origin, rate
// limited, audited. Header values are never returned.
import { NextResponse } from 'next/server'
import { z } from 'zod'
import { requireAdmin } from '@/lib/api/auth'
import { RequestError, assertSameOrigin, errorResponse, parseJsonBody, requestErrorResponse } from '@/lib/api/http'
import { createLogger, requestIdFrom } from '@/lib/observability/logger'
import { createAdminClient } from '@/lib/supabase/admin'
import { enforceRateLimit, type RateLimitRule } from '@/lib/security/rate-limit'
import { EMBEDDING_RETENTION_MAX_DAYS, EMBEDDING_RETENTION_MIN_DAYS } from '@/lib/elevenlabs/api/workspace'
import { alignEmbeddingRetention } from '@/lib/voice-providers/workspace-settings'

const Body = z.strictObject({
  dry_run: z.boolean().optional().default(true),
  embedding_retention_days: z.number().int().min(EMBEDDING_RETENTION_MIN_DAYS).max(EMBEDDING_RETENTION_MAX_DAYS).optional(),
})

const SETTINGS_ADMIN_LIMIT: RateLimitRule = { name: 'admin_voice_convai_settings', limit: 20, windowSeconds: 3_600 }

export async function POST(request: Request) {
  const requestId = requestIdFrom(request)
  const log = createLogger({ requestId, route: 'admin.voice.convai_settings' })
  try {
    assertSameOrigin(request)
    const admin = await requireAdmin(request)
    const body = await parseJsonBody(request, Body, 2 * 1024)
    await enforceRateLimit(SETTINGS_ADMIN_LIMIT, 'platform', 'Too many settings changes. Please wait a moment.')
    const result = await alignEmbeddingRetention({ dryRun: body.dry_run, days: body.embedding_retention_days, log })
    if (result.applied) {
      const { error } = await createAdminClient().from('audit_log').insert({
        actor_user_id: admin.userId,
        actor_kind: admin.kind === 'token' ? 'admin_token' : 'admin_user',
        action: 'voice.convai_settings.embedding_retention',
        details: { change: result.change, other_fields_changed: result.other_fields_changed },
      })
      if (error) log.error('admin.audit_write_failed', error)
    }
    log.info('admin.convai_settings', { by: admin.kind, dryRun: body.dry_run, applied: result.applied })
    return NextResponse.json(result, { headers: { 'Cache-Control': 'no-store' } })
  } catch (err) {
    if (err instanceof RequestError) return requestErrorResponse(err, requestId)
    return errorResponse(err, log, 'admin.convai_settings_failed', requestId)
  }
}
