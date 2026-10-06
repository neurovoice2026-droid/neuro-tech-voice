import 'server-only'
// Per-call telephony router. Twilio numbers in `app_routed` mode point their
// voice webhook here, so EVERY call is decided by us before any provider is
// involved:
//
//   1. unknown number            → <Reject> (not answered, not billed)
//   2. number/agent inactive     → localized "unavailable" + hang up
//   3. after hours (message/forward)  → same for both providers
//   4. ElevenLabs (primary)      → register-call TwiML (+ <Redirect> to
//      stream-ended so an early media failure can still fail over)
//   5. ElevenLabs unavailable    → ONE attempt on the Cartesia fallback agent
//      (circuit open / not configured / register-call failed)  via <Dial><Sip>
//   6. nothing available         → apology + human handoff if configured
//
// In-call failures are not "handed off" mid-conversation (neither platform
// supports transplanting a live conversation): only a media failure in the
// first seconds of an inbound call (stream-ended within the early-failure
// window, no audio exchanged yet) is retried on Cartesia, once, and recorded.

import type { SupabaseClient } from '@supabase/supabase-js'
import { createAdminClient } from '@/lib/supabase/admin'
import { createLogger, type Logger } from '@/lib/observability/logger'
import { emitProviderEvent, deferBackground } from '@/lib/observability/telemetry'
import { outboundRoutingInput, planRouting, type Candidate } from '@/lib/voice-providers/routing'
import { reportOutcome } from '@/lib/voice-providers/circuit-registry'
import { isProviderError, toProviderError, type VoiceProvider } from '@/lib/voice-providers/errors'
import { cartesiaSip, earlyFailureWindowSeconds, publicBaseUrl } from '@/lib/voice-providers/config'
import { PLATFORM_VARIABLES } from '@/lib/voice-providers/prompt'
import { AFTER_HOURS_MESSAGE } from '@/lib/voice-providers/working-hours'
import * as el from '@/lib/elevenlabs/client'
import { maskPhone, normalizeE164 } from '@/lib/phone/e164'
import { APOLOGY_MESSAGE, UNAVAILABLE_MESSAGE, localized, outboundGreetingFor, applyDisclosure } from '@/lib/voice/greetings'
import { signCallToken } from './tokens'
import { appendRedirect, dialCartesiaSip, forwardCall, hangup, reject, sayAndHangup } from './twiml'
import { findNumber, loadRoutingContext, numberById, type RoutingContext } from './context'

const CALL_TOKEN_TTL_S = 4 * 60 * 60

export interface RoutingAttempt {
  provider: VoiceProvider
  at: string
  ok: boolean
  error_code?: string | null
  probe?: boolean
}

interface CallRow {
  id: string
  org_id: string
  agent_id: string | null
  phone_number_id: string | null
  direction: 'inbound' | 'outbound'
  status: string
  provider: VoiceProvider | null
  from_number: string | null
  to_number: string | null
  caller_number: string | null
  routing: Record<string, unknown>
  routing_reason: string | null
  failover_reason: string | null
  outcome: string | null
  duration_seconds: number | null
}

const CALL_COLUMNS = 'id, org_id, agent_id, phone_number_id, direction, status, provider, from_number, to_number, caller_number, routing, routing_reason, failover_reason, outcome, duration_seconds'

function base(): string {
  const b = publicBaseUrl()
  if (!b) throw new Error('VOICE_PUBLIC_BASE_URL is not configured')
  return b
}

function urlWithToken(path: string, token: string, extra: Record<string, string> = {}): string {
  const qs = new URLSearchParams({ t: token, ...extra })
  return `${base()}${path}?${qs.toString()}`
}

async function loadCall(db: SupabaseClient, callId: string): Promise<CallRow | null> {
  const { data, error } = await db.from('calls').select(CALL_COLUMNS).eq('id', callId).maybeSingle()
  if (error) throw new Error(`calls read failed: ${error.message}`)
  return (data as CallRow | null) ?? null
}

async function updateCall(db: SupabaseClient, callId: string, patch: Record<string, unknown>, log: Logger) {
  const { error } = await db.from('calls').update(patch).eq('id', callId)
  if (error) log.error('router.call_update_failed', error, { callId })
}

