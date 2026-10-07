import 'server-only'
// Maintenance step `business_tools_retention` (hourly from the stored last
// run): housekeeping of the in-call tool tables, and the agent's privacy
// retention applied to the caller details they keep (messages, bookings,
// texts; public.apply_business_tool_retention, migration 018).
//
// Retention uses the agent's privacy retention_days (the same window as call
// transcripts), with a floor of one day so a message taken today is not wiped
// before anyone could read it (the alert e-mail already carried it).

import { createAdminClient } from '@/lib/supabase/admin'
import { createLogger, type Logger } from '@/lib/observability/logger'
import { readPrivacySettings } from '@/lib/voice-providers/settings'
import { runIfDue } from '@/lib/voice-providers/maintenance-state'

const DAY_MS = 86_400_000
/** Offers older than this can no longer be booked (calls are capped at 2 h). */
const OFFER_TTL_MS = 2 * DAY_MS
/** Idempotency records only matter during the call. */
const INVOCATION_TTL_MS = 7 * DAY_MS
/** A booking still 'pending' after this was abandoned mid-write (crash): give its time back. */
const PENDING_BOOKING_TTL_MS = 10 * 60_000
const ROWS_PER_AGENT = 500

export interface BusinessToolRetentionReport {
  offersDeleted: boolean
  invocationsDeleted: boolean
  pendingReleased: number
  agents: number
  purged: number
  errors: number
}

export async function applyBusinessToolRetention(log: Logger = createLogger({ component: 'business_tools_retention' }), now = Date.now()): Promise<BusinessToolRetentionReport> {
  const db = createAdminClient()
  const report: BusinessToolRetentionReport = { offersDeleted: false, invocationsDeleted: false, pendingReleased: 0, agents: 0, purged: 0, errors: 0 }

  const offers = await db.from('call_slot_offers').delete().lt('created_at', new Date(now - OFFER_TTL_MS).toISOString())
  if (offers.error) {
    report.errors++
    log.error('business_tools_retention.offers_failed', offers.error)
  } else report.offersDeleted = true
  const invocations = await db.from('tool_invocations').delete().lt('created_at', new Date(now - INVOCATION_TTL_MS).toISOString())
  if (invocations.error) {
    report.errors++
    log.error('business_tools_retention.invocations_failed', invocations.error)
  } else report.invocationsDeleted = true
  const pending = await db
    .from('bookings')
    .update({ status: 'cancelled' })
    .eq('status', 'pending')
    .lt('created_at', new Date(now - PENDING_BOOKING_TTL_MS).toISOString())
    .select('id')
  if (pending.error) {
    report.errors++
    log.error('business_tools_retention.pending_failed', pending.error)
  } else {
    report.pendingReleased = pending.data?.length ?? 0
    if (report.pendingReleased > 0) log.warn('business_tools_retention.pending_released', { bookings: report.pendingReleased })
  }

  const { data: agents, error } = await db.from('agents').select('id, org_id, privacy_settings, metadata').order('id').limit(10_000)
  if (error) throw new Error(`agents scan failed: ${error.message}`)
  for (const a of agents ?? []) {
    const behavior = (a.metadata as { behavior_settings?: Record<string, unknown> } | null)?.behavior_settings
    const privacy = readPrivacySettings(a.privacy_settings, behavior?.record_calls)
    if (privacy.retention_days < 0) continue
    report.agents++
    const cutoff = new Date(now - Math.max(privacy.retention_days, 1) * DAY_MS).toISOString()
    const { data: purged, error: rpcErr } = await db.rpc('apply_business_tool_retention', { p_agent_id: a.id, p_cutoff: cutoff, p_limit: ROWS_PER_AGENT })
    if (rpcErr) {
      report.errors++
      log.error('business_tools_retention.agent_failed', new Error(rpcErr.message), { agentId: a.id, orgId: a.org_id })
      continue
    }
    const n = typeof purged === 'number' ? purged : Number(purged ?? 0) || 0
    if (n > 0) log.info('business_tools_retention.purged', { agentId: a.id, orgId: a.org_id, rows: n, days: privacy.retention_days })
    report.purged += n
  }
  return report
}

export function runBusinessToolRetention(log: Logger) {
  return runIfDue('business_tools_retention', 3_600_000, log, () => applyBusinessToolRetention(log))
}
