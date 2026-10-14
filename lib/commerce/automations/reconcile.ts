import 'server-only'
// After a campaign call ends (post-call webhook, poll or Twilio status), the
// run takes its outcome: what a tool recorded during the call wins
// (confirmed / not confirmed / callback / opted out); otherwise the call's
// own status decides (no answer, voicemail, failed, or a conversation that
// recorded nothing → not confirmed). Unanswered calls retry within the
// automation's limits; the provider's call status stays on the calls row.

import type { SupabaseClient } from '@supabase/supabase-js'
import type { Logger } from '@/lib/observability/logger'
import { readCommerceProfile } from '../profile'
import { RUN_COLUMNS, type RunRow, writeAudit } from '../store'
import type { RunOutcome } from '../types'
import { AUTOMATION_COLUMNS, type AutomationRow, automationState } from './scheduler'
import { nextCallSlot } from './eligibility'

const TOOL_OUTCOMES: ReadonlySet<RunOutcome> = new Set(['confirmed', 'not_confirmed', 'callback_requested', 'opted_out'])
const RETRYABLE: ReadonlySet<RunOutcome> = new Set(['no_answer', 'voicemail', 'failed'])
/** Call statuses a provider event or status callback produced: the call's result is known. */
const TERMINAL_CALL_STATUSES: ReadonlySet<string> = new Set(['completed', 'failed', 'busy', 'no-answer', 'canceled', 'transferred'])
/** A "completed" call shorter than this never reached a conversation. */
const MIN_CONVERSATION_SECONDS = 8

export interface CallFacts {
  status: string
  duration_seconds: number | null
  termination_reason: string | null
  outcome: string | null
  summary: string | null
  ended_at?: string | null
}

/** True when a provider event, poll or status callback settled the call row (not a row still ringing hours later). */
export function callResultVerified(call: CallFacts): boolean {
  return TERMINAL_CALL_STATUSES.has(call.status) || !!call.ended_at
}

/** Pure mapping of a finished call to a run outcome (when no tool recorded one). */
export function outcomeFromCall(call: CallFacts): RunOutcome {
  if (call.outcome === 'voicemail' || /voicemail|answering machine|mesagerie/i.test(call.termination_reason ?? '')) return 'voicemail'
  if (call.status === 'no-answer' || call.status === 'busy' || call.status === 'canceled') return 'no_answer'
  if (call.status === 'failed') return 'failed'
  if (call.status === 'completed' || call.status === 'transferred') {
    if ((call.duration_seconds ?? 0) < MIN_CONVERSATION_SECONDS) return 'no_answer'
    return 'not_confirmed'
  }
  return 'failed'
}

