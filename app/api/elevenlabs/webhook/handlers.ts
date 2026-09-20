import 'server-only'
import { createAdminClient } from '@/lib/supabase/admin'
import { isOpenAIConfigured } from '@/lib/env'
import { kvIncr } from '@/lib/kv'
import { maskPhone } from '@/lib/phone/e164'
import { recordCallUsage } from '@/lib/billing/usage'
import { entitlementsFor } from '@/lib/billing/entitlements'
import { behaviorFor } from '@/lib/voice/session'
import { analyzeAndStoreCall, appendHandoffTranscript } from '@/lib/voice/post-call'
import { executeWorkflows } from '@/lib/workflows/executor'
import {
  conversationMayUpdateCall,
  sentimentFromCallSuccessful,
  transcriptionAction,
  type InitiationFailureEvent,
  type TranscriptionEvent,
} from './payload'
import type { Agent, CallOutcome, Plan, Sentiment, TranscriptEntry } from '@/types'

// Storage side of the ElevenLabs webhook. Two kinds of conversations arrive:
//  1. Fallback calls our router (or the gateway bridge) sent to ElevenLabs: the
//     call row already exists, found by dynamic_variables.call_id or the Twilio
//     CallSid. Minutes are billed by our Twilio status callback, not here.
//  2. Legacy numbers still imported natively into ElevenLabs: no row exists, so
//     the conversation is imported and billed from its duration.

const LOG = '[elevenlabs-webhook]'
const TERMINAL_STATUSES = new Set(['completed', 'failed', 'busy', 'no-answer'])
const WORKFLOW_GUARD_SECONDS = 7 * 24 * 60 * 60

type Db = ReturnType<typeof createAdminClient>

interface CallRow {
  id: string
  org_id: string
  agent_id: string | null
  status: string | null
  started_at: string | null
  ended_at: string | null
  duration_seconds: number | null
  transcript: unknown
  summary: string | null
  sentiment: string | null
  analysis: unknown
  pipeline_mode: string | null
  fallback_reason: string | null
  recording_url: string | null
  is_test: boolean
}

const CALL_COLUMNS =
  'id, org_id, agent_id, status, started_at, ended_at, duration_seconds, transcript, summary, sentiment, analysis, pipeline_mode, fallback_reason, recording_url, is_test'

interface AgentRow {
  id: string
  org_id: string
  name: string | null
  metadata: unknown
}

function describe(error: unknown): string {
  if (!error) return 'unknown error'
  if (error instanceof Error) return error.message
  if (typeof error === 'object') {
    const e = error as { code?: string; message?: string }
    return [e.code, e.message].filter(Boolean).join(' ') || 'unknown error'
  }
  return String(error)
}

function hasTranscript(value: unknown): boolean {
  return Array.isArray(value) && value.length > 0
}

async function findAgentByElevenLabsId(db: Db, elevenLabsAgentId: string): Promise<AgentRow | null> {
  const { data, error } = await db
    .from('agents')
    .select('id, org_id, name, metadata')
    .eq('elevenlabs_agent_id', elevenLabsAgentId)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()
  if (error) throw new Error(`agent lookup failed: ${describe(error)}`)
  return (data as AgentRow | null) ?? null
}

async function orgPlan(db: Db, orgId: string): Promise<Plan | null> {
  const { data, error } = await db.from('organizations').select('plan').eq('id', orgId).maybeSingle()
  if (error) {
    console.error(LOG, 'organization lookup failed', orgId, describe(error))
    return null
  }
  return ((data as { plan: Plan } | null)?.plan) ?? null
}

async function agentMetadata(db: Db, orgId: string, agentId: string | null): Promise<unknown> {
  if (!agentId) return null
  const { data, error } = await db.from('agents').select('metadata').eq('id', agentId).eq('org_id', orgId).maybeSingle()
  if (error) {
    console.error(LOG, 'agent lookup failed', agentId, describe(error))
    return null
  }
  return (data as { metadata: unknown } | null)?.metadata ?? null
}

