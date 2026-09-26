import 'server-only'
import { after } from 'next/server'
import type Stripe from 'stripe'
import type { SupabaseClient } from '@supabase/supabase-js'
import { createAdminClient } from '@/lib/supabase/admin'
import { isSupabaseAdminConfigured } from '@/lib/env'
import { kvDel, kvIncr } from '@/lib/kv'
import { callBlockReason, entitlementsFor, type CallBlockReason } from '@/lib/billing/entitlements'
import {
  basePlanItem,
  getStripeClient,
  isOverageBillingConfigured,
  isPaidSubscriptionStatus,
  isStripeConfigured,
  overageMeterEventName,
} from '@/lib/stripe/client'
import { sendEmail } from '@/lib/email/client'
import { overageNoticeEmail, trialMinutesUsedUpEmail, usageAlertEmail } from '@/lib/email/templates'
import type { VoicePipelineMode } from '@/lib/voice/contracts'
import { PLANS, type BillingInterval, type Organization, type Plan } from '@/types'

// Billed minutes, usage periods and overage (contract 3.3, 5.3, 5.4).
//
// - Minutes are recorded once per call through record_call_usage (idempotency
//   key per call), which also computes the overage part of each call.
// - Monthly plans follow the Stripe billing period of the plan item. Annual
//   plans renew their minutes monthly from the subscription anniversary.
//   Orgs without a subscription (custom plans set by hand) roll monthly from
//   their last period start. The trial never rolls: its minutes are a one-off.
// - Overage rows go to a Stripe Billing Meter right after the call is billed
//   (the daily cron catches up), once per ledger id.
// - Owners get one email at 80 % and one at 100 % of the included minutes per
//   period (trial: calls pause; paid: overage starts).

const DAY_MS = 86_400_000

export type UsageThreshold = 80 | 100
export const USAGE_THRESHOLDS: readonly UsageThreshold[] = [80, 100] as const

export interface UsagePeriod {
  start: Date
  end: Date
}

// ─── Pure period math ────────────────────────────────────────────────────────

function daysInUtcMonth(year: number, monthIndex: number): number {
  return new Date(Date.UTC(year, monthIndex + 1, 0)).getUTCDate()
}

/**
 * anchor + n calendar months in UTC, keeping the anchor's day and time and
 * clamping the day to the target month (Jan 31 → Feb 28/29 → Mar 31). Always
 * computed from the anchor, never step by step, so short months don't make
 * later periods drift earlier.
 */
export function addMonthsClamped(anchor: Date, months: number): Date {
  const totalMonths = anchor.getUTCFullYear() * 12 + anchor.getUTCMonth() + months
  const year = Math.floor(totalMonths / 12)
  const monthIndex = totalMonths - year * 12
  const day = Math.min(anchor.getUTCDate(), daysInUtcMonth(year, monthIndex))
  return new Date(
    Date.UTC(
      year,
      monthIndex,
      day,
      anchor.getUTCHours(),
      anchor.getUTCMinutes(),
      anchor.getUTCSeconds(),
      anchor.getUTCMilliseconds()
    )
  )
}

/** The monthly slice [start, end) anchored on `anchor` that contains `now`. */
export function monthlyPeriodContaining(anchor: Date, now: Date): UsagePeriod {
  let k =
    (now.getUTCFullYear() - anchor.getUTCFullYear()) * 12 + (now.getUTCMonth() - anchor.getUTCMonth())
  // The estimate is off by at most one in either direction (day/time within the month).
  while (addMonthsClamped(anchor, k).getTime() > now.getTime()) k -= 1
  while (addMonthsClamped(anchor, k + 1).getTime() <= now.getTime()) k += 1
  return { start: addMonthsClamped(anchor, k), end: addMonthsClamped(anchor, k + 1) }
}

export interface PeriodInput {
  interval: BillingInterval
  /** Current period of the plan item in Stripe, when known. */
  itemPeriodStart?: Date | null
  itemPeriodEnd?: Date | null
  /**
   * Subscription billing_cycle_anchor. Monthly renewals are computed from it,
   * so a period that starts on a clamped day (Feb 28 for a 31st anchor) still
   * renews on the 31st afterwards, the same day Stripe will use.
   */
  billingCycleAnchor?: Date | null
  /** Anchor for orgs without a Stripe period: last period start, else signup. */
  fallbackAnchor: Date
  now: Date
}

/** Usage period that contains `now` for a paid plan. */
export function usagePeriodFor(input: PeriodInput): UsagePeriod {
  const { itemPeriodStart: start, itemPeriodEnd: end, now } = input
  const hasItemPeriod = !!start && !!end && start.getTime() < end.getTime()

  if (!hasItemPeriod) return monthlyPeriodContaining(input.fallbackAnchor, now)

  const inItemPeriod = start.getTime() <= now.getTime() && now.getTime() < end.getTime()
  if (input.interval === 'month' && inItemPeriod) return { start, end }

  if (!inItemPeriod) {
    // Stripe's copy of the subscription is behind the boundary (a delayed
    // webhook or a renewal still being created): continue on the renewal
    // anchor. The billing cycle anchor is trusted only when the item period
    // ends on it (a Stripe trial ends at the anchor) or lies on it.
    const anchor = input.billingCycleAnchor
    const anchorFits =
      !!anchor &&
      (anchor.getTime() === end.getTime() || monthlyPeriodContaining(anchor, start).start.getTime() === start.getTime())
    return monthlyPeriodContaining(anchorFits ? anchor : start, now)
  }

  // Annual plan inside its paid year: minutes renew monthly from the
  // anniversary, and the last slice never runs past the paid year.
  const slice = monthlyPeriodContaining(start, now)
  if (slice.end.getTime() > end.getTime()) return { start: slice.start, end }
  return slice
}

