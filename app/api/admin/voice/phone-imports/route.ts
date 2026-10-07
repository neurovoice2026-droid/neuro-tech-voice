// POST /api/admin/voice/phone-imports { apply?: boolean, delete_orphans?: boolean, limit?: 1–200 }
// Native ElevenLabs imports of this environment vs our phone_numbers rows
// (lib/telephony/import-reconcile.ts). Dry run by default; deleting orphans
// needs apply AND delete_orphans and never touches an import assigned to an
// agent this database does not know. Platform admins only.
import { NextResponse } from 'next/server'
import { z } from 'zod'
import { requireAdmin } from '@/lib/api/auth'
import { RequestError, assertSameOrigin, errorResponse, parseJsonBody, requestErrorResponse } from '@/lib/api/http'
import { createLogger, requestIdFrom } from '@/lib/observability/logger'
import { createAdminClient } from '@/lib/supabase/admin'
import { enforceRateLimit, type RateLimitRule } from '@/lib/security/rate-limit'
import { reconcileNativeImports } from '@/lib/telephony/import-reconcile'

export const maxDuration = 120

const Body = z.object({
  apply: z.boolean().optional().default(false),
  delete_orphans: z.boolean().optional().default(false),
  limit: z.number().int().min(1).max(200).optional().default(50),
})

/** Provider listing + deletions: 20 runs per hour platform-wide. */
const RULE: RateLimitRule = { name: 'admin_phone_imports', limit: 20, windowSeconds: 3_600 }

export async function POST(request: Request) {
  const requestId = requestIdFrom(request)
  const log = createLogger({ requestId, route: 'admin.voice.phone_imports' })
  try {
    assertSameOrigin(request)
    const admin = await requireAdmin(request)
    const body = await parseJsonBody(request, Body, 4 * 1024)
    if (body.delete_orphans && !body.apply) throw new RequestError('invalid_request', 'delete_orphans requires apply=true.', 400)
    await enforceRateLimit(RULE, 'platform')
    const report = await reconcileNativeImports({ apply: body.apply, deleteOrphans: body.delete_orphans, limit: body.limit, log })
    if (body.apply) {
      const { error } = await createAdminClient().from('audit_log').insert({
        actor_user_id: admin.userId,
        actor_kind: admin.kind === 'token' ? 'admin_token' : 'admin_user',
        action: 'voice.phone_imports.applied',
        details: { orphans: report.orphans.length, deleted: report.deleted, issues: report.issues.length },
      })
      if (error) log.error('admin.audit_write_failed', error)
    }
    return NextResponse.json(report, { headers: { 'Cache-Control': 'no-store' } })
  } catch (err) {
    if (err instanceof RequestError) return requestErrorResponse(err, requestId)
    return errorResponse(err, log, 'admin.phone_imports_failed', requestId)
  }
}