/** Creates (or, on a Twilio retry/fallback re-entry, returns) the call row for this CallSid. */
async function upsertInboundCall(ctx: RoutingContext, p: Record<string, string>, log: Logger): Promise<CallRow> {
  const insert = {
    org_id: ctx.number.org_id,
    agent_id: ctx.agent?.id ?? null,
    phone_number_id: ctx.number.id,
    twilio_call_sid: p.CallSid,
    direction: 'inbound',
    caller_number: p.From ?? null,
    from_number: p.From ?? null,
    to_number: p.To ?? null,
    status: 'ringing',
    lifecycle_rank: 20,
    primary_provider: ctx.agent?.primary ?? null,
    started_at: new Date().toISOString(),
    routing: { attempts: [] },
  }
  const { data, error } = await ctx.db.from('calls').insert(insert).select(CALL_COLUMNS).single()
  if (!error && data) return data as CallRow
  if (error && error.code !== '23505') throw new Error(`calls insert failed: ${error.message}`)
  const { data: existing, error: readErr } = await ctx.db.from('calls').select(CALL_COLUMNS).eq('twilio_call_sid', p.CallSid).single()
  if (readErr) throw new Error(`calls read failed: ${readErr.message}`)
  log.info('router.call_reentered', { callId: existing.id })
  return existing as CallRow
}

function attemptsOf(call: CallRow): RoutingAttempt[] {
  const a = (call.routing as { attempts?: unknown }).attempts
  return Array.isArray(a) ? (a as RoutingAttempt[]) : []
}

function finalFailureTwiml(ctx: RoutingContext, call: CallRow): string {
  const language = ctx.agent?.language ?? 'en'
  if (ctx.agent?.transferEnabled && ctx.agent.transferNumber) {
    const token = signCallToken(call.id, 'dial_complete', CALL_TOKEN_TTL_S)
    return forwardCall({
      sayText: localized(APOLOGY_MESSAGE, language),
      language,
      to: ctx.agent.transferNumber,
      callerId: ctx.number.number,
      actionUrl: urlWithToken('/api/telephony/twilio/dial-complete', token, { leg: 'handoff' }),
    })
  }
  return sayAndHangup(localized(APOLOGY_MESSAGE, language), language)
}

async function connectElevenLabs(ctx: RoutingContext, call: CallRow, opts: { afterHours: boolean; direction: 'inbound' | 'outbound' }, log: Logger): Promise<string> {
  const agentId = ctx.externalIds.elevenlabs
  if (!agentId || !ctx.agent) throw new Error('no ElevenLabs agent')
  const ours = ctx.number.number
  const other = opts.direction === 'outbound' ? call.to_number : call.from_number
  const clientData: el.ClientData = {
    user_id: ctx.org.id,
    dynamic_variables: {
      [PLATFORM_VARIABLES.callId]: call.id,
      [PLATFORM_VARIABLES.callToken]: signCallToken(call.id, 'transfer', CALL_TOKEN_TTL_S),
      [PLATFORM_VARIABLES.afterHours]: opts.afterHours ? 'true' : 'false',
      [PLATFORM_VARIABLES.businessName]: ctx.org.name ?? '',
    },
  }
  if (opts.direction === 'outbound') {
    // The agent places this call: an outbound opening line instead of the inbound greeting.
    const greeting = outboundGreetingFor({ language: ctx.agent.language, company: ctx.org.name ?? '', agentName: ctx.agent.name })
    clientData.conversation_config_override = {
      agent: { first_message: applyDisclosure(greeting, { language: ctx.agent.language, businessName: ctx.org.name ?? '', recordingNotice: false }) },
    }
  }
  log.debug('router.register_call', { direction: opts.direction, afterHours: opts.afterHours, callId: call.id })
  const twiml = await el.twilio.registerCall(
    {
      agent_id: agentId,
      from_number: opts.direction === 'outbound' ? ours : (other ?? ''),
      to_number: opts.direction === 'outbound' ? (other ?? '') : ours,
      direction: opts.direction,
      conversation_initiation_client_data: clientData,
    },
    { orgId: ctx.org.id, agentId: ctx.agent.id, callId: call.id },
  )
  const redirect = urlWithToken('/api/telephony/twilio/stream-ended', signCallToken(call.id, 'stream_ended', CALL_TOKEN_TTL_S))
  return appendRedirect(twiml, redirect)
}

