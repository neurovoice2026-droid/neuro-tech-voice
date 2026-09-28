import 'server-only'
import { z } from 'zod'
import { createAdminClient } from '@/lib/supabase/admin'
import { cartesia, cartesiaTtsModel, CartesiaError } from '@/lib/cartesia/client'
import type { CartesiaAgentCall, CartesiaCallTranscriptTurn } from '@/lib/cartesia/types'
import { isCartesiaConfigured, isElevenLabsWebhookConfigured, isOpenAIConfigured } from '@/lib/env'
import { kvDel, kvIncr } from '@/lib/kv'
import { openAIVoiceModel } from '@/lib/openai/client'
import {
  analyzeCall,
  buildOutcomeEvidence,
  mergeExtracted,
  resolveCallOutcome,
  sentimentOrNull,
  type AnalysisUsage,
  type ToolEvidenceItem,
} from '@/lib/openai/analysis'
import { entitlementsFor } from '@/lib/billing/entitlements'
import {
  AGENT_CENTS_PER_SECOND,
  creditsForStt,
  creditsForTts,
  recordProviderUsage,
  type ProviderUsageEvent,
} from '@/lib/voice/budget'
import { behaviorFor } from '@/lib/voice/session'
import { fromCartesiaToolName, VOICE_TOOL_NAMES } from '@/lib/voice/tools/definitions'
import { executeWorkflows } from '@/lib/workflows/executor'
import type {
  CallEndReason,
  CallUsage,
  FinalizeRequest,
  KnowledgeSourceRef,
  SttModel,
  VoicePipelineMode,
  VoiceToolName,
} from '@/lib/voice/contracts'
import type { Agent, CallAnalysis, CallOutcome, LeadField, Plan, Sentiment, TranscriptEntry } from '@/types'

// What happens after a call ends, whichever way it was served:
//   finalizeCall()        gateway calls (cartesia_self / cartesia_managed / elevenlabs bridge):
//                         transcript, timing, usage columns, provider metering
//   analyzeAndStoreCall() every call with a transcript (also the ElevenLabs webhook):
//                         OpenAI analysis → outcome/sentiment/summary/lead details → workflows
// Both are idempotent: the gateway retries finalize and webhooks get redelivered.
// Minutes are billed by the Twilio status callback (S1), never here.

const LOG = '[post-call]'

const TERMINAL_STATUSES = new Set(['completed', 'failed', 'busy', 'no-answer'])
const MAX_TURNS = 2_000
const MAX_MESSAGE_CHARS = 8_000
const MAX_SOURCES_PER_TURN = 10
const MAX_CALL_SOURCES = 50
/** A call can't last longer than this; anything above is a clock problem. */
const MAX_CALL_SECONDS = 6 * 60 * 60
const ANALYZE_LOCK_SECONDS = 5 * 60
const WORKFLOW_GUARD_SECONDS = 7 * 24 * 60 * 60
const CARTESIA_DELETE_RETRY_MS = 3_000
const MANAGED_CALL_SETTLE_MS = 4_000

// ─── Validation of the gateway body ──────────────────────────────────────────

const uuid = z.string().regex(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i)
const providerId = z.string().regex(/^[A-Za-z0-9_-]{1,128}$/)
const isoDate = z.string().refine((v) => Number.isFinite(Date.parse(v)), 'Must be an ISO date')
const count = z.number().finite().min(0).max(1e9).catch(0)

const END_REASONS = [
  'caller_hangup', 'agent_hangup', 'transferred', 'silence_timeout',
  'max_duration', 'voicemail', 'error', 'test_ended',
] as const satisfies readonly CallEndReason[]

const sourceSchema = z.object({
  document_id: z.string().max(128),
  document_name: z.string().max(300),
  chunk_id: z.string().max(128),
  excerpt: z.string().max(1_000).catch(''),
  similarity: z.number().finite().catch(0),
})

const turnSchema = z.object({
  role: z.enum(['agent', 'user']),
  message: z.string().max(50_000).catch(''),
  time_in_call_secs: z.number().finite().min(0).catch(0),
  interrupted: z.boolean().optional(),
  sources: z.array(sourceSchema).max(50).optional().catch(undefined),
  tool_calls: z.array(z.object({ name: z.string().max(64), ok: z.boolean() })).max(50).optional().catch(undefined),
})

/** Body of POST /api/voice/internal/finalize (lib/voice/contracts.ts FinalizeRequest). */
export const FinalizeRequestSchema = z.object({
  session_id: uuid,
  call_id: uuid,
  started_at: isoDate,
  ended_at: isoDate,
  // An unknown reason from a newer gateway must not drop the whole call.
  end_reason: z.enum(END_REASONS).catch('error'),
  mode: z.enum(['cartesia_self', 'cartesia_managed', 'elevenlabs']),
  fallback_used: z.boolean().catch(false),
  fallback_reason: z.string().max(200).nullable().catch(null),
  transcript: z.array(turnSchema).max(10_000),
  usage: z.object({
    tts_characters: count,
    stt_seconds: count,
    stt_model: z.enum(['ink-2', 'ink-preview', 'ink-whisper']).nullable().catch(null),
    agent_seconds: count,
    elevenlabs_seconds: count,
    elevenlabs_tts_characters: count,
    llm_input_tokens: count,
    llm_cached_input_tokens: count,
    llm_output_tokens: count,
  }),
  cartesia_call_id: providerId.nullable().catch(null),
  elevenlabs_conversation_id: providerId.nullable().catch(null),
})

