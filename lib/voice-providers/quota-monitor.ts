import 'server-only'
// Health of the ONE ElevenLabs workspace every tenant shares: its credits,
// voice slots, voice add/edit operations and billing state
// (GET /v1/user/subscription), and the health of the platform API key itself.
// If credits run out, the key is revoked or auto-disabled after a leak, or an
// invoice goes past due, every tenant's calls fail at once; this module makes
// sure that is noticed before or as it happens.
//
//   quotaSnapshot()        reads the subscription and grades it (ok / warn /
//                          error / unknown). Thresholds: credits and voice
//                          capacity at ELEVENLABS_CREDIT_ALERT_PCT (80 %) warn
//                          and ELEVENLABS_CREDIT_CRITICAL_PCT (95 %) error; a
//                          blocking status (incomplete, past_due,
//                          free_disabled) or open invoices are errors. A key
//                          without the user_read permission gives 'unknown',
//                          never 'ok'.
//   runQuotaMonitor()      maintenance step `elevenlabs_quota`, hourly from a
//                          stored last run: error/warn logs, a provider event
//                          (health_check / quota_snapshot) and the snapshot
//                          kept in maintenance_state for diagnostics.
//   quotaDiagnostics()     admin diagnostics: last snapshot (live with ?probe=1)
//                          and key health (auth / permission / quota failures
//                          of the last 24 h, last health probe).
// Platform/admin only: nothing here is ever shown to a tenant. No key, header
// or invoice detail is read beyond counts and statuses.

import type { SupabaseClient } from '@supabase/supabase-js'
import { createAdminClient } from '@/lib/supabase/admin'
import type { Logger } from '@/lib/observability/logger'
import { emitProviderEvent } from '@/lib/observability/telemetry'
import { isConfigured } from '@/lib/elevenlabs/client'
import { BLOCKING_SUBSCRIPTION_STATUSES, getSubscription, type ELSubscription } from '@/lib/elevenlabs/api/subscription'
import { isProviderError } from './errors'
import { runIfDue } from './maintenance-state'
import type { ConfigProblem } from './config'

export const QUOTA_STATE_KEY = 'elevenlabs_quota'

/** Provider error codes that mean the platform cannot use the provider at all (key or billing), whatever the circuit says. */
export const KEY_BLOCKING_CODES: ReadonlySet<string> = new Set(['auth', 'permission', 'quota'])

function envNumber(name: string, fallback: number, min: number, max: number): number {
  const raw = (process.env[name] ?? '').trim()
  const v = Number(raw)
  return raw !== '' && Number.isFinite(v) && v >= min && v <= max ? v : fallback
}

/** Warn threshold, % of the hard credit limit or of voice capacity (ELEVENLABS_CREDIT_ALERT_PCT, 1–100, default 80). */
export const creditAlertPct = () => envNumber('ELEVENLABS_CREDIT_ALERT_PCT', 80, 1, 100)
/** Error threshold (ELEVENLABS_CREDIT_CRITICAL_PCT, 1–100, default 95; never below the warn threshold). */
export const creditCriticalPct = () => Math.max(creditAlertPct(), envNumber('ELEVENLABS_CREDIT_CRITICAL_PCT', 95, 1, 100))
/** Free custom-voice slots below which a warning is raised (ELEVENLABS_VOICE_SLOTS_MIN_FREE, 0–1000, default 20). */
export const voiceSlotsMinFree = () => Math.floor(envNumber('ELEVENLABS_VOICE_SLOTS_MIN_FREE', 20, 0, 1000))
/** Minutes between two subscription checks by maintenance (ELEVENLABS_QUOTA_CHECK_MINUTES, 5–1440, default 60). */
export const quotaCheckMinutes = () => Math.floor(envNumber('ELEVENLABS_QUOTA_CHECK_MINUTES', 60, 5, 1440))

export interface QuotaProblem {
  code: string
  level: 'warn' | 'error'
  message: string
}

export interface QuotaSnapshot {
  status: 'ok' | 'warn' | 'error' | 'unknown'
  /** Why the status is unknown. */
  reason?: 'not_configured' | 'no_permission' | 'unavailable'
  checked_at: string
  tier?: string | null
  subscription_status?: string | null
  credits?: {
    used: number
    included: number
    /** Credits after which requests fail (null: unlimited usage-based billing). */
    hard_limit: number | null
    used_pct: number | null
    overage: boolean
    next_reset_at: string | null
    days_to_reset: number | null
  }
  voice_slots?: { used: number; limit: number; free: number; used_pct: number | null }
  voice_edits?: { used: number; limit: number | null; used_pct: number | null }
  instant_cloning?: boolean
  open_invoices?: number
  problems: QuotaProblem[]
}