function connectCartesia(ctx: RoutingContext, call: CallRow, direction: 'inbound' | 'outbound'): string {
  const sip = cartesiaSip()
  if (!sip.username || !sip.password || !ctx.agent) throw new Error('Cartesia SIP is not configured')
  if (!ctx.number.cartesia_phone_number_id) throw new Error('number not imported into Cartesia')
  const edge = (process.env.CARTESIA_SIP_EDGE ?? '').trim()
  const edgeParam = /^[a-z-]{3,20}$/.test(edge) ? `;edge=${edge}` : ''
  // Cartesia routes by the dialed number (our line, imported under the
  // platform SIP trunk and assigned to the org's fallback agent).
  const uri = `sip:${ctx.number.number}@${sip.domain};transport=${sip.transport}${edgeParam}?x-ntv-call-id=${call.id}`
  // For outbound calls present the callee as the SIP caller so the fallback
  // agent's context lookup (caller + called number) finds this call.
  return dialCartesiaSip({
    sipUri: uri,
    username: sip.username,
    password: sip.password,
    actionUrl: urlWithToken('/api/telephony/twilio/dial-complete', signCallToken(call.id, 'dial_complete', CALL_TOKEN_TTL_S), { leg: 'cartesia' }),
    referUrl: urlWithToken('/api/telephony/twilio/refer', signCallToken(call.id, 'refer', CALL_TOKEN_TTL_S)),
    timeLimitSeconds: Math.max(60, Math.min(4 * 3600, ctx.agent.maxDurationSeconds)),
    callerId: direction === 'outbound' ? call.to_number : null,
  })
}

/** Tries the candidates in order (max one fallback) and returns TwiML. */
async function connect(
  ctx: RoutingContext,
  call: CallRow,
  candidates: Candidate[],
  opts: { afterHours: boolean; direction: 'inbound' | 'outbound'; skipped: string | null },
  log: Logger,
): Promise<string> {
  const attempts = attemptsOf(call)
  let failoverReason: string | null = opts.skipped
  for (const [i, cand] of candidates.entries()) {
    const at = new Date().toISOString()
    try {
      const twiml = cand.provider === 'elevenlabs'
        ? await connectElevenLabs(ctx, call, opts, log)
        : connectCartesia(ctx, call, opts.direction)
      const role = i === 0 && cand.role === 'primary' ? 'primary' : 'provider_fallback'
      attempts.push({ provider: cand.provider, at, ok: true, probe: cand.probe })
      await updateCall(ctx.db, call.id, {
        provider: cand.provider,
        routing_reason: role,
        failover_reason: role === 'provider_fallback' ? (failoverReason ?? cand.failoverReason) : null,
        status: 'in-progress',
        routing: { ...call.routing, attempts, connected_at: at, after_hours: opts.afterHours, direction: opts.direction },
      }, log)
      emitProviderEvent({ system: cand.provider, kind: 'routing_decision', ok: true, orgId: ctx.org.id, agentId: ctx.agent?.id, callId: call.id, details: { role, probe: cand.probe, after_hours: opts.afterHours } })
      if (role === 'provider_fallback') {
        emitProviderEvent({ system: cand.provider, kind: 'failover', ok: true, orgId: ctx.org.id, agentId: ctx.agent?.id, callId: call.id, details: { reason: failoverReason ?? cand.failoverReason } })
      }
      log.info('router.connected', { provider: cand.provider, role, callId: call.id })
      return twiml
    } catch (e) {
      const err = toProviderError(e, cand.provider, 'router.connect')
      attempts.push({ provider: cand.provider, at, ok: false, error_code: err.code, probe: cand.probe })
      failoverReason = `${failoverReason ? `${failoverReason},` : ''}${cand.provider}:connect_${err.code}`
      log.error('router.connect_failed', e, { provider: cand.provider, callId: call.id })
      // providerRequest already reported the breaker outcome for HTTP errors;
      // a malformed TwiML response is a health signal too.
      if (!isProviderError(e)) await reportOutcome(cand.provider, { ok: false, code: 'bad_response' })
    }
  }
  await updateCall(ctx.db, call.id, {
    status: 'failed',
    routing_reason: 'no_provider',
    failover_reason: failoverReason,
    lifecycle_rank: 30,
    routing: { ...call.routing, attempts },
  }, log)
  emitProviderEvent({ system: 'platform', kind: 'failover', ok: false, orgId: ctx.org.id, callId: call.id, details: { reason: failoverReason, final: true } })
  return finalFailureTwiml(ctx, call)
}

