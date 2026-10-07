// POST /api/admin/voice/orphans { apply?: false (default), min_age_hours?: 24 }
// Custom voices this platform created in the shared ElevenLabs workspace
// (cloned/designed, described "… for org <uuid> [ntv-env:<env>]") that no
// provider_voices row owns. Voices marked for another environment are never
// listed; unmarked ones are report-only. Dry run by default: lists them (voice
// id, category, org tag, age, hold reason; no names). apply=true deletes only
// voices of this environment whose org is known to be gone (no organizations
// row and an account deletion or voice purge on record), with their speech
// history, audited; the others stay listed with a hold reason.
// Also drains the purge queue of deleted organizations when apply=true.
// Platform admins only.

import { NextResponse } from 'next/server'
import { z } from 'zod'
import { requireAdmin } from '@/lib/api/auth'
import { RequestError, assertSameOrigin, errorResponse, parseJsonBody, requestErrorResponse } from '@/lib/api/http'
import { createLogger, requestIdFrom } from '@/lib/observability/logger'
import { createAdminClient } from '@/lib/supabase/admin'
import { drainVoicePurgeQueue, scanOrphanVoices } from '@/lib/voice-providers/voice-orphans'

export const maxDuration = 300

const Body = z
  .object({
    apply: z.boolean().optional().default(false),
    min_age_hours: z.number().int().min(1).max(24 * 365).optional().default(24),
  })
  .strict()

export async function POST(request: Request) {
  const requestId = requestIdFrom(request)
  const log = createLogger({ requestId, route: 'admin.voice.orphans' })
  try {
    assertSameOrigin(request)
    const admin = await requireAdmin(request)
    const body = await parseJsonBody(request, Body, 4 * 1024)
    const purge = body.apply ? await drainVoicePurgeQueue({ limit: 100, log }) : null
    const report = await scanOrphanVoices({ apply: body.apply, minAgeHours: body.min_age_hours, log })
    if (body.apply) {
      const { error } = await createAdminClient().from('audit_log').insert({
        actor_user_id: admin.userId,
        actor_kind: admin.kind === 'token' ? 'admin_token' : 'admin_user',
        action: 'voice.orphans.applied',
        details: { orphans: report.orphans.length, deleted: report.orphans.filter((o) => o.deleted).length, purge },
      })
      if (error) log.error('admin.audit_write_failed', error)
    }
    log.info('admin.voice.orphans', { by: admin.kind, apply: body.apply, orphans: report.orphans.length })
    return NextResponse.json({ ...report, purge_queue: purge }, { headers: { 'Cache-Control': 'no-store' } })
  } catch (err) {
    if (err instanceof RequestError) return requestErrorResponse(err, requestId)
    return errorResponse(err, log, 'admin.voice.orphans_failed', requestId)
  }
}
