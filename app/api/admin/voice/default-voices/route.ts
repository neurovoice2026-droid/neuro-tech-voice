// POST /api/admin/voice/default-voices { apply?: false (default), force?: false }
// Agents still on a retired ElevenLabs default voice (or on a voice that no
// longer exists, or saved without a voice). Dry run by default: counts.
// apply=true runs the migration step now; it only switches voices from
// ELEVENLABS_DEFAULT_VOICE_MIGRATION_AT (default 2026-12-15) unless force=true.
// Switching uses the PUT /api/agent/voice path (save, full sync, echo check)
// with the curated voice of each agent's language, audited per agent.
//
// POST /api/admin/voice/default-voices { check_library: true } runs the daily
// library-voice lifecycle check now instead (removal notices, bans, removed voices).
// Platform admins only.

import { NextResponse } from 'next/server'
import { z } from 'zod'
import { requireAdmin } from '@/lib/api/auth'
import { RequestError, assertSameOrigin, errorResponse, parseJsonBody, requestErrorResponse } from '@/lib/api/http'
import { createLogger, requestIdFrom } from '@/lib/observability/logger'
import { createAdminClient } from '@/lib/supabase/admin'
import { runDefaultVoiceMigration } from '@/lib/voice-providers/default-voices'
import { checkLibraryVoices } from '@/lib/voice-providers/library-lifecycle'

export const maxDuration = 300

const Body = z
  .object({
    apply: z.boolean().optional().default(false),
    force: z.boolean().optional().default(false),
    check_library: z.boolean().optional().default(false),
  })
  .strict()

export async function POST(request: Request) {
  const requestId = requestIdFrom(request)
  const log = createLogger({ requestId, route: 'admin.voice.default_voices' })
  try {
    assertSameOrigin(request)
    const admin = await requireAdmin(request)
    const body = await parseJsonBody(request, Body, 4 * 1024)
    if (body.force && !body.apply) throw new RequestError('invalid_request', 'force requires apply=true.', 400)
    if (body.check_library) {
      const lifecycle = await checkLibraryVoices({ log })
      return NextResponse.json({ library: lifecycle }, { headers: { 'Cache-Control': 'no-store' } })
    }
    const report = await runDefaultVoiceMigration({ log, dryRun: !body.apply, force: body.force, timeBudgetMs: 240_000, maxMigrations: 100 })
    if (body.apply) {
      const { error } = await createAdminClient().from('audit_log').insert({
        actor_user_id: admin.userId,
        actor_kind: admin.kind === 'token' ? 'admin_token' : 'admin_user',
        action: 'voice.default_migration.run',
        details: { force: body.force, mode: report.mode, migrated: report.migrated, failed: report.failed, remaining: report.remaining },
      })
      if (error) log.error('admin.audit_write_failed', error)
    }
    return NextResponse.json(report, { headers: { 'Cache-Control': 'no-store' } })
  } catch (err) {
    if (err instanceof RequestError) return requestErrorResponse(err, requestId)
    return errorResponse(err, log, 'admin.voice.default_voices_failed', requestId)
  }
}