/**
 * Highest alert threshold usage has reached, or null. Level-based on purpose:
 * each threshold is claimed once per period in KV, so a call that crosses 80 %
 * and 100 % at once sends only the 100 % email, and an email that failed to
 * send is retried by the next billed call. Integer math avoids float edges.
 */
export function usageAlertLevel(minutesUsed: number, minutesLimit: number): UsageThreshold | null {
  if (!(minutesLimit > 0) || !(minutesUsed > 0)) return null
  const reached = USAGE_THRESHOLDS.filter((t) => minutesUsed * 100 >= t * minutesLimit)
  return reached.length ? reached[reached.length - 1] : null
}

/** USD, rounded to cents. */
export function estimateOverageUsd(overageMinutes: number, ratePerMinute: number): number {
  if (!(overageMinutes > 0) || !(ratePerMinute > 0)) return 0
  return Math.round(overageMinutes * ratePerMinute * 100) / 100
}

/** Whole days left in the trial, rounded up; 0 once it has ended; null without an end date. */
export function trialDaysLeft(trialEndsAt: string | null, now: Date): number | null {
  if (!trialEndsAt) return null
  const end = Date.parse(trialEndsAt)
  if (!Number.isFinite(end)) return null
  return Math.max(0, Math.ceil((end - now.getTime()) / DAY_MS))
}

// ─── Usage summary (billing page) ────────────────────────────────────────────

export interface UsageSummary {
  plan: Plan
  planName: string
  isTrial: boolean
  billingInterval: BillingInterval | null
  /** trial: signup → trial end; billing: current usage period; none: not started yet. */
  periodKind: 'trial' | 'billing' | 'none'
  periodStart: string | null
  periodEnd: string | null
  minutesUsed: number
  minutesLimit: number
  minutesRemaining: number
  /** 0–100, for progress bars. */
  percentUsed: number
  overageAllowed: boolean
  /** USD per minute past the allowance (0 on the trial). */
  overageRate: number
  overageMinutes: number
  estimatedOverageUsd: number
  /** ledger = what is billed; estimate = used − limit when the ledger isn't readable. */
  overageSource: 'ledger' | 'estimate'
  /** Overage minutes are sent to Stripe automatically, so they reach the invoice on their own. */
  overageInvoiced: boolean
  /** Overage minutes already sent to Stripe this period. */
  overageMinutesReported: number
  trialEndsAt: string | null
  trialDaysLeft: number | null
  /** Why calls are refused right now, or null when the agent can answer. */
  blockReason: CallBlockReason | null
}

type SummaryOrg = Pick<
  Organization,
  | 'plan'
  | 'minutes_used'
  | 'minutes_limit'
  | 'trial_ends_at'
  | 'onboarding_completed'
  | 'billing_interval'
  | 'usage_period_start'
  | 'usage_period_end'
  | 'created_at'
>

export interface LedgerOverage {
  minutes: number
  reportedMinutes: number
}

/** Pure part of getUsageSummary; `ledger` is null when the ledger couldn't be read. */
export function buildUsageSummary(
  org: SummaryOrg,
  ledger: LedgerOverage | null,
  now: Date = new Date(),
  opts: { overageInvoiced?: boolean } = {}
): UsageSummary {
  const plan: Plan = org.plan in PLANS ? org.plan : 'trial'
  const config = PLANS[plan]
  const entitlements = entitlementsFor(plan)
  const isTrial = plan === 'trial'
  const used = Math.max(0, Math.round(org.minutes_used ?? 0))
  const limit = Math.max(0, Math.round(org.minutes_limit ?? config.minutes_limit))
  const overageAllowed = entitlements.overageAllowed
  const rate = overageAllowed ? config.overage_per_min : 0

  const estimated = overageAllowed ? Math.max(0, used - limit) : 0
  const overageMinutes = overageAllowed ? (ledger ? ledger.minutes : estimated) : 0

  const periodKind: UsageSummary['periodKind'] = isTrial
    ? 'trial'
    : org.usage_period_start && org.usage_period_end
      ? 'billing'
      : 'none'

  return {
    plan,
    planName: config.name,
    isTrial,
    billingInterval: isTrial ? null : org.billing_interval,
    periodKind,
    periodStart: isTrial ? org.created_at : periodKind === 'billing' ? org.usage_period_start : null,
    periodEnd: isTrial ? org.trial_ends_at : periodKind === 'billing' ? org.usage_period_end : null,
    minutesUsed: used,
    minutesLimit: limit,
    minutesRemaining: Math.max(0, limit - used),
    percentUsed: limit > 0 ? Math.min(100, Math.round((used / limit) * 100)) : used > 0 ? 100 : 0,
    overageAllowed,
    overageRate: rate,
    overageMinutes,
    estimatedOverageUsd: estimateOverageUsd(overageMinutes, rate),
    overageSource: overageAllowed && ledger ? 'ledger' : 'estimate',
    overageInvoiced: overageAllowed && !!opts.overageInvoiced,
    overageMinutesReported: overageAllowed && ledger ? ledger.reportedMinutes : 0,
    trialEndsAt: isTrial ? org.trial_ends_at : null,
    trialDaysLeft: isTrial ? trialDaysLeft(org.trial_ends_at, now) : null,
    blockReason: callBlockReason(org, now),
  }
}

