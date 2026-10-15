import 'server-only'
// Dispatch: claims due runs (scheduled/retry_waiting → calling, atomically,
// with a lease), re-checks every rule against the current state, and places
// the call through the one outbound path (lib/telephony/outbound.ts). A run
// whose dispatch result is uncertain is never dialed again automatically.
// Out of minutes (included and purchased, lib/telephony/quota.ts): the run
// waits for minutes (tried again every MINUTES_RETRY_MINUTES inside the call
// window) for up to MINUTES_WAIT_HOURS after its scheduled time, then it is
// skipped as 'minutes_exhausted' (a late confirmation call is pointless). The
// same wait applies when startOutboundCall itself refuses for lack of minutes
// (capacity ran out between this check and the dial). Usage is recorded only
// when a call ends, so calls already under way hold back
// IN_FLIGHT_CALL_RESERVE_MINUTES each: another store call starts only when
// the minutes left cover it too (the first call always may), otherwise the
// run tries again MINUTES_RESERVED_RETRY_MINUTES later, within the same
// 24-hour wait.

import type { SupabaseClient } from '@supabase/supabase-js'
import type { Logger } from '@/lib/observability/logger'
import { RequestError } from '@/lib/api/http'
import { maskPhone } from '@/lib/phone/e164'
import { minutesCapacity } from '@/lib/billing/minute-packs'
import { callAllowance } from '@/lib/telephony/quota'
import { startOutboundCall, type OutboundRequest, type OutboundResult } from '@/lib/telephony/outbound'
import { isProviderError } from '@/lib/voice-providers/errors'
import { readCommerceProfile } from '../profile'
import type { AutomationConfig } from '../types'
import { type CustomerRow, CUSTOMER_COLUMNS, RUN_COLUMNS, type RunRow, isPhoneSuppressed, loadConnection, writeAudit } from '../store'
import { type AutomationRow, AUTOMATION_COLUMNS, automationState } from './scheduler'
import { INELIGIBLE_LABELS, insideCallWindow, localDayBounds, nextCallSlot, orderOpenForCod } from './eligibility'
import { loadRunContext, scriptValuesFor } from './variables'

export const DISPATCH_LEASE_SECONDS = 180

/** How long a run out of minutes waits for minutes, from its scheduled time. */
export const MINUTES_WAIT_HOURS = 24
/** How often a run out of minutes is tried again (moved into the call window). */
export const MINUTES_RETRY_MINUTES = 30

/**
 * Minutes held back for each call of the organization already under way when
 * deciding whether another store call may start. A store call is short and
 * billed in whole minutes, so two cover one.
 */
export const IN_FLIGHT_CALL_RESERVE_MINUTES = 2
/** How often a run waiting for calls under way to free their minutes is tried again. */
export const MINUTES_RESERVED_RETRY_MINUTES = 5
/** A call row still marked ringing / in progress after this long is stale, not live. */
const LIVE_CALL_WINDOW_MS = 2 * 3_600_000

/** eligibility_reason of a run waiting for minutes, and of one skipped for lack of them. */
export const MINUTES_WAIT_REASON = 'Out of call minutes: waiting for more minutes (up to 24 hours).'
// Plan-neutral: a trial cannot buy minutes or turn on auto top-up, and the Billing page offers each plan its own way out.
export const MINUTES_SKIP_REASON = 'Out of call minutes for 24 hours, so this call was skipped. Add minutes on the Billing page to keep store calls running.'
/** eligibility_reason of a run waiting because the few minutes left are held by calls under way. */
export const MINUTES_RESERVED_REASON = 'Few call minutes left and other calls are under way: trying again in a few minutes (up to 24 hours).'

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
  extra_minutes_balance?: number | null
  commerce_profile: unknown
  deletion_requested_at?: string | null
}

