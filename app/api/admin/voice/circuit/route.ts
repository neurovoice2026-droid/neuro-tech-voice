// Circuit breaker overrides (incident runbook).
//   GET  → current state of both circuits
//   POST { provider, action: 'open' | 'close' | 'auto' }
// 'open' forces new calls away from the provider (e.g. ElevenLabs incident);
// 'close' forces it back; 'auto' returns control to the breaker.
// For a deployment-wide kill switch use VOICE_FORCE_PROVIDER instead.
import { NextResponse } from 'next/server'
import { z } from 'zod'
import { requireAdmin } from '@/lib/api/auth'
import { RequestError, assertSameOrigin, errorResponse, parseJsonBody, requestErrorResponse } from '@/lib/api/http'
import { createLogger, requestIdFrom } from '@/lib/observability/logger'
import { createAdminClient } from '@/lib/supabase/admin'
import { forceCircuit, peek } from '@/lib/voice-providers/circuit-registry'

const Body = z.object({
  provider: z.enum(['elevenlabs', 'cartesia']),
  action: z.enum(['open', 'close', 'auto']),
  reason: z.string().trim().max(300).optional(),
})

export async function GET(request: Request) {
  const requestId = requestIdFrom(request)
  const log = createLogger({ requestId, route: 'admin.voice.circuit' })
  try {
    await requireAdmin(request)
    const [elevenlabs, cartesia] = await Promise.all([peek('elevenlabs'), peek('cartesia')])
    return NextResponse.json({ elevenlabs, cartesia }, { headers: { 'Cache-Control': 'no-store' } })
  } catch (err) {
    if (err instanceof RequestError) return requestErrorResponse(err, requestId)
    return errorResponse(err, log, 'admin.circuit_read_failed', requestId)
  }
}

export async function POST(request: Request) {
  const requestId = requestIdFrom(request)
  const log = createLogger({ requestId, route: 'admin.voice.circuit' })
  try {
    assertSameOrigin(request)
    const admin = await requireAdmin(request)
    const body = await parseJsonBody(request, Body, 4 * 1024)
    const forced = body.action === 'open' ? 'open' : body.action === 'close' ? 'closed' : null
    const state = await forceCircuit(body.provider, forced)
    log.warn('admin.circuit_forced', { provider: body.provider, action: body.action, by: admin.kind })
    const { error } = await createAdminClient().from('audit_log').insert({
      actor_user_id: admin.userId,
      actor_kind: admin.kind === 'token' ? 'admin_token' : 'admin_user',
      action: 'voice.circuit.forced',
      target_type: 'provider',
      target_id: body.provider,
      details: { action: body.action, reason: body.reason ?? null },
    })
    if (error) log.error('admin.audit_write_failed', error)
    return NextResponse.json({ provider: body.provider, state }, { headers: { 'Cache-Control': 'no-store' } })
  } catch (err) {
    if (err instanceof RequestError) return requestErrorResponse(err, requestId)
    return errorResponse(err, log, 'admin.circuit_failed', requestId)
  }
}