// ─── Pure helpers (unit tested) ──────────────────────────────────────────────

const TOOL_NAMES = new Set<string>(VOICE_TOOL_NAMES)

function isToolName(name: string): name is VoiceToolName {
  return TOOL_NAMES.has(name)
}

/** Trims messages, drops empty turns, keeps valid tool names and sources, caps sizes. */
export function sanitizeTranscript(turns: FinalizeRequest['transcript']): TranscriptEntry[] {
  const out: TranscriptEntry[] = []
  for (const turn of turns) {
    const message = typeof turn.message === 'string' ? turn.message.trim().slice(0, MAX_MESSAGE_CHARS) : ''
    const toolCalls = (turn.tool_calls ?? [])
      .filter((c) => c && typeof c.name === 'string' && isToolName(c.name))
      .map((c) => ({ name: c.name, ok: c.ok === true }))
    if (!message && toolCalls.length === 0) continue
    const entry: TranscriptEntry = {
      role: turn.role === 'agent' ? 'agent' : 'user',
      message,
      time_in_call_secs: Math.max(0, Math.round((Number(turn.time_in_call_secs) || 0) * 10) / 10),
    }
    if (turn.interrupted) entry.interrupted = true
    const sources = (turn.sources ?? []).slice(0, MAX_SOURCES_PER_TURN)
    if (sources.length > 0 && entry.role === 'agent') entry.sources = sources
    if (toolCalls.length > 0) entry.tool_calls = toolCalls
    out.push(entry)
    if (out.length >= MAX_TURNS) break
  }
  return out
}

/** Unique passages the agent answered from, best match first. */
export function aggregateKnowledgeSources(transcript: Pick<TranscriptEntry, 'sources'>[]): KnowledgeSourceRef[] {
  const byChunk = new Map<string, KnowledgeSourceRef>()
  for (const turn of transcript) {
    for (const source of turn.sources ?? []) {
      if (!source?.chunk_id) continue
      const existing = byChunk.get(source.chunk_id)
      if (!existing || source.similarity > existing.similarity) byChunk.set(source.chunk_id, source)
    }
  }
  return Array.from(byChunk.values())
    .sort((a, b) => b.similarity - a.similarity)
    .slice(0, MAX_CALL_SOURCES)
}

/** Whole seconds between two ISO instants, clamped to a sane range. */
export function secondsBetween(startIso: string | null | undefined, endIso: string | null | undefined): number {
  const start = Date.parse(startIso ?? '')
  const end = Date.parse(endIso ?? '')
  if (!Number.isFinite(start) || !Number.isFinite(end) || end <= start) return 0
  return Math.min(MAX_CALL_SECONDS, Math.round((end - start) / 1000))
}

export type FinalizePlan =
  | { kind: 'skip'; reason: 'session_mismatch' | 'already_finalized' }
  | { kind: 'analyze_only' }
  | { kind: 'usage_only' }
  | { kind: 'apply' }

export interface FinalizeRowState {
  id: string
  ended_at: string | null
  analysis: unknown
  /** Set only by finalize, so non-null means the usage was already stored. */
  tts_characters: number | null
}

/**
 * - different session: skip (a token for another call)
 * - usage stored and analysed: skip (a retry, everything is done)
 * - usage stored, no analysis: only (re)run the analysis
 * - analysed, no usage: the ElevenLabs webhook finished the call first (the
 *   gateway handed it over mid-call), so store only usage and metering
 * - otherwise apply the whole finalize update
 */
export function planFinalize(row: FinalizeRowState, req: Pick<FinalizeRequest, 'session_id' | 'call_id'>): FinalizePlan {
  if (row.id !== req.session_id || row.id !== req.call_id) return { kind: 'skip', reason: 'session_mismatch' }
  const usageStored = row.tts_characters !== null && row.tts_characters !== undefined
  const analysed = !!row.analysis
  if (usageStored && analysed) return { kind: 'skip', reason: 'already_finalized' }
  if (usageStored) return { kind: 'analyze_only' }
  if (analysed) return { kind: 'usage_only' }
  return { kind: 'apply' }
}

export function voiceProviderForMode(mode: VoicePipelineMode): 'cartesia' | 'elevenlabs' {
  return mode === 'elevenlabs' ? 'elevenlabs' : 'cartesia'
}

function round2(value: number): number {
  return Math.round(value * 100) / 100
}

/** Largest amount Cartesia's call record may add to the gateway's own count before it looks like a clock problem. */
const MAX_AGENT_SECONDS_DRIFT = 60

/**
 * Managed Agent seconds to meter. The gateway counts from session_ready until
 * it closes the socket; Cartesia's call record (end_time - start_time) runs
 * 5-8 s longer because Cartesia closes the call after the socket (live e2e
 * runs S4/S5). Which of the two Cartesia bills isn't documented, so the
 * agent-dollar budget uses the longer one: an estimate that runs low lets the
 * budget switch fire late.
 */