const pct = (used: number, limit: number) => (limit > 0 ? Math.round((used / limit) * 1000) / 10 : null)
const num = (v: unknown) => (typeof v === 'number' && Number.isFinite(v) ? v : 0)

/** Grades a subscription body (pure). */
export function gradeSubscription(sub: ELSubscription, now = Date.now()): QuotaSnapshot {
  const problems: QuotaProblem[] = []
  const warnAt = creditAlertPct()
  const errorAt = creditCriticalPct()
  const used = num(sub.character_count)
  const included = num(sub.character_limit)
  const ext = sub.max_credit_limit_extension
  // Spec: "unlimited" = no cap on overage, 0 = usage-based billing disabled.
  const hardLimit = sub.can_extend_character_limit === true ? (ext === 'unlimited' ? null : included + Math.max(0, num(ext))) : included
  const usedPct = hardLimit === null ? null : pct(used, hardLimit)
  if (usedPct !== null && hardLimit !== null && hardLimit > 0) {
    if (usedPct >= errorAt) problems.push({ code: 'credits_critical', level: 'error', message: `ElevenLabs credits are ${usedPct}% used: calls stop when they run out.` })
    else if (usedPct >= warnAt) problems.push({ code: 'credits_low', level: 'warn', message: `ElevenLabs credits are ${usedPct}% used.` })
  }
  const overage = included > 0 && used > included
  if (hardLimit === null && overage) problems.push({ code: 'credits_overage', level: 'warn', message: 'The included ElevenLabs credits are used up: usage is billed as overage.' })

  const status = typeof sub.status === 'string' ? sub.status : null
  if (status && BLOCKING_SUBSCRIPTION_STATUSES.has(status)) {
    problems.push({ code: `subscription_${status}`, level: 'error', message: `The ElevenLabs subscription is ${status.replace('_', ' ')}: fix billing before calls stop.` })
  }
  const openInvoices = Array.isArray(sub.open_invoices) ? sub.open_invoices.length : sub.has_open_invoices ? 1 : 0
  if (sub.has_open_invoices === true || openInvoices > 0) {
    problems.push({ code: 'open_invoices', level: 'error', message: 'The ElevenLabs workspace has open invoices: pay them before the subscription becomes past due.' })
  }

  const slotsUsed = num(sub.voice_slots_used)
  const slotsLimit = num(sub.voice_limit)
  const slotsFree = Math.max(0, slotsLimit - slotsUsed)
  const slotsPct = pct(slotsUsed, slotsLimit)
  if (slotsLimit > 0) {
    if (slotsFree === 0 || (slotsPct !== null && slotsPct >= errorAt)) problems.push({ code: 'voice_slots_full', level: 'error', message: `Only ${slotsFree} custom voice slot(s) left: new clones and library voices will fail.` })
    else if ((slotsPct !== null && slotsPct >= warnAt) || slotsFree < voiceSlotsMinFree()) problems.push({ code: 'voice_slots_low', level: 'warn', message: `${slotsFree} custom voice slot(s) left.` })
  }

  const editsUsed = num(sub.voice_add_edit_counter)
  const editsLimit = typeof sub.max_voice_add_edits === 'number' ? sub.max_voice_add_edits : null
  const editsPct = editsLimit !== null ? pct(editsUsed, editsLimit) : null
  if (editsPct !== null) {
    if (editsPct >= errorAt) problems.push({ code: 'voice_edits_critical', level: 'error', message: `Voice add/edit operations are ${editsPct}% used: adding voices will fail.` })
    else if (editsPct >= warnAt) problems.push({ code: 'voice_edits_low', level: 'warn', message: `Voice add/edit operations are ${editsPct}% used.` })
  }
  if (sub.can_use_instant_voice_cloning === false) {
    problems.push({ code: 'instant_cloning_unavailable', level: 'warn', message: 'The ElevenLabs plan does not allow instant voice cloning: custom voices cannot be created.' })
  }

  const resetUnix = typeof sub.next_character_count_reset_unix === 'number' ? sub.next_character_count_reset_unix : null
  return {
    status: problems.some((p) => p.level === 'error') ? 'error' : problems.length ? 'warn' : 'ok',
    checked_at: new Date(now).toISOString(),
    tier: typeof sub.tier === 'string' ? sub.tier.slice(0, 40) : null,
    subscription_status: status,
    credits: {
      used,
      included,
      hard_limit: hardLimit,
      used_pct: usedPct,
      overage,
      next_reset_at: resetUnix ? new Date(resetUnix * 1000).toISOString() : null,
      days_to_reset: resetUnix ? Math.max(0, Math.round(((resetUnix * 1000 - now) / 86_400_000) * 10) / 10) : null,
    },
    voice_slots: { used: slotsUsed, limit: slotsLimit, free: slotsFree, used_pct: slotsPct },
    voice_edits: { used: editsUsed, limit: editsLimit, used_pct: editsPct },
    instant_cloning: sub.can_use_instant_voice_cloning !== false,
    open_invoices: openInvoices,
    problems,
  }
}