/** Settles the run of a finished call, if any. Never throws into the call pipeline. */
export async function reconcileCommerceRun(db: SupabaseClient, callId: string, log: Logger, now = new Date()): Promise<RunOutcome | null> {
  try {
    const { data: call, error } = await db.from('calls').select('id, org_id, status, duration_seconds, termination_reason, outcome, summary, ended_at, commerce_run_id').eq('id', callId).maybeSingle()
    if (error) throw new Error(`calls read failed: ${error.message}`)
    if (!call?.commerce_run_id) return null
    const { data: runRow, error: runErr } = await db.from('commerce_automation_runs').select(RUN_COLUMNS).eq('id', call.commerce_run_id as string).maybeSingle()
    if (runErr) throw new Error(`commerce_automation_runs read failed: ${runErr.message}`)
    const run = runRow as RunRow | null
    if (!run || run.status !== 'calling') return null
    if (run.call_id !== callId) {
      // Every attempt's call carries the run id; a late or replayed event for
      // an earlier attempt must not settle the attempt in progress.
      log.info('commerce.run.reconcile_stale_call', { runId: run.id, callId, currentCallId: run.call_id })
      return null
    }
    const l = log.child({ orgId: run.org_id, runId: run.id, callId })
    const facts: CallFacts = { status: String(call.status ?? ''), duration_seconds: (call.duration_seconds as number | null) ?? null, termination_reason: (call.termination_reason as string | null) ?? null, outcome: (call.outcome as string | null) ?? null, summary: (call.summary as string | null) ?? null, ended_at: (call.ended_at as string | null) ?? null }
    const outcome: RunOutcome = run.outcome && TOOL_OUTCOMES.has(run.outcome) ? run.outcome : outcomeFromCall(facts)
    const summary = facts.summary ? facts.summary.replace(/\s+/g, ' ').trim().slice(0, 500) : run.summary

    let patch: Record<string, unknown>
    if (run.dispatch_uncertain && !callResultVerified(facts) && !TOOL_OUTCOMES.has(outcome)) {
      // The dial was never confirmed and no provider event settled the call: it
      // may have rung and been answered, so the run ends here and is never
      // dialed again (same terms as the recovery sweep in ./dispatch.ts).
      patch = { status: 'failed', outcome: 'failed', outcome_detail: run.outcome_detail, summary, error_code: 'dispatch_uncertain', error_message: 'Apelul nu a putut fi confirmat; nu se reia automat.', completed_at: now.toISOString(), lease_owner: null, lease_until: null }
    } else if (RETRYABLE.has(outcome) && run.attempt < run.max_attempts) {
      const { data: automation } = await db.from('commerce_automations').select(AUTOMATION_COLUMNS).eq('id', run.automation_id).maybeSingle()
      const { data: org } = await db.from('organizations').select('timezone, commerce_profile').eq('id', run.org_id).maybeSingle()
      const state = automation ? automationState(automation as AutomationRow) : null
      const timezone = (org?.timezone as string | null) ?? readCommerceProfile(org?.commerce_profile).timezone
      const until = state ? nextCallSlot(new Date(now.getTime() + state.config.retry_minutes * 60_000), state.config, timezone) : new Date(now.getTime() + 2 * 3_600_000)
      patch = { status: 'retry_waiting', outcome, outcome_detail: facts.termination_reason?.slice(0, 200) ?? null, summary, scheduled_for: until.toISOString(), lease_owner: null, lease_until: null }
    } else {
      patch = { status: outcome === 'failed' ? 'failed' : 'completed', outcome, outcome_detail: run.outcome_detail ?? facts.termination_reason?.slice(0, 200) ?? null, summary, completed_at: now.toISOString(), lease_owner: null, lease_until: null }
    }
    const { error: updErr } = await db.from('commerce_automation_runs').update(patch).eq('id', run.id).eq('status', 'calling')
    if (updErr) throw new Error(`commerce_automation_runs update failed: ${updErr.message}`)
    await writeAudit(db, { orgId: run.org_id, actor: 'system', action: 'call.result', connectionId: run.connection_id, automationId: run.automation_id, runId: run.id, callId, metadata: { outcome, call_status: facts.status, duration: facts.duration_seconds, next: String(patch.status) } }, l)
    l.info('commerce.run.reconciled', { outcome, status: patch.status })
    return outcome
  } catch (err) {
    log.error('commerce.run.reconcile_failed', err, { callId })
    return null
  }
}

/**
 * Safety net for lost post-call events: 'calling' runs whose call row is
 * already terminal (or whose lease expired long ago) are reconciled from
 * the calls table.
 */
export async function reconcileStaleCallingRuns(db: SupabaseClient, log: Logger, now = new Date()): Promise<number> {
  const { data, error } = await db
    .from('commerce_automation_runs')
    .select('id, call_id, lease_until')
    .eq('status', 'calling')
    .not('call_id', 'is', null)
    .lt('lease_until', now.toISOString())
    .limit(50)
  if (error) throw new Error(`commerce_automation_runs read failed: ${error.message}`)
  let n = 0
  for (const r of data ?? []) {
    const { data: call } = await db.from('calls').select('status, ended_at, started_at').eq('id', r.call_id as string).maybeSingle()
    const terminal = !!call && callResultVerified({ status: String(call.status ?? ''), duration_seconds: null, termination_reason: null, outcome: null, summary: null, ended_at: (call.ended_at as string | null) ?? null })
    // A call still ringing hours later is abandoned: settle it as failed (an
    // uncertain dispatch ends without a retry, see reconcileCommerceRun).
    const abandoned = !!call && !terminal && call.started_at && now.getTime() - Date.parse(String(call.started_at)) > 4 * 3_600_000
    if (!terminal && !abandoned) continue
    if (await reconcileCommerceRun(db, r.call_id as string, log, now)) n++
  }
  return n
}