function skippedSummary(plan: { skipped: Array<{ provider: VoiceProvider; reason: string }> }): string | null {
  return plan.skipped.length ? plan.skipped.map((s) => `${s.provider}:${s.reason}`).join(',') : null
}

/** POST /api/telephony/twilio/inbound */
export async function routeInboundCall(p: Record<string, string>, log: Logger = createLogger()): Promise<string> {
  const db = createAdminClient()
  const to = normalizeE164(p.To ?? '')
  const l = log.child({ callSid: p.CallSid, to: to ? maskPhone(to) : null })
  if (!to || !p.CallSid) {
    l.warn('router.bad_request')
    return reject()
  }
  const number = await findNumber(db, to)
  if (!number) {
    l.warn('router.unknown_number')
    return reject()
  }
  const ctx = await loadRoutingContext(number)
  const call = await upsertInboundCall(ctx, p, l)
  const cl = l.child({ orgId: ctx.org.id, agentId: ctx.agent?.id ?? null, callId: call.id })

  // Re-entry (Twilio fallback URL or retry) after a successful connect: do not route twice.
  if (attemptsOf(call).some((a) => a.ok)) {
    cl.warn('router.reentry_after_connect')
    return finalFailureTwiml(ctx, call)
  }

  if (!ctx.agent || !ctx.routingInput || !number.supports_inbound) {
    await updateCall(db, call.id, { status: 'failed', routing_reason: ctx.agent ? 'number_inactive' : 'agent_inactive', lifecycle_rank: 30 }, cl)
    return sayAndHangup(localized(UNAVAILABLE_MESSAGE, ctx.agent?.language ?? 'en'), ctx.agent?.language ?? 'en')
  }

  const plan = planRouting(ctx.routingInput)
  const language = ctx.agent.language
  cl.info('router.plan', { kind: plan.kind, ...(plan.kind === 'connect' ? { candidates: plan.candidates.map((c) => c.provider) } : {}) })

  if (plan.kind === 'reject') {
    const reason = plan.reason
    await updateCall(db, call.id, { status: 'failed', routing_reason: reason, failover_reason: skippedSummary(plan), lifecycle_rank: 30 }, cl)
    if (reason === 'no_provider') {
      emitProviderEvent({ system: 'platform', kind: 'failover', ok: false, orgId: ctx.org.id, callId: call.id, details: { reason: skippedSummary(plan), final: true } })
      return finalFailureTwiml(ctx, call)
    }
    return sayAndHangup(localized(UNAVAILABLE_MESSAGE, language), language)
  }

  if (plan.kind === 'after_hours') {
    const message = plan.message ?? localized(AFTER_HOURS_MESSAGE, language)
    await updateCall(db, call.id, {
      status: 'after-hours',
      routing_reason: 'after_hours',
      provider: null,
      lifecycle_rank: 30,
      routing: { ...call.routing, after_hours: true, mode: plan.mode },
      ...(plan.mode === 'forward' ? { outcome: 'transferred' } : {}),
    }, cl)
    if (plan.mode === 'forward' && plan.forwardNumber) {
      return forwardCall({
        sayText: plan.message,
        language,
        to: plan.forwardNumber,
        callerId: number.number,
        actionUrl: urlWithToken('/api/telephony/twilio/dial-complete', signCallToken(call.id, 'dial_complete', CALL_TOKEN_TTL_S), { leg: 'after_hours' }),
      })
    }
    return sayAndHangup(message, language)
  }

  return connect(ctx, call, plan.candidates, { afterHours: plan.afterHoursContext, direction: 'inbound', skipped: skippedSummary(plan) }, cl)
}

