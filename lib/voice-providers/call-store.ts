import 'server-only'
// Applies normalized provider events to the `calls` table (single source of
// truth for call history, whichever provider served the call), then performs
// the once-per-call side effects:
//   • usage: record_call_usage() inserts into usage_ledger with key call:<id>
//     and increments minutes_used only if that insert happened (retries and
//     a second source for the same call are no-ops);
//   • workflows: claimed with workflows_triggered_at IS NULL → now().

import type { SupabaseClient } from '@supabase/supabase-js'
import { createAdminClient } from '@/lib/supabase/admin'
import { createLogger, type Logger } from '@/lib/observability/logger'
import { emitProviderEvent } from '@/lib/observability/telemetry'
import { mergeCallEvent, type StoredCall } from './call-merge'
import type { NormalizedCallEvent } from './types'
import type { VoiceProvider } from './errors'
import { executeWorkflows, type CallContext } from '@/lib/workflows/executor'
import { sendEmail } from '@/lib/email/client'
import { usageAlertEmail } from '@/lib/email/templates'
import { PLANS, type Plan } from '@/types'

const STORED_COLUMNS =
  'id, org_id, agent_id, status, lifecycle_rank, provider, provider_call_id, elevenlabs_conversation_id, cartesia_call_id, transcript, summary, duration_seconds, started_at, ended_at, routing_reason, outcome, direction, caller_number, from_number, to_number, sentiment, updated_at, workflows_triggered_at'

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
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

async function findCall(db: SupabaseClient, event: NormalizedCallEvent): Promise<CallRow | null> {
  const tries: Array<[string, string]> = []
  if (event.localCallId && UUID.test(event.localCallId)) tries.push(['id', event.localCallId])
  tries.push([event.provider === 'elevenlabs' ? 'elevenlabs_conversation_id' : 'cartesia_call_id', event.providerCallId])
  tries.push(['provider_call_id', event.providerCallId])
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

export interface ApplyResult {
  callId: string | null
  outcome: 'created' | 'updated' | 'unchanged' | 'unowned'
}

export async function applyCallEvent(event: NormalizedCallEvent, log: Logger = createLogger()): Promise<ApplyResult> {
  const db = createAdminClient()
  const l = log.child({ provider: event.provider, providerCallId: event.providerCallId })

  for (let attempt = 0; attempt < 3; attempt++) {
    const current = await findCall(db, event)
    const patch = mergeCallEvent(current, event)

    if (!current) {
      const owner = await ownerOf(db, event.provider, event.externalAgentId)
      if (!owner) {
        l.warn('call_event.unowned', { externalAgentId: event.externalAgentId })
        return { callId: null, outcome: 'unowned' }
      }
      const direction = event.direction ?? 'inbound'
      const insert = {
        org_id: owner.org_id,
        agent_id: owner.agent_id,
        twilio_call_sid: event.twilioCallSid,
        direction,
        caller_number: direction === 'outbound' ? event.toNumber : event.fromNumber,
        primary_provider: event.provider,
        routing_reason: 'primary',
        routing: { mode: 'native', note: 'call reached the provider directly (native number)' },
        started_at: event.startedAt,
        ...patch,
      }
      const { data, error } = await db.from('calls').insert(insert).select('id').single()
      if (error) {
        if (error.code === '23505') continue // a concurrent event created it: merge into that row
        throw new Error(`calls insert failed: ${error.message}`)
      }
      await afterWrite(db, data.id as string, owner.org_id, event, l)
      return { callId: data.id as string, outcome: 'created' }
    }

    if (!patch || Object.keys(patch).length === 0) {
      await afterWrite(db, current.id, current.org_id, event, l)
      return { callId: current.id, outcome: 'unchanged' }
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
    await afterWrite(db, current.id, current.org_id, event, l)
    return { callId: current.id, outcome: 'updated' }
  }
  throw new Error('calls update kept conflicting; will be retried')
}

async function afterWrite(db: SupabaseClient, callId: string, orgId: string, event: NormalizedCallEvent, log: Logger) {
  if (event.kind === 'call.completed' && typeof event.durationSeconds === 'number' && event.durationSeconds > 0) {
    await recordUsage(db, { orgId, callId, seconds: event.durationSeconds, provider: event.provider, source: `${event.provider}_webhook` }, log)
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
    .select('id, org_id, provider_call_id, caller_number, direction, duration_seconds, status, sentiment, summary, transcript, started_at, agents(name)')
  if (error) throw new Error(`workflow claim failed: ${error.message}`)
  const call = claimed?.[0] as Record<string, unknown> | undefined
  if (!call) return // already triggered by an earlier delivery

  const agentRel = call.agents as { name?: string } | Array<{ name?: string }> | null
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
  }
  try {
    if (kind === 'missed') {
      await executeWorkflows('call_missed', ctx)
      return
    }
    await executeWorkflows('call_ended', ctx)
    if (ctx.sentiment === 'negative') await executeWorkflows('sentiment_negative', ctx)
    if (transcript.length > 0) await executeWorkflows('keyword_detected', ctx)
  } catch (err) {
    // Workflow runs record their own per-action failures; a crash here must
    // not make the provider retry the webhook (that would duplicate nothing,
    // since the claim is already taken, but would hide the error).
    log.error('workflows.failed', err, { callId })
  }
}