/** A recording is kept only when the owner's switch is on and the plan includes recordings. */
function recordingAllowed(metadata: unknown, plan: Plan | null, isTest: boolean): boolean {
  if (!plan || !metadata) return false
  const behavior = behaviorFor({ metadata: typeof metadata === 'object' ? metadata : {} } as Agent, { isTest })
  return behavior.record && entitlementsFor(plan).recordings
}

async function updateWithProviderIds(db: Db, callId: string, orgId: string, update: Record<string, unknown>): Promise<void> {
  let { error } = await db.from('calls').update(update).eq('id', callId).eq('org_id', orgId)
  if (error?.code === '23505') {
    // The conversation id is already stored on another row (an earlier native
    // import): keep this call's data and leave the ids where they are.
    console.warn(LOG, 'conversation already stored on another call; updating without provider ids', callId)
    const rest = { ...update }
    delete rest.provider_call_id
    delete rest.elevenlabs_conversation_id
    ;({ error } = await db.from('calls').update(rest).eq('id', callId).eq('org_id', orgId))
  }
  if (error) throw new Error(`call update failed: ${describe(error)}`)
}

// ─── post_call_transcription ─────────────────────────────────────────────────

export async function handleTranscription(event: TranscriptionEvent): Promise<void> {
  const db = createAdminClient()

  const existing = await findRoutedCall(db, event)
  if (existing === 'rejected') return
  const action = transcriptionAction({ routedRowFound: !!existing, dynamicCallId: event.dynamic.callId })
  if (action === 'update' && existing) {
    await updateRoutedCall(db, existing, event)
    return
  }
  if (action === 'skip') {
    console.warn(LOG, 'conversation belongs to a call that no longer exists; not stored', event.conversationId)
    return
  }
  await importNativeConversation(db, event)
}

/** The call row our router created, verified to belong to the agent's organisation. */
async function findRoutedCall(db: Db, event: TranscriptionEvent): Promise<CallRow | null | 'rejected'> {
  const sid = event.dynamic.twilioCallSid ?? event.phone.callSid
  let row: CallRow | null = null

  if (event.dynamic.callId) {
    const { data, error } = await db.from('calls').select(CALL_COLUMNS).eq('id', event.dynamic.callId).maybeSingle()
    if (error) throw new Error(`call lookup failed: ${describe(error)}`)
    row = (data as CallRow | null) ?? null
    if (!row) console.warn(LOG, 'call_id from dynamic variables not found', event.dynamic.callId)
  }
  if (!row && sid) {
    const { data, error } = await db.from('calls').select(CALL_COLUMNS).eq('twilio_call_sid', sid).maybeSingle()
    if (error) throw new Error(`call lookup by CallSid failed: ${describe(error)}`)
    row = (data as CallRow | null) ?? null
  }
  if (!row) return null

  const agent = await findAgentByElevenLabsId(db, event.agentId)
  if (conversationMayUpdateCall({ rowOrgId: row.org_id, agentOrgId: agent?.org_id ?? null, dynamicOrgId: event.dynamic.orgId })) {
    return row
  }
  console.warn(LOG, 'conversation does not belong to the organisation of the matched call', row.id)
  return 'rejected'
}