/** POST /api/telephony/twilio/outbound-connect?t= — Twilio fetched TwiML for an answered outbound call. */
export async function routeOutboundConnect(callId: string, p: Record<string, string>, log: Logger = createLogger()): Promise<string> {
  const db = createAdminClient()
  const call = await loadCall(db, callId)
  if (!call || !call.phone_number_id) return hangup()
  const number = await numberById(db, call.phone_number_id)
  if (!number) return hangup()
  const ctx = await loadRoutingContext(number)
  const cl = log.child({ orgId: ctx.org.id, callId, callSid: p.CallSid })
  if (p.CallSid) await updateCall(db, callId, { twilio_call_sid: p.CallSid }, cl)
  if (!ctx.agent || !ctx.routingInput) return hangup()
  // Outbound calls are business-initiated: the after-hours gate does not apply.
  const plan = planRouting(outboundRoutingInput(ctx.routingInput))
  if (plan.kind !== 'connect') {
    await updateCall(db, callId, { status: 'failed', routing_reason: plan.kind === 'reject' ? plan.reason : 'no_provider', lifecycle_rank: 30 }, cl)
    return hangup()
  }
  return connect(ctx, call, plan.candidates, { afterHours: false, direction: 'outbound', skipped: skippedSummary(plan) }, cl)
}

/** Distinct organizations that must see early stream ends before the shared media circuit counts one. */
const EARLY_END_MIN_ORGS = 2
const EARLY_END_WINDOW_MS = 2 * 60_000

/**
 * Marks this call's early stream end and reports a media failure only when
 * calls of at least EARLY_END_MIN_ORGS organizations ended early within the
 * window: one tenant (a prompt that ends the call immediately, a broken
 * voice) can never take ElevenLabs out of routing for everyone.
 */
async function recordEarlyStreamEnd(db: SupabaseClient, call: CallRow, log: Logger) {
  // Kept on the in-memory row too: the failover below rewrites routing from it.
  call.routing = { ...call.routing, early_stream_end_at: new Date().toISOString() }
  await updateCall(db, call.id, { routing: call.routing }, log)
  const since = new Date(Date.now() - EARLY_END_WINDOW_MS).toISOString()
  const { data, error } = await db
    .from('calls')
    .select('org_id')
    .eq('provider', 'elevenlabs')
    .gte('created_at', new Date(Date.now() - 4 * 3600_000).toISOString())
    .filter('routing->>early_stream_end_at', 'gte', since)
    .limit(50)
  if (error) {
    log.error('router.early_end_scan_failed', error)
    return
  }
  const orgs = new Set((data ?? []).map((r) => r.org_id as string))
  orgs.add(call.org_id)
  if (orgs.size >= EARLY_END_MIN_ORGS) await reportOutcome('elevenlabs_media', { ok: false, code: 'upstream' })
  else log.info('router.early_end_single_org', { orgs: orgs.size })
}

/**
 * POST /api/telephony/twilio/stream-ended?t= — the ElevenLabs media stream
 * closed while the caller is still on the line. Within the early-failure
 * window of an inbound call (no conversation happened), fail over to
 * Cartesia once; otherwise the agent ended the call: hang up.
 */
