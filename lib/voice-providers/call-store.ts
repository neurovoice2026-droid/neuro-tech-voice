import 'server-only'
// Applies normalized provider events to the `calls` table (single source of
// truth for call history, whichever provider served the call), then performs
// the once-per-call side effects:
//   • usage: record_call_usage() inserts into usage_ledger with key call:<id>
//     and increments minutes_used only if that insert happened (retries and
//     a second source for the same call are no-ops);
//   • workflows: claimed with workflows_triggered_at IS NULL → now().
// Conversations that are not phone calls (dashboard tests, widget/SDK
// sessions, ElevenLabs simulations) are stored as test calls (calls.channel,
// calls.is_test): never billed, never trigger workflows. Provider cost goes to
// the service-only call_provider_costs table, never to the calls row.
// The same path applies webhooks (source 'webhook') and conversations fetched
// by the reconciliation (source 'poll', conversation-reconcile.ts).

import type { SupabaseClient } from '@supabase/supabase-js'
import { createAdminClient } from '@/lib/supabase/admin'
import { createLogger, type Logger } from '@/lib/observability/logger'
import { emitProviderEvent } from '@/lib/observability/telemetry'
import { isFromOtherProvider, mergeCallEvent, type StoredCall } from './call-merge'
import type { NormalizedCallEvent } from './types'
import type { VoiceProvider } from './errors'
import { executeWorkflows, type CallContext } from '@/lib/workflows/executor'
import { sendEmail } from '@/lib/email/client'
import { usageAlertEmail } from '@/lib/email/templates'
import { PLANS, type Plan } from '@/types'
import { verifyCallToken } from '@/lib/telephony/tokens'
import { reportOutcome } from './circuit-registry'
import { earlyFailureWindowSeconds } from './config'
import { conversations as elConversations } from '@/lib/elevenlabs/client'
import { isProviderError } from './errors'
import { collectedValues } from './call-context'

const STORED_COLUMNS =
  'id, org_id, agent_id, status, lifecycle_rank, provider, provider_call_id, elevenlabs_conversation_id, cartesia_call_id, transcript, summary, duration_seconds, started_at, ended_at, routing_reason, outcome, direction, caller_number, from_number, to_number, sentiment, updated_at, workflows_triggered_at, channel, is_test, call_metadata, recording_status, retention_applied_at'

interface CallRow extends StoredCall {
  id: string
  org_id: string
  agent_id: string | null
  direction: string
  caller_number: string | null
  from_number: string | null
  to_number: string | null
  sentiment: string | null
  updated_at: string
  channel?: string | null
  is_test?: boolean | null
}

/** Where an event came from: the provider's webhook or our own reconciliation poll. */
export type EventSource = 'webhook' | 'poll'