async function loadOrg(db: SupabaseClient, orgId: string): Promise<OrgRow | null> {
  const { data, error } = await db.from('organizations').select('id, name, timezone, plan, minutes_used, minutes_limit, extra_minutes_balance, commerce_profile, deletion_requested_at').eq('id', orgId).maybeSingle()
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
  // When the run first waited for minutes (migration 027); cleared once it dials.
  const waitingSince = minutesWaitSince(run)
  /** Waits for minutes (never spends an attempt) until MINUTES_WAIT_HOURS after the first wait, then skips. */
  const waitForMinutes = async (code: 'minutes_exhausted' | 'minutes_reserved', reason: string, retryMinutes: number) => {
    const anchor = waitingSince ?? (run.scheduled_for && Number.isFinite(Date.parse(run.scheduled_for)) ? new Date(run.scheduled_for) : now)
    const until = minutesRetrySlot(anchor, now, state.config, timezone, retryMinutes)
    if (!until) return skip('minutes_exhausted', MINUTES_SKIP_REASON)
    await settle(db, run, owner, { status: 'scheduled', scheduled_for: until.toISOString(), attempt: Math.max(0, run.attempt - 1), eligibility_reason: reason, minutes_wait_since: anchor.toISOString() }, l)
    if (!waitingSince) await audit('run.deferred', { code, until: until.toISOString() })
    l.info('commerce.dispatch.deferred', { until: until.toISOString(), reason: code })
    return 'deferred' as const
  }
  const usage = { plan: org.plan, minutes_used: org.minutes_used, minutes_limit: org.minutes_limit, extra_minutes_balance: org.extra_minutes_balance }
  const allowance = callAllowance(usage)
  if (!allowance.allowed) return waitForMinutes('minutes_exhausted', MINUTES_WAIT_REASON, MINUTES_RETRY_MINUTES)
  // Capped (a known plan with the cap on): calls under way spend these minutes too before any usage is recorded.
  if (allowance.capSeconds !== null) {
    const live = await countLiveCalls(db, run.org_id, now)
    if (live > 0 && minutesCapacity(usage).total < (live + 1) * IN_FLIGHT_CALL_RESERVE_MINUTES) {
      return waitForMinutes('minutes_reserved', MINUTES_RESERVED_REASON, MINUTES_RESERVED_RETRY_MINUTES)
    }
  }
  // The run dials now: it no longer waits for minutes (a later shortage starts a new wait).
  const clearWait: Record<string, unknown> = waitingSince ? { minutes_wait_since: null } : {}

  const profile = readCommerceProfile(org.commerce_profile)
  const agentName = await agentNameOf(db, automation.agent_id, run.org_id)
  const variables = scriptValuesFor(ctx, { name: profile.display_name || org.name || '', agentName })
  if (run.call_id) {
    // A retry still points at the previous attempt's call. Unlink it before
    // dialing, so neither a late event for that call nor the stale sweep can
    // settle this attempt from it (./reconcile.ts accepts only run.call_id).
    const { error: unlinkErr } = await db.from('commerce_automation_runs').update({ call_id: null, provider_call_ref: null, dispatch_uncertain: false, ...clearWait }).eq('id', run.id).eq('lease_owner', owner)
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
      // The minutes ran out between the check above and the dial (another call ended): wait for minutes like the check does.
      if (isOutOfMinutesRefusal(err)) return waitForMinutes('minutes_exhausted', MINUTES_WAIT_REASON, MINUTES_RETRY_MINUTES)
      // precondition_failed: no number / paused agent / plan — the merchant must act; never a silent retry loop.
      if (err.status === 409 || err.status === 503 || err.status === 400) {
        await settle(db, run, owner, { status: 'skipped', error_code: err.code, error_message: err.message, completed_at: now.toISOString(), ...clearWait }, l)
        await audit('run.skipped', { code: err.code, reason: err.message })
        l.warn('commerce.dispatch.precondition_failed', { code: err.code })
        return 'skipped'
      }
    }
    // The raw error (provider text, database message) stays in the log; the run shows public-safe text.
    l.error('commerce.dispatch.failed', err, { attempt: run.attempt })
    if (run.attempt < run.max_attempts) {
      const until = nextCallSlot(new Date(now.getTime() + state.config.retry_minutes * 60_000), state.config, timezone)
      await settle(db, run, owner, { status: 'retry_waiting', scheduled_for: until.toISOString(), error_code: 'dispatch_failed', error_message: dispatchFailureMessage(err, true), ...clearWait }, l)
      await audit('run.retry', { attempt: run.attempt, until: until.toISOString() })
      return 'retry'
    }
    await settle(db, run, owner, { status: 'failed', outcome: 'failed', error_code: 'dispatch_failed', error_message: dispatchFailureMessage(err, false), completed_at: now.toISOString(), ...clearWait }, l)
    await audit('run.failed', { attempt: run.attempt, code: 'dispatch_failed' })
    return 'failed'
  }
  // The call row exists: from here the post-call reconciliation settles the run.
  const patch: Record<string, unknown> = { call_id: result.callId, provider_call_ref: result.routingMode, dispatch_uncertain: result.status === 'unconfirmed', error_code: null, error_message: null, ...clearWait }
  const { error } = await db.from('commerce_automation_runs').update(patch).eq('id', run.id).eq('lease_owner', owner)
  if (error) l.error('commerce.dispatch.call_link_failed', error)
  await writeAudit(db, { orgId: run.org_id, actor: 'cron', action: 'call.started', connectionId: run.connection_id, automationId: run.automation_id, runId: run.id, callId: result.callId, metadata: { phone: maskPhone(phone), attempt: run.attempt, routing: result.routingMode, status: result.status } }, l)
  l.info('commerce.dispatch.called', { callId: result.callId, status: result.status })
  return result.status === 'unconfirmed' ? 'unconfirmed' : 'called'
}

