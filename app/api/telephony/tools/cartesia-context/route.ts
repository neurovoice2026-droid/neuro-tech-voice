// Webhook tool `get_call_context` for the Cartesia fallback agent. Cartesia
// calls it at the start of a call with the called/caller numbers (system
// dynamic variables); we answer with the minimum context the agent needs to
// behave like the primary agent: is the business closed right now, call
// direction and the business name. No caller PII is returned. Store agents
// (lib/commerce) additionally get the script variables of a campaign call
// (call_reason, order number, customer name…), only when the caller id is
// that campaign call's callee; every other call gets call_reason "inbound".
// Auth: static bearer token (CARTESIA_TOOL_SECRET) configured on the tool.
import crypto from 'crypto'
import { NextResponse } from 'next/server'
import { z } from 'zod'
import { createAdminClient } from '@/lib/supabase/admin'
import { createLogger, requestIdFrom } from '@/lib/observability/logger'
import { RequestError, parseJsonBody } from '@/lib/api/http'
import { emitProviderEvent } from '@/lib/observability/telemetry'
import { normalizeE164 } from '@/lib/phone/e164'
import { findNumber, loadRoutingContext } from '@/lib/telephony/context'
import { formatIsoWithOffset } from '@/lib/scheduling/time'

const Body = z.object({
  called_number: z.string().max(64).optional(),
  caller_number: z.string().max(64).optional(),
  direction: z.string().max(32).optional(),
})

function authorized(request: Request): boolean {
  const secret = (process.env.CARTESIA_TOOL_SECRET ?? '').trim()
  if (secret.length < 24) return false
  const header = request.headers.get('authorization') ?? ''
  const given = header.startsWith('Bearer ') ? header.slice(7).trim() : ''
  if (!given) return false
  const a = crypto.createHash('sha256').update(given).digest()
  const b = crypto.createHash('sha256').update(secret).digest()
  return crypto.timingSafeEqual(a, b)
}

const UNKNOWN = { after_hours: false, direction: 'unknown', business_name: null, business_local_time: null }

export async function POST(request: Request) {
  const requestId = requestIdFrom(request)
  const log = createLogger({ requestId, route: 'tools.cartesia_context', provider: 'cartesia' })
  if (!authorized(request)) {
    emitProviderEvent({ system: 'cartesia', kind: 'webhook_verification_failed', ok: false, details: { path: 'tools/cartesia-context' } })
    log.warn('tools.context_unauthorized')
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }
  let body: z.infer<typeof Body>
  try {
    body = await parseJsonBody(request, Body, 8 * 1024)
  } catch (err) {
    if (err instanceof RequestError) return NextResponse.json({ error: err.code }, { status: err.status })
    log.error('tools.context_body_failed', err)
    return NextResponse.json({ error: 'invalid_request' }, { status: 400 })
  }

  try {
    const called = normalizeE164(body.called_number ?? '')
    const caller = normalizeE164(body.caller_number ?? '')
    if (!called) return NextResponse.json(UNKNOWN)
    const db = createAdminClient()
    const number = await findNumber(db, called)
    if (!number) return NextResponse.json(UNKNOWN)

    // The router recorded the decision (incl. after-hours "AI answers" mode)
    // on the call row before dialing Cartesia; prefer it over re-evaluating.
    const since = new Date(Date.now() - 15 * 60_000).toISOString()
    const { data: calls, error } = await db
      .from('calls')
      .select('id, direction, routing, from_number, to_number, commerce_run_id')
      .eq('org_id', number.org_id)
      .eq('phone_number_id', number.id)
      .eq('provider', 'cartesia')
      .gte('created_at', since)
      .order('created_at', { ascending: false })
      .limit(10)
    if (error) throw new Error(`calls lookup failed: ${error.message}`)
    // Inbound: the caller is the customer; outbound: the router presents the
    // callee as the SIP caller id, so match either side.
    const call = (calls ?? []).find((c) => !caller || c.from_number === caller || c.to_number === caller)

    const ctx = await loadRoutingContext(number)
    const routing = (call?.routing ?? {}) as { after_hours?: boolean }
    const afterHours = typeof routing.after_hours === 'boolean' ? routing.after_hours : !(ctx.routingInput?.hours.open ?? true)
    // Store agents (lib/commerce): the typed script values of a campaign call
    // were written on the call row at dispatch; an inbound store call gets
    // call_reason "inbound" and no order. Unlike after_hours/direction, these
    // name a customer and their order, so the loose match above is not enough:
    // they are only answered when the caller id is present and the matched row
    // is that campaign call itself (outbound, our line → this callee), the
    // same both-numbers rule as lib/voice-tools/cartesia-call.ts. A withheld
    // caller id, or the newest row on the line being another customer's
    // campaign call, therefore never leaks that customer's order.
    const campaignCallee = !!caller && !!call && call.direction === 'outbound' && call.from_number === called && call.to_number === caller && typeof call.commerce_run_id === 'string'
    const commerceVariables = campaignCallee ? (call.routing as { commerce_variables?: Record<string, unknown> } | null)?.commerce_variables : undefined
    const commerce = commerceVariables && typeof commerceVariables === 'object' && !Array.isArray(commerceVariables)
      ? Object.fromEntries(Object.entries(commerceVariables).filter(([, v]) => typeof v === 'string').map(([k, v]) => [k, String(v).slice(0, 500)]))
      : null
    log.info('tools.context', { orgId: number.org_id, callId: call?.id ?? null, matched: !!call, commerce: commerce !== null })
    return NextResponse.json(
      {
        after_hours: afterHours,
        direction: (call?.direction as string | undefined) ?? (body.direction === 'outbound' ? 'outbound' : 'inbound'),
        business_name: ctx.org.name,
        business_local_time: formatIsoWithOffset(Date.now(), ctx.org.timezone),
        call_reason: commerce?.call_reason ?? 'inbound',
        ...(commerce ?? {}),
      },
      { headers: { 'Cache-Control': 'no-store' } },
    )
  } catch (err) {
    log.error('tools.context_failed', err)
    // The agent proceeds with defaults (open, inbound) rather than failing the call.
    return NextResponse.json(UNKNOWN, { headers: { 'Cache-Control': 'no-store' } })
  }
}