export function reconcileAgentSeconds(gatewaySeconds: number, providerSeconds: number): number {
  if (!(gatewaySeconds > 0) || !(providerSeconds > gatewaySeconds)) return gatewaySeconds
  return round2(Math.min(providerSeconds, gatewaySeconds + MAX_AGENT_SECONDS_DRIFT))
}

export function cartesiaCreditsFor(usage: Pick<CallUsage, 'tts_characters' | 'stt_seconds' | 'stt_model'>): number {
  return round2(creditsForTts(usage.tts_characters) + creditsForStt(usage.stt_model as SttModel | null, usage.stt_seconds))
}

export function buildProviderUsageEvents(input: {
  orgId: string
  callId: string
  usage: CallUsage
  cartesiaCallId: string | null
  elevenLabsConversationId: string | null
  ttsModel: string
  llmModel: string
}): ProviderUsageEvent[] {
  const { usage, orgId, callId } = input
  const base = { org_id: orgId, call_id: callId }
  const events: ProviderUsageEvent[] = []

  if (usage.tts_characters > 0) {
    events.push({
      ...base,
      provider: 'cartesia',
      kind: 'tts_characters',
      quantity: Math.round(usage.tts_characters),
      credits: creditsForTts(usage.tts_characters),
      meta: { model: input.ttsModel, source: 'call' },
    })
  }
  if (usage.stt_seconds > 0) {
    events.push({
      ...base,
      provider: 'cartesia',
      kind: 'stt_seconds',
      quantity: round2(usage.stt_seconds),
      credits: creditsForStt(usage.stt_model, usage.stt_seconds),
      meta: { model: usage.stt_model, source: 'call' },
    })
  }
  if (usage.agent_seconds > 0) {
    // Managed Agents are paid from voice-agent dollars, not model credits.
    events.push({
      ...base,
      provider: 'cartesia',
      kind: 'agent_seconds',
      quantity: round2(usage.agent_seconds),
      credits: 0,
      cost_cents: round2(usage.agent_seconds * AGENT_CENTS_PER_SECOND),
      meta: { cartesia_call_id: input.cartesiaCallId },
    })
  }
  const llmTokens = usage.llm_input_tokens + usage.llm_output_tokens
  if (llmTokens > 0) {
    events.push({
      ...base,
      provider: 'openai',
      kind: 'llm_tokens',
      quantity: Math.round(llmTokens),
      meta: {
        model: input.llmModel,
        purpose: 'voice',
        input_tokens: Math.round(usage.llm_input_tokens),
        cached_input_tokens: Math.round(usage.llm_cached_input_tokens),
        output_tokens: Math.round(usage.llm_output_tokens),
      },
    })
  }
  if (usage.elevenlabs_seconds > 0) {
    events.push({
      ...base,
      provider: 'elevenlabs',
      // A conversation id means the whole agent ran there; otherwise only speech recognition did.
      kind: input.elevenLabsConversationId ? 'agent_seconds' : 'stt_seconds',
      quantity: round2(usage.elevenlabs_seconds),
      meta: { conversation_id: input.elevenLabsConversationId },
    })
  }
  if (usage.elevenlabs_tts_characters > 0) {
    events.push({
      ...base,
      provider: 'elevenlabs',
      kind: 'tts_characters',
      quantity: Math.round(usage.elevenlabs_tts_characters),
      meta: { source: 'call' },
    })
  }
  return events
}

/** Cartesia Managed Agent transcript → our turns ('assistant' is the agent, system turns dropped). */
export function mapCartesiaTranscript(turns: CartesiaCallTranscriptTurn[] | null | undefined): TranscriptEntry[] {
  const out: TranscriptEntry[] = []
  for (const turn of turns ?? []) {
    const role = turn.role === 'user' ? 'user' : turn.role === 'assistant' || turn.role === 'agent' ? 'agent' : null
    if (!role) continue
    const message = typeof turn.text === 'string' ? turn.text.trim().slice(0, MAX_MESSAGE_CHARS) : ''
    const toolCalls = (turn.tool_calls ?? [])
      .map((c) => {
        const name = typeof c?.name === 'string' ? fromCartesiaToolName(c.name) ?? (isToolName(c.name) ? c.name : null) : null
        return name ? { name, ok: typeof c.result === 'string' && !/^\s*(error|failed)/i.test(c.result) } : null
      })
      .filter((c): c is { name: VoiceToolName; ok: boolean } => c !== null)
    if (!message && toolCalls.length === 0) continue
    const entry: TranscriptEntry = {
      role,
      message,
      time_in_call_secs: Math.max(0, Math.round((Number(turn.start_timestamp) || 0) * 10) / 10),
    }
    if (toolCalls.length > 0) entry.tool_calls = toolCalls
    out.push(entry)
    if (out.length >= MAX_TURNS) break
  }
  return out
}

export interface FinalizeRow extends FinalizeRowState {
  org_id: string
  agent_id: string | null
  is_test: boolean
  status: string | null
  started_at: string | null
  duration_seconds: number | null
  end_reason: string | null
  fallback_used: boolean | null
  fallback_reason: string | null
  provider_call_id: string | null
  summary: string | null
  recording_url: string | null
  transcript?: unknown
  pipeline_mode?: string | null
  voice_provider?: string | null
}