/** commerce_automation_runs.minutes_wait_since (migration 027; the claim returns every column). */
function minutesWaitSince(run: RunRow): Date | null {
  const raw = (run as RunRow & { minutes_wait_since?: unknown }).minutes_wait_since
  if (typeof raw !== 'string') return null
  const t = Date.parse(raw)
  return Number.isFinite(t) ? new Date(t) : null
}

/**
 * The next attempt of a run out of minutes: `retryMinutes` (default
 * MINUTES_RETRY_MINUTES) from now, moved into the call window; null once that
 * is past MINUTES_WAIT_HOURS after the anchor (the run's scheduled time when
 * it first waited), so a run never dials later than that.
 */
export function minutesRetrySlot(anchor: Date, now: Date, config: AutomationConfig, timezone: string, retryMinutes = MINUTES_RETRY_MINUTES): Date | null {
  const deadline = anchor.getTime() + MINUTES_WAIT_HOURS * 3_600_000
  if (now.getTime() >= deadline) return null
  const next = nextCallSlot(new Date(now.getTime() + retryMinutes * 60_000), config, timezone)
  return next.getTime() <= deadline ? next : null
}

/** startOutboundCall's refusal for lack of minutes (lib/telephony/outbound.ts: 409, details.reason 'minutes_exhausted'). */
function isOutOfMinutesRefusal(err: RequestError): boolean {
  const details = err.details as { reason?: unknown } | null | undefined
  return err.status === 409 && details?.reason === 'minutes_exhausted'
}

/**
 * The organization's calls still under way (ringing or in progress, usage not
 * recorded yet), started within LIVE_CALL_WINDOW_MS: a row stuck in a live
 * status for longer is stale and must not hold minutes forever.
 */
async function countLiveCalls(db: SupabaseClient, orgId: string, now: Date): Promise<number> {
  const { count, error } = await db
    .from('calls')
    .select('id', { count: 'exact', head: true })
    .eq('org_id', orgId)
    .in('status', ['ringing', 'in-progress'])
    .is('usage_recorded_at', null)
    .gte('started_at', new Date(now.getTime() - LIVE_CALL_WINDOW_MS).toISOString())
  if (error) throw new Error(`calls count failed: ${error.message}`)
  return count ?? 0
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