export async function handleStreamEnded(callId: string, p: Record<string, string>, log: Logger = createLogger()): Promise<string> {
  const db = createAdminClient()
  const call = await loadCall(db, callId)
  if (!call) return hangup()
  const routing = call.routing as { connected_at?: string; attempts?: RoutingAttempt[] }
  const connectedAt = routing.connected_at ? Date.parse(routing.connected_at) : NaN
  const elapsed = Number.isFinite(connectedAt) ? (Date.now() - connectedAt) / 1000 : Infinity
  const attempts = attemptsOf(call)
  const cl = log.child({ orgId: call.org_id, callId, callSid: p.CallSid })

  const window = earlyFailureWindowSeconds()
  const early = call.provider === 'elevenlabs' && elapsed <= window
  // Media-plane health: a stream that outlived the early window proves the
  // conversation path works. A stream that ended within it may be a platform
  // failure — or a tenant's own agent hanging up at once — so it only counts
  // against the shared circuit when several organizations see it (below).
  if (call.provider === 'elevenlabs' && Number.isFinite(elapsed)) {
    if (!early) await reportOutcome('elevenlabs_media', { ok: true })
    else await recordEarlyStreamEnd(db, call, cl)
  }
  const alreadyFellBack = attempts.some((a) => a.provider === 'cartesia')
  if (!early || call.direction !== 'inbound' || alreadyFellBack || !call.phone_number_id) {
    cl.info('router.stream_ended', { elapsed: Math.round(elapsed), early })
    return hangup()
  }

  const number = await numberById(db, call.phone_number_id)
  if (!number) return hangup()
  const ctx = await loadRoutingContext(number)
  if (!ctx.routingInput) return hangup()
  cl.warn('router.early_stream_failure', { elapsed: Math.round(elapsed) })
  // Same switches as the ingress decision: the kill switch, the platform and
  // org fallback flags and the agent's configured fallback all apply here.
  const fallbackAllowed =
    ctx.routingInput.fallbackEnabled && ctx.routingInput.force !== 'elevenlabs' && ctx.agent?.fallback === 'cartesia'
  const plan = fallbackAllowed
    ? planRouting({ ...ctx.routingInput, primary: 'cartesia', fallback: null, force: 'auto' })
    : ({ kind: 'reject', reason: 'no_provider', skipped: [] } as const)
  if (plan.kind !== 'connect') {
    await updateCall(db, callId, { status: 'failed', routing_reason: 'no_provider', failover_reason: 'elevenlabs:stream_failed_early', lifecycle_rank: 30 }, cl)
    return finalFailureTwiml(ctx, call)
  }
  return connect(
    ctx,
    call,
    plan.candidates.map((c) => ({ ...c, role: 'provider_fallback' as const })),
    { afterHours: !ctx.routingInput.hours.open, direction: 'inbound', skipped: 'elevenlabs:stream_failed_early' },
    cl,
  )
}

/** POST /api/telephony/twilio/dial-complete?t=&leg= — a <Dial> leg finished. */
export async function handleDialComplete(callId: string, leg: string, p: Record<string, string>, log: Logger = createLogger()): Promise<string> {
  const db = createAdminClient()
  const call = await loadCall(db, callId)
  if (!call) return hangup()
  const status = p.DialCallStatus ?? 'failed'
  const duration = Number(p.DialCallDuration ?? '0') || 0
  const cl = log.child({ orgId: call.org_id, callId, leg, dialStatus: status })
  const connected = status === 'completed' || status === 'answered'

  if (leg === 'cartesia') {
    if (connected && duration > 0) {
      await reportOutcome('cartesia_media', { ok: true })
      await updateCall(db, callId, { routing: { ...call.routing, cartesia_dial: { status, duration } } }, cl)
      // Pull transcript/recording from Cartesia now (webhooks for managed agents
      // are not guaranteed); the maintenance job retries if it is not ready yet.
      deferBackground(import('@/lib/voice-providers/cartesia-poll').then((m) => m.pollCartesiaCall(callId, cl)).catch((err: unknown) => cl.error('router.cartesia_poll_failed', err)))
      return hangup()
    }
    await reportOutcome('cartesia_media', { ok: false, code: 'upstream' })
    emitProviderEvent({ system: 'cartesia', kind: 'failover', ok: false, orgId: call.org_id, callId, details: { reason: `cartesia:dial_${status}`, final: true } })
    await updateCall(db, callId, {
      status: 'failed',
      routing_reason: 'no_provider',
      failover_reason: `${call.failover_reason ? `${call.failover_reason},` : ''}cartesia:dial_${status}`,
      lifecycle_rank: 30,
    }, cl)
    if (!call.phone_number_id) return hangup()
    const number = await numberById(db, call.phone_number_id)
    if (!number) return hangup()
    const ctx = await loadRoutingContext(number)
    return finalFailureTwiml(ctx, call)
  }

  // after_hours forward, final-failure handoff, transfer: record and end.
  // A transfer leg is the human part of an AI call: its duration stays in
  // routing (duration_seconds is the AI conversation, which billing and the
  // transcript match). Forward/handoff legs are the whole call.
  const patch: Record<string, unknown> = { routing: { ...call.routing, [`${leg}_dial`]: { status, duration } } }
  if (connected) patch.outcome = 'transferred'
  else if (leg === 'after_hours') patch.outcome = 'missed'
  else if (leg === 'transfer' && call.outcome === 'transferred') patch.outcome = null // the transfer did not happen
  if (leg !== 'transfer' && duration > 0 && !call.duration_seconds) patch.duration_seconds = duration
  await updateCall(db, callId, patch, cl)
  return hangup()
}