// PostgREST caps a response at 1,000 rows on Supabase, so the ledger is read in
// pages. 20 pages = 20,000 overage calls in one period, far past any real org.
const LEDGER_PAGE_SIZE = 1_000
const LEDGER_MAX_PAGES = 20

/** Adds up one period's overage rows; null when the ledger can't be read (the UI then estimates). */
async function readPeriodOverage(client: SupabaseClient, orgId: string, periodStart: string): Promise<LedgerOverage | null> {
  const total: LedgerOverage = { minutes: 0, reportedMinutes: 0 }
  for (let page = 0; page < LEDGER_MAX_PAGES; page += 1) {
    const from = page * LEDGER_PAGE_SIZE
    const { data, error } = await client
      .from('usage_ledger')
      .select('overage_minutes, reported_to_stripe_at')
      .eq('org_id', orgId)
      .eq('kind', 'call')
      .eq('period_start', periodStart)
      .gt('overage_minutes', 0)
      .order('id', { ascending: true })
      .range(from, from + LEDGER_PAGE_SIZE - 1)
    if (error) {
      console.error('[billing] usage ledger read failed', orgId, error.code, error.message)
      return null
    }
    const rows = (data ?? []) as { overage_minutes: number | null; reported_to_stripe_at: string | null }[]
    for (const row of rows) {
      const minutes = Number(row.overage_minutes) || 0
      total.minutes += minutes
      if (row.reported_to_stripe_at) total.reportedMinutes += minutes
    }
    if (rows.length < LEDGER_PAGE_SIZE) return total
  }
  console.warn('[billing] usage ledger has more overage rows than the page cap; showing an estimate', orgId)
  return null
}

/**
 * Usage for the billing page. Reads the ledger with the given client (the
 * signed-in owner's, so RLS applies) or the admin client, always filtered by org.
 */
export async function getUsageSummary(
  org: Organization,
  opts: { supabase?: SupabaseClient; now?: Date } = {}
): Promise<UsageSummary> {
  const now = opts.now ?? new Date()
  let ledger: LedgerOverage | null = null

  if (org.plan !== 'trial' && org.usage_period_start) {
    const client = opts.supabase ?? (isSupabaseAdminConfigured() ? createAdminClient() : null)
    if (client) ledger = await readPeriodOverage(client, org.id, org.usage_period_start)
  }

  return buildUsageSummary(org, ledger, now, { overageInvoiced: isOverageBillingConfigured() })
}

// ─── Recording usage ─────────────────────────────────────────────────────────

interface AlertOrgRow {
  id: string
  user_id: string
  plan: Plan
  minutes_used: number | null
  minutes_limit: number | null
  usage_period_start: string | null
  usage_period_end: string | null
  timezone: string | null
}

const ALERT_KEY_TTL_SECONDS = 45 * 24 * 60 * 60

function alertKey(org: Pick<AlertOrgRow, 'id' | 'plan' | 'usage_period_start'>, threshold: UsageThreshold): string {
  const period = org.plan === 'trial' ? 'trial' : org.usage_period_start ?? 'unset'
  return `usage-alert:${org.id}:${period}:${threshold}`
}

async function ownerEmail(userId: string): Promise<string | null> {
  const { data, error } = await createAdminClient().auth.admin.getUserById(userId)
  if (error) {
    console.error('[billing] owner lookup failed', userId, error.message)
    return null
  }
  return data.user?.email ?? null
}

/** Sends the 80 % / 100 % email once per period after a call added minutes. */
async function sendUsageAlerts(orgId: string): Promise<void> {
  const { data, error } = await createAdminClient()
    .from('organizations')
    .select('id, user_id, plan, minutes_used, minutes_limit, usage_period_start, usage_period_end, timezone')
    .eq('id', orgId)
    .maybeSingle()
  if (error) {
    console.error('[billing] usage alert org lookup failed', orgId, error.code, error.message)
    return
  }
  const org = data as AlertOrgRow | null
  if (!org) return

  const plan: Plan = org.plan in PLANS ? org.plan : 'trial'
  const after = org.minutes_used ?? 0
  const limit = org.minutes_limit ?? PLANS[plan].minutes_limit
  const threshold = usageAlertLevel(after, limit)
  if (!threshold) return

  // Claim the email for this period first so concurrent calls don't both send it.
  const key = alertKey(org, threshold)
  if ((await kvIncr(key, ALERT_KEY_TTL_SECONDS)) !== 1) return

  const to = await ownerEmail(org.user_id)
  if (!to) {
    console.warn('[billing] usage alert skipped: owner has no email', orgId)
    return
  }

  const config = PLANS[plan]
  const isTrial = plan === 'trial'
  const overageInvoiced = isOverageBillingConfigured()
  const content =
    threshold === 80
      ? usageAlertEmail({
          minutesUsed: after,
          minutesLimit: limit,
          planName: config.name,
          isTrial,
          overageRate: isTrial ? null : config.overage_per_min,
          overageInvoiced,
          periodEnd: isTrial ? null : org.usage_period_end,
          timeZone: org.timezone,
        })
      : isTrial
        ? trialMinutesUsedUpEmail({ minutesUsed: after, minutesLimit: limit })
        : overageNoticeEmail({
            planName: config.name,
            minutesLimit: limit,
            overageRate: config.overage_per_min,
            overageInvoiced,
            periodEnd: org.usage_period_end,
            timeZone: org.timezone,
          })

  const sent = await sendEmail({ to, ...content })
  if (!sent) {
    // Give the next call in this period another chance to deliver it.
    await kvDel(key)
    console.error('[billing] usage alert email not delivered', orgId, threshold)
  }
}

