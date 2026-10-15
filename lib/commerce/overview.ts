import 'server-only'
// The store overview: connection, automations, queue, recent calls and the
// problems that stop automations from working (each with where to fix it).

import type { SupabaseClient } from '@supabase/supabase-js'
import { callAllowance, type OrgUsage } from '@/lib/telephony/quota'
import { commerceCryptoConfigured } from './crypto'
import { enableGate, listAutomationDtos } from './automations/service'
import { type ConnectionRow, RUN_COLUMNS_WITH_REFS, type RunRow, connectionDto, countRunsByStatus, primaryConnection, readWebhookConfig, runDto } from './store'
import type { CommerceOverviewDto, CommerceProblemCode } from './types'

export async function buildOverview(db: SupabaseClient, org: { id: string; plan: string | null }, brandName: string | null): Promise<CommerceOverviewDto> {
  const connection = await primaryConnection(db, org.id)
  const [automations, queue, recent, gate, usage] = await Promise.all([
    connection ? listAutomationDtos(db, connection, brandName) : Promise.resolve([]),
    countRunsByStatus(db, { orgId: org.id }),
    db.from('commerce_automation_runs').select(RUN_COLUMNS_WITH_REFS).eq('org_id', org.id).order('created_at', { ascending: false }).limit(10),
    enableGate(db, org.id),
    db.from('organizations').select('plan, minutes_used, minutes_limit, extra_minutes_balance').eq('id', org.id).maybeSingle(),
  ])
  if (recent.error) throw new Error(`commerce_automation_runs read failed: ${recent.error.message}`)
  const problems: CommerceOverviewDto['problems'] = []
  const push = (code: CommerceProblemCode, message: string, href: string | null) => problems.push({ code, message, href })
  if (!commerceCryptoConfigured()) push('encryption_not_configured', 'Credential encryption is not configured on the platform: connecting stores is disabled.', null)
  if (!connection) push('no_connection', 'No store connected yet.', '/store/connections')
  else {
    if (connection.status === 'error') push('credentials_expired', connection.error_message ?? 'Store access has expired: reconnect the store.', '/store/connections')
    else if (connection.status === 'degraded') push('sync_error', connection.error_message ?? 'The last sync failed; retrying automatically.', '/store/connections')
    else if (connection.status === 'disconnected') push('no_connection', 'The store is disconnected.', '/store/connections')
    const wh = readWebhookConfig(connection.webhook_config)
    if (wh.last_error && (!wh.last_delivery_at || Date.parse(wh.last_error_at ?? '') > Date.parse(wh.last_delivery_at))) push('webhook_failure', wh.last_error, '/store/connections')
  }
  const anyEnabled = automations.some((a) => a.enabled)
  if (!gate.agentActive) push('agent_inactive', 'The agent is paused: automated calls will not start.', '/agent')
  if (!gate.hasOutboundNumber) push('no_phone_number', 'No active phone number can place calls: automated calls will not start.', '/phone')
  if (connection && !automations.some((a) => a.consent_confirmed_at) ) push('no_consent', 'No automation has confirmed customer consent.', '/store/automations')
  // Capacity = included minutes left + purchased minutes (lib/billing/minute-packs.ts
  // minutesCapacity), gated like the dispatcher (lib/telephony/quota.ts).
  const minutes: OrgUsage | null = usage.data
    ? {
        plan: (usage.data.plan as string | null) ?? org.plan,
        minutes_used: usage.data.minutes_used as number | null,
        minutes_limit: usage.data.minutes_limit as number | null,
        extra_minutes_balance: (usage.data.extra_minutes_balance as number | null | undefined) ?? null,
      }
    : null
  if (!callAllowance(minutes).allowed) {
    const trial = minutes?.plan === 'trial'
    push(
      'minutes_exhausted',
      trial
        ? 'Your trial minutes are used up: automated calls are paused. Choose a plan to keep them running.'
        : 'You are out of call minutes: automated calls are paused for up to 24 hours, then skipped. Buy extra minutes or turn on auto top-up.',
      '/billing#minutes',
    )
  }
  void anyEnabled
  return {
    connection: connection ? await connectionDto(db, connection) : null,
    automations,
    queue: { eligible: queue.eligible, scheduled: queue.scheduled, calling: queue.calling, completed: queue.completed, suppressed: queue.suppressed, failed: queue.failed },
    recent_runs: ((recent.data ?? []) as RunRow[]).map(runDto),
    problems,
  }
}

export type { ConnectionRow }