async function updateRoutedCall(db: Db, row: CallRow, event: TranscriptionEvent): Promise<void> {
  // The gateway (or an earlier delivery) already analysed this call: only link the conversation.
  const analysed = !!row.analysis
  const update: Record<string, unknown> = {
    voice_provider: 'elevenlabs',
    provider_call_id: event.conversationId,
    elevenlabs_conversation_id: event.conversationId,
    fallback_used: true,
    fallback_reason: row.fallback_reason ?? event.dynamic.failoverReason ?? 'elevenlabs_fallback',
    pipeline_mode: row.pipeline_mode ?? 'elevenlabs',
  }

  if (!analysed) {
    if (!hasTranscript(row.transcript) && event.transcript.length > 0) {
      update.transcript = event.transcript
    } else if (row.fallback_reason === 'stream_ended' && event.transcript.length > 0) {
      // The app put the caller through mid-conversation: the gateway stored the first part.
      update.transcript = appendHandoffTranscript(row.transcript as TranscriptEntry[], event.transcript)
    }
    if (!row.summary && event.summary) update.summary = event.summary
    if (!row.sentiment && !isOpenAIConfigured()) {
      const fallback = sentimentFromCallSuccessful(event.callSuccessful)
      if (fallback) update.sentiment = fallback
    }
    update.duration_seconds = Math.max(Number(row.duration_seconds) || 0, event.durationSeconds)
    if (!row.started_at) update.started_at = event.startedAt
    if (!row.ended_at) update.ended_at = event.endedAt
    if (!row.status || !TERMINAL_STATUSES.has(row.status)) update.status = 'completed'
    if (event.hasAudio && !row.recording_url) {
      const [plan, metadata] = await Promise.all([orgPlan(db, row.org_id), agentMetadata(db, row.org_id, row.agent_id)])
      if (recordingAllowed(metadata, plan, row.is_test)) update.recording_url = `/api/calls/${row.id}/audio`
    }
  }

  await updateWithProviderIds(db, row.id, row.org_id, update)
  if (!analysed) await analyzeAndStoreCall(row.id)
}

async function importNativeConversation(db: Db, event: TranscriptionEvent): Promise<void> {
  const agent = await findAgentByElevenLabsId(db, event.agentId)
  if (!agent) {
    console.warn(LOG, 'no agent matches this ElevenLabs agent; conversation not stored', event.conversationId)
    return
  }

  const { data: existingData, error: existingError } = await db
    .from('calls')
    .select(CALL_COLUMNS)
    .eq('voice_provider', 'elevenlabs')
    .eq('provider_call_id', event.conversationId)
    .maybeSingle()
  if (existingError) throw new Error(`call lookup failed: ${describe(existingError)}`)
  const existing = existingData as CallRow | null

  if (existing && existing.org_id !== agent.org_id) {
    console.warn(LOG, 'conversation already stored for another organisation', existing.id)
    return
  }

  let phoneNumberId: string | null = null
  if (event.phone.agentNumber) {
    const { data, error } = await db
      .from('phone_numbers')
      .select('id')
      .eq('org_id', agent.org_id)
      .eq('number', event.phone.agentNumber)
      .maybeSingle()
    if (error) console.error(LOG, 'phone number lookup failed', describe(error))
    phoneNumberId = (data as { id: string } | null)?.id ?? null
  }

  const plan = await orgPlan(db, agent.org_id)
  const record = event.hasAudio && recordingAllowed(agent.metadata, plan, false)

  const fields: Record<string, unknown> = {
    org_id: agent.org_id,
    agent_id: agent.id,
    phone_number_id: phoneNumberId,
    voice_provider: 'elevenlabs',
    pipeline_mode: 'elevenlabs',
    provider_call_id: event.conversationId,
    elevenlabs_conversation_id: event.conversationId,
    caller_number: event.phone.externalNumber,
    from_number: event.phone.fromNumber,
    to_number: event.phone.toNumber,
    direction: event.phone.direction,
    duration_seconds: event.durationSeconds,
    status: 'completed',
    started_at: event.startedAt,
    ended_at: event.endedAt,
  }
  const analysed = !!existing?.analysis
  if (!analysed) {
    fields.transcript = event.transcript
    if (event.summary) fields.summary = event.summary
    if (!isOpenAIConfigured()) {
      const fallback = sentimentFromCallSuccessful(event.callSuccessful)
      if (fallback) fields.sentiment = fallback
    }
  }

  let callId: string
  if (existing) {
    callId = existing.id
    if (record && !existing.recording_url) fields.recording_url = `/api/calls/${callId}/audio`
    const { error } = await db.from('calls').update(fields).eq('id', callId).eq('org_id', agent.org_id)
    if (error) throw new Error(`call update failed: ${describe(error)}`)
  } else {
    callId = await insertImportedCall(db, fields, event.phone.callSid)
    if (record) {
      const { error } = await db
        .from('calls')
        .update({ recording_url: `/api/calls/${callId}/audio` })
        .eq('id', callId)
        .eq('org_id', agent.org_id)
      if (error) console.error(LOG, 'could not mark the recording', callId, describe(error))
    }
  }

  if (event.durationSeconds > 0) {
    try {
      await recordCallUsage({
        orgId: agent.org_id,
        callId,
        idempotencyKey: `call:elevenlabs:${event.conversationId}`,
        voiceProvider: 'elevenlabs',
        pipelineMode: 'elevenlabs',
        billableSeconds: event.durationSeconds,
      })
    } catch (error) {
      console.error(LOG, 'recording call usage failed', callId, describe(error))
    }
  }

  if (!analysed) await analyzeAndStoreCall(callId)
}

