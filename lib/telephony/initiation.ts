import 'server-only'
// Conversation initiation webhook (POST /api/elevenlabs/initiation): ElevenLabs
// asks us for the per-call client data of an inbound call to a NATIVE number
// (the call reaches ElevenLabs directly, our router never sees it). We answer
// what register-call gives app-routed calls: our call id, the signed
// correlation and tool tokens (so platform tools work on native calls), the
// real after_hours, the direction and routing mode, the business and tenant
// variables, and an "unavailable" opening for a paused agent/number or a used
// up trial.
//
// Tenant isolation: the organization comes ONLY from the agent_id (our
// agent_provider_resources row); the called number must be a phone_numbers row
// of that same organization. Nothing else in the request is trusted: a
// mismatch gets neutral placeholders, no call row and no token.
//
// Idempotent by Twilio CallSid: a call row that already exists for the sid
// (a retried webhook, the post-call webhook first, or a register-call that
// triggers this webhook too) is reused and gets the same values back.
//
// Fast: a few indexed reads and at most one insert, no provider call; a
// deadline answers with placeholders if the database is slow.

import type { SupabaseClient } from '@supabase/supabase-js'
import { createAdminClient } from '@/lib/supabase/admin'
import type { Logger } from '@/lib/observability/logger'
import type { InitiationWebhookRequest, InitiationWebhookResponse } from '@/lib/elevenlabs/api/telephony'
import { overridesInForce } from '@/lib/elevenlabs/client-overrides'
import { PLATFORM_VARIABLES } from '@/lib/voice-providers/prompt'
import { readAfterHours, readConversationSettings, readDynamicVariables, readWorkingHours } from '@/lib/voice-providers/settings'
import { stripPlatformVariables } from '@/lib/voice-providers/template-variables'
import { evaluateWorkingHours } from '@/lib/voice-providers/working-hours'
import { normalizeAgentLanguage } from '@/lib/voice/languages'
import { maskPhone, normalizeE164 } from '@/lib/phone/e164'
import { conversationOverride, platformVariables, type ClientDataInput } from './client-data'
import { callAllowance } from './quota'

/** Answer within this budget whatever happens (the caller is waiting). */
export const INITIATION_DEADLINE_MS = 1_200
/** An existing outbound/app-routed row is matched only this recently. */
const MATCH_WINDOW_MS = 10 * 60_000
/** A native outbound call whose webhook names OUR number as the called one: matched only right after it was placed. */
const OUTBOUND_ECHO_WINDOW_MS = 2 * 60_000

const CALL_COLUMNS = 'id, org_id, agent_id, phone_number_id, direction, status, routing, from_number, to_number, elevenlabs_conversation_id'

interface CallRow {
  id: string
  org_id: string
  agent_id: string | null
  phone_number_id: string | null
  direction: 'inbound' | 'outbound'
  status: string
  routing: Record<string, unknown> | null
  from_number: string | null
  to_number: string | null
  elevenlabs_conversation_id: string | null
}

interface NumberRow {
  id: string
  org_id: string
  number: string
  is_active: boolean
  routing_mode: 'app_routed' | 'native_elevenlabs'
  supports_inbound: boolean
}

export type InitiationOutcome = 'created' | 'existing' | 'no_row' | 'mismatch' | 'unknown_agent' | 'deadline' | 'error'

export interface InitiationResult {
  body: InitiationWebhookResponse
  outcome: InitiationOutcome
}

/** What is known so far, so a deadline or an error still answers with as much as possible. */
interface KnownSoFar {
  tenantVariables: Record<string, string>
  businessName: string
}

function response(input: ClientDataInput, override: Record<string, unknown> | null): InitiationWebhookResponse {
  return {
    type: 'conversation_initiation_client_data',
    dynamic_variables: { ...(input.tenantVariables ?? {}), ...platformVariables(input) },
    ...(override ? { conversation_config_override: override } : {}),
  }
}

