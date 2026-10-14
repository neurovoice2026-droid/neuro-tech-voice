import 'server-only'
// Dispatch: claims due runs (scheduled/retry_waiting → calling, atomically,
// with a lease), re-checks every rule against the current state, and places
// the call through the one outbound path (lib/telephony/outbound.ts). A run
// whose dispatch result is uncertain is never dialed again automatically.

import type { SupabaseClient } from '@supabase/supabase-js'
import type { Logger } from '@/lib/observability/logger'
import { RequestError } from '@/lib/api/http'
import { maskPhone } from '@/lib/phone/e164'
import { callAllowance } from '@/lib/telephony/quota'
import { startOutboundCall, type OutboundRequest, type OutboundResult } from '@/lib/telephony/outbound'
import { isProviderError } from '@/lib/voice-providers/errors'
import { readCommerceProfile } from '../profile'
import { type CustomerRow, CUSTOMER_COLUMNS, RUN_COLUMNS, type RunRow, isPhoneSuppressed, loadConnection, writeAudit } from '../store'
import { type AutomationRow, AUTOMATION_COLUMNS, automationState } from './scheduler'
import { INELIGIBLE_LABELS, insideCallWindow, localDayBounds, nextCallSlot, orderOpenForCod } from './eligibility'
import { loadRunContext, scriptValuesFor } from './variables'

export const DISPATCH_LEASE_SECONDS = 180

export type DispatchOutcome = 'called' | 'unconfirmed' | 'deferred' | 'skipped' | 'cancelled' | 'retry' | 'failed'

export interface Dispatcher {
  startOutboundCall: (req: OutboundRequest, log: Logger) => Promise<OutboundResult>
}

export async function claimDueRuns(db: SupabaseClient, owner: string, limit: number): Promise<RunRow[]> {
  const { data, error } = await db.rpc('commerce_claim_automation_runs', { p_owner: owner, p_limit: limit, p_lease_seconds: DISPATCH_LEASE_SECONDS })
  if (error) throw new Error(`commerce_claim_automation_runs failed: ${error.message}`)
  return (data ?? []) as RunRow[]
}

interface OrgRow {
  id: string
  name: string | null
  timezone: string | null
  plan: string | null
  minutes_used: number | null
  minutes_limit: number | null
  commerce_profile: unknown
  deletion_requested_at?: string | null
}

async function loadOrg(db: SupabaseClient, orgId: string): Promise<OrgRow | null> {
  const { data, error } = await db.from('organizations').select('id, name, timezone, plan, minutes_used, minutes_limit, commerce_profile, deletion_requested_at').eq('id', orgId).maybeSingle()
  if (error) throw new Error(`organizations read failed: ${error.message}`)
  return (data as OrgRow | null) ?? null
}

async function loadAutomation(db: SupabaseClient, id: string): Promise<AutomationRow | null> {
  const { data, error } = await db.from('commerce_automations').select(AUTOMATION_COLUMNS).eq('id', id).maybeSingle()
  if (error) throw new Error(`commerce_automations read failed: ${error.message}`)
  return (data as AutomationRow | null) ?? null
}

async function loadCustomer(db: SupabaseClient, id: string | null): Promise<CustomerRow | null> {
  if (!id) return null
  const { data, error } = await db.from('commerce_customers').select(CUSTOMER_COLUMNS).eq('id', id).maybeSingle()
  if (error) throw new Error(`commerce_customers read failed: ${error.message}`)
  return (data as CustomerRow | null) ?? null
}

async function countToday(db: SupabaseClient, filter: { automationId?: string; customerId?: string; phone?: string; orgId: string; excludeRunId: string }, bounds: { start: Date; end: Date }): Promise<number> {
  let q = db
    .from('commerce_automation_runs')
    .select('id', { count: 'exact', head: true })
    .eq('org_id', filter.orgId)
    // The claimed run itself is already 'calling' with last_attempt_at = now.
    .neq('id', filter.excludeRunId)
    .in('status', ['calling', 'completed', 'failed', 'retry_waiting'])
    .not('last_attempt_at', 'is', null)
    .gte('last_attempt_at', bounds.start.toISOString())
    .lt('last_attempt_at', bounds.end.toISOString())
  if (filter.automationId) q = q.eq('automation_id', filter.automationId)
  if (filter.customerId) q = q.eq('customer_id', filter.customerId)
  if (filter.phone) q = q.eq('to_phone_e164', filter.phone)
  const { count, error } = await q
  if (error) throw new Error(`commerce_automation_runs count failed: ${error.message}`)
  return count ?? 0
}