async function insertImportedCall(db: Db, fields: Record<string, unknown>, sid: string | null): Promise<string> {
  const withSid = sid ? { ...fields, twilio_call_sid: sid } : fields
  let { data, error } = await db.from('calls').insert(withSid).select('id').single()
  if (error?.code === '23505') {
    // Either a concurrent delivery inserted the conversation, or the CallSid is
    // already on another row. Prefer the existing conversation row.
    const { data: raced } = await db
      .from('calls')
      .select('id')
      .eq('voice_provider', 'elevenlabs')
      .eq('provider_call_id', String(fields.provider_call_id))
      .maybeSingle()
    if (raced) return (raced as { id: string }).id
    ;({ data, error } = await db.from('calls').insert(fields).select('id').single())
  }
  if (error || !data) throw new Error(`call insert failed: ${describe(error)}`)
  return (data as { id: string }).id
}

// ─── call_initiation_failure ─────────────────────────────────────────────────

export async function handleInitiationFailure(event: InitiationFailureEvent): Promise<void> {
  const db = createAdminClient()
  const agent = await findAgentByElevenLabsId(db, event.agentId)
  if (!agent) {
    console.warn(LOG, 'no agent matches this ElevenLabs agent; failed call not stored', event.conversationId)
    return
  }

  const { data: existing, error: lookupError } = await db
    .from('calls')
    .select('id, org_id')
    .eq('voice_provider', 'elevenlabs')
    .eq('provider_call_id', event.conversationId)
    .maybeSingle()
  if (lookupError) throw new Error(`call lookup failed: ${describe(lookupError)}`)
  if (existing) return

  const fields: Record<string, unknown> = {
    org_id: agent.org_id,
    agent_id: agent.id,
    voice_provider: 'elevenlabs',
    pipeline_mode: 'elevenlabs',
    provider_call_id: event.conversationId,
    elevenlabs_conversation_id: event.conversationId,
    caller_number: event.externalNumber,
    from_number: event.fromNumber,
    to_number: event.toNumber,
    direction: event.direction,
    duration_seconds: 0,
    status: event.status,
    outcome: 'missed',
    end_reason: event.status === 'no-answer' ? 'no_answer' : event.status,
    transcript: [],
    started_at: event.occurredAt,
    ended_at: event.occurredAt,
  }
  const callId = await insertImportedCall(db, fields, event.callSid)

  if ((await kvIncr(`post-call:workflows:${callId}`, WORKFLOW_GUARD_SECONDS)) > 1) return
  // Built as a variable so the workflow context can grow fields without breaking this call site.
  const ctx = {
    call_id: callId,
    org_id: agent.org_id,
    conversation_id: event.conversationId,
    caller_number: event.externalNumber,
    from_number: event.fromNumber,
    to_number: event.toNumber,
    direction: event.direction,
    duration_seconds: 0,
    status: event.status,
    sentiment: null as Sentiment | null,
    summary: null as string | null,
    outcome: 'missed' as CallOutcome,
    intent: null as string | null,
    tags: [] as string[],
    extracted: {} as Record<string, string>,
    transcript: [] as { role: 'agent' | 'user'; message: string }[],
    agent_name: agent.name ?? undefined,
    started_at: event.occurredAt,
  }
  try {
    await executeWorkflows(agent.org_id, 'call_missed', ctx)
  } catch (error) {
    console.error(
      LOG,
      'call_missed workflows failed',
      callId,
      event.externalNumber ? maskPhone(event.externalNumber) : '',
      describe(error)
    )
  }
}
