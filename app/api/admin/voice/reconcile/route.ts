// POST /api/admin/voice/reconcile { apply?: boolean, delete_orphans?: boolean, limit? }
// Dry-run by default. Used by scripts/reconcile-voice-providers.mjs.
import { NextResponse } from 'next/server'
import { z } from 'zod'
import { requireAdmin } from '@/lib/api/auth'
import { RequestError, assertSameOrigin, errorResponse, parseJsonBody, requestErrorResponse } from '@/lib/api/http'
import { createLogger, requestIdFrom } from '@/lib/observability/logger'
import { createAdminClient } from '@/lib/supabase/admin'
import { reconcileVoiceProviders } from '@/lib/voice-providers/reconcile'

export const maxDuration = 300

const Body = z.object({
  apply: z.boolean().optional().default(false),
  delete_orphans: z.boolean().optional().default(false),
  limit: z.number().int().min(1).max(2000).optional().default(500),
})

export async function POST(request: Request) {
  const requestId = requestIdFrom(request)
  const log = createLogger({ requestId, route: 'admin.voice.reconcile' })
  try {
    assertSameOrigin(request)
    const admin = await requireAdmin(request)
    const body = await parseJsonBody(request, Body, 4 * 1024)
    if (body.delete_orphans && !body.apply) throw new RequestError('invalid_request', 'delete_orphans requires apply=true.', 400)
    const report = await reconcileVoiceProviders({ apply: body.apply, deleteOrphans: body.delete_orphans, limit: body.limit, log })
    if (body.apply) {
      const { error } = await createAdminClient().from('audit_log').insert({
        actor_user_id: admin.userId,
        actor_kind: admin.kind === 'token' ? 'admin_token' : 'admin_user',
        action: 'voice.reconcile.applied',
        details: { issues: report.issues.length, orphans_deleted: report.orphans.filter((o) => o.deleted).length },
      })
      if (error) log.error('admin.audit_write_failed', error)
    }
    return NextResponse.json(report, { headers: { 'Cache-Control': 'no-store' } })
  } catch (err) {
    if (err instanceof RequestError) return requestErrorResponse(err, requestId)
    return errorResponse(err, log, 'admin.reconcile_failed', requestId)
  }
}
