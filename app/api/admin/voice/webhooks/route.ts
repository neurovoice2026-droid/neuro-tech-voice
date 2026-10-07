// POST /api/admin/voice/webhooks { dry_run?: true, enable_retries?: true, reenable?: true, rediscover?: false }
// Health of the ElevenLabs post-call webhook every tenant's call data depends
// on, and its repair. Dry run by default: reports the health and the PATCH it
// would send. With dry_run=false it PATCHes the webhook (current name,
// is_disabled=false, retry_enabled=true; events are never sent) and checks it
// again. `rediscover` forgets a stored discovered id so the next agent sync
// finds the webhook again by URL. Admin only, same-origin, rate limited,
// audited. No secret is read or returned.
import { NextResponse } from 'next/server'
import { z } from 'zod'
import { requireAdmin } from '@/lib/api/auth'
import { RequestError, assertSameOrigin, errorResponse, parseJsonBody, requestErrorResponse } from '@/lib/api/http'
import { createLogger, requestIdFrom } from '@/lib/observability/logger'
import { createAdminClient } from '@/lib/supabase/admin'
import { enforceRateLimit, type RateLimitRule } from '@/lib/security/rate-limit'
import { repairPostCallWebhook } from '@/lib/voice-providers/workspace-settings'
import { POST_CALL_WEBHOOK_RESOURCE, resetPostCallWebhookMemo } from '@/lib/voice-providers/webhook-health'

const Body = z.strictObject({
  dry_run: z.boolean().optional().default(true),
  enable_retries: z.boolean().optional().default(true),
  reenable: z.boolean().optional().default(true),
  rediscover: z.boolean().optional().default(false),
})

const WEBHOOK_ADMIN_LIMIT: RateLimitRule = { name: 'admin_voice_webhooks', limit: 30, windowSeconds: 3_600 }

export async function POST(request: Request) {
  const requestId = requestIdFrom(request)
  const log = createLogger({ requestId, route: 'admin.voice.webhooks' })
  try {
    assertSameOrigin(request)
    const admin = await requireAdmin(request)
    const body = await parseJsonBody(request, Body, 2 * 1024)
    await enforceRateLimit(WEBHOOK_ADMIN_LIMIT, 'platform', 'Too many webhook checks. Please wait a moment.')
    const db = createAdminClient()
    if (body.rediscover && !body.dry_run) {
      const { error } = await db.from('platform_resources').delete().eq('key', POST_CALL_WEBHOOK_RESOURCE)
      if (error) throw new Error(`platform_resources delete failed: ${error.message}`)
      resetPostCallWebhookMemo()
    }
    const result = await repairPostCallWebhook({ dryRun: body.dry_run, enableRetries: body.enable_retries, reenable: body.reenable, log })
    if (!body.dry_run) {
      const { error } = await db.from('audit_log').insert({
        actor_user_id: admin.userId,
        actor_kind: admin.kind === 'token' ? 'admin_token' : 'admin_user',
        action: 'voice.post_call_webhook.updated',
        details: { webhook_id: result.plan.webhook_id, applied: result.applied, patch: result.plan.patch, rediscovered: body.rediscover },
      })
      if (error) log.error('admin.audit_write_failed', error)
    }
    log.info('admin.webhooks', { by: admin.kind, dryRun: body.dry_run, applied: result.applied })
    return NextResponse.json(result, { headers: { 'Cache-Control': 'no-store' } })
  } catch (err) {
    if (err instanceof RequestError) return requestErrorResponse(err, requestId)
    return errorResponse(err, log, 'admin.webhooks_failed', requestId)
  }
}