async function settle(db: SupabaseClient, run: RunRow, owner: string, patch: Record<string, unknown>, log: Logger): Promise<void> {
  const { error } = await db.from('commerce_automation_runs').update({ ...patch, lease_owner: null, lease_until: null }).eq('id', run.id).eq('lease_owner', owner)
  if (error) log.error('commerce.dispatch.settle_failed', error, { runId: run.id })
}

/**
 * Merchant-facing text for a failed dispatch (run.error_message reaches the
 * browser through the run DTO). Never the provider's or the database's own
 * message: those name internals and stay in the server log.
 */
export function dispatchFailureMessage(err: unknown, willRetry: boolean): string {
  const what = isProviderError(err)
    ? err.retryable || err.code === 'circuit_open'
      ? 'The voice provider did not respond.'
      : 'The voice provider rejected the call.'
    : 'The call could not be started.'
  return willRetry ? `${what} Retrying automatically.` : what
}

/**
 * Dispatches one claimed run. The run is in 'calling' under our lease; every
 * exit path writes a final (or re-queued) state. Returns what happened.
 */
export async function dispatchRun(db: SupabaseClient, run: RunRow, owner: string, log: Logger, deps: Dispatcher = { startOutboundCall }, now = new Date()): Promise<DispatchOutcome> {
  const l = log.child({ orgId: run.org_id, runId: run.id, connectionId: run.connection_id })
  const audit = (action: string, metadata: Record<string, string | number | boolean | null>) =>
    writeAudit(db, { orgId: run.org_id, actor: 'cron', action, connectionId: run.connection_id, automationId: run.automation_id, runId: run.id, callId: null, metadata }, l)
  const skip = async (code: string, reason: string, status: 'skipped' | 'cancelled' | 'suppressed' = 'skipped') => {
    await settle(db, run, owner, { status, eligibility_reason: reason, error_code: code, completed_at: now.toISOString() }, l)
    await audit('run.skipped', { code, reason })
    l.info('commerce.dispatch.skipped', { code })
    return status === 'cancelled' ? 'cancelled' : 'skipped'
  }
  const defer = async (until: Date, reason: string) => {
    await settle(db, run, owner, { status: 'scheduled', scheduled_for: until.toISOString(), attempt: Math.max(0, run.attempt - 1), eligibility_reason: reason }, l)
    l.info('commerce.dispatch.deferred', { until: until.toISOString(), reason })
    return 'deferred' as const
  }

  const [org, automation, connection, customer] = await Promise.all([loadOrg(db, run.org_id), loadAutomation(db, run.automation_id), loadConnection(db, run.connection_id), loadCustomer(db, run.customer_id)])
  if (!org || org.deletion_requested_at) return skip('org_unavailable', 'Organization is no longer active', 'cancelled')
  if (!automation) return skip('automation_missing', 'Automation was deleted', 'cancelled')
  const state = automationState(automation)
  if (!state.enabled) return skip('automation_disabled', INELIGIBLE_LABELS.automation_disabled, 'cancelled')
  if (!state.consent_confirmed_at) return skip('no_consent', INELIGIBLE_LABELS.no_consent, 'cancelled')
  if (!connection || (connection.status !== 'active' && connection.status !== 'degraded')) return skip('connection_inactive', 'Store connection is not active', 'cancelled')

  const phone = run.to_phone_e164
  if (!phone) return skip('no_phone', INELIGIBLE_LABELS.no_phone, 'suppressed')
  if (customer?.do_not_call || (await isPhoneSuppressed(db, run.connection_id, phone))) return skip('do_not_call', INELIGIBLE_LABELS.do_not_call, 'suppressed')

  const ctx = await loadRunContext(db, run)
  if (run.automation_type === 'cod_confirmation') {
    if (!ctx.order) return skip('order_missing', 'Order no longer exists', 'cancelled')
    if (!orderOpenForCod({ ...ctx.order, total: ctx.order.total === null ? null : Number(ctx.order.total) })) return skip('order_not_open', INELIGIBLE_LABELS.order_not_open, 'cancelled')
  } else if (run.automation_type === 'order_follow_up') {
    if (!ctx.order || ['cancelled', 'refunded', 'failed'].includes(ctx.order.status)) return skip('order_not_open', INELIGIBLE_LABELS.order_not_open, 'cancelled')
  } else if (run.automation_type === 'abandoned_cart') {
    if (!ctx.cart || ctx.cart.status === 'recovered') return skip('cart_recovered', INELIGIBLE_LABELS.cart_recovered, 'cancelled')
    // 'open' (checkout still in progress) or 'expired': not an abandoned cart, never dialed.
    if (ctx.cart.status !== 'abandoned') return skip('cart_not_abandoned', INELIGIBLE_LABELS.cart_not_abandoned, 'cancelled')
  }

  const timezone = org.timezone ?? readCommerceProfile(org.commerce_profile).timezone
  if (!insideCallWindow(now, state.config, timezone)) return defer(nextCallSlot(now, state.config, timezone), 'Outside the call window')
  const bounds = localDayBounds(now, state.config, timezone)
  if ((await countToday(db, { orgId: run.org_id, automationId: run.automation_id, excludeRunId: run.id }, bounds)) >= state.config.daily_cap) {
    return defer(nextCallSlot(bounds.end, state.config, timezone), 'Daily limit of the automation reached')
  }
  const perCustomer = Math.max(
    await countToday(db, { orgId: run.org_id, phone, excludeRunId: run.id }, bounds),
    run.customer_id ? await countToday(db, { orgId: run.org_id, customerId: run.customer_id, excludeRunId: run.id }, bounds) : 0,
  )
  if (perCustomer >= state.config.per_customer_daily_cap) return defer(nextCallSlot(bounds.end, state.config, timezone), 'Customer already called today')
  if (!callAllowance({ plan: org.plan, minutes_used: org.minutes_used, minutes_limit: org.minutes_limit }).allowed) {
    return skip('minutes_exhausted', 'Included plan minutes are used up')
  }

  const profile = readCommerceProfile(org.commerce_profile)
  const agentName = await agentNameOf(db, automation.agent_id, run.org_id)
  const variables = scriptValuesFor(ctx, { name: profile.display_name || org.name || '', agentName })
  if (run.call_id) {
    // A retry still points at the previous attempt's call. Unlink it before
    // dialing, so neither a late event for that call nor the stale sweep can
    // settle this attempt from it (./reconcile.ts accepts only run.call_id).
    const { error: unlinkErr } = await db.from('commerce_automation_runs').update({ call_id: null, provider_call_ref: null, dispatch_uncertain: false }).eq('id', run.id).eq('lease_owner', owner)
    if (unlinkErr) {
      // Nothing was dialed: hand the attempt back instead of dialing with a stale link.
      l.error('commerce.dispatch.unlink_failed', unlinkErr)
      return defer(nextCallSlot(new Date(now.getTime() + state.config.retry_minutes * 60_000), state.config, timezone), 'Retry postponed')
    }
  }
  let result: OutboundResult
  try {
    result = await deps.startOutboundCall({ orgId: run.org_id, toNumber: phone, phoneNumberId: null, purpose: 'outbound', commerceRunId: run.id, variables }, l)
  } catch (err) {
    if (err instanceof RequestError) {
      // precondition_failed: no number / paused agent / plan — the merchant must act; never a silent retry loop.
      if (err.status === 409 || err.status === 503 || err.status === 400) {
        await settle(db, run, owner, { status: 'skipped', error_code: err.code, error_message: err.message, completed_at: now.toISOString() }, l)
        await audit('run.skipped', { code: err.code, reason: err.message })
        l.warn('commerce.dispatch.precondition_failed', { code: err.code })
        return 'skipped'
      }
    }
    // The raw error (provider text, database message) stays in the log; the run shows public-safe text.
    l.error('commerce.dispatch.failed', err, { attempt: run.attempt })
    if (run.attempt < run.max_attempts) {
      const until = nextCallSlot(new Date(now.getTime() + state.config.retry_minutes * 60_000), state.config, timezone)
      await settle(db, run, owner, { status: 'retry_waiting', scheduled_for: until.toISOString(), error_code: 'dispatch_failed', error_message: dispatchFailureMessage(err, true) }, l)
      await audit('run.retry', { attempt: run.attempt, until: until.toISOString() })
      return 'retry'
    }
    await settle(db, run, owner, { status: 'failed', outcome: 'failed', error_code: 'dispatch_failed', error_message: dispatchFailureMessage(err, false), completed_at: now.toISOString() }, l)
    await audit('run.failed', { attempt: run.attempt, code: 'dispatch_failed' })
    return 'failed'
  }
  // The call row exists: from here the post-call reconciliation settles the run.
  const patch: Record<string, unknown> = { call_id: result.callId, provider_call_ref: result.routingMode, dispatch_uncertain: result.status === 'unconfirmed', error_code: null, error_message: null }
  const { error } = await db.from('commerce_automation_runs').update(patch).eq('id', run.id).eq('lease_owner', owner)
  if (error) l.error('commerce.dispatch.call_link_failed', error)
  await writeAudit(db, { orgId: run.org_id, actor: 'cron', action: 'call.started', connectionId: run.connection_id, automationId: run.automation_id, runId: run.id, callId: result.callId, metadata: { phone: maskPhone(phone), attempt: run.attempt, routing: result.routingMode, status: result.status } }, l)
  l.info('commerce.dispatch.called', { callId: result.callId, status: result.status })
  return result.status === 'unconfirmed' ? 'unconfirmed' : 'called'
}