function runAfterResponse(label: string, task: () => Promise<void>): Promise<void> | void {
  const guarded = () =>
    task().catch((error) => {
      console.error('[billing]', label, 'failed', error instanceof Error ? error.message : error)
    })
  try {
    after(guarded)
  } catch {
    // Outside a request (cron, scripts, tests): run it now.
    return guarded()
  }
}

export interface RecordCallUsageInput {
  orgId: string
  callId: string
  /** e.g. 'call:twilio:<CallSid>'; a repeated key is not counted again. */
  idempotencyKey: string
  voiceProvider: 'cartesia' | 'elevenlabs'
  pipelineMode: VoicePipelineMode | null
  billableSeconds: number
}

/**
 * Bills a finished call: minutes are rounded up per call and added once per
 * idempotency key; test calls and duplicates return 0. Throws when the
 * database rejects the write so the caller can log it and retry. Usage emails
 * and the call's overage meter event go out after the response when there is one.
 */
export async function recordCallUsage(input: RecordCallUsageInput): Promise<number> {
  if (!input.orgId || !input.idempotencyKey) {
    throw new Error('recordCallUsage: orgId and idempotencyKey are required')
  }
  const seconds = Number.isFinite(input.billableSeconds) ? Math.max(0, Math.round(input.billableSeconds)) : 0
  const admin = createAdminClient()

  if (input.callId) {
    // One call can report its duration through two paths (Twilio status
    // callback and the ElevenLabs webhook) under different keys; bill it once.
    const { data: call, error: callError } = await admin
      .from('calls')
      .select('usage_recorded_at')
      .eq('id', input.callId)
      .eq('org_id', input.orgId)
      .maybeSingle()
    if (callError) {
      console.error('[billing] call usage lookup failed', input.callId, callError.code, callError.message)
      throw new Error(`call usage lookup failed: ${callError.message}`)
    }
    if ((call as { usage_recorded_at: string | null } | null)?.usage_recorded_at) return 0
  }

  const { data, error } = await admin.rpc('record_call_usage', {
    p_org_id: input.orgId,
    p_call_id: input.callId || null,
    p_idempotency_key: input.idempotencyKey,
    p_voice_provider: input.voiceProvider,
    p_pipeline_mode: input.pipelineMode,
    p_billable_seconds: seconds,
  })
  if (error) {
    console.error('[billing] record_call_usage failed', input.orgId, input.idempotencyKey, error.code, error.message)
    throw new Error(`record_call_usage failed: ${error.message}`)
  }

  const minutes = Number(data) || 0
  if (minutes > 0) {
    await runAfterResponse('usage alert', () => sendUsageAlerts(input.orgId))
    await runAfterResponse('overage report', () => reportCallOverage(input.orgId, input.idempotencyKey))
  }
  return minutes
}

// ─── Usage periods ───────────────────────────────────────────────────────────

interface PeriodOrgRow {
  id: string
  plan: Plan
  billing_interval: BillingInterval | null
  stripe_subscription_id: string | null
  usage_period_start: string | null
  usage_period_end: string | null
  created_at: string
}

function parseDate(value: string | null | undefined): Date | null {
  if (!value) return null
  const time = Date.parse(value)
  return Number.isFinite(time) ? new Date(time) : null
}

function sameInstant(a: Date | null, b: Date | null): boolean {
  return !!a && !!b && a.getTime() === b.getTime()
}

/** Period and interval implied by a subscription's plan item. */
export function periodFromSubscription(
  subscription: Pick<Stripe.Subscription, 'items'> & Partial<Pick<Stripe.Subscription, 'billing_cycle_anchor'>>,
  fallbackAnchor: Date,
  now: Date
): { period: UsagePeriod; interval: BillingInterval } | null {
  const item = basePlanItem(subscription)
  if (!item) return null
  const interval: BillingInterval = item.price.recurring?.interval === 'year' ? 'year' : 'month'
  const period = usagePeriodFor({
    interval,
    itemPeriodStart: item.current_period_start ? new Date(item.current_period_start * 1000) : null,
    itemPeriodEnd: item.current_period_end ? new Date(item.current_period_end * 1000) : null,
    billingCycleAnchor: subscription.billing_cycle_anchor ? new Date(subscription.billing_cycle_anchor * 1000) : null,
    fallbackAnchor,
    now,
  })
  return { period, interval }
}

export type PeriodSyncResult = 'rolled' | 'extended' | 'unchanged'

/**
 * Moves an org onto `period`: a newer start rolls the period (resets minutes
 * through roll_usage_period, idempotent per start); the same start only
 * corrects the end; an older start (a stale webhook) is ignored.
 */