/** Neutral values: no call row, no token (the same placeholders the agent carries). */
export function placeholderResponse(partial: KnownSoFar = { tenantVariables: {}, businessName: '' }): InitiationWebhookResponse {
  return {
    type: 'conversation_initiation_client_data',
    dynamic_variables: {
      ...partial.tenantVariables,
      [PLATFORM_VARIABLES.callId]: 'unknown',
      [PLATFORM_VARIABLES.callToken]: 'none',
      [PLATFORM_VARIABLES.secretCallToken]: 'none',
      // The prompt decides from the opening hours when it has them.
      [PLATFORM_VARIABLES.afterHours]: 'unknown',
      // Tenant data (organizations.name): never a {{platform variable}}.
      [PLATFORM_VARIABLES.businessName]: stripPlatformVariables(partial.businessName),
      [PLATFORM_VARIABLES.callDirection]: 'inbound',
      [PLATFORM_VARIABLES.routingMode]: 'native',
    },
  }
}

async function one<T>(q: PromiseLike<{ data: unknown; error: { message: string } | null }>, what: string): Promise<T | null> {
  const { data, error } = await q
  if (error) throw new Error(`${what} read failed: ${error.message}`)
  return (data as T | null) ?? null
}

/** The row of an app-routed or outbound call this webhook may belong to (no sid match). */
async function recentCallFor(db: SupabaseClient, orgId: string, ours: NumberRow, other: string | null, direction: 'inbound' | 'outbound', now: number, windowMs = MATCH_WINDOW_MS): Promise<CallRow | null> {
  if (!other) return null
  const q = db
    .from('calls')
    .select(CALL_COLUMNS)
    .eq('org_id', orgId)
    .eq('phone_number_id', ours.id)
    .eq('direction', direction)
    .eq(direction === 'outbound' ? 'to_number' : 'from_number', other)
    .in('status', ['ringing', 'in-progress'])
    .gte('created_at', new Date(now - windowMs).toISOString())
    .order('created_at', { ascending: false })
    .limit(1)
  const { data, error } = await q
  if (error) throw new Error(`calls match failed: ${error.message}`)
  return ((data ?? [])[0] as CallRow | undefined) ?? null
}

/** E.164 from the webhook (Twilio sends "+…"; a bare international digit string is accepted too). */
function webhookE164(raw: string | null | undefined): string | null {
  const v = (raw ?? '').trim()
  return normalizeE164(v) ?? (/^[1-9]\d{6,14}$/.test(v) ? normalizeE164(`+${v}`) : null)
}