/**
 * True when the app's stream-ended route put the live caller through to the
 * ElevenLabs agent after the gateway leg failed. The gateway's finalize then
 * describes only that first leg: the call is still going, on ElevenLabs.
 */
export function wasHandedOffByApp(
  row: Pick<FinalizeRow, 'pipeline_mode' | 'fallback_used' | 'fallback_reason'>,
  req: Pick<FinalizeRequest, 'mode'>
): boolean {
  return row.pipeline_mode === 'elevenlabs' && row.fallback_used === true && row.fallback_reason === 'stream_ended' && req.mode !== 'elevenlabs'
}

/**
 * The gateway leg's transcript followed by the ElevenLabs leg's (whose clock
 * starts again at zero), for a call the app handed over mid-conversation.
 */
export function appendHandoffTranscript(before: TranscriptEntry[], after: TranscriptEntry[]): TranscriptEntry[] {
  if (before.length === 0) return after
  if (after.length === 0) return before
  const offset = Math.max(...before.map((turn) => Number(turn.time_in_call_secs) || 0)) + 1
  return [
    ...before,
    ...after.map((turn) => ({ ...turn, time_in_call_secs: Math.round(((Number(turn.time_in_call_secs) || 0) + offset) * 100) / 100 })),
  ]
}

/** Usage columns only; also what a call analysed by the ElevenLabs webhook still needs. */
export function buildUsageUpdate(req: FinalizeRequest, transcript: TranscriptEntry[]): Record<string, unknown> {
  return {
    knowledge_sources: aggregateKnowledgeSources(transcript),
    tts_characters: Math.round(req.usage.tts_characters),
    stt_seconds: round2(req.usage.stt_seconds),
    stt_model: req.usage.stt_model,
    agent_seconds: round2(req.usage.agent_seconds),
    llm_input_tokens: Math.round(req.usage.llm_input_tokens),
    llm_cached_input_tokens: Math.round(req.usage.llm_cached_input_tokens),
    llm_output_tokens: Math.round(req.usage.llm_output_tokens),
    cartesia_credits: cartesiaCreditsFor(req.usage),
  }
}

export function buildFinalizeUpdate(input: {
  row: FinalizeRow
  req: FinalizeRequest
  transcript: TranscriptEntry[]
  providerSummary: string | null
  providerDurationSeconds: number
  recordingAvailable: boolean
}): Record<string, unknown> {
  const { row, req } = input
  if (wasHandedOffByApp(row, req)) {
    // The ElevenLabs agent is still talking to the caller: keep the provider,
    // status and end of call for the Twilio status callback and the webhook.
    const update: Record<string, unknown> = {
      transcript: input.transcript,
      started_at: row.started_at ?? req.started_at,
      duration_seconds: Math.max(Number(row.duration_seconds) || 0, secondsBetween(req.started_at, req.ended_at)),
      fallback_used: true,
      ...buildUsageUpdate(req, input.transcript),
    }
    return update
  }
  const voiceProvider = voiceProviderForMode(req.mode)
  const providerCallId = voiceProvider === 'elevenlabs'
    ? req.elevenlabs_conversation_id ?? row.provider_call_id
    : req.cartesia_call_id ?? row.provider_call_id

  const duration = Math.max(
    Number(row.duration_seconds) || 0,
    secondsBetween(req.started_at, req.ended_at),
    input.providerDurationSeconds
  )

  const update: Record<string, unknown> = {
    transcript: input.transcript,
    started_at: row.started_at ?? req.started_at,
    // The Twilio status callback may have set these first; its values are the carrier's.
    ended_at: row.ended_at ?? req.ended_at,
    duration_seconds: duration,
    end_reason: row.end_reason ?? req.end_reason,
    status: row.status && TERMINAL_STATUSES.has(row.status) ? row.status : 'completed',
    voice_provider: voiceProvider,
    pipeline_mode: req.mode,
    provider_call_id: providerCallId ?? null,
    fallback_used: row.fallback_used === true || req.fallback_used,
    fallback_reason: row.fallback_reason ?? req.fallback_reason ?? null,
    ...buildUsageUpdate(req, input.transcript),
  }
  if (req.elevenlabs_conversation_id) update.elevenlabs_conversation_id = req.elevenlabs_conversation_id
  if (!row.summary && input.providerSummary) update.summary = input.providerSummary.slice(0, 2_000)
  if (input.recordingAvailable && !row.recording_url) update.recording_url = `/api/calls/${row.id}/audio`
  return update
}

// ─── Database helpers ────────────────────────────────────────────────────────

type Db = ReturnType<typeof createAdminClient>

function describe(error: unknown): string {
  if (!error) return 'unknown error'
  if (error instanceof Error) return error.message
  if (typeof error === 'object') {
    const e = error as { code?: string; message?: string }
    return [e.code, e.message].filter(Boolean).join(' ') || 'unknown error'
  }
  return String(error)
}

function isMissingRelation(error: { code?: string } | null | undefined): boolean {
  return error?.code === '42P01' || error?.code === 'PGRST205'
}