export async function applyUsagePeriod(
  org: Pick<PeriodOrgRow, 'id' | 'usage_period_start' | 'usage_period_end'>,
  period: UsagePeriod
): Promise<PeriodSyncResult> {
  const admin = createAdminClient()
  const currentStart = parseDate(org.usage_period_start)
  const currentEnd = parseDate(org.usage_period_end)

  if (currentStart && period.start.getTime() < currentStart.getTime()) return 'unchanged'

  if (sameInstant(currentStart, period.start)) {
    if (sameInstant(currentEnd, period.end)) return 'unchanged'
    const { error } = await admin
      .from('organizations')
      .update({ usage_period_end: period.end.toISOString() })
      .eq('id', org.id)
    if (error) throw new Error(`usage period update failed: ${error.message}`)
    return 'extended'
  }

  const { error } = await admin.rpc('roll_usage_period', {
    p_org_id: org.id,
    p_start: period.start.toISOString(),
    p_end: period.end.toISOString(),
  })
  if (error) throw new Error(`roll_usage_period failed: ${error.message}`)
  return 'rolled'
}

async function nextPeriodFor(org: PeriodOrgRow, now: Date): Promise<UsagePeriod> {
  const fallbackAnchor = parseDate(org.usage_period_start) ?? parseDate(org.created_at) ?? now

  if (org.stripe_subscription_id && isStripeConfigured()) {
    try {
      const subscription = await getStripeClient().subscriptions.retrieve(org.stripe_subscription_id)
      if (isPaidSubscriptionStatus(subscription.status)) {
        const fromStripe = periodFromSubscription(subscription, fallbackAnchor, now)
        if (fromStripe) return fromStripe.period
      } else {
        console.warn('[billing] org has a non-paying subscription; rolling monthly until the webhook updates the plan', org.id, subscription.status)
      }
    } catch (error) {
      // Keep minutes renewing on schedule even when Stripe is unreachable.
      console.error('[billing] subscription lookup failed; rolling on the stored anchor', org.id, error instanceof Error ? error.message : error)
    }
  }

  const interval = org.billing_interval ?? 'month'
  return usagePeriodFor({ interval, fallbackAnchor, now })
}

// PostgREST returns at most 1,000 rows per request on Supabase.
const ROLL_BATCH_LIMIT = 1_000

export interface CronJobOptions {
  /** Epoch ms after which no new work starts; the rest is picked up by the next run. */
  deadline?: number
}

function pastDeadline(opts: CronJobOptions): boolean {
  return opts.deadline !== undefined && Date.now() >= opts.deadline
}

// ─── Reconciliation of unbilled calls ────────────────────────────────────────

/** Calls younger than this may still be billing through the status callback's after(). */
const RECONCILE_MIN_AGE_MS = 15 * 60 * 1000
/** Older than this is outside any period that can still be invoiced cleanly. */
const RECONCILE_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000
const RECONCILE_BATCH = 200

interface UnbilledCallRow {
  id: string
  org_id: string
  twilio_call_sid: string | null
  voice_provider: 'cartesia' | 'elevenlabs'
  pipeline_mode: VoicePipelineMode | null
  billable_seconds: number | null
}

/**
 * The Twilio status callback stores the billable seconds on the call before it
 * bills in after(); Twilio doesn't retry a callback that already answered, so a
 * transient database error there would lose the minutes. This bills those
 * calls under the same idempotency key (call:twilio:<CallSid>), so a call the
 * callback did bill is never counted twice.
 */
export async function reconcileUnbilledCalls(
  now: Date = new Date(),
  opts: CronJobOptions = {}
): Promise<{ billed: number; checked: number; failed: number }> {
  const result = { billed: 0, checked: 0, failed: 0 }
  const { data, error } = await createAdminClient()
    .from('calls')
    .select('id, org_id, twilio_call_sid, voice_provider, pipeline_mode, billable_seconds')
    .gt('billable_seconds', 0)
    .is('usage_recorded_at', null)
    .eq('is_test', false)
    .not('twilio_call_sid', 'is', null)
    .lt('ended_at', new Date(now.getTime() - RECONCILE_MIN_AGE_MS).toISOString())
    .gt('ended_at', new Date(now.getTime() - RECONCILE_MAX_AGE_MS).toISOString())
    .order('ended_at', { ascending: true })
    .limit(RECONCILE_BATCH)
  if (error) {
    // Before migration 010 the usage columns don't exist; nothing to reconcile.
    if (error.code === '42703' || error.code === '42P01') return result
    throw new Error(`unbilled call lookup failed: ${error.message}`)
  }
  for (const call of (data ?? []) as UnbilledCallRow[]) {
    if (pastDeadline(opts)) break
    result.checked++
    try {
      const minutes = await recordCallUsage({
        orgId: call.org_id,
        callId: call.id,
        idempotencyKey: `call:twilio:${call.twilio_call_sid}`,
        voiceProvider: call.voice_provider,
        pipelineMode: call.pipeline_mode,
        billableSeconds: Number(call.billable_seconds) || 0,
      })
      if (minutes > 0) {
        result.billed++
        console.warn('[billing] billed a call the status callback had not recorded', call.id, minutes)
      }
    } catch (err) {
      result.failed++
      console.error('[billing] reconciling an unbilled call failed', call.id, err instanceof Error ? err.message : err)
    }
  }
  return result
}