async function resolve(req: InitiationWebhookRequest, partial: KnownSoFar, log: Logger, now: number): Promise<InitiationResult> {
  const db = createAdminClient()
  const called = webhookE164(req.called_number)
  const caller = webhookE164(req.caller_id)
  const sid = req.call_sid ?? null

  const [resource, calledRow, bySid] = await Promise.all([
    one<{ org_id: string; agent_id: string; details: unknown }>(
      db.from('agent_provider_resources').select('org_id, agent_id, details').eq('provider', 'elevenlabs').eq('external_id', req.agent_id).maybeSingle(),
      'agent_provider_resources',
    ),
    called
      ? one<NumberRow>(db.from('phone_numbers').select('id, org_id, number, is_active, routing_mode, supports_inbound').eq('number', called).maybeSingle(), 'phone_numbers')
      : Promise.resolve(null),
    sid ? one<CallRow>(db.from('calls').select(CALL_COLUMNS).eq('twilio_call_sid', sid).maybeSingle(), 'calls') : Promise.resolve(null),
  ])
  if (!resource) {
    // Not one of this database's agents: neutral placeholders (the caller is still answered).
    log.warn('initiation.unknown_agent')
    return { body: placeholderResponse(partial), outcome: 'unknown_agent' }
  }
  const orgId = resource.org_id

  const [org, agent] = await Promise.all([
    one<{ id: string; name: string | null; timezone: string | null; plan: string | null; minutes_used: number | null; minutes_limit: number | null }>(
      db.from('organizations').select('id, name, timezone, plan, minutes_used, minutes_limit').eq('id', orgId).maybeSingle(),
      'organizations',
    ),
    one<{ id: string; name: string; language: string | null; is_active: boolean | null; conversation_settings: unknown; metadata: Record<string, unknown> | null; working_hours: unknown; after_hours: unknown; dynamic_variables: unknown }>(
      db.from('agents').select('id, name, language, is_active, conversation_settings, metadata, working_hours, after_hours, dynamic_variables').eq('id', resource.agent_id).eq('org_id', orgId).maybeSingle(),
      'agents',
    ),
  ])
  if (!org || !agent) return { body: placeholderResponse(partial), outcome: 'mismatch' }
  partial.businessName = org.name ?? ''
  partial.tenantVariables = Object.fromEntries(Object.entries(readDynamicVariables(agent.dynamic_variables)).map(([k, v]) => [k, stripPlatformVariables(v)]))

  const language = normalizeAgentLanguage(agent.language)
  const conversation = readConversationSettings(agent.conversation_settings ?? agent.metadata?.behavior_settings)
  const hours = evaluateWorkingHours(readWorkingHours(agent.working_hours), org.timezone, readAfterHours(agent.after_hours), new Date(now))
  const allowance = callAllowance({ plan: org.plan, minutes_used: org.minutes_used, minutes_limit: org.minutes_limit })
  const base = (over: { callId: string | null; direction: 'inbound' | 'outbound'; routingMode: 'app_routed' | 'native'; afterHours: boolean; unavailable: boolean; endUser: string | null }): ClientDataInput => ({
    callId: over.callId,
    orgId,
    direction: over.direction,
    routingMode: over.routingMode,
    afterHours: over.afterHours,
    businessName: partial.businessName,
    agent: { name: agent.name, language, recordingNotice: conversation.recording_notice, maxDurationSeconds: conversation.max_call_duration_minutes * 60 },
    endUserNumber: over.endUser,
    tenantVariables: partial.tenantVariables,
    allowedOverrides: overridesInForce(resource.details),
    capSeconds: allowance.capSeconds,
    unavailable: over.unavailable,
  })

  // The called number must belong to the agent's organization.
  const ours = calledRow && calledRow.org_id === orgId ? calledRow : null
  let existing = bySid && bySid.org_id === orgId ? bySid : null
  if (bySid && !existing) log.warn('initiation.call_sid_other_org')

  if (!existing && !ours) {
    // Native OUTBOUND (if ElevenLabs triggers this webhook for it): our number is the caller.
    const callerRow = caller ? await one<NumberRow>(db.from('phone_numbers').select('id, org_id, number, is_active, routing_mode, supports_inbound').eq('number', caller).maybeSingle(), 'phone_numbers') : null
    if (callerRow && callerRow.org_id === orgId) existing = await recentCallFor(db, orgId, callerRow, called, 'outbound', now)
    if (!existing) {
      log.warn('initiation.number_mismatch', { called: called ? maskPhone(called) : null })
      return { body: placeholderResponse(partial), outcome: 'mismatch' }
    }
  }
  if (!existing && ours && ours.routing_mode === 'app_routed') {
    // A register-call that triggered this webhook: the router created the row.
    existing = await recentCallFor(db, orgId, ours, caller, 'inbound', now)
    if (!existing) {
      log.warn('initiation.app_routed_without_row')
      return { body: response(base({ callId: null, direction: 'inbound', routingMode: 'app_routed', afterHours: !hours.open, unavailable: false, endUser: caller }), null), outcome: 'no_row' }
    }
  }

  if (!existing && ours && ours.routing_mode === 'native_elevenlabs') {
    // Defensive: if ElevenLabs also calls this webhook for a native OUTBOUND
    // call it just placed (undocumented) and names our number as the called
    // one, reuse that call instead of creating an inbound row for it.
    const echo = await recentCallFor(db, orgId, ours, caller, 'outbound', now, OUTBOUND_ECHO_WINDOW_MS)
    if (echo && (echo.routing ?? {}).mode === 'native') existing = echo
  }

  if (existing) {
    // Same values as the path that created the row (idempotent by call sid).
    const routing = existing.routing ?? {}
    // Native rows (this webhook, native outbound, post-call inserts) carry routing.mode 'native'; router rows never do.
    const native = routing.mode === 'native'
    const afterHours = typeof routing.after_hours === 'boolean' ? routing.after_hours : existing.direction === 'inbound' && !hours.open
    const unavailable = routing.unavailable === true
    if (req.conversation_id && !existing.elevenlabs_conversation_id && native) {
      const { error } = await db.from('calls').update({ elevenlabs_conversation_id: req.conversation_id, provider_call_id: req.conversation_id }).eq('id', existing.id).is('elevenlabs_conversation_id', null)
      if (error) log.error('initiation.conversation_link_failed', error, { callId: existing.id })
    }
    const input = base({
      callId: existing.id,
      direction: existing.direction,
      routingMode: native ? 'native' : 'app_routed',
      afterHours,
      unavailable,
      endUser: existing.direction === 'outbound' ? existing.to_number : existing.from_number,
    })
    log.info('initiation.existing_call', { callId: existing.id, direction: existing.direction })
    return { body: response(input, conversationOverride(input)), outcome: 'existing' }
  }

  // A new inbound call to a native number of this organization.
  const number = ours as NumberRow
  const reason = !agent.is_active ? 'agent_inactive' : !number.is_active || !number.supports_inbound ? 'number_inactive' : !allowance.allowed ? 'quota_exhausted' : 'primary'
  const unavailable = reason !== 'primary'
  const afterHours = !hours.open
  if (!sid && !req.conversation_id) {
    const input = base({ callId: null, direction: 'inbound', routingMode: 'native', afterHours, unavailable, endUser: caller })
    return { body: response(input, conversationOverride(input)), outcome: 'no_row' }
  }
  const startedAt = new Date(now).toISOString()
  const insert = {
    org_id: orgId,
    agent_id: agent.id,
    phone_number_id: number.id,
    twilio_call_sid: sid,
    elevenlabs_conversation_id: req.conversation_id ?? null,
    provider_call_id: req.conversation_id ?? null,
    direction: 'inbound',
    caller_number: caller,
    from_number: caller,
    to_number: number.number,
    // 'ringing' until the post-call webhook (or conversation_reconcile, which
    // settles a native row with no conversation) completes it.
    status: 'ringing',
    lifecycle_rank: 20,
    provider: 'elevenlabs',
    primary_provider: 'elevenlabs',
    routing_reason: reason,
    started_at: startedAt,
    routing: { attempts: [], mode: 'native', source: 'initiation_webhook', direction: 'inbound', after_hours: afterHours, ...(unavailable ? { unavailable: true } : {}) },
  }
  const { data: created, error: insErr } = await db.from('calls').insert(insert).select('id').single()
  let callId: string | null = (created?.id as string | undefined) ?? null
  if (insErr) {
    if (insErr.code !== '23505') throw new Error(`calls insert failed: ${insErr.message}`)
    // A concurrent delivery (or the post-call webhook) created it: reuse that
    // row, found by whichever unique key collided.
    let again = sid ? await one<CallRow>(db.from('calls').select(CALL_COLUMNS).eq('twilio_call_sid', sid).maybeSingle(), 'calls') : null
    if (!again && req.conversation_id) {
      again = await one<CallRow>(db.from('calls').select(CALL_COLUMNS).eq('elevenlabs_conversation_id', req.conversation_id).maybeSingle(), 'calls')
    }
    if (!again || again.org_id !== orgId) {
      log.warn('initiation.duplicate_other_org')
      return { body: placeholderResponse(partial), outcome: 'mismatch' }
    }
    callId = again.id
  }
  const input = base({ callId, direction: 'inbound', routingMode: 'native', afterHours, unavailable, endUser: caller })
  log.info('initiation.call_created', { callId, reason, afterHours })
  return { body: response(input, conversationOverride(input)), outcome: insErr ? 'existing' : 'created' }
}

/**
 * Resolves one webhook request within INITIATION_DEADLINE_MS. Errors and the
 * deadline answer with placeholders (plus whatever was already loaded), never
 * with a failure: a failing webhook could keep a caller from being answered.
 */
export async function handleInitiation(req: InitiationWebhookRequest, log: Logger, now = Date.now(), deadlineMs = INITIATION_DEADLINE_MS): Promise<InitiationResult> {
  const partial: KnownSoFar = { tenantVariables: {}, businessName: '' }
  let timer: ReturnType<typeof setTimeout> | undefined
  const deadline = new Promise<'deadline'>((r) => {
    timer = setTimeout(() => r('deadline'), deadlineMs)
  })
  const work = resolve(req, partial, log, now).catch((err: unknown) => {
    log.error('initiation.failed', err)
    return 'error' as const
  })
  try {
    const res = await Promise.race([work, deadline])
    if (res === 'deadline') {
      log.error('initiation.deadline_exceeded', null, { deadlineMs })
      return { body: placeholderResponse(partial), outcome: 'deadline' }
    }
    if (res === 'error') return { body: placeholderResponse(partial), outcome: 'error' }
    return res
  } finally {
    if (timer) clearTimeout(timer)
  }
}