async function agentNameOf(db: SupabaseClient, agentId: string | null, orgId: string): Promise<string> {
  let q = db.from('agents').select('name').eq('org_id', orgId)
  if (agentId) q = q.eq('id', agentId)
  const { data, error } = await q.order('created_at', { ascending: true }).limit(1).maybeSingle()
  if (error) throw new Error(`agents read failed: ${error.message}`)
  return (data?.name as string | undefined) ?? ''
}

/**
 * A 'calling' run whose lease expired without a call id died mid-dispatch:
 * the call may or may not have been placed, so it is settled as failed and
 * never dialed again (the merchant sees it and can act). Runs with a call id
 * wait for the call's own lifecycle (./reconcile.ts).
 */
export async function recoverStaleDispatches(db: SupabaseClient, log: Logger, now = new Date()): Promise<number> {
  const { data, error } = await db
    .from('commerce_automation_runs')
    .select(RUN_COLUMNS)
    .eq('status', 'calling')
    .is('call_id', null)
    .not('lease_until', 'is', null)
    .lt('lease_until', now.toISOString())
    .limit(50)
  if (error) throw new Error(`commerce_automation_runs read failed: ${error.message}`)
  let n = 0
  for (const run of (data ?? []) as RunRow[]) {
    const { error: updErr } = await db
      .from('commerce_automation_runs')
      .update({ status: 'failed', outcome: 'failed', dispatch_uncertain: true, error_code: 'dispatch_uncertain', error_message: 'The call could not be confirmed; it is not retried automatically.', completed_at: now.toISOString(), lease_owner: null, lease_until: null })
      .eq('id', run.id)
      .eq('status', 'calling')
      .is('call_id', null)
    if (updErr) {
      log.error('commerce.dispatch.recover_failed', updErr, { runId: run.id })
      continue
    }
    n++
    await writeAudit(db, { orgId: run.org_id, actor: 'cron', action: 'run.failed', connectionId: run.connection_id, automationId: run.automation_id, runId: run.id, metadata: { code: 'dispatch_uncertain' } }, log)
  }
  return n
}