/** Daily cron: starts a new usage period for every paid org whose period ended (or never started). */
export async function rollUsagePeriods(
  now: Date = new Date(),
  opts: CronJobOptions = {}
): Promise<{ rolled: number; failed: number; deferred: number }> {
  const admin = createAdminClient()
  const columns = 'id, plan, billing_interval, stripe_subscription_id, usage_period_start, usage_period_end, created_at'

  const [ended, unset] = await Promise.all([
    admin
      .from('organizations')
      .select(columns)
      .neq('plan', 'trial')
      .lt('usage_period_end', now.toISOString())
      .order('usage_period_end', { ascending: true })
      .limit(ROLL_BATCH_LIMIT),
    admin.from('organizations').select(columns).neq('plan', 'trial').is('usage_period_end', null).limit(ROLL_BATCH_LIMIT),
  ])
  if (ended.error) throw new Error(`usage period query failed: ${ended.error.message}`)
  if (unset.error) throw new Error(`usage period query failed: ${unset.error.message}`)

  const orgs = [...(unset.data ?? []), ...(ended.data ?? [])] as unknown as PeriodOrgRow[]
  if ((ended.data ?? []).length >= ROLL_BATCH_LIMIT || (unset.data ?? []).length >= ROLL_BATCH_LIMIT) {
    console.warn('[billing] usage period batch is full; the rest roll on the next run')
  }

  let rolled = 0
  let failed = 0
  let deferred = 0
  for (const [index, org] of orgs.entries()) {
    if (pastDeadline(opts)) {
      deferred = orgs.length - index
      console.warn('[billing] usage period roll stopped at its time budget; the rest roll on the next run', deferred)
      break
    }
    try {
      const period = await nextPeriodFor(org, now)
      if (period.end.getTime() <= now.getTime()) {
        console.error('[billing] computed usage period already ended; skipping', org.id, period.end.toISOString())
        failed += 1
        continue
      }
      const result = await applyUsagePeriod(org, period)
      if (result === 'rolled') rolled += 1
    } catch (error) {
      failed += 1
      console.error('[billing] usage period roll failed', org.id, error instanceof Error ? error.message : error)
    }
  }
  return { rolled, failed, deferred }
}

// ─── Overage → Stripe ────────────────────────────────────────────────────────
//
// Each ledger row with overage minutes becomes one Stripe Billing Meter event
// (identifier and idempotency key = ledger id). Events are sent right after
// the call is billed; the daily cron only catches up what didn't go out.
//
// Events carry the time the row was claimed for sending, not the call time:
// Stripe only bills usage into invoices that are still open, so a call from
// the last hours of a period reported the next morning would otherwise never
// be invoiced. Every attempt and resend of a row sends byte-identical
// parameters (same timestamp): Stripe compares a reused Idempotency-Key's
// parameters and refuses changed ones with an idempotency_error.
//
// Row states (stripe_meter_event_id / reported_to_stripe_at):
//   null / null                      not sent yet
//   'claim-<ms>-<id>' / null         being sent, or the outcome is unknown
//   '<id>' / timestamp               reported
// Stripe dedupes an identifier for at least 24 h, so a claimed row may be sent
// again while its claim is younger than OVERAGE_RESEND_WINDOW_MS; older ones
// are left for a person to check, never resent blindly.

const METER_EVENT_MAX_AGE_DAYS = 34
/** Small pages keep the `in (...)` org filters well inside URL limits. */
const OVERAGE_PAGE_SIZE = 100
const OVERAGE_MAX_PAGES = 50
const METER_EVENT_CONCURRENCY = 5
const METER_EVENT_ATTEMPTS = 3
const CLAIM_PREFIX = 'claim-'
export const OVERAGE_RESEND_WINDOW_MS = 22 * 60 * 60 * 1000

interface OverageRow {
  id: string
  org_id: string
  overage_minutes: number
  period_start: string
  created_at: string
  stripe_meter_event_id: string | null
}

export interface OverageReportResult {
  reported: number
  /** Rows that aren't billed automatically (no Stripe customer, or recorded before usage periods existed). */
  skipped: number
  /** Not sent this run; retried on the next one. */
  failed: number
  /** Claimed rows too old to resend safely; check them in Stripe. */
  needsReview: number
}

export function overageClaimValue(rowId: string, nowMs: number): string {
  return `${CLAIM_PREFIX}${nowMs}-${rowId}`
}

/**
 * The meter event timestamp (seconds) for a claimed row: the claim time, so
 * retries and next-day resends repeat the first request exactly.
 */
export function meterEventTimestamp(claim: string, nowMs: number): number {
  const match = new RegExp(`^${CLAIM_PREFIX}(\\d+)-`).exec(claim)
  const claimedAt = match ? Number(match[1]) : Number.NaN
  const ms = Number.isFinite(claimedAt) && claimedAt > 0 && claimedAt <= nowMs + 60_000 ? claimedAt : nowMs
  return Math.floor(ms / 1000)
}

/** What the reporter may do with an unreported row. */
export function overageRowAction(
  row: Pick<OverageRow, 'id' | 'stripe_meter_event_id'>,
  nowMs: number
): 'send' | 'resend' | 'review' {
  const value = row.stripe_meter_event_id
  if (!value) return 'send'
  const match = new RegExp(`^${CLAIM_PREFIX}(\\d+)-(.+)$`).exec(value)
  if (!match || match[2] !== row.id) return 'review'
  const age = nowMs - Number(match[1])
  return age >= 0 && age < OVERAGE_RESEND_WINDOW_MS ? 'resend' : 'review'
}

function stripeStatus(error: unknown): number | null {
  const status = (error as { statusCode?: unknown } | null)?.statusCode
  return typeof status === 'number' ? status : null
}

