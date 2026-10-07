// POST /api/admin/voice/web-tests { org_id }
// Turns an organisation's browser tests back on after they were paused by a
// session far longer than the cap (web_test.blocked_session_over_limit). The
// spent seconds stay counted. Audited; the response holds the org id and
// whether a block was lifted.
import { NextResponse } from 'next/server'
import { z } from 'zod'
import { requireAdmin } from '@/lib/api/auth'
import { RequestError, assertSameOrigin, errorResponse, parseJsonBody, requestErrorResponse } from '@/lib/api/http'
import { createLogger, requestIdFrom } from '@/lib/observability/logger'
import { createAdminClient } from '@/lib/supabase/admin'
import { resetWebTestBlock } from '@/lib/voice-providers/web-test'

const Body = z.strictObject({ org_id: z.string().uuid() })

export async function POST(request: Request) {
  const requestId = requestIdFrom(request)
  const log = createLogger({ requestId, route: 'admin.voice.web_tests' })
  try {
    assertSameOrigin(request)
    const admin = await requireAdmin(request)
    const body = await parseJsonBody(request, Body, 1024)
    const db = createAdminClient()
    const reset = await resetWebTestBlock(body.org_id, log, db)
    if (reset) {
      const { error } = await db.from('audit_log').insert({
        org_id: body.org_id,
        actor_user_id: admin.userId,
        actor_kind: admin.kind === 'token' ? 'admin_token' : 'admin_user',
        action: 'voice.web_test.block_reset',
        details: {},
      })
      if (error) log.error('admin.audit_write_failed', error)
    }
    log.info('admin.web_test_block_reset', { by: admin.kind, orgId: body.org_id, reset })
    return NextResponse.json({ org_id: body.org_id, reset }, { headers: { 'Cache-Control': 'no-store' } })
  } catch (err) {
    if (err instanceof RequestError) return requestErrorResponse(err, requestId)
    return errorResponse(err, log, 'admin.web_test_block_reset_failed', requestId)
  }
}