const FINALIZE_COLUMNS = [
  'id', 'org_id', 'agent_id', 'is_test', 'status', 'started_at', 'ended_at', 'duration_seconds',
  'end_reason', 'fallback_used', 'fallback_reason', 'provider_call_id', 'summary', 'recording_url',
  'analysis', 'tts_characters', 'transcript', 'pipeline_mode', 'voice_provider',
].join(', ')

interface AgentRow {
  id: string
  name: string | null
  language: string | null
  lead_fields: unknown
  metadata: unknown
}

/** null: the call has no agent (or it was deleted); undefined: the lookup failed. */
async function loadAgent(db: Db, orgId: string, agentId: string | null): Promise<AgentRow | null | undefined> {
  if (!agentId) return null
  const { data, error } = await db
    .from('agents')
    .select('id, name, language, lead_fields, metadata')
    .eq('id', agentId)
    .eq('org_id', orgId)
    .maybeSingle()
  if (error) {
    console.error(LOG, 'agent lookup failed', agentId, describe(error))
    return undefined
  }
  return (data as AgentRow | null) ?? null
}

async function loadOrg(db: Db, orgId: string): Promise<{ name: string | null; plan: Plan } | null> {
  const { data, error } = await db.from('organizations').select('name, plan').eq('id', orgId).maybeSingle()
  if (error) {
    console.error(LOG, 'organization lookup failed', orgId, describe(error))
    return null
  }
  return (data as { name: string | null; plan: Plan } | null) ?? null
}

function leadFieldsOf(agent: AgentRow | null | undefined): LeadField[] {
  if (!agent || !Array.isArray(agent.lead_fields)) return []
  return agent.lead_fields.filter(
    (f): f is LeadField =>
      !!f && typeof f === 'object' && typeof (f as LeadField).key === 'string' && (f as LeadField).key.trim() !== ''
  )
}

export type RecordingDecision = 'record' | 'discard' | 'unknown'

/**
 * Owner's "record calls" switch AND a plan that includes recordings.
 * `unknown` when the agent or organisation couldn't be read: provider copies
 * are only deleted on a definite "don't record", never because of a failed lookup.
 */
export function recordingDecision(
  agentMetadata: unknown,
  plan: Plan | null | undefined,
  isTest: boolean
): RecordingDecision {
  if (agentMetadata === undefined || !plan) return 'unknown'
  const metadata = agentMetadata && typeof agentMetadata === 'object' ? (agentMetadata as Record<string, unknown>) : {}
  const behavior = behaviorFor({ metadata } as Agent, { isTest })
  return behavior.record && entitlementsFor(plan).recordings ? 'record' : 'discard'
}

/**
 * The fuller of the transcript the gateway sent and the one already stored
 * (an ElevenLabs webhook may have written it first); ties keep the gateway's,
 * which carries tool calls and knowledge sources.
 */
export function chooseTranscript(incoming: TranscriptEntry[], stored: TranscriptEntry[]): TranscriptEntry[] {
  return stored.length > incoming.length ? stored : incoming
}

interface ManagedCallDetails {
  summary: string | null
  transcript: TranscriptEntry[]
  durationSeconds: number
}

async function fetchManagedCall(callId: string): Promise<ManagedCallDetails | null> {
  let details: ManagedCallDetails | null = null
  for (let attempt = 1; attempt <= 2; attempt++) {
    try {
      const call: CartesiaAgentCall = await cartesia.calls.get(callId, { transcript: true })
      details = {
        summary: typeof call.summary === 'string' && call.summary.trim() ? call.summary.trim() : null,
        transcript: mapCartesiaTranscript(call.transcript),
        durationSeconds: secondsBetween(call.start_time, call.end_time),
      }
      // The gateway reports the end as soon as the bridge closes; Cartesia may
      // still be closing the call and writing its summary. Look once more.
      const settled = call.status === 'completed' || call.status === 'failed'
      if (attempt === 2 || (settled && details.summary)) return details
      await new Promise((resolve) => setTimeout(resolve, MANAGED_CALL_SETTLE_MS))
    } catch (error) {
      console.error(LOG, 'could not read the Cartesia call', callId, describe(error))
      return details
    }
  }
  return details
}

/** Removes Cartesia's copy (transcript, audio, logs) of a call the owner didn't want recorded. */
async function deleteManagedCall(callId: string): Promise<void> {
  for (let attempt = 1; attempt <= 2; attempt++) {
    try {
      await cartesia.calls.delete(callId)
      return
    } catch (error) {
      if (error instanceof CartesiaError && error.status === 404) return
      // Only completed or failed calls can be deleted; the call may still be closing.
      const retryable = error instanceof CartesiaError && (error.status === 400 || error.status >= 500 || error.status === 0)
      if (attempt === 1 && retryable) {
        await new Promise((resolve) => setTimeout(resolve, CARTESIA_DELETE_RETRY_MS))
        continue
      }
      console.error(LOG, 'could not delete the Cartesia call record of an unrecorded call', callId, describe(error))
      return
    }
  }
}

// ─── finalizeCall ────────────────────────────────────────────────────────────

/** How long finalize waits for the stream-ended route when the gateway gave a live call back. */
const HANDOFF_SETTLE_MS = 2_000