/** Reads and grades the subscription. Never throws for provider errors: they become 'unknown'. */
export async function quotaSnapshot(log: Logger, now = Date.now()): Promise<QuotaSnapshot> {
  const checked_at = new Date(now).toISOString()
  if (!isConfigured()) return { status: 'unknown', reason: 'not_configured', checked_at, problems: [] }
  try {
    return gradeSubscription(await getSubscription(), now)
  } catch (err) {
    if (!isProviderError(err)) throw err
    if (err.code === 'auth' || err.code === 'permission') {
      // A ConvAI-only key: health falls back to the agents probe, but the
      // credits are invisible. Reported, never treated as healthy.
      return {
        status: 'unknown',
        reason: 'no_permission',
        checked_at,
        problems: [{ code: 'quota_unknown', level: 'warn', message: 'The ElevenLabs API key cannot read the subscription (user_read permission): credits and voice slots are not monitored.' }],
      }
    }
    log.warn('quota.read_failed', { code: err.code })
    return { status: 'unknown', reason: 'unavailable', checked_at, problems: [{ code: 'quota_unavailable', level: 'warn', message: `The ElevenLabs subscription could not be read (${err.code}).` }] }
  }
}

/** Logs, emits and stores one snapshot. */
export async function recordQuotaSnapshot(snapshot: QuotaSnapshot, log: Logger, db: SupabaseClient = createAdminClient()): Promise<void> {
  const errors = snapshot.problems.filter((p) => p.level === 'error')
  const warns = snapshot.problems.filter((p) => p.level === 'warn')
  const figures = {
    status: snapshot.status,
    credits_used_pct: snapshot.credits?.used_pct ?? null,
    voice_slots_free: snapshot.voice_slots?.free ?? null,
    voice_edits_used_pct: snapshot.voice_edits?.used_pct ?? null,
    days_to_reset: snapshot.credits?.days_to_reset ?? null,
    subscription_status: snapshot.subscription_status ?? null,
  }
  if (errors.length) log.error('quota.alert', null, { problems: errors.map((p) => p.code), ...figures })
  else if (warns.length) log.warn('quota.warning', { problems: warns.map((p) => p.code), ...figures })
  else log.info('quota.ok', figures)
  emitProviderEvent({
    system: 'elevenlabs',
    kind: 'health_check',
    operation: 'quota_snapshot',
    ok: snapshot.status === 'ok',
    errorCode: errors[0]?.code ?? warns[0]?.code ?? null,
    details: { ...figures, problems: snapshot.problems.map((p) => p.code) },
  })
  const nowIso = new Date().toISOString()
  const { error } = await db.from('maintenance_state').upsert({ key: QUOTA_STATE_KEY, last_run_at: nowIso, details: snapshot, updated_at: nowIso }, { onConflict: 'key' })
  if (error) log.warn('quota.store_failed', { error: error.message.slice(0, 200) })
}

/** Maintenance step `elevenlabs_quota` (default hourly, from the stored last run). */
export async function runQuotaMonitor(log: Logger, opts: { force?: boolean; now?: number } = {}) {
  if (!isConfigured()) return { skipped: 'not_configured' as const }
  const run = async () => {
    const snapshot = await quotaSnapshot(log, opts.now)
    await recordQuotaSnapshot(snapshot, log)
    return { status: snapshot.status, problems: snapshot.problems.map((p) => p.code) }
  }
  return opts.force ? run() : runIfDue(`${QUOTA_STATE_KEY}_check`, quotaCheckMinutes() * 60_000, log, run, opts.now)
}

