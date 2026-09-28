import 'server-only'
import type { SupabaseClient } from '@supabase/supabase-js'
import { CALL_OUTCOMES, type CallOutcome, type Plan } from '@/types'
import type { CallContext, WorkflowCallData, WorkflowOrgData, WorkflowTranscriptTurn } from './types'

// Turns whatever a caller of executeWorkflows passed into a complete, typed
// picture of the call. When a call id is known the stored row fills the gaps,
// always filtered by org so a wrong id can never pull another tenant's call.

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export function isUuid(value: unknown): value is string {
  return typeof value === 'string' && UUID_REGEX.test(value)
}

/** Postgres undefined_column, as relayed by PostgREST (migration 010 not applied yet). */
export function isMissingColumnError(error: { code?: string } | null | undefined): boolean {
  return error?.code === '42703'
}

export const CALL_CONTEXT_COLUMNS = [
  'id', 'org_id', 'agent_id', 'provider_call_id', 'elevenlabs_conversation_id', 'caller_number',
  'from_number', 'to_number', 'direction', 'duration_seconds', 'status', 'sentiment', 'summary',
  'outcome', 'intent', 'tags', 'extracted', 'transcript', 'started_at', 'ended_at', 'is_test',
  'caller_name:analysis->>caller_name',
].join(', ')

export interface CallContextRow {
  id: string
  org_id: string
  agent_id: string | null
  provider_call_id: string | null
  elevenlabs_conversation_id: string | null
  caller_number: string | null
  from_number: string | null
  to_number: string | null
  direction: string | null
  duration_seconds: number | null
  status: string | null
  sentiment: string | null
  summary: string | null
  outcome: string | null
  intent: string | null
  tags: unknown
  extracted: unknown
  transcript: unknown
  started_at: string | null
  ended_at: string | null
  is_test: boolean | null
  caller_name: string | null
}

// ─── Normalisers ──────────────────────────────────────────────────────────────

function str(value: unknown): string | null {
  return typeof value === 'string' && value.trim() ? value : null
}

function outcomeOf(value: unknown): CallOutcome | null {
  return typeof value === 'string' && (CALL_OUTCOMES as readonly string[]).includes(value) ? (value as CallOutcome) : null
}

function tagsOf(value: unknown): string[] {
  if (!Array.isArray(value)) return []
  return [...new Set(value.filter((tag): tag is string => typeof tag === 'string' && tag.trim().length > 0))]
}

function extractedOf(value: unknown): Record<string, string> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {}
  const out: Record<string, string> = {}
  for (const [key, raw] of Object.entries(value as Record<string, unknown>)) {
    if (typeof raw === 'string') out[key] = raw
    else if (typeof raw === 'number' || typeof raw === 'boolean') out[key] = String(raw)
  }
  return out
}

function transcriptOf(value: unknown): WorkflowTranscriptTurn[] {
  if (!Array.isArray(value)) return []
  const turns: WorkflowTranscriptTurn[] = []
  for (const entry of value) {
    if (!entry || typeof entry !== 'object') continue
    const turn = entry as { role?: unknown; message?: unknown; time_in_call_secs?: unknown }
    if (typeof turn.message !== 'string' || !turn.message.trim()) continue
    turns.push({
      role: turn.role === 'agent' || turn.role === 'assistant' ? 'agent' : 'user',
      message: turn.message,
      ...(typeof turn.time_in_call_secs === 'number' ? { time_in_call_secs: turn.time_in_call_secs } : {}),
    })
  }
  return turns
}

function durationOf(value: unknown): number {
  const n = typeof value === 'number' ? value : Number(value)
  return Number.isFinite(n) && n > 0 ? Math.round(n) : 0
}

/** Picks the caller-supplied value when it was given (even null), else the stored one. */
function pick<T>(given: T | undefined, stored: T): T {
  return given === undefined ? stored : given
}

/** Builds call data from the context alone (no stored row). */
export function callDataFromContext(ctx: CallContext): WorkflowCallData {
  const callId = isUuid(ctx.call_id) ? ctx.call_id : null
  return {
    call_id: callId,
    conversation_id: str(ctx.conversation_id) ?? str(ctx.provider_call_id) ?? callId,
    agent_name: str(ctx.agent_name),
    caller_name: str(ctx.caller_name),
    caller_number: str(ctx.caller_number) ?? str(ctx.direction === 'outbound' ? ctx.to_number : ctx.from_number),
    from_number: str(ctx.from_number),
    to_number: str(ctx.to_number),
    direction: ctx.direction === 'outbound' ? 'outbound' : 'inbound',
    duration_seconds: durationOf(ctx.duration_seconds),
    status: str(ctx.status) ?? 'completed',
    sentiment: str(ctx.sentiment),
    summary: str(ctx.summary),
    outcome: outcomeOf(ctx.outcome),
    intent: str(ctx.intent),
    tags: tagsOf(ctx.tags),
    extracted: extractedOf(ctx.extracted),
    transcript: transcriptOf(ctx.transcript),
    started_at: str(ctx.started_at),
    ended_at: str(ctx.ended_at),
    is_test: ctx.is_test === true,
  }
}

