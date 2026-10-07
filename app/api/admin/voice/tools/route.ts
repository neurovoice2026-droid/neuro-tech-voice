// POST /api/admin/voice/tools { resync_degraded?: boolean, limit?: number }
// Platform webhook tools on demand (the maintenance step `platform_tools` runs
// the same reconcile): verifies the workspace secret (rotation when
// ELEVENLABS_TOOL_SECRET changed) and every platform tool (PATCH on config
// drift, recreate when deleted). Run it right after a deploy that changes a
// tool, so the tool switches to header authentication at once.
// With resync_degraded, agents whose last sync could not obtain the transfer
// tool are synced again (at most `limit`). Admin only, same-origin, rate
// limited platform-wide; the response holds statuses, counts and internal
// agent ids only (no secret, no provider payload).
import { NextResponse } from 'next/server'
import { z } from 'zod'
import { requireAdmin } from '@/lib/api/auth'
import { RequestError, assertSameOrigin, errorResponse, parseJsonBody, requestErrorResponse } from '@/lib/api/http'
import { createLogger, requestIdFrom } from '@/lib/observability/logger'
import { createAdminClient } from '@/lib/supabase/admin'
import { enforceRateLimit, type RateLimitRule } from '@/lib/security/rate-limit'
import { TRANSFER_TOOL_DEGRADED, reconcilePlatformTools } from '@/lib/voice-providers/platform-tools'
import { syncAgent } from '@/lib/voice-providers/agent-sync'

export const maxDuration = 300

const Body = z.strictObject({
  resync_degraded: z.boolean().optional().default(false),
  limit: z.number().int().min(1).max(50).optional().default(20),
})

/** Every run calls ElevenLabs (and may PATCH or create workspace resources). */
const TOOLS_RATE_LIMIT: RateLimitRule = { name: 'admin_voice_tools', limit: 20, windowSeconds: 3_600 }

export async function POST(request: Request) {
  const requestId = requestIdFrom(request)
  const log = createLogger({ requestId, route: 'admin.voice.tools' })
  try {
    assertSameOrigin(request)
    const admin = await requireAdmin(request)
    const body = await parseJsonBody(request, Body, 4 * 1024)
    await enforceRateLimit(TOOLS_RATE_LIMIT, 'platform', 'Too many tool reconcile runs. Please wait before starting another one.')
    const report = await reconcilePlatformTools({ log })
    const tools = report.tools.map((t) => ({ key: t.key, status: t.status, action: t.action ?? null, code: t.code ?? null, message: t.message ?? null }))

    const resynced: Array<{ agentId: string; status: string; degraded: string | null }> = []
    const transferOk = report.tools.some((t) => t.key === 'elevenlabs.transfer_tool' && t.status === 'ok')
    if (body.resync_degraded && transferOk) {
      const db = createAdminClient()
      const { data, error } = await db
        .from('agent_provider_resources')
        .select('agent_id')
        .eq('provider', 'elevenlabs')
        .eq('status', 'degraded')
        .eq('last_error_code', TRANSFER_TOOL_DEGRADED.code)
        .limit(body.limit)
      if (error) throw new Error(`agent_provider_resources read failed: ${error.message}`)
      for (const r of data ?? []) {
        const agentId = r.agent_id as string
        try {
          const [res] = await syncAgent(agentId, { providers: ['elevenlabs'], log })
          resynced.push({ agentId, status: res?.status ?? 'unknown', degraded: res?.degraded ?? null })
        } catch (err) {
          log.error('admin.tools_resync_failed', err, { agentId })
          resynced.push({ agentId, status: 'error', degraded: null })
        }
      }
    }

    const { error: auditErr } = await createAdminClient().from('audit_log').insert({
      actor_user_id: admin.userId,
      actor_kind: admin.kind === 'token' ? 'admin_token' : 'admin_user',
      action: 'voice.platform_tools.reconciled',
      details: { secret: report.secret.status, tools: tools.map((t) => `${t.key}:${t.status}:${t.action ?? t.code}`), resynced: resynced.length },
    })
    if (auditErr) log.error('admin.audit_write_failed', auditErr)
    log.info('admin.tools_reconciled', { by: admin.kind, secret: report.secret.status, tools: tools.map((t) => t.status), resynced: resynced.length })
    return NextResponse.json({ configured: report.configured, secret: report.secret, tools, resynced }, { headers: { 'Cache-Control': 'no-store' } })
  } catch (err) {
    if (err instanceof RequestError) return requestErrorResponse(err, requestId)
    return errorResponse(err, log, 'admin.tools_failed', requestId)
  }
}
