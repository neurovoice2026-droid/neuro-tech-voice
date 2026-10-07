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
// Copies already sent by workflows (Sheets, Docs, email, webhooks) are outside
// our reach and are disclosed in the dashboard.

import { createAdminClient } from '@/lib/supabase/admin'
import { createLogger, type Logger } from '@/lib/observability/logger'
import { readPrivacySettings } from './settings'
import { runIfDue } from './maintenance-state'

const DAY_MS = 86_400_000
const HOUR_MS = 3_600_000

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
}

/** True when the owner saved a retention period (privacy_settings.retention_days present). */
export function hasExplicitRetention(raw: unknown): boolean {
  return !!raw && typeof raw === 'object' && !Array.isArray(raw) && typeof (raw as { retention_days?: unknown }).retention_days === 'number'
}

export async function applyCallRetention(log: Logger = createLogger({ component: 'call_retention' }), now = Date.now()): Promise<RetentionReport> {
  const db = createAdminClient()
  const report: RetentionReport = { agents: 0, withRetention: 0, purged: 0, errors: 0 }
  const { data: agents, error } = await db.from('agents').select('id, org_id, privacy_settings, metadata').order('id').limit(10_000)
  if (error) throw new Error(`agents scan failed: ${error.message}`)
  let remaining = retentionBatch()
  for (const a of agents ?? []) {
    report.agents++
    // Only a retention the owner chose explicitly purges OUR copies: the
    // default (365 days) used to apply at the voice provider only, and nobody
    // agreed to irreversible deletion of their call history here.
    if (!hasExplicitRetention(a.privacy_settings)) continue
    const behavior = (a.metadata as { behavior_settings?: Record<string, unknown> } | null)?.behavior_settings
    const privacy = readPrivacySettings(a.privacy_settings, behavior?.record_calls)
    if (privacy.retention_days < 0) continue
    report.withRetention++
    if (remaining <= 0) continue
    const cutoff = new Date(now - privacy.retention_days * DAY_MS).toISOString()
    const { data: purged, error: rpcErr } = await db.rpc('apply_call_retention', { p_agent_id: a.id, p_cutoff: cutoff, p_limit: Math.min(remaining, 1000) })
    if (rpcErr) {
      report.errors++
      log.error('call_retention.agent_failed', new Error(rpcErr.message), { agentId: a.id, orgId: a.org_id })
      continue
    }
    const n = typeof purged === 'number' ? purged : Number(purged ?? 0) || 0
    if (n > 0) log.info('call_retention.purged', { agentId: a.id, orgId: a.org_id, calls: n, days: privacy.retention_days })
    report.purged += n
    remaining -= n
  }
  return report
}

/** Maintenance entry point: hourly, from a stored last-run timestamp (any cron cadence). */
export function runCallRetention(log: Logger, now = Date.now()) {
  return runIfDue('call_retention', HOUR_MS, log, () => applyCallRetention(log, now), now)
}