export interface ApplyOptions {
  source?: EventSource
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

/**
 * Our calls.id carried by the event, if it can be trusted: set by our own
 * code (poll, SIP header from our trunk) or accompanied by the signed call
 * token we injected. An ElevenLabs client-started session can send any
 * dynamic variables, so a bare ntv_call_id is never trusted (it could
 * attach a fake conversation to someone's call and consume its billing key).
 */
export function trustedLocalCallId(event: NormalizedCallEvent): string | null {
  const id = event.localCallId
  if (!id || !UUID.test(id)) return null
  if (event.localCallIdTrusted) return id
  return verifyCallToken(event.localCallToken, 'transfer', Date.now(), { ignoreExpiry: true }) === id ? id : null
}

async function findCall(db: SupabaseClient, event: NormalizedCallEvent): Promise<CallRow | null> {
  const tries: Array<[string, string]> = []
  const localId = trustedLocalCallId(event)
  if (localId) tries.push(['id', localId])
  // provider_call_id is always written together with these indexed columns.
  tries.push([event.provider === 'elevenlabs' ? 'elevenlabs_conversation_id' : 'cartesia_call_id', event.providerCallId])
  if (event.twilioCallSid) tries.push(['twilio_call_sid', event.twilioCallSid])
  for (const [col, val] of tries) {
    const { data, error } = await db.from('calls').select(STORED_COLUMNS).eq(col, val).limit(1).maybeSingle()
    if (error) throw new Error(`calls lookup by ${col} failed: ${error.message}`)
    if (data) return data as CallRow
  }
  return null
}

/** Org/agent owning an external agent id (native calls have no pre-created row). */
async function ownerOf(db: SupabaseClient, provider: VoiceProvider, externalAgentId: string | null): Promise<{ org_id: string; agent_id: string } | null> {
  if (!externalAgentId) return null
  const { data, error } = await db
    .from('agent_provider_resources')
    .select('org_id, agent_id')
    .eq('provider', provider)
    .eq('external_id', externalAgentId)
    .maybeSingle()
  if (error) throw new Error(`agent_provider_resources lookup failed: ${error.message}`)
  if (data) return data as { org_id: string; agent_id: string }
  if (provider === 'elevenlabs') {
    // Legacy rows that predate agent_provider_resources.
    const { data: legacy, error: legacyErr } = await db.from('agents').select('id, org_id').eq('elevenlabs_agent_id', externalAgentId).maybeSingle()
    if (legacyErr) throw new Error(`agents lookup failed: ${legacyErr.message}`)
    if (legacy) return { org_id: legacy.org_id as string, agent_id: legacy.id as string }
  }
  return null
}

/**
 * A Cartesia event for a SIP fallback call arrives without our call id when
 * Cartesia does not echo the SIP header, and before any poll stored the
 * Cartesia call id on our row. Match the routed row instead of creating a
 * second ("native") one: same org, served by Cartesia, no Cartesia id yet,
 * same two numbers (our line + the other party, in either direction),
 * created within a few minutes of the event.
 */
async function findRoutedCartesiaCall(db: SupabaseClient, orgId: string, event: NormalizedCallEvent): Promise<CallRow | null> {
  if (event.provider !== 'cartesia' || !event.fromNumber || !event.toNumber) return null
  const at = event.startedAt ? Date.parse(event.startedAt) : Date.now()
  const { data, error } = await db
    .from('calls')
    .select(STORED_COLUMNS)
    .eq('org_id', orgId)
    .eq('provider', 'cartesia')
    .is('cartesia_call_id', null)
    .gte('created_at', new Date(at - 10 * 60_000).toISOString())
    .lte('created_at', new Date(at + 5 * 60_000).toISOString())
    .order('created_at', { ascending: false })
    .limit(10)
  if (error) throw new Error(`calls routed-row lookup failed: ${error.message}`)
  const pair = new Set([event.fromNumber, event.toNumber])
  const match = (data ?? []).find((c) => pair.has(c.from_number as string) && pair.has(c.to_number as string))
  return (match as CallRow | undefined) ?? null
}

export interface ApplyResult {
  callId: string | null
  outcome: 'created' | 'updated' | 'unchanged' | 'unowned' | 'deleted'
  /** The stored row is a test session (no billing, no workflows). */
  test?: boolean
}

/** Our phone_numbers row for the provider's phone number id, within the owner org only. */
async function phoneNumberIdFor(db: SupabaseClient, orgId: string, event: NormalizedCallEvent): Promise<string | null> {
  const externalId = event.metadata?.phone_number_external_id
  if (event.provider !== 'elevenlabs' || !externalId) return null
  const { data, error } = await db
    .from('phone_numbers')
    .select('id')
    .eq('org_id', orgId)
    .eq('elevenlabs_phone_number_id', externalId)
    .limit(1)
    .maybeSingle()
  if (error) throw new Error(`phone_numbers lookup failed: ${error.message}`)
  return (data?.id as string | undefined) ?? null
}

/**
 * The owner deleted this call: make sure the provider copy (transcript,
 * audio, analysis) is gone too. The owner org was resolved from the
 * conversation's agent (ownerOf), so this never touches another tenant's
 * conversation. A 404 means already gone; any other failure throws so the
 * stored webhook event is retried by maintenance.
 */
async function deleteTombstonedConversation(event: NormalizedCallEvent, orgId: string, log: Logger): Promise<void> {
  if (event.provider !== 'elevenlabs') return
  try {
    await elConversations.delete(event.providerCallId, { orgId })
    log.info('call_event.deleted_call_purged_at_provider')
  } catch (err) {
    if (isProviderError(err) && err.code === 'not_found') return
    if (isProviderError(err) && err.code === 'not_configured') {
      log.warn('call_event.deleted_call_provider_not_configured')
      return
    }
    throw err
  }
}

/** True when the owner deleted this call (tombstone written by DELETE /api/calls/[id]). */
async function wasDeleted(db: SupabaseClient, orgId: string, event: NormalizedCallEvent): Promise<boolean> {
  const base = () => db.from('audit_log').select('id').eq('org_id', orgId).eq('action', 'call.deleted')
  const checks = [base().contains('details', { provider_call_ids: [event.providerCallId] }).limit(1)]
  const localId = trustedLocalCallId(event)
  if (localId) checks.push(base().eq('target_id', localId).limit(1))
  for (const { data, error } of await Promise.all(checks)) {
    if (error) throw new Error(`audit_log lookup failed: ${error.message}`)
    if ((data?.length ?? 0) > 0) return true
  }
  return false
}

export async function applyCallEvent(event: NormalizedCallEvent, log: Logger = createLogger(), opts: ApplyOptions = {}): Promise<ApplyResult> {
  const db = createAdminClient()
  const source: EventSource = opts.source ?? 'webhook'
  const l = log.child({ provider: event.provider, providerCallId: event.providerCallId, source })
  // Why a conversation failed at the provider: the code only (the reason text may quote the caller).
  if (event.metadata?.provider_error) l.warn('call_event.provider_error', { code: event.metadata.provider_error.code })

  for (let attempt = 0; attempt < 3; attempt++) {
    let current = await findCall(db, event)
    if (!current && event.provider === 'cartesia') {
      const owner = await ownerOf(db, event.provider, event.externalAgentId)
      if (owner) current = await findRoutedCartesiaCall(db, owner.org_id, event)
    }
    const patch = mergeCallEvent(current, event)

    if (!current) {
      const owner = await ownerOf(db, event.provider, event.externalAgentId)
      if (!owner) {
        l.warn('call_event.unowned', { externalAgentId: event.externalAgentId })
        return { callId: null, outcome: 'unowned' }
      }
      if (await wasDeleted(db, owner.org_id, event)) {
        await deleteTombstonedConversation(event, owner.org_id, l)
        l.info('call_event.deleted_call_ignored')
        return { callId: null, outcome: 'deleted' }
      }
      const direction = event.direction ?? 'inbound'
      // Only a post-call result can tell a phone call from a web/SDK/test
      // session; failures and audio events keep today's behaviour (phone).
      const channel = event.kind === 'call.completed' && event.channel ? event.channel : 'phone'
      const isTest = channel !== 'phone'
      if (isTest) l.info('call_event.non_telephony', { channel, initiationSource: event.metadata?.initiation_source ?? null })
      const insert = {
        org_id: owner.org_id,
        agent_id: owner.agent_id,
        twilio_call_sid: event.twilioCallSid,
        phone_number_id: isTest ? null : await phoneNumberIdFor(db, owner.org_id, event),
        direction,
        caller_number: direction === 'outbound' ? event.toNumber : event.fromNumber,
        primary_provider: event.provider,
        routing_reason: 'primary',
        routing: isTest
          ? { mode: 'test', note: 'conversation did not come from a phone call (web, SDK or dashboard test)' }
          : { mode: 'native', note: 'call reached the provider directly (native number)' },
        started_at: event.startedAt,
        channel,
        is_test: isTest,
        ...patch,
      }
      const { data, error } = await db.from('calls').insert(insert).select('id').single()
      if (error) {
        if (error.code === '23505') continue // a concurrent event created it: merge into that row
        throw new Error(`calls insert failed: ${error.message}`)
      }
      await afterWrite(db, data.id as string, owner.org_id, event, l, { source, isTest })
      return { callId: data.id as string, outcome: 'created', test: isTest }
    }

    if (isFromOtherProvider(current, event)) {
      // Abandoned conversation of the provider that did not serve the call:
      // record its id only; no usage, no workflows (call-merge.ts).
      l.info('call_event.other_provider_ignored', { callId: current.id, servedBy: current.provider })
      if (patch && Object.keys(patch).length) {
        const { error } = await db.from('calls').update(patch).eq('id', current.id)
        if (error) throw new Error(`calls update failed: ${error.message}`)
      }
      // The abandoned conversation still cost the platform money.
      if (event.kind === 'call.completed') await recordProviderCost(db, current.id, current.org_id, event, l)
      return { callId: current.id, outcome: 'unchanged' }
    }
    const isTest = current.is_test === true
    if (!patch || Object.keys(patch).length === 0) {
      await afterWrite(db, current.id, current.org_id, event, l, { source, isTest })
      return { callId: current.id, outcome: 'unchanged', test: isTest }
    }
    if (!current.caller_number) {
      const other = (patch.direction ?? current.direction) === 'outbound' ? event.toNumber : event.fromNumber
      if (other) patch.caller_number = other
    }
    // Optimistic concurrency on updated_at: two events for the same call
    // (transcript + audio) must not overwrite each other's merge.
    const { data, error } = await db.from('calls').update(patch).eq('id', current.id).eq('updated_at', current.updated_at).select('id')
    if (error) throw new Error(`calls update failed: ${error.message}`)
    if ((data?.length ?? 0) === 0) continue
    await afterWrite(db, current.id, current.org_id, event, l, { source, isTest })
    return { callId: current.id, outcome: 'updated', test: isTest }
  }
  throw new Error('calls update kept conflicting; will be retried')
}

const MEDIA_EVIDENCE_MAX_AGE_MS = 2 * 60_000

/**
 * Provider cost of one call (service-only table: tenants can read calls rows,
 * so cost of goods never goes there). Best effort: a failure is logged and
 * never fails the event (the call data and the billing matter more).
 */
async function recordProviderCost(db: SupabaseClient, callId: string, orgId: string, event: NormalizedCallEvent, log: Logger): Promise<void> {
  if (event.costCredits === null && event.costUsd === null && !event.charging) return
  const { error } = await db.from('call_provider_costs').upsert(
    {
      call_id: callId,
      org_id: orgId,
      provider: event.provider,
      provider_call_id: event.providerCallId,
      cost_credits: event.costCredits,
      cost_usd: event.costUsd,
      is_burst: event.charging?.isBurst ?? null,
      tier: event.charging?.tier ?? null,
      dev_discount: event.charging?.devDiscount ?? null,
      llm_price: event.charging?.llmPrice ?? null,
      platform_price: event.charging?.platformPrice ?? null,
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'call_id,provider' },
  )
  if (error) log.error('call_event.cost_write_failed', new Error(error.message), { callId })
}

async function afterWrite(
  db: SupabaseClient,
  callId: string,
  orgId: string,
  event: NormalizedCallEvent,
  log: Logger,
  opts: { source: EventSource; isTest: boolean },
) {
  if (event.kind === 'call.completed') await recordProviderCost(db, callId, orgId, event, log)
  // Test sessions (web, SDK, dashboard): no billing, no workflows, and no
  // evidence about the telephony media path.
  if (opts.isTest) return
  // A conversation that outlived the early-failure window proves the
  // provider's media path works — but only as fresh evidence: a late or
  // retried webhook for a call that ended before an outage must not close
  // the media circuit opened by that outage.
  if (event.kind === 'call.completed' && typeof event.durationSeconds === 'number' && event.durationSeconds > earlyFailureWindowSeconds()) {
    const startedMs = event.startedAt ? Date.parse(event.startedAt) : NaN
    const endedMs = startedMs + event.durationSeconds * 1000
    if (Number.isFinite(endedMs) && Date.now() - endedMs < MEDIA_EVIDENCE_MAX_AGE_MS) {
      await reportOutcome(`${event.provider}_media`, { ok: true }, Date.now(), { evidenceStartedAt: startedMs })
    }
  }
  if (event.kind === 'call.completed' && typeof event.durationSeconds === 'number' && event.durationSeconds > 0) {
    await recordUsage(db, { orgId, callId, seconds: event.durationSeconds, provider: event.provider, source: `${event.provider}_${opts.source}` }, log)
  }
  if (event.kind === 'call.completed' || event.kind === 'call.initiation_failed') {
    await triggerWorkflowsOnce(db, callId, event.kind === 'call.completed' ? 'ended' : 'missed', log)
  }
}

export async function recordUsage(
  db: SupabaseClient,
  input: { orgId: string; callId: string; seconds: number; provider: string; source: string },
  log: Logger,
): Promise<void> {
  const { data, error } = await db.rpc('record_call_usage', {
    p_org_id: input.orgId,
    p_call_id: input.callId,
    p_key: `call:${input.callId}`,
    p_seconds: Math.round(input.seconds),
    p_provider: input.provider,
    p_source: input.source,
  })
  if (error) throw new Error(`record_call_usage failed: ${error.message}`)
  const row = (Array.isArray(data) ? data[0] : data) as { recorded: boolean; minutes: number; minutes_used_after: number | null } | null
  if (row?.recorded) {
    emitProviderEvent({ system: input.provider, kind: 'usage_recorded', ok: true, orgId: input.orgId, callId: input.callId, details: { minutes: row.minutes, source: input.source } })
    await maybeSendUsageAlert(db, input.orgId, row.minutes, log)
  }
}

const USAGE_ALERT_THRESHOLD = 0.8

/** Emails the owner once, on the call that first crosses 80% of the allowance. */
async function maybeSendUsageAlert(db: SupabaseClient, orgId: string, minutesJustAdded: number, log: Logger) {
  try {
    const { data: org, error } = await db.from('organizations').select('user_id, plan, minutes_used, minutes_limit').eq('id', orgId).single()
    if (error) throw new Error(error.message)
    if (!org?.minutes_limit || org.minutes_limit <= 0) return
    const after = org.minutes_used ?? 0
    const before = after - minutesJustAdded
    const threshold = org.minutes_limit * USAGE_ALERT_THRESHOLD
    if (before >= threshold || after < threshold || after >= org.minutes_limit) return
    const { data: userRes, error: userErr } = await db.auth.admin.getUserById(org.user_id as string)
    if (userErr) throw new Error(userErr.message)
    const email = userRes?.user?.email
    if (!email) return
    await sendEmail({
      to: email,
      ...usageAlertEmail({ minutesUsed: after, minutesLimit: org.minutes_limit, planName: PLANS[(org.plan ?? 'trial') as Plan]?.name }),
    })
  } catch (err) {
    // The usage itself is already recorded; the alert is best-effort.
    log.error('usage_alert.failed', err, { orgId })
  }
}

async function triggerWorkflowsOnce(db: SupabaseClient, callId: string, kind: 'ended' | 'missed', log: Logger) {
  const { data: claimed, error } = await db
    .from('calls')
    .update({ workflows_triggered_at: new Date().toISOString() })
    .eq('id', callId)
    .is('workflows_triggered_at', null)
    // Test sessions never trigger the owner's automations.
    .eq('is_test', false)
    .select(
      'id, org_id, provider_call_id, caller_number, from_number, to_number, direction, duration_seconds, status, sentiment, call_successful, outcome, summary, summary_title, analysis, transcript, started_at, ended_at, agents(name), organizations(name, timezone)',
    )
  if (error) throw new Error(`workflow claim failed: ${error.message}`)
  const call = claimed?.[0] as Record<string, unknown> | undefined
  if (!call) return // already triggered by an earlier delivery (or a test session)

  const agentRel = call.agents as { name?: string } | Array<{ name?: string }> | null
  type OrgJoin = { name?: string | null; timezone?: string | null }
  const orgRel = call.organizations as OrgJoin | OrgJoin[] | null
  const org = Array.isArray(orgRel) ? orgRel[0] : orgRel
  const transcript = Array.isArray(call.transcript) ? (call.transcript as Array<{ role: string; message: string }>) : []
  const ctx: CallContext = {
    call_id: callId,
    org_id: call.org_id as string,
    conversation_id: (call.provider_call_id as string) ?? callId,
    caller_number: (call.caller_number as string | null) ?? null,
    direction: (call.direction as string) ?? 'inbound',
    duration_seconds: (call.duration_seconds as number) ?? 0,
    status: (call.status as string) ?? 'completed',
    sentiment: (call.sentiment as string | null) ?? null,
    summary: (call.summary as string | null) ?? null,
    transcript,
    agent_name: (Array.isArray(agentRel) ? agentRel[0]?.name : agentRel?.name) ?? undefined,
    started_at: (call.started_at as string) ?? new Date().toISOString(),
    ended_at: (call.ended_at as string | null) ?? null,
    from_number: (call.from_number as string | null) ?? null,
    to_number: (call.to_number as string | null) ?? null,
    call_successful: (call.call_successful as string | null) ?? null,
    outcome: (call.outcome as string | null) ?? null,
    summary_title: (call.summary_title as string | null) ?? null,
    collected: collectedValues(call.analysis),
    business_name: org?.name ?? null,
    timezone: org?.timezone ?? null,
  }
  try {
    if (kind === 'missed') {
      await executeWorkflows('call_missed', ctx)
      return
    }
    await executeWorkflows('call_ended', ctx)
    // 'sentiment_negative' now means "the AI marked the call unsuccessful":
    // calls.sentiment is no longer derived from call_successful; older rows
    // keep their derived value.
    if (ctx.call_successful === 'failure' || ctx.sentiment === 'negative') await executeWorkflows('sentiment_negative', ctx)
    if (transcript.length > 0) await executeWorkflows('keyword_detected', ctx)
  } catch (err) {
    // Workflow runs record their own per-action failures; a crash here must
    // not make the provider retry the webhook (that would duplicate nothing,
    // since the claim is already taken, but would hide the error).
    log.error('workflows.failed', err, { callId })
  }
}