export async function finalizeCall(req: FinalizeRequest): Promise<void> {
  const db = createAdminClient()
  const load = async () => {
    const { data, error } = await db.from('calls').select(FINALIZE_COLUMNS).eq('id', req.call_id).maybeSingle()
    if (error) throw new Error(`call lookup failed: ${describe(error)}`)
    return data as unknown as FinalizeRow | null
  }
  let row = await load()
  // end_reason 'error' means the gateway closed a live Twilio stream for the app
  // to rescue, and Twilio calls stream-ended at the same moment. Give that route
  // a moment to record a hand-over so this finalize doesn't close a live call.
  if (row && req.end_reason === 'error' && row.status === 'in-progress' && row.pipeline_mode !== 'elevenlabs') {
    await new Promise((resolve) => setTimeout(resolve, HANDOFF_SETTLE_MS))
    row = await load()
  }
  if (!row) {
    console.warn(LOG, 'finalize for an unknown call', req.call_id)
    return
  }

  const plan = planFinalize(row, req)
  if (plan.kind === 'skip') {
    if (plan.reason === 'session_mismatch') console.warn(LOG, 'finalize session does not match the call', req.call_id)
    return
  }

  if (plan.kind === 'usage_only') {
    const gatewayTranscript = sanitizeTranscript(req.transcript)
    // After a mid-call handoff the webhook only saw the ElevenLabs half of the
    // conversation; the gateway has all of it, so the call is analysed again.
    const fuller = gatewayTranscript.length > transcriptOf(row.transcript).length
    const update: Record<string, unknown> = {
      ...buildUsageUpdate(req, gatewayTranscript),
      fallback_used: true,
      fallback_reason: row.fallback_reason ?? req.fallback_reason ?? null,
      ...(fuller ? { transcript: gatewayTranscript, analysis: null } : {}),
    }
    const applied = await applyFinalizeUpdate(db, row, update)
    if (applied === 'error' || applied === 'conflict') throw new Error('storing call usage failed')
    if (applied !== 'applied') return
    await recordUsage(row, req)
    // A Managed Agent leg before the handoff left its own copy at Cartesia.
    if (req.cartesia_call_id && isCartesiaConfigured()) {
      const [agent, org] = await Promise.all([loadAgent(db, row.org_id, row.agent_id), loadOrg(db, row.org_id)])
      const decision = recordingDecision(agent === undefined ? undefined : agent?.metadata ?? null, org?.plan, row.is_test)
      if (decision === 'discard') await deleteManagedCall(req.cartesia_call_id)
    }
    if (!fuller) return
    // The webhook's analysis has finished (it stored one), so its lock can go.
    await kvDel(`post-call:analyze:${row.id}`)
  }

  if (plan.kind === 'apply') {
    const [agent, org] = await Promise.all([loadAgent(db, row.org_id, row.agent_id), loadOrg(db, row.org_id)])
    const decision = recordingDecision(agent === undefined ? undefined : agent?.metadata ?? null, org?.plan, row.is_test)

    const managedId = req.cartesia_call_id
    const managed = managedId && isCartesiaConfigured() ? await fetchManagedCall(managedId) : null
    // Meter the managed leg by Cartesia's own record when it runs longer than the gateway's count.
    if (managed && req.usage.agent_seconds > 0) {
      const agentSeconds = reconcileAgentSeconds(req.usage.agent_seconds, managed.durationSeconds)
      if (agentSeconds !== req.usage.agent_seconds) req = { ...req, usage: { ...req.usage, agent_seconds: agentSeconds } }
    }

    let transcript = chooseTranscript(sanitizeTranscript(req.transcript), transcriptOf(row.transcript))
    // The bridge normally captures every turn; Cartesia's own transcript covers a bridge that lost them.
    if (transcript.length === 0 && managed && managed.transcript.length > 0) transcript = managed.transcript

    const update = buildFinalizeUpdate({
      row,
      req,
      transcript,
      providerSummary: managed?.summary ?? null,
      providerDurationSeconds: managed?.durationSeconds ?? 0,
      recordingAvailable: decision === 'record' && !!managedId && !!managed,
    })

    let applied = await applyFinalizeUpdate(db, row, update)
    if (applied === 'conflict') {
      // Another row already owns this provider call id (a webhook import raced us): keep ours without it.
      console.warn(LOG, 'provider call id already stored on another call; saving without it', row.id)
      const withoutProviderIds = { ...update }
      delete withoutProviderIds.provider_call_id
      delete withoutProviderIds.elevenlabs_conversation_id
      applied = await applyFinalizeUpdate(db, row, withoutProviderIds)
    }
    if (applied === 'error' || applied === 'conflict') throw new Error('finalize update failed')

    if (applied === 'applied') {
      await recordUsage(row, req)
      if (managedId && isCartesiaConfigured() && decision === 'discard') {
        // Only once the conversation is safely copied: deleting also removes Cartesia's transcript.
        if (transcript.length > 0 || managed) await deleteManagedCall(managedId)
        else console.warn(LOG, 'kept the Cartesia call record: its transcript could not be copied yet', row.id)
      }
    }

    // The ElevenLabs webhook brings the rest of the conversation and analyses
    // the whole call once, so workflows see all of it. Without the webhook this
    // leg is all there will be.
    if (wasHandedOffByApp(row, req) && isElevenLabsWebhookConfigured()) return
  }

  await analyzeAndStoreCall(row.id)
}

