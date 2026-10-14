import 'server-only'
// Retention of the commerce vertical's operational data (daily, from the
// maintenance cron): webhook payloads are cleared once processed and purged
// after COMMERCE_WEBHOOK_PAYLOAD_RETENTION_DAYS; settled runs lose the
// number they dialed after COMMERCE_RUN_PHONE_RETENTION_DAYS; processed
// webhook rows and audit entries are pruned after 90 / 365 days. Bounded
// and idempotent; the mirrors themselves live as long as the connection.

import type { SupabaseClient } from '@supabase/supabase-js'
import type { Logger } from '@/lib/observability/logger'
import { runPhoneRetentionDays, webhookPayloadRetentionDays } from './config'

const DAY_MS = 24 * 3_600_000

export async function runCommerceRetention(db: SupabaseClient, log: Logger, now = Date.now()): Promise<Record<string, number | string>> {
  const out: Record<string, number | string> = {}
  const iso = (days: number) => new Date(now - days * DAY_MS).toISOString()
  const step = async (name: string, op: () => PromiseLike<{ error: { message: string } | null; count?: number | null }>) => {
    const res = await op()
    if (res.error) {
      log.error('commerce.retention.step_failed', res.error, { step: name })
      out[name] = `failed: ${res.error.message.slice(0, 120)}`
    } else out[name] = res.count ?? 0
  }
  // Settled deliveries only: a delivery still queued (received/processing) keeps its body until it is processed.
  await step('webhook_payloads', () =>
    db.from('commerce_webhook_events').update({ payload: null }, { count: 'exact' }).lt('received_at', iso(webhookPayloadRetentionDays())).not('payload', 'is', null).in('status', ['processed', 'ignored', 'failed']),
  )
  await step('webhook_events', () => db.from('commerce_webhook_events').delete({ count: 'exact' }).lt('received_at', iso(90)).in('status', ['processed', 'ignored', 'failed']))
  await step('run_phones', () =>
    db.from('commerce_automation_runs').update({ to_phone_e164: null }, { count: 'exact' }).lt('completed_at', iso(runPhoneRetentionDays())).not('to_phone_e164', 'is', null).in('status', ['completed', 'suppressed', 'skipped', 'failed', 'cancelled']),
  )
  await step('sync_jobs', () => db.from('commerce_sync_jobs').delete({ count: 'exact' }).lt('created_at', iso(30)).in('status', ['succeeded', 'failed', 'cancelled']))
  await step('audit_log', () => db.from('commerce_audit_log').delete({ count: 'exact' }).lt('created_at', iso(365)))
  return out
}