/**
 * An Idempotency-Key conflict: the key was used before (maybe by a request
 * that did record the event, or one still running), so the outcome is unknown.
 */
function isIdempotencyConflict(error: unknown): boolean {
  const e = error as { type?: unknown; rawType?: unknown } | null
  return e?.type === 'StripeIdempotencyError' || e?.rawType === 'idempotency_error' || stripeStatus(error) === 409
}

/**
 * Whether a failed meter event call certainly didn't record the event: Stripe
 * answered with a 4xx that isn't about the idempotency key. A network error,
 * a 5xx or an idempotency conflict may have recorded it.
 */
export function meterEventDefinitelyRejected(error: unknown): boolean {
  if (isIdempotencyConflict(error)) return false
  const status = stripeStatus(error)
  return status !== null && status >= 400 && status < 500
}

const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms))

type SendOutcome = 'reported' | 'failed' | 'taken'

interface MeterContext {
  admin: SupabaseClient
  stripe: Stripe
  eventName: string
}

/** Claims (or re-uses a fresh claim on) one row, sends it and marks it reported. */
async function sendOverageRow(ctx: MeterContext, row: OverageRow & { customer: string }): Promise<SendOutcome> {
  const { admin, stripe, eventName } = ctx
  let claim = row.stripe_meter_event_id
  if (!claim) {
    claim = overageClaimValue(row.id, Date.now())
    const claimed = await admin
      .from('usage_ledger')
      .update({ stripe_meter_event_id: claim })
      .eq('id', row.id)
      .eq('org_id', row.org_id)
      .is('stripe_meter_event_id', null)
      .select('id')
    if (claimed.error) {
      console.error('[billing] could not claim overage row', row.id, claimed.error.message)
      return 'failed'
    }
    if ((claimed.data ?? []).length === 0) return 'taken'
  }

  let sendError: unknown = null
  // Same parameters on every attempt and resend (see meterEventTimestamp).
  const timestamp = meterEventTimestamp(claim, Date.now())
  for (let attempt = 1; attempt <= METER_EVENT_ATTEMPTS; attempt += 1) {
    try {
      await stripe.billing.meterEvents.create(
        {
          event_name: eventName,
          identifier: row.id,
          timestamp,
          payload: { stripe_customer_id: row.customer, value: String(row.overage_minutes) },
        },
        { idempotencyKey: `meter-event:${row.id}` }
      )
      sendError = null
      break
    } catch (error) {
      sendError = error
      if (meterEventDefinitelyRejected(error) && stripeStatus(error) !== 429) break
      if (attempt < METER_EVENT_ATTEMPTS) await sleep(500 * attempt)
    }
  }

  if (sendError) {
    const message = sendError instanceof Error ? sendError.message : String(sendError)
    if (meterEventDefinitelyRejected(sendError)) {
      // Stripe didn't record it: release the claim so the next run starts over.
      console.error('[billing] meter event rejected', row.id, stripeStatus(sendError), message)
      const release = await admin
        .from('usage_ledger')
        .update({ stripe_meter_event_id: null })
        .eq('id', row.id)
        .eq('org_id', row.org_id)
        .eq('stripe_meter_event_id', claim)
      if (release.error) console.error('[billing] could not release a rejected overage row', row.id, release.error.message)
    } else {
      // Maybe recorded: keep the claim; the next run resends it inside Stripe's dedupe window.
      console.error('[billing] meter event outcome unknown; it is resent on the next run', row.id, message)
    }
    return 'failed'
  }

  const mark = await admin
    .from('usage_ledger')
    .update({ stripe_meter_event_id: row.id, reported_to_stripe_at: new Date().toISOString() })
    .eq('id', row.id)
    .eq('org_id', row.org_id)
    .eq('stripe_meter_event_id', claim)
  if (mark.error) {
    console.error('[billing] meter event sent but the ledger was not marked; the next run confirms it', row.id, mark.error.message)
    return 'failed'
  }
  return 'reported'
}

async function runPool<T>(items: T[], concurrency: number, worker: (item: T) => Promise<void>): Promise<void> {
  let next = 0
  const lanes = Array.from({ length: Math.min(concurrency, items.length) }, async () => {
    while (next < items.length) {
      const item = items[next]
      next += 1
      await worker(item)
    }
  })
  await Promise.all(lanes)
}

function periodKey(orgId: string, periodStart: string): string {
  return `${orgId}|${Date.parse(periodStart)}`
}

const OVERAGE_COLUMNS = 'id, org_id, overage_minutes, period_start, created_at, stripe_meter_event_id'

/**
 * Sends the overage of one just-billed call to Stripe. Best effort: anything
 * that doesn't go out here is sent by the daily cron.
 */