async function recordUsage(row: FinalizeRow, req: FinalizeRequest): Promise<void> {
  await recordProviderUsage(
    buildProviderUsageEvents({
      orgId: row.org_id,
      callId: row.id,
      usage: req.usage,
      cartesiaCallId: req.cartesia_call_id,
      elevenLabsConversationId: req.elevenlabs_conversation_id,
      ttsModel: cartesiaTtsModel(),
      llmModel: openAIVoiceModel(),
    })
  )
}

async function applyFinalizeUpdate(
  db: Db,
  row: FinalizeRow,
  update: Record<string, unknown>
): Promise<'applied' | 'duplicate' | 'conflict' | 'error'> {
  // `tts_characters IS NULL` makes the write happen once even when two finalize
  // requests for the same call run at the same time.
  const { data, error } = await db
    .from('calls')
    .update(update)
    .eq('id', row.id)
    .eq('org_id', row.org_id)
    .is('tts_characters', null)
    .select('id')
  if (error) {
    if (error.code === '23505') return 'conflict'
    console.error(LOG, 'finalize update failed', row.id, describe(error))
    return 'error'
  }
  return Array.isArray(data) && data.length > 0 ? 'applied' : 'duplicate'
}

// ─── analyzeAndStoreCall ─────────────────────────────────────────────────────

const ANALYZE_COLUMNS = [
  'id', 'org_id', 'agent_id', 'is_test', 'status', 'direction', 'caller_number', 'from_number', 'to_number',
  'duration_seconds', 'started_at', 'created_at', 'end_reason', 'transcript', 'summary', 'sentiment',
  'intent', 'outcome', 'extracted', 'analysis', 'tags', 'provider_call_id',
].join(', ')

interface AnalyzeRow {
  id: string
  org_id: string
  agent_id: string | null
  is_test: boolean
  status: string
  direction: string
  caller_number: string | null
  from_number: string | null
  to_number: string | null
  duration_seconds: number | null
  started_at: string | null
  created_at: string
  end_reason: string | null
  transcript: unknown
  summary: string | null
  sentiment: string | null
  intent: string | null
  outcome: string | null
  extracted: unknown
  analysis: unknown
  tags: string[] | null
  provider_call_id: string | null
}

function transcriptOf(value: unknown): TranscriptEntry[] {
  if (!Array.isArray(value)) return []
  return value.filter(
    (t): t is TranscriptEntry =>
      !!t && typeof t === 'object' && (t.role === 'agent' || t.role === 'user') && typeof t.message === 'string'
  )
}

async function selectEvidence<T>(db: Db, table: string, columns: string, callId: string, orgId: string): Promise<T[]> {
  const { data, error } = await db.from(table).select(columns).eq('call_id', callId).eq('org_id', orgId).limit(200)
  if (error) {
    if (!isMissingRelation(error)) console.error(LOG, `${table} lookup failed`, callId, describe(error))
    return []
  }
  return (data ?? []) as T[]
}

function toolEvidenceFrom(
  invocations: { tool_name: string; ok: boolean; result_summary: string | null }[],
  transcript: TranscriptEntry[]
): ToolEvidenceItem[] {
  if (invocations.length > 0) {
    return invocations.map((inv) => ({ name: inv.tool_name, ok: inv.ok, detail: inv.result_summary }))
  }
  // Calls bridged without the tool log (managed agent without the app, older gateway) still carry tool calls per turn.
  return transcript.flatMap((t) => (t.tool_calls ?? []).map((c) => ({ name: c.name, ok: c.ok })))
}

async function recordAnalysisUsage(orgId: string, callId: string, usage: AnalysisUsage | null): Promise<void> {
  if (!usage) return
  const quantity = usage.input_tokens + usage.output_tokens
  if (quantity <= 0) return
  await recordProviderUsage([
    {
      provider: 'openai',
      kind: 'llm_tokens',
      quantity,
      org_id: orgId,
      call_id: callId,
      meta: {
        model: usage.model,
        purpose: 'analysis',
        input_tokens: usage.input_tokens,
        cached_input_tokens: usage.cached_input_tokens,
        output_tokens: usage.output_tokens,
        service_tier: usage.service_tier,
      },
    },
  ])
}

/**
 * Analyses a finished call and stores summary, sentiment, outcome, intent and
 * lead details, then runs the owner's workflows once. Safe to call repeatedly:
 * an analysed call is left alone, concurrent runs are locked out, and
 * workflows are guarded separately so a retried analysis never re-sends them.
 */
export async function analyzeAndStoreCall(callId: string): Promise<void> {
  const db = createAdminClient()
  const { data, error } = await db.from('calls').select(ANALYZE_COLUMNS).eq('id', callId).maybeSingle()
  if (error) throw new Error(`call lookup failed: ${describe(error)}`)
  const row = data as unknown as AnalyzeRow | null
  if (!row) {
    console.warn(LOG, 'analysis for an unknown call', callId)
    return
  }
  if (row.analysis) return

  const lockKey = `post-call:analyze:${row.id}`
  if ((await kvIncr(lockKey, ANALYZE_LOCK_SECONDS)) > 1) {
    console.info(LOG, 'analysis already running for this call', row.id)
    return
  }

  try {
    await analyzeLocked(db, row)
  } finally {
    // Released as soon as this run ends, so a later finalize or webhook for
    // the same call can retry an analysis that failed (a stored one returns early).
    await kvDel(lockKey).catch((lockError: unknown) => console.warn(LOG, 'could not release the analysis lock', row.id, describe(lockError)))
  }
}