function extractNumber(target: string | undefined): string | null {
  if (!target) return null
  const m = /(?:tel:|sip:)?(\+?\d[\d\-.() ]{5,})/i.exec(target)
  return m ? normalizeE164(m[1].startsWith('+') ? m[1] : `+${m[1]}`) : null
}

/**
 * POST /api/telephony/twilio/refer?t= — the Cartesia agent asked to transfer
 * (SIP REFER). Only the destination configured by the business is honoured.
 */
export async function handleRefer(callId: string, p: Record<string, string>, log: Logger = createLogger()): Promise<string> {
  const db = createAdminClient()
  const call = await loadCall(db, callId)
  if (!call?.phone_number_id) return hangup()
  const number = await numberById(db, call.phone_number_id)
  if (!number) return hangup()
  const ctx = await loadRoutingContext(number)
  const target = extractNumber(p.ReferTransferTarget)
  const cl = log.child({ orgId: call.org_id, callId })
  if (!ctx.agent?.transferEnabled || !ctx.agent.transferNumber || target !== ctx.agent.transferNumber) {
    cl.warn('router.refer_rejected', { target: target ? maskPhone(target) : null })
    return sayAndHangup(localized(APOLOGY_MESSAGE, ctx.agent?.language ?? 'en'), ctx.agent?.language ?? 'en')
  }
  await updateCall(db, callId, { outcome: 'transferred', routing: { ...call.routing, transfer: { at: new Date().toISOString(), via: 'sip_refer' } } }, cl)
  return forwardCall({
    language: ctx.agent.language,
    to: ctx.agent.transferNumber,
    callerId: call.direction === 'inbound' ? call.from_number : number.number,
    actionUrl: urlWithToken('/api/telephony/twilio/dial-complete', signCallToken(callId, 'dial_complete', CALL_TOKEN_TTL_S), { leg: 'transfer' }),
  })
}

/**
 * Transfer tool (ElevenLabs agent on an app-routed call): redirect the live
 * Twilio call to the configured human. Replacing the TwiML ends the media
 * stream; the conversation's post-call webhook still arrives.
 */
export async function transferLiveCall(callId: string, reason: string, log: Logger = createLogger()): Promise<{ ok: boolean; message: string }> {
  const db = createAdminClient()
  const { data: call, error } = await db.from('calls').select(`${CALL_COLUMNS}, twilio_call_sid`).eq('id', callId).maybeSingle()
  if (error) throw new Error(`calls read failed: ${error.message}`)
  if (!call?.twilio_call_sid || !call.phone_number_id) return { ok: false, message: 'This call cannot be transferred.' }
  // The model may call the tool twice; redirecting the live call twice would drop it.
  if (call.outcome === 'transferred') return { ok: true, message: 'The caller is already being transferred.' }
  if (['completed', 'failed', 'canceled', 'busy', 'no-answer'].includes(call.status as string)) {
    return { ok: false, message: 'This call has already ended.' }
  }
  const number = await numberById(db, call.phone_number_id as string)
  if (!number) return { ok: false, message: 'This call cannot be transferred.' }
  const ctx = await loadRoutingContext(number)
  if (!ctx.agent?.transferEnabled || !ctx.agent.transferNumber) return { ok: false, message: 'Transfers are not enabled for this business.' }
  const { getTwilioClient } = await import('@/lib/twilio/client')
  // The agent has already told the caller it is transferring them (platform rule).
  const twiml = forwardCall({
    language: ctx.agent.language,
    to: ctx.agent.transferNumber,
    callerId: (call.direction === 'inbound' ? call.from_number : number.number) as string | null,
    actionUrl: urlWithToken('/api/telephony/twilio/dial-complete', signCallToken(callId, 'dial_complete', CALL_TOKEN_TTL_S), { leg: 'transfer' }),
  })
  await getTwilioClient().calls(call.twilio_call_sid as string).update({ twiml })
  await updateCall(db, callId, { outcome: 'transferred', routing: { ...(call.routing as object), transfer: { at: new Date().toISOString(), via: 'tool', reason: reason.slice(0, 200) } } }, log)
  return { ok: true, message: 'Transferring the caller now.' }
}