/** Stored row + what the caller passed; caller values win when present. */
export function mergeCallData(ctx: CallContext, row: CallContextRow, agentName: string | null): WorkflowCallData {
  const direction = pick(ctx.direction, row.direction) === 'outbound' ? 'outbound' : 'inbound'
  const transcript = transcriptOf(ctx.transcript)
  return {
    call_id: row.id,
    conversation_id:
      str(ctx.conversation_id) ?? str(ctx.provider_call_id) ?? str(row.provider_call_id) ?? str(row.elevenlabs_conversation_id) ?? row.id,
    agent_name: str(ctx.agent_name) ?? agentName,
    caller_name: str(ctx.caller_name) ?? str(row.caller_name),
    caller_number: str(pick(ctx.caller_number, row.caller_number)) ?? str(direction === 'outbound' ? row.to_number : row.from_number),
    from_number: str(pick(ctx.from_number, row.from_number)),
    to_number: str(pick(ctx.to_number, row.to_number)),
    direction,
    duration_seconds: durationOf(pick(ctx.duration_seconds, row.duration_seconds)),
    status: str(pick(ctx.status, row.status)) ?? 'completed',
    sentiment: str(pick(ctx.sentiment, row.sentiment)),
    summary: str(pick(ctx.summary, row.summary)),
    outcome: outcomeOf(pick(ctx.outcome, row.outcome)),
    intent: str(pick(ctx.intent, row.intent)),
    // Tags always come from the row too: another workflow may have just added one.
    tags: tagsOf([...tagsOf(row.tags), ...tagsOf(ctx.tags)]),
    extracted: { ...extractedOf(row.extracted), ...extractedOf(ctx.extracted) },
    transcript: transcript.length > 0 ? transcript : transcriptOf(row.transcript),
    started_at: str(pick(ctx.started_at, row.started_at)),
    ended_at: str(pick(ctx.ended_at, row.ended_at)),
    is_test: ctx.is_test === true || row.is_test === true,
  }
}

// ─── Loaders ──────────────────────────────────────────────────────────────────

async function agentName(client: SupabaseClient, orgId: string, agentId: string | null): Promise<string | null> {
  if (!isUuid(agentId)) return null
  const { data, error } = await client.from('agents').select('name').eq('id', agentId).eq('org_id', orgId).maybeSingle()
  if (error) {
    console.error('[workflows] agent name lookup failed', error.code, error.message)
    return null
  }
  return str((data as { name?: unknown } | null)?.name)
}

export async function loadOrgData(client: SupabaseClient, orgId: string): Promise<WorkflowOrgData | null> {
  const full = await client.from('organizations').select('id, name, timezone, plan').eq('id', orgId).maybeSingle()
  let row = full.data as { id: string; name: string | null; timezone?: string | null; plan: Plan } | null
  if (full.error) {
    if (!isMissingColumnError(full.error)) {
      console.error('[workflows] organization lookup failed', full.error.code, full.error.message)
      return null
    }
    const legacy = await client.from('organizations').select('id, name, plan').eq('id', orgId).maybeSingle()
    if (legacy.error) {
      console.error('[workflows] organization lookup failed', legacy.error.code, legacy.error.message)
      return null
    }
    row = legacy.data as typeof row
  }
  if (!row) return null
  return { id: row.id, name: row.name ?? null, timezone: row.timezone || 'UTC', plan: row.plan }
}

export async function resolveCallData(client: SupabaseClient, orgId: string, ctx: CallContext): Promise<WorkflowCallData> {
  const base = callDataFromContext(ctx)
  if (!base.call_id) return base

  const { data, error } = await client
    .from('calls')
    .select(CALL_CONTEXT_COLUMNS)
    .eq('id', base.call_id)
    .eq('org_id', orgId)
    .maybeSingle()
  if (error) {
    console.error('[workflows] call lookup failed', error.code, error.message)
    return base
  }
  if (!data) {
    // Never tag or link a call that isn't this organisation's.
    console.warn('[workflows] call not found for organization; running without a call id')
    return { ...base, call_id: null, conversation_id: str(ctx.conversation_id) ?? str(ctx.provider_call_id) }
  }
  const row = data as unknown as CallContextRow
  const name = str(ctx.agent_name) ?? (await agentName(client, orgId, row.agent_id))
  return mergeCallData(ctx, row, name)
}

/** The organisation's most recent real (non-test) call, for "Send test". */
export async function loadLatestCallData(client: SupabaseClient, orgId: string): Promise<WorkflowCallData | null> {
  const { data, error } = await client
    .from('calls')
    .select(CALL_CONTEXT_COLUMNS)
    .eq('org_id', orgId)
    .eq('is_test', false)
    .order('started_at', { ascending: false, nullsFirst: false })
    .limit(1)
    .maybeSingle()
  if (error) {
    console.error('[workflows] latest call lookup failed', error.code, error.message)
    return null
  }
  if (!data) return null
  const row = data as unknown as CallContextRow
  return mergeCallData({}, row, await agentName(client, orgId, row.agent_id))
}