async function analyzeLocked(db: Db, row: AnalyzeRow): Promise<void> {
  const [agentResult, org, invocations, bookings, messages] = await Promise.all([
    loadAgent(db, row.org_id, row.agent_id),
    loadOrg(db, row.org_id),
    selectEvidence<{ tool_name: string; ok: boolean; arguments: unknown; result_summary: string | null }>(
      db, 'tool_invocations', 'tool_name, ok, arguments, result_summary', row.id, row.org_id
    ),
    selectEvidence<{ status: string | null }>(db, 'bookings', 'status', row.id, row.org_id),
    selectEvidence<{ urgency: string | null }>(db, 'agent_messages', 'urgency', row.id, row.org_id),
  ])

  const agent = agentResult ?? null
  const transcript = transcriptOf(row.transcript)
  const evidence = buildOutcomeEvidence({
    transcript,
    endReason: row.end_reason,
    toolInvocations: invocations,
    bookings,
    messages,
    storedOutcome: row.outcome,
  })
  const leadFields = leadFieldsOf(agent)

  let analysis: CallAnalysis | null = null
  if (evidence.callerSpoke && isOpenAIConfigured()) {
    try {
      const result = await analyzeCall({
        transcript,
        language: agent?.language ?? 'en',
        leadFields,
        toolEvidence: toolEvidenceFrom(invocations, transcript),
        orgId: row.org_id,
        businessName: org?.name ?? null,
      })
      if (result.status === 'ok') analysis = result.analysis
      else if (result.status === 'refused') console.warn(LOG, 'analysis refused by the model', row.id)
      else if (result.status === 'incomplete') console.warn(LOG, 'analysis incomplete', row.id, result.reason)
      if (result.status !== 'skipped') await recordAnalysisUsage(row.org_id, row.id, result.usage)
    } catch (analysisError) {
      // The call keeps the provider summary; the next finalize/webhook retry can analyse it again.
      console.error(LOG, 'analysis failed', row.id, describe(analysisError))
    }
  }

  const outcome: CallOutcome = resolveCallOutcome(evidence, analysis)
  const sentiment: Sentiment | null = analysis?.sentiment ?? sentimentOrNull(row.sentiment) ?? (evidence.callerSpoke ? 'neutral' : null)
  const summary = analysis?.summary || row.summary
  const intent = analysis?.intent ?? row.intent
  const extracted = mergeExtracted(
    row.extracted && typeof row.extracted === 'object' ? (row.extracted as Record<string, unknown>) : null,
    analysis?.extracted
  )

  const update: Record<string, unknown> = { outcome, sentiment, summary, intent, extracted }
  if (analysis) update.analysis = analysis
  const { error: updateError } = await db.from('calls').update(update).eq('id', row.id).eq('org_id', row.org_id)
  if (updateError) throw new Error(`storing the analysis failed: ${describe(updateError)}`)

  if (row.is_test) return
  if ((await kvIncr(`post-call:workflows:${row.id}`, WORKFLOW_GUARD_SECONDS)) > 1) return

  await runCallWorkflows({
    ...row,
    outcome,
    sentiment,
    summary,
    intent,
    extracted,
    transcript,
    agentName: agent?.name ?? null,
  })
}

interface WorkflowCall extends Omit<AnalyzeRow, 'transcript' | 'extracted' | 'sentiment'> {
  outcome: CallOutcome
  sentiment: Sentiment | null
  extracted: Record<string, string>
  transcript: TranscriptEntry[]
  agentName: string | null
}

async function runCallWorkflows(call: WorkflowCall): Promise<void> {
  const ctx = {
    call_id: call.id,
    org_id: call.org_id,
    conversation_id: call.provider_call_id ?? call.id,
    caller_number: call.caller_number,
    from_number: call.from_number,
    to_number: call.to_number,
    direction: call.direction,
    duration_seconds: Number(call.duration_seconds) || 0,
    status: call.status,
    sentiment: call.sentiment,
    summary: call.summary,
    outcome: call.outcome,
    intent: call.intent,
    tags: call.tags ?? [],
    extracted: call.extracted,
    transcript: call.transcript.map((t) => ({ role: t.role, message: t.message })),
    agent_name: call.agentName ?? undefined,
    started_at: call.started_at ?? call.created_at,
  }

  const triggers: ('call_ended' | 'sentiment_negative' | 'keyword_detected')[] = ['call_ended']
  if (call.sentiment === 'negative') triggers.push('sentiment_negative')
  if (call.transcript.length > 0) triggers.push('keyword_detected')

  const results = await Promise.allSettled(triggers.map((trigger) => executeWorkflows(call.org_id, trigger, ctx)))
  results.forEach((result, i) => {
    if (result.status === 'rejected') {
      console.error(LOG, `workflows for ${triggers[i]} failed`, call.id, describe(result.reason))
    }
  })
}
