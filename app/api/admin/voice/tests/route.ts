// POST /api/admin/voice/tests — the platform regression suite (ElevenLabs agent
// testing, lib/voice-providers/agent-tests.ts). Admin only, same-origin,
// zod-validated, rate limited platform-wide (every run costs credits).
//   {action: 'sync', dry_run?: true}        create/update the suite's tests (dry run by default)
//   {action: 'run', agent_id?, candidate?, wait_seconds?}
//        run the suite on the canary (ELEVENLABS_TEST_AGENT_ID) or on one of
//        OUR agents picked by its local id; candidate = test the config this
//        deployment would push (agent_config_override) instead of the live one
//   {action: 'status', invocation_id?}      recent runs; refreshes one started here
// Required before raising PLATFORM_AGENT_CONFIG_VERSION (docs/elevenlabs/G.md).
// The response holds statuses, test names, counts and credits only.
import { NextResponse } from 'next/server'
import { z } from 'zod'
import { requireAdmin } from '@/lib/api/auth'
import { RequestError, assertSameOrigin, errorResponse, parseJsonBody, requestErrorResponse } from '@/lib/api/http'
import { createLogger, requestIdFrom } from '@/lib/observability/logger'
import { createAdminClient } from '@/lib/supabase/admin'
import { RATE_LIMITS, enforceRateLimit } from '@/lib/security/rate-limit'
import { resolveRunTarget, runPlatformTests, syncPlatformTests, testRunStatus } from '@/lib/voice-providers/agent-tests'

export const maxDuration = 60

const Body = z.discriminatedUnion('action', [
  z.strictObject({ action: z.literal('sync'), dry_run: z.boolean().optional().default(true) }),
  z.strictObject({
    action: z.literal('run'),
    agent_id: z.uuid().optional(),
    candidate: z.boolean().optional().default(false),
    wait_seconds: z.number().int().min(0).max(45).optional().default(40),
  }),
  z.strictObject({ action: z.literal('status'), invocation_id: z.string().regex(/^[A-Za-z0-9_-]{1,128}$/).optional() }),
])

const NO_STORE = { 'Cache-Control': 'no-store' }

export async function POST(request: Request) {
  const requestId = requestIdFrom(request)
  const log = createLogger({ requestId, route: 'admin.voice.tests' })
  try {
    assertSameOrigin(request)
    const admin = await requireAdmin(request)
    const body = await parseJsonBody(request, Body, 4 * 1024)
    const actor = admin.kind === 'token' ? 'admin_token' : `admin_user:${admin.userId ?? 'unknown'}`

    if (body.action === 'status') {
      await enforceRateLimit(RATE_LIMITS.diagnostics, 'platform:agent_tests', 'Too many status checks. Please wait a moment.')
      const status = await testRunStatus({ invocationId: body.invocation_id ?? null, log })
      if (!status) throw new RequestError('not_found', 'No run with this invocation id was started from this deployment.', 404)
      return NextResponse.json(status, { headers: NO_STORE })
    }

    if (body.action === 'sync') {
      if (!body.dry_run) await enforceRateLimit(RATE_LIMITS.agentTests, 'platform', 'Too many test runs. Please wait before starting another one.')
      const report = await syncPlatformTests({ dryRun: body.dry_run, log })
      if (!body.dry_run) await audit(admin, 'voice.agent_tests.synced', { actions: report.tests.map((t) => `${t.key}:${t.action}`), suite: report.suite_version }, log)
      return NextResponse.json(report, { headers: NO_STORE })
    }

    await enforceRateLimit(RATE_LIMITS.agentTests, 'platform', 'Too many test runs. Please wait before starting another one.')
    const target = await resolveRunTarget(body.agent_id ?? null)
    if (!target) {
      throw new RequestError(
        'invalid_request',
        body.agent_id ? 'That agent has no ElevenLabs agent yet.' : 'Set ELEVENLABS_TEST_AGENT_ID (the canary agent) or pick an agent_id.',
        400,
      )
    }
    const report = await runPlatformTests({ target, candidate: body.candidate, startedBy: actor, waitMs: body.wait_seconds * 1000, log })
    await audit(admin, 'voice.agent_tests.run', { invocation_id: report.invocation_id, agent_id: target.localAgentId, candidate: report.candidate, status: report.status }, log)
    return NextResponse.json(report, { status: 202, headers: NO_STORE })
  } catch (err) {
    if (err instanceof RequestError) return requestErrorResponse(err, requestId)
    return errorResponse(err, log, 'admin.voice_tests_failed', requestId)
  }
}

async function audit(admin: { kind: 'token' | 'user'; userId: string | null }, action: string, details: Record<string, unknown>, log: ReturnType<typeof createLogger>) {
  const { error } = await createAdminClient().from('audit_log').insert({
    actor_user_id: admin.userId,
    actor_kind: admin.kind === 'token' ? 'admin_token' : 'admin_user',
    action,
    details,
  })
  if (error) log.error('admin.audit_write_failed', error)
}