async function reportCallOverage(orgId: string, idempotencyKey: string): Promise<void> {
  if (!isOverageBillingConfigured()) return
  const admin = createAdminClient()
  const { data, error } = await admin
    .from('usage_ledger')
    .select(OVERAGE_COLUMNS)
    .eq('org_id', orgId)
    .eq('idempotency_key', idempotencyKey)
    .eq('kind', 'call')
    .gt('overage_minutes', 0)
    .is('reported_to_stripe_at', null)
    .is('stripe_meter_event_id', null)
    .maybeSingle()
  if (error) throw new Error(`overage row lookup failed: ${error.message}`)
  const row = data as OverageRow | null
  if (!row) return

  const [org, reset] = await Promise.all([
    admin.from('organizations').select('stripe_customer_id').eq('id', orgId).maybeSingle(),
    admin
      .from('usage_ledger')
      .select('id')
      .eq('org_id', orgId)
      .eq('kind', 'reset')
      .eq('period_start', row.period_start)
      .limit(1),
  ])
  if (org.error) throw new Error(`overage org lookup failed: ${org.error.message}`)
  if (reset.error) throw new Error(`overage period lookup failed: ${reset.error.message}`)
  const customer = (org.data as { stripe_customer_id: string | null } | null)?.stripe_customer_id
  // No reset row: the period predates usage periods (see reportOverageToStripe).
  if (!customer || (reset.data ?? []).length === 0) return

  const eventName = overageMeterEventName() as string
  await sendOverageRow({ admin, stripe: getStripeClient(), eventName }, { ...row, customer })
}

/**
 * Daily cron: sends every overage row that didn't reach Stripe yet, and
 * re-sends rows whose earlier attempt had an unknown outcome while Stripe
 * still dedupes them.
 */
export async function reportOverageToStripe(
  now: Date = new Date(),
  opts: CronJobOptions = {}
): Promise<OverageReportResult> {
  const result: OverageReportResult = { reported: 0, skipped: 0, failed: 0, needsReview: 0 }
  const eventName = overageMeterEventName()
  if (!eventName || !isStripeConfigured()) {
    console.info('[billing] overage reporting skipped: STRIPE_OVERAGE_METER_EVENT or Stripe is not configured')
    return result
  }

  const ctx: MeterContext = { admin: createAdminClient(), stripe: getStripeClient(), eventName }
  const since = new Date(now.getTime() - METER_EVENT_MAX_AGE_DAYS * DAY_MS).toISOString()
  let unverified = 0
  let cursor: string | null = null

  for (let page = 0; page < OVERAGE_MAX_PAGES && !pastDeadline(opts); page += 1) {
    // Rows that are skipped stay unreported; the created_at cursor keeps them
    // from hiding newer rows on the next page.
    const base = ctx.admin
      .from('usage_ledger')
      .select(OVERAGE_COLUMNS)
      .gt('overage_minutes', 0)
      .is('reported_to_stripe_at', null)
      .or(`stripe_meter_event_id.is.null,stripe_meter_event_id.like.${CLAIM_PREFIX}*`)
    const { data, error } = await (cursor === null ? base.gte('created_at', since) : base.gt('created_at', cursor))
      .order('created_at', { ascending: true })
      .limit(OVERAGE_PAGE_SIZE)
    if (error) throw new Error(`overage ledger query failed: ${error.message}`)

    const rows = (data ?? []) as OverageRow[]
    if (rows.length === 0) break
    cursor = rows[rows.length - 1].created_at

    const orgIds = [...new Set(rows.map((row) => row.org_id))]
    const earliestPeriod = new Date(Math.min(...rows.map((row) => Date.parse(row.period_start)))).toISOString()
    const [orgs, resets] = await Promise.all([
      ctx.admin.from('organizations').select('id, stripe_customer_id').in('id', orgIds),
      ctx.admin
        .from('usage_ledger')
        .select('org_id, period_start')
        .eq('kind', 'reset')
        .in('org_id', orgIds)
        .gte('period_start', earliestPeriod),
    ])
    if (orgs.error) throw new Error(`overage org query failed: ${orgs.error.message}`)
    if (resets.error) throw new Error(`overage period query failed: ${resets.error.message}`)
    const customers = new Map(
      ((orgs.data ?? []) as { id: string; stripe_customer_id: string | null }[]).map((org) => [org.id, org.stripe_customer_id])
    )
    // Every real usage period starts with a reset row. Overage recorded without
    // one was computed against minutes that were never reset (orgs from before
    // usage periods existed), so it is not billed automatically.
    const realPeriods = new Set(
      ((resets.data ?? []) as { org_id: string; period_start: string }[]).map((r) => periodKey(r.org_id, r.period_start))
    )

    const sendable: (OverageRow & { customer: string })[] = []
    for (const row of rows) {
      const customer = customers.get(row.org_id)
      const action = overageRowAction(row, Date.now())
      if (action === 'review') {
        result.needsReview += 1
        console.error('[billing] OVERAGE NEEDS REVIEW: send outcome unknown and too old to resend; check Stripe for identifier', row.id)
      } else if (!realPeriods.has(periodKey(row.org_id, row.period_start))) {
        unverified += 1
      } else if (!customer) {
        result.skipped += 1 // custom plans without a Stripe customer are invoiced by hand
      } else {
        sendable.push({ ...row, customer })
      }
    }

    await runPool(sendable, METER_EVENT_CONCURRENCY, async (row) => {
      if (pastDeadline(opts)) {
        result.failed += 1
        return
      }
      const outcome = await sendOverageRow(ctx, row)
      if (outcome === 'reported') result.reported += 1
      else if (outcome === 'failed') result.failed += 1
    })

    if (rows.length < OVERAGE_PAGE_SIZE) break
  }

  if (pastDeadline(opts)) console.warn('[billing] overage reporting stopped at its time budget; the rest is sent on the next run')
  if (result.skipped > 0) console.info('[billing] overage rows without a Stripe customer skipped', result.skipped)
  if (unverified > 0) {
    console.warn('[billing] overage rows outside a tracked usage period were not billed; review them by hand', unverified)
  }
  result.skipped += unverified
  return result
}
