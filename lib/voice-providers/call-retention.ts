import 'server-only'
// Privacy retention of OUR copy of call content (maintenance step
// `call_retention`). The agent's privacy setting (retention_days) is sent to
// ElevenLabs, but our database kept transcripts, summaries and the extracted
// details (analysis.data: names, callback numbers) forever. For every agent
// with retention_days >= 0 this clears transcript, summary, summary title,
// analysis, provider error text and the recording link of calls that ended
// longer ago than the window (public.apply_call_retention, migration 017).
// Billing and statistics columns are kept. Bounded per run, idempotent
// (calls.retention_applied_at), hourly whatever the cron cadence.
// Fairness: agents are served round-robin, each round giving every agent
// with calls still to purge an equal share of what is left of the batch,
// starting after the agent the previous run stopped at (keyset cursor in
// maintenance_state 'call_retention_cursor'). Rounds repeat until the batch
// or the step's deadline is spent, so one agent with a large backlog can
// never keep the agents after it (in id order) from being purged.
// Copies already sent by workflows (Sheets, Docs, email, webhooks) are outside
// our reach and are disclosed in the dashboard.

import type { SupabaseClient } from '@supabase/supabase-js'
import { createAdminClient } from '@/lib/supabase/admin'
import { createLogger, type Logger } from '@/lib/observability/logger'
import { readPrivacySettings } from './settings'
import { runIfDue } from './maintenance-state'

const DAY_MS = 86_400_000
const HOUR_MS = 3_600_000
/** The RPC's own cap per call (apply_call_retention). */
const RPC_MAX = 1000
/** Smallest share per agent and round (fewer RPCs when many agents share a small batch). */
const MIN_SHARE = 25
const AGENT_SCAN_LIMIT = 10_000
/** maintenance_state key of the keyset cursor (last agent id served). */
export const RETENTION_CURSOR_KEY = 'call_retention_cursor'

/** Calls purged per run (CALL_RETENTION_BATCH, 1–5000, default 500). */
export function retentionBatch(): number {
  const raw = (process.env.CALL_RETENTION_BATCH ?? '').trim()
  const v = Number(raw)
  return raw !== '' && Number.isInteger(v) && v >= 1 && v <= 5000 ? v : 500
}

export interface RetentionReport {
  agents: number
  withRetention: number
  purged: number
  errors: number
  /** Rounds over the agents with calls still to purge. */
  rounds: number
  /** The step's deadline stopped the run (the cursor keeps the place). */
  deadlineReached: boolean
}

/** True when the owner saved a retention period (privacy_settings.retention_days present). */
export function hasExplicitRetention(raw: unknown): boolean {
  return !!raw && typeof raw === 'object' && !Array.isArray(raw) && typeof (raw as { retention_days?: unknown }).retention_days === 'number'
}

interface AgentRow {
  id: string
  org_id: string
  privacy_settings: unknown
  metadata: unknown
}

async function readCursor(db: SupabaseClient, log: Logger): Promise<string | null> {
  const { data, error } = await db.from('maintenance_state').select('details').eq('key', RETENTION_CURSOR_KEY).maybeSingle()
  if (error) {
    log.warn('maintenance_state.read_failed', { key: RETENTION_CURSOR_KEY, error: error.message.slice(0, 200) })
    return null
  }
  const after = (data?.details as { after_agent_id?: unknown } | null)?.after_agent_id
  return typeof after === 'string' && after ? after : null
}

async function writeCursor(db: SupabaseClient, agentId: string, log: Logger): Promise<void> {
  const nowIso = new Date().toISOString()
  const { error } = await db
    .from('maintenance_state')
    .upsert({ key: RETENTION_CURSOR_KEY, last_run_at: nowIso, updated_at: nowIso, details: { after_agent_id: agentId } }, { onConflict: 'key' })
  if (error) log.warn('maintenance_state.write_failed', { key: RETENTION_CURSOR_KEY, error: error.message.slice(0, 200) })
}