export interface KeyHealth {
  /** Last maintenance health probe per provider (kind health_check, no operation). */
  last_probe: Record<string, { ok: boolean; error_code: string | null; at: string } | null>
  /** API calls refused for key/billing reasons in the last 24 h, per provider and code. */
  blocked_calls_24h: Record<string, Record<string, number>>
}

/** Admin diagnostics: stored (or live with probe) snapshot plus key health; problems for the diagnostics list. */
export async function quotaDiagnostics(db: SupabaseClient, log: Logger, opts: { probe?: boolean; now?: number } = {}) {
  const now = opts.now ?? Date.now()
  const problems: ConfigProblem[] = []
  let snapshot: QuotaSnapshot | null = null
  if (opts.probe) {
    snapshot = await quotaSnapshot(log, now)
  } else {
    const { data, error } = await db.from('maintenance_state').select('details, last_run_at').eq('key', QUOTA_STATE_KEY).maybeSingle()
    if (error) log.warn('quota.diagnostics_read_failed', { error: error.message.slice(0, 200) })
    const d = data?.details as QuotaSnapshot | undefined
    snapshot = d && typeof d === 'object' && typeof d.status === 'string' ? d : null
  }
  if (!snapshot) {
    if (isConfigured()) problems.push({ key: 'ELEVENLABS_QUOTA', severity: 'warning', message: 'No ElevenLabs subscription snapshot yet (maintenance step elevenlabs_quota, or ?probe=1).' })
  } else {
    for (const p of snapshot.problems) problems.push({ key: 'ELEVENLABS_QUOTA', severity: p.level === 'error' ? 'error' : 'warning', message: p.message })
    const age = now - Date.parse(snapshot.checked_at)
    if (!opts.probe && Number.isFinite(age) && age > 26 * 3_600_000) {
      problems.push({ key: 'ELEVENLABS_QUOTA', severity: 'warning', message: 'The ElevenLabs subscription snapshot is more than a day old: check that maintenance runs.' })
    }
  }

  const since = new Date(now - 24 * 3_600_000).toISOString()
  const [blocked, probes] = await Promise.all([
    db.from('provider_events').select('system, error_code').eq('kind', 'api_call').in('error_code', [...KEY_BLOCKING_CODES]).gte('created_at', since).limit(5000),
    db.from('provider_events').select('system, ok, error_code, created_at').eq('kind', 'health_check').is('operation', null).gte('created_at', new Date(now - 7 * 86_400_000).toISOString()).order('created_at', { ascending: false }).limit(50),
  ])
  if (blocked.error) log.warn('quota.diagnostics_events_failed', { error: blocked.error.message.slice(0, 200) })
  if (probes.error) log.warn('quota.diagnostics_events_failed', { error: probes.error.message.slice(0, 200) })
  const keyHealth: KeyHealth = { last_probe: { elevenlabs: null, cartesia: null }, blocked_calls_24h: {} }
  for (const r of blocked.data ?? []) {
    const sys = String(r.system)
    const code = String(r.error_code)
    const bySys = (keyHealth.blocked_calls_24h[sys] = keyHealth.blocked_calls_24h[sys] ?? {})
    bySys[code] = (bySys[code] ?? 0) + 1
  }
  for (const r of probes.data ?? []) {
    const sys = String(r.system)
    if (keyHealth.last_probe[sys]) continue
    keyHealth.last_probe[sys] = { ok: r.ok === true, error_code: (r.error_code as string | null) ?? null, at: String(r.created_at) }
  }
  for (const [sys, probe] of Object.entries(keyHealth.last_probe)) {
    if (probe && !probe.ok && probe.error_code && KEY_BLOCKING_CODES.has(probe.error_code)) {
      problems.push({ key: 'PROVIDER_KEY', severity: 'error', message: `The last ${sys} health probe failed with "${probe.error_code}": the platform API key is rejected or the account is out of credits. Every tenant is affected.` })
    }
  }
  for (const [sys, codes] of Object.entries(keyHealth.blocked_calls_24h)) {
    const total = Object.values(codes).reduce((a, b) => a + b, 0)
    if (total > 0) {
      problems.push({ key: 'PROVIDER_KEY', severity: 'error', message: `${total} ${sys} API call(s) in the last 24 h were refused for key or billing reasons (${Object.entries(codes).map(([c, n]) => `${c}: ${n}`).join(', ')}).` })
    }
  }
  return { snapshot, key_health: keyHealth, problems }
}
