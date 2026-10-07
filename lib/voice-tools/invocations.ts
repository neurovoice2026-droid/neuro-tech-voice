import 'server-only'
// Idempotency of tool requests (tool_invocations, migration 018). The model
// may repeat a tool call (retries, parallel tool calls): the first request
// for (call, tool, key) runs, an exact repeat gets the stored answer, and a
// repeat that arrives while the first is still running is told to wait.
// The domain tables keep their own guards too (unique booking per call and
// slot, one message per call), so a failure here never double-books.

import { createHash } from 'node:crypto'
import type { SupabaseClient } from '@supabase/supabase-js'
import type { Logger } from '@/lib/observability/logger'
import { stableStringify } from '@/lib/elevenlabs/tools/hash'

export interface ToolAnswer {
  ok: boolean
  message: string
  [key: string]: unknown
}

export type InvocationClaim =
  | { kind: 'new'; id: string }
  /** Tracking unavailable (DB error): run anyway, the domain guards still hold. */
  | { kind: 'untracked' }
  | { kind: 'replay'; answer: ToolAnswer }
  | { kind: 'in_progress' }

/** A running invocation older than this was abandoned (crashed instance): it may be taken over. */
const STALE_RUNNING_MS = 60_000

/** Short, stable key of the normalized arguments. */
export function invocationKey(args: unknown): string {
  return createHash('sha256').update(stableStringify(args)).digest('hex').slice(0, 32)
}

export async function claimInvocation(
  db: SupabaseClient,
  input: { orgId: string; callId: string; tool: string; key: string },
  log: Logger,
  now = Date.now(),
): Promise<InvocationClaim> {
  const { data, error } = await db
    .from('tool_invocations')
    .insert({ org_id: input.orgId, call_id: input.callId, tool: input.tool, idempotency_key: input.key, status: 'running' })
    .select('id')
    .single()
  if (!error && data) return { kind: 'new', id: String(data.id) }
  if (error?.code !== '23505') {
    log.error('tools.invocation_claim_failed', error, { tool: input.tool })
    return { kind: 'untracked' }
  }
  const { data: existing, error: readErr } = await db
    .from('tool_invocations')
    .select('id, status, response, created_at')
    .eq('call_id', input.callId)
    .eq('tool', input.tool)
    .eq('idempotency_key', input.key)
    .maybeSingle()
  if (readErr || !existing) {
    if (readErr) log.error('tools.invocation_read_failed', readErr, { tool: input.tool })
    return { kind: 'in_progress' }
  }
  const response = existing.response as ToolAnswer | null
  if (existing.status === 'completed' && response && typeof response.message === 'string') return { kind: 'replay', answer: response }
  const startedAt = Date.parse(String(existing.created_at))
  if (Number.isFinite(startedAt) && now - startedAt > STALE_RUNNING_MS) {
    // Compare-and-set on created_at: only one taker.
    const { data: taken, error: takeErr } = await db
      .from('tool_invocations')
      .update({ created_at: new Date(now).toISOString() })
      .eq('id', existing.id)
      .eq('status', 'running')
      .eq('created_at', existing.created_at)
      .select('id')
    if (takeErr) log.error('tools.invocation_takeover_failed', takeErr, { tool: input.tool })
    if (taken && taken.length > 0) return { kind: 'new', id: String(existing.id) }
  }
  return { kind: 'in_progress' }
}

/** Stores the answer of a claimed invocation (replayed to exact retries). Logged, never thrown. */
export async function completeInvocation(db: SupabaseClient, claim: InvocationClaim, answer: ToolAnswer, log: Logger): Promise<void> {
  if (claim.kind !== 'new') return
  const { error } = await db
    .from('tool_invocations')
    .update({ status: 'completed', response: answer, completed_at: new Date().toISOString() })
    .eq('id', claim.id)
  if (error) log.error('tools.invocation_complete_failed', error)
}

/**
 * Gives a claim back when the answer must not be replayed (a transient
 * failure the model may retry with the same values). Logged, never thrown.
 */
export async function releaseInvocation(db: SupabaseClient, claim: InvocationClaim, log: Logger): Promise<void> {
  if (claim.kind !== 'new') return
  const { error } = await db.from('tool_invocations').delete().eq('id', claim.id).eq('status', 'running')
  if (error) log.error('tools.invocation_release_failed', error)
}

export const IN_PROGRESS_MESSAGE = 'The same request is already being processed. Wait a moment for its result instead of calling the tool again.'
