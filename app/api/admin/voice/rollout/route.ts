// POST /api/admin/voice/rollout { dry_run?: boolean, limit?: number }
// Platform config rollout on demand (the maintenance step `config_rollout`
// runs the same code with the env batch size). Dry-run by default: it reports
// how many synced ElevenLabs agents drifted from the current platform config.
// With dry_run=false it re-syncs up to `limit` of them, least recently checked
// first; it never creates agents and stops while the ElevenLabs API circuit is
// not closed. The response holds counts and internal agent ids only.
import { NextResponse } from 'next/server'
import { z } from 'zod'
import { requireAdmin } from '@/lib/api/auth'
import { RequestError, assertSameOrigin, errorResponse, parseJsonBody, requestErrorResponse } from '@/lib/api/http'
import { createLogger, requestIdFrom } from '@/lib/observability/logger'
import { createAdminClient } from '@/lib/supabase/admin'
import { enforceRateLimit, type RateLimitRule } from '@/lib/security/rate-limit'
import { runConfigRollout } from '@/lib/voice-providers/config-rollout'

export const maxDuration = 300

const Body = z.strictObject({
  dry_run: z.boolean().optional().default(true),
  limit: z.number().int().min(1).max(50).optional(),
  scan: z.number().int().min(1).max(1000).optional(),
})

/** Every applied run PATCHes provider agents: bounded platform-wide. */
const ROLLOUT_RATE_LIMIT: RateLimitRule = { name: 'admin_voice_rollout', limit: 20, windowSeconds: 3_600 }

export async function POST(request: Request) {
  const requestId = requestIdFrom(request)
  const log = createLogger({ requestId, route: 'admin.voice.rollout' })
  try {
    assertSameOrigin(request)
    const admin = await requireAdmin(request)
    const body = await parseJsonBody(request, Body, 4 * 1024)
    await enforceRateLimit(ROLLOUT_RATE_LIMIT, 'platform', 'Too many rollout runs. Please wait before starting another one.')
    const report = await runConfigRollout({ dryRun: body.dry_run, limit: body.limit, scan: body.scan, log })
    if (!body.dry_run) {
      const { error } = await createAdminClient().from('audit_log').insert({
        actor_user_id: admin.userId,
        actor_kind: admin.kind === 'token' ? 'admin_token' : 'admin_user',
        action: 'voice.config_rollout.applied',
        details: { platform_version: report.platformVersion, synced: report.synced.length, drifted: report.drifted, errors: report.errors },
      })
      if (error) log.error('admin.audit_write_failed', error)
    }
    log.info('admin.rollout', { by: admin.kind, dryRun: body.dry_run, drifted: report.drifted, synced: report.synced.length })
    return NextResponse.json(report, { headers: { 'Cache-Control': 'no-store' } })
  } catch (err) {
    if (err instanceof RequestError) return requestErrorResponse(err, requestId)
    return errorResponse(err, log, 'admin.rollout_failed', requestId)
  }
}