/** Agents in id order starting after `cursor` (keyset), wrapping around to the first ones. */
async function agentsFrom(db: SupabaseClient, cursor: string | null): Promise<AgentRow[]> {
  const columns = 'id, org_id, privacy_settings, metadata'
  const after = cursor
    ? await db.from('agents').select(columns).gt('id', cursor).order('id').limit(AGENT_SCAN_LIMIT)
    : await db.from('agents').select(columns).order('id').limit(AGENT_SCAN_LIMIT)
  if (after.error) throw new Error(`agents scan failed: ${after.error.message}`)
  const out = (after.data ?? []) as AgentRow[]
  if (cursor && out.length < AGENT_SCAN_LIMIT) {
    const wrap = await db.from('agents').select(columns).lte('id', cursor).order('id').limit(AGENT_SCAN_LIMIT - out.length)
    if (wrap.error) throw new Error(`agents scan failed: ${wrap.error.message}`)
    out.push(...((wrap.data ?? []) as AgentRow[]))
  }
  return out
}

export async function applyCallRetention(
  log: Logger = createLogger({ component: 'call_retention' }),
  now = Date.now(),
  opts: { deadline?: number } = {},
): Promise<RetentionReport> {
  const db = createAdminClient()
  const report: RetentionReport = { agents: 0, withRetention: 0, purged: 0, errors: 0, rounds: 0, deadlineReached: false }
  const timeUp = () => opts.deadline !== undefined && Date.now() >= opts.deadline
  const agents = await agentsFrom(db, await readCursor(db, log))

  let active: Array<{ agent: AgentRow; days: number }> = []
  for (const a of agents) {
    report.agents++
    // Only a retention the owner chose explicitly purges OUR copies: the
    // default (365 days) used to apply at the voice provider only, and nobody
    // agreed to irreversible deletion of their call history here.
    if (!hasExplicitRetention(a.privacy_settings)) continue
    const behavior = (a.metadata as { behavior_settings?: Record<string, unknown> } | null)?.behavior_settings
    const privacy = readPrivacySettings(a.privacy_settings, behavior?.record_calls)
    if (privacy.retention_days < 0) continue
    report.withRetention++
    active.push({ agent: a, days: privacy.retention_days })
  }

  let remaining = retentionBatch()
  let lastServed: string | null = null
  while (remaining > 0 && active.length > 0) {
    if (timeUp()) {
      report.deadlineReached = true
      break
    }
    report.rounds++
    // Equal share of what is left for every agent still holding purgeable calls.
    const share = Math.min(RPC_MAX, Math.max(MIN_SHARE, Math.ceil(remaining / active.length)))
    const next: typeof active = []
    for (const entry of active) {
      if (remaining <= 0) break
      if (timeUp()) {
        report.deadlineReached = true
        break
      }
      const { agent: a, days } = entry
      const limit = Math.min(share, remaining)
      const cutoff = new Date(now - days * DAY_MS).toISOString()
      lastServed = a.id
      const { data: purged, error: rpcErr } = await db.rpc('apply_call_retention', { p_agent_id: a.id, p_cutoff: cutoff, p_limit: limit })
      if (rpcErr) {
        report.errors++
        log.error('call_retention.agent_failed', new Error(rpcErr.message), { agentId: a.id, orgId: a.org_id })
        continue
      }
      const n = typeof purged === 'number' ? purged : Number(purged ?? 0) || 0
      if (n > 0) log.info('call_retention.purged', { agentId: a.id, orgId: a.org_id, calls: n, days })
      report.purged += n
      remaining -= n
      // A full share means more may be waiting: the agent stays in the next round.
      if (n >= limit) next.push(entry)
    }
    if (report.deadlineReached) break
    active = next
  }
  // The next run starts after the last agent served (keyset cursor).
  if (lastServed) await writeCursor(db, lastServed, log)
  return report
}

/** Maintenance entry point: hourly, from a stored last-run timestamp (any cron cadence). */
export function runCallRetention(log: Logger, now = Date.now(), deadline?: number) {
  return runIfDue('call_retention', HOUR_MS, log, () => applyCallRetention(log, now, { deadline }), now)
}