const TERMINAL = new Set(['completed', 'busy', 'failed', 'no-answer', 'canceled'])

/** POST /api/telephony/twilio/status — number/outbound status callbacks. */
export async function handleStatusCallback(p: Record<string, string>, log: Logger = createLogger()): Promise<void> {
  const db = createAdminClient()
  if (!p.CallSid || !p.CallStatus) return
  const { data: call, error } = await db.from('calls').select(`${CALL_COLUMNS}, lifecycle_rank`).eq('twilio_call_sid', p.CallSid).maybeSingle()
  if (error) throw new Error(`calls read failed: ${error.message}`)
  if (!call) return
  const cl = log.child({ orgId: call.org_id, callId: call.id, twilioStatus: p.CallStatus })
  // Twilio does not guarantee delivery order: never let a late non-terminal
  // event (or an older sequence number) overwrite a terminal status.
  const prev = call.routing as { twilio_status?: string; twilio_seq?: number }
  const seq = Number(p.SequenceNumber)
  if (Number.isFinite(seq) && typeof prev.twilio_seq === 'number' && seq < prev.twilio_seq) {
    cl.info('router.status_out_of_order', { seq, last: prev.twilio_seq })
    return
  }
  if (prev.twilio_status && TERMINAL.has(prev.twilio_status) && !TERMINAL.has(p.CallStatus)) {
    cl.info('router.status_after_terminal_ignored')
    return
  }
  const patch: Record<string, unknown> = {
    routing: {
      ...(call.routing as object),
      twilio_status: p.CallStatus,
      twilio_duration: Number(p.CallDuration ?? '0') || 0,
      ...(Number.isFinite(seq) ? { twilio_seq: seq } : {}),
    },
  }
  if (p.CallStatus === 'in-progress' && (call.lifecycle_rank as number) < 20) {
    patch.status = 'in-progress'
    patch.lifecycle_rank = 20
  }
  if (TERMINAL.has(p.CallStatus)) {
    patch.ended_at = new Date().toISOString()
    if ((call.lifecycle_rank as number) < 50) {
      // No provider result yet (or none will come: after-hours, final failure).
      const failed = p.CallStatus !== 'completed'
      if (failed) {
        patch.status = p.CallStatus === 'canceled' ? 'canceled' : p.CallStatus
        patch.lifecycle_rank = 30
      } else if (!call.provider && call.status !== 'after-hours' && call.status !== 'failed') {
        patch.status = 'completed'
      }
      if (!call.duration_seconds) patch.duration_seconds = Number(p.CallDuration ?? '0') || 0
    }
  }
  await updateCall(db, call.id as string, patch, cl)
}

/**
 * POST /api/telephony/twilio/fallback — Twilio's voiceFallbackUrl: the primary
 * webhook errored or timed out. Re-runs the router, which is idempotent on
 * CallSid (a call that already connected is not routed twice) and bounded by
 * the per-provider timeouts; if anything fails here too, apologise.
 */
export async function handleVoiceFallback(p: Record<string, string>, log: Logger = createLogger()): Promise<string> {
  log.warn('router.voice_fallback_invoked', { errorCode: p.ErrorCode ?? null, callSid: p.CallSid })
  try {
    return await routeInboundCall(p, log)
  } catch (err) {
    log.error('router.voice_fallback_failed', err)
    return sayAndHangup(localized(APOLOGY_MESSAGE, 'en'), 'en')
  }
}
