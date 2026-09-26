import 'server-only'
import { cartesia } from '@/lib/cartesia/client'
import { env, envNumber, isCartesiaAdminConfigured, isSupabaseAdminConfigured } from '@/lib/env'
import { kvDel, kvGet, kvSet } from '@/lib/kv'
import { createAdminClient } from '@/lib/supabase/admin'
import type { SttModel } from '@/lib/voice/contracts'

// Cartesia budget: model credits (TTS/STT, spent by cartesia_self) and prepaid
// voice-agent dollars (spent by cartesia_managed). Cartesia exposes consumption
// only, never a balance, so the remaining amount is the configured allotment
// minus what was used since the renewal day. Two sources feed "used":
//   - the admin usage API (exact, but its freshness is undocumented and it
//     needs CARTESIA_ADMIN_API_KEY);
//   - our own metering in provider_usage_events (immediate, but only what our
//     code recorded).
// Taking the larger of the two keeps the estimate conservative when either
// lags. A real quota_exceeded from Cartesia is authoritative and pins the
// budget as exhausted until the cycle renews (voice_runtime_state).
//
// Nothing here throws to the caller: the router reads the budget while Twilio
// waits, so a failing source counts as unavailable and is logged.

export interface CartesiaBudgetState {
  cycle_key: string
  cycle_start: string
  cycle_end: string
  credits_allotment: number
  credits_used: number
  credits_remaining: number
  credits_source: 'admin_api' | 'local_metering' | 'both'
  credits_exhausted: boolean
  agent_cents_allotment: number
  agent_cents_used: number
  agent_cents_remaining: number
  agent_exhausted: boolean
  checked_at: string
}

export interface ProviderUsageEvent {
  provider: 'cartesia' | 'openai' | 'elevenlabs' | 'twilio'
  kind: string
  quantity: number
  credits?: number
  cost_cents?: number | null
  org_id?: string | null
  call_id?: string | null
  meta?: Record<string, unknown>
}

export type BudgetKind = 'model_credits' | 'agent_dollars'

export const DEFAULT_MONTHLY_CREDITS = 8_000_000
export const DEFAULT_MONTHLY_AGENT_CENTS = 30_000
export const DEFAULT_CREDIT_RESERVE = 150_000
export const DEFAULT_AGENT_CENTS_RESERVE = 500
/** Managed Agents list price, $0.06 per minute. Used when the usage API isn't available. */
export const AGENT_CENTS_PER_SECOND = 0.1

const STT_CREDITS_PER_SECOND: Record<SttModel, number> = {
  'ink-2': 3,
  // Not on the pricing page yet; priced like ink-2 so the estimate errs high.
  'ink-preview': 3,
  'ink-whisper': 1,
}
const UNKNOWN_STT_CREDITS_PER_SECOND = 3

const CACHE_KEY = 'voice:budget:cartesia'
const CACHE_TTL_SECONDS = 60
const FLAG_KEY_PREFIX = 'voice:budget:exhausted:'
// The router reads the budget while Twilio waits for TwiML; a slow source is
// dropped from this computation rather than delaying the call.
const ADMIN_TIMEOUT_MS = 2_000
const DB_TIMEOUT_MS = 2_000
const PAGE_SIZE = 1_000
const MAX_PAGES = 50
const INSERT_BATCH_SIZE = 500

const PROVIDERS = new Set<ProviderUsageEvent['provider']>(['cartesia', 'openai', 'elevenlabs', 'twilio'])
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

const warned = new Set<string>()

function warnOnce(id: string, ...args: unknown[]): void {
  if (warned.has(id)) return
  warned.add(id)
  console.warn('[budget]', ...args)
}

// ─── Billing cycle ───────────────────────────────────────────────────────────

/** Midnight UTC on `day` of the given month, clamped to the month's last day. Month may overflow. */
function clampedUtcDate(year: number, month: number, day: number): Date {
  const lastDay = new Date(Date.UTC(year, month + 1, 0)).getUTCDate()
  return new Date(Date.UTC(year, month, Math.min(day, lastDay)))
}

/** Day of month (UTC) of an ISO date or timestamp; null when missing or invalid. */
export function cycleAnchorDay(anchorIso: string | null | undefined): number | null {
  const value = anchorIso?.trim()
  if (!value) return null
  const dateOnly = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value)
  if (dateOnly) {
    const [year, month, day] = [Number(dateOnly[1]), Number(dateOnly[2]), Number(dateOnly[3])]
    // Date.parse accepts 2026-02-30 as March 2; a typo must not move the renewal day.
    const probe = new Date(Date.UTC(year, month - 1, day))
    const valid = probe.getUTCFullYear() === year && probe.getUTCMonth() === month - 1 && probe.getUTCDate() === day
    return valid ? day : null
  }
  if (!/^\d{4}-\d{2}-\d{2}T/.test(value)) return null
  const ms = Date.parse(value)
  return Number.isFinite(ms) ? new Date(ms).getUTCDate() : null
}

/**
 * The monthly cycle containing `now`. Only the anchor's day of month matters:
 * a renewal on the 31st falls on the last day of shorter months, and an anchor
 * in the future is projected backwards. No (or an invalid) anchor means
 * calendar months in UTC. `key` is the start date, YYYY-MM-DD.
 */
export function billingCycle(anchorIso: string | null, now: Date): { start: Date; end: Date; key: string } {
  const at = Number.isFinite(now.getTime()) ? now : new Date()
  const day = cycleAnchorDay(anchorIso) ?? 1
  const year = at.getUTCFullYear()
  let month = at.getUTCMonth()
  let start = clampedUtcDate(year, month, day)
  if (start.getTime() > at.getTime()) {
    month -= 1
    start = clampedUtcDate(year, month, day)
  }
  const end = clampedUtcDate(year, month + 1, day)
  return { start, end, key: start.toISOString().slice(0, 10) }
}

// ─── Configuration ───────────────────────────────────────────────────────────

export interface BudgetConfig {
  creditsAllotment: number
  agentCentsAllotment: number
  creditReserve: number
  agentCentsReserve: number
  /** allow = keep using Managed Agents past the prepaid dollars (Cartesia bills overage); fallback = switch to ElevenLabs. */
  agentOverage: 'allow' | 'fallback'
  anchor: string | null
}

function nonNegativeEnv(name: Parameters<typeof envNumber>[0], fallback: number): number {
  const value = envNumber(name, fallback)
  return Number.isFinite(value) && value >= 0 ? value : fallback
}

export function budgetConfig(): BudgetConfig {
  const overage = env.CARTESIA_AGENT_OVERAGE?.toLowerCase()
  if (overage && overage !== 'allow' && overage !== 'fallback') {
    warnOnce('overage', 'CARTESIA_AGENT_OVERAGE must be "allow" or "fallback"; using "allow"')
  }
  const anchor = env.CARTESIA_BILLING_CYCLE_ANCHOR ?? null
  if (anchor && cycleAnchorDay(anchor) === null) {
    warnOnce('anchor', 'CARTESIA_BILLING_CYCLE_ANCHOR is not an ISO date; using calendar months')
  }
  return {
    creditsAllotment: nonNegativeEnv('CARTESIA_MONTHLY_CREDITS', DEFAULT_MONTHLY_CREDITS),
    agentCentsAllotment: nonNegativeEnv('CARTESIA_MONTHLY_AGENT_CENTS', DEFAULT_MONTHLY_AGENT_CENTS),
    creditReserve: nonNegativeEnv('CARTESIA_CREDIT_RESERVE', DEFAULT_CREDIT_RESERVE),
    agentCentsReserve: nonNegativeEnv('CARTESIA_AGENT_CENTS_RESERVE', DEFAULT_AGENT_CENTS_RESERVE),
    agentOverage: overage === 'fallback' ? 'fallback' : 'allow',
    anchor,
  }
}

// ─── Pure budget math ────────────────────────────────────────────────────────

export interface BudgetInputs {
  cycle: { start: Date; end: Date; key: string }
  config: BudgetConfig
  now: Date
  /** null = the admin usage API was not configured or failed. */
  adminCredits: number | null
  adminAgentCents: number | null
  /** null = local metering was unavailable (no admin client, missing table, query error). */
  local: { credits: number; agentSeconds: number } | null
  /** Cycle keys stored by markBudgetExhausted; only the current cycle's key counts. */
  flags: { creditsExhaustedCycle: string | null; agentExhaustedCycle: string | null }
}

function round2(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100
}

function usable(value: number | null | undefined): number | null {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0 ? value : null
}

export function computeBudgetState(inputs: BudgetInputs): CartesiaBudgetState {
  const { cycle, config, local, flags } = inputs
  const adminCredits = usable(inputs.adminCredits)
  const adminAgentCents = usable(inputs.adminAgentCents)

  const creditsUsed = round2(Math.max(adminCredits ?? 0, usable(local?.credits) ?? 0))
  const creditsRemaining = round2(config.creditsAllotment - creditsUsed)
  const creditsSource: CartesiaBudgetState['credits_source'] =
    adminCredits !== null && local !== null ? 'both' : adminCredits !== null ? 'admin_api' : 'local_metering'

  const localAgentCents = (usable(local?.agentSeconds) ?? 0) * AGENT_CENTS_PER_SECOND
  const agentCentsUsed = round2(Math.max(adminAgentCents ?? 0, localAgentCents))
  const agentCentsRemaining = round2(config.agentCentsAllotment - agentCentsUsed)

  const creditsFlagged = flags.creditsExhaustedCycle === cycle.key
  const agentFlagged = flags.agentExhaustedCycle === cycle.key

  return {
    cycle_key: cycle.key,
    cycle_start: cycle.start.toISOString(),
    cycle_end: cycle.end.toISOString(),
    credits_allotment: config.creditsAllotment,
    credits_used: creditsUsed,
    credits_remaining: creditsRemaining,
    credits_source: creditsSource,
    credits_exhausted: creditsFlagged || creditsRemaining <= config.creditReserve,
    agent_cents_allotment: config.agentCentsAllotment,
    agent_cents_used: agentCentsUsed,
    agent_cents_remaining: agentCentsRemaining,
    // Past the prepaid dollars Cartesia keeps billing at the plan rate, so by
    // default only a real quota_exceeded (overages switched off) stops Managed Agents.
    agent_exhausted:
      agentFlagged || (config.agentOverage === 'fallback' && agentCentsRemaining <= config.agentCentsReserve),
    checked_at: inputs.now.toISOString(),
  }
}

/** Credits for realtime STT audio. Unknown models are priced like ink-2 so the estimate errs high. */
export function creditsForStt(model: SttModel | null, seconds: number): number {
  if (!Number.isFinite(seconds) || seconds <= 0) return 0
  const rate = (model && STT_CREDITS_PER_SECOND[model]) || UNKNOWN_STT_CREDITS_PER_SECOND
  return round2(seconds * rate)
}

/**
 * Batch STT (POST /stt, ink-whisper only, used by the voice lab): one credit
 * per two seconds of audio, half the realtime rate that creditsForStt prices.
 */
export function creditsForBatchStt(seconds: number): number {
  if (!Number.isFinite(seconds) || seconds <= 0) return 0
  return round2(seconds / 2)
}

/** Sonic TTS: one credit per character sent. */
export function creditsForTts(characters: number): number {
  if (!Number.isFinite(characters) || characters <= 0) return 0
  return Math.ceil(characters)
}

// ─── Sources ─────────────────────────────────────────────────────────────────

class TimeoutError extends Error {
  override name = 'TimeoutError'
}

function withTimeout<T>(promise: Promise<T>, ms: number, label: string): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new TimeoutError(`${label} timed out after ${ms} ms`)), ms)
  })
  return Promise.race([promise, timeout]).finally(() => clearTimeout(timer))
}

/** Short, log-safe summary (server logs only; never returned to clients). */
function describeError(error: unknown): string {
  if (error && typeof error === 'object') {
    const e = error as { name?: unknown; status?: unknown; errorCode?: unknown; code?: unknown; message?: unknown }
    const parts = [e.name, e.status, e.errorCode ?? e.code, typeof e.message === 'string' ? e.message.slice(0, 200) : null]
    const text = parts.filter((p) => p !== undefined && p !== null && p !== '').join(' ')
    if (text) return text
  }
  return typeof error === 'string' ? error.slice(0, 200) : 'unknown error'
}

function isMissingTable(error: { code?: string } | null | undefined): boolean {
  return error?.code === '42P01' || error?.code === 'PGRST205'
}

async function readAdminUsage(
  cycle: { start: Date },
  now: Date
): Promise<{ credits: number | null; agentCents: number | null }> {
  if (!isCartesiaAdminConfigured()) return { credits: null, agentCents: null }
  const startIso = cycle.start.toISOString()
  // /usage/agents needs end > start; the API rounds both to UTC days anyway.
  const endIso = new Date(Math.max(now.getTime(), cycle.start.getTime() + 1000)).toISOString()
  const [credits, agents] = await Promise.allSettled([
    withTimeout(cartesia.usage.credits(startIso, endIso), ADMIN_TIMEOUT_MS, 'usage/credits'),
    withTimeout(cartesia.usage.agents(startIso, endIso), ADMIN_TIMEOUT_MS, 'usage/agents'),
  ])
  if (credits.status === 'rejected') {
    console.warn('[budget] Cartesia credit usage unavailable; using local metering', describeError(credits.reason))
  }
  if (agents.status === 'rejected') {
    console.warn('[budget] Cartesia agent usage unavailable; using local metering', describeError(agents.reason))
  }
  return {
    credits: credits.status === 'fulfilled' ? usable(credits.value) : null,
    agentCents: agents.status === 'fulfilled' ? usable(agents.value?.cents) : null,
  }
}

interface UsageRow {
  kind: string | null
  quantity: number | string | null
  credits: number | string | null
}

function toNumber(value: number | string | null | undefined): number {
  const n = typeof value === 'string' ? Number(value) : value
  return typeof n === 'number' && Number.isFinite(n) ? n : 0
}

async function readLocalMetering(
  cycle: { start: Date },
  now: Date
): Promise<{ credits: number; agentSeconds: number } | null> {
  if (!isSupabaseAdminConfigured()) return null
  try {
    const db = createAdminClient()
    let credits = 0
    let agentSeconds = 0
    let total: number | null = null
    let offset = 0
    for (let page = 0; page < MAX_PAGES; page++) {
      // Aggregates are disabled on Supabase's PostgREST by default, so the rows
      // are summed here. The upper bound freezes the row set while paging.
      const { data, error, count } = await db
        .from('provider_usage_events')
        .select('kind, quantity, credits', page === 0 ? { count: 'exact' } : undefined)
        .eq('provider', 'cartesia')
        .gte('created_at', cycle.start.toISOString())
        .lt('created_at', now.toISOString())
        .order('created_at', { ascending: true })
        .order('id', { ascending: true })
        .range(offset, offset + PAGE_SIZE - 1)
        .abortSignal(AbortSignal.timeout(DB_TIMEOUT_MS))
      if (error) {
        if (isMissingTable(error)) {
          warnOnce('usage-table', 'provider_usage_events is missing (apply migration 010); local metering disabled')
        } else {
          console.warn('[budget] local metering query failed', describeError(error))
        }
        return null
      }
      if (page === 0 && typeof count === 'number') total = count
      const rows = (data ?? []) as UsageRow[]
      for (const row of rows) {
        credits += toNumber(row.credits)
        if (row.kind === 'agent_seconds') agentSeconds += toNumber(row.quantity)
      }
      offset += rows.length
      const done = total !== null ? offset >= total : rows.length < PAGE_SIZE
      if (done || rows.length === 0) return { credits, agentSeconds }
    }
    warnOnce('usage-pages', `local metering stopped after ${MAX_PAGES * PAGE_SIZE} rows; the estimate is a lower bound`)
    return { credits, agentSeconds }
  } catch (error) {
    console.warn('[budget] local metering failed', describeError(error))
    return null
  }
}

function flagKey(budget: BudgetKind): string {
  return `${FLAG_KEY_PREFIX}${budget}`
}

async function readExhaustionFlags(cycleKey: string): Promise<BudgetInputs['flags']> {
  let dbCredits: string | null = null
  let dbAgent: string | null = null
  if (isSupabaseAdminConfigured()) {
    try {
      const { data, error } = await createAdminClient()
        .from('voice_runtime_state')
        .select('credits_exhausted_cycle, agent_exhausted_cycle')
        .eq('id', true)
        .abortSignal(AbortSignal.timeout(DB_TIMEOUT_MS))
        .maybeSingle()
      if (error) {
        if (isMissingTable(error)) {
          warnOnce('runtime-table', 'voice_runtime_state is missing (apply migration 010); quota flags live in KV only')
        } else {
          console.warn('[budget] reading voice_runtime_state failed', describeError(error))
        }
      } else if (data) {
        const row = data as { credits_exhausted_cycle: string | null; agent_exhausted_cycle: string | null }
        dbCredits = row.credits_exhausted_cycle ?? null
        dbAgent = row.agent_exhausted_cycle ?? null
      }
    } catch (error) {
      console.warn('[budget] reading voice_runtime_state failed', describeError(error))
    }
  }
  // KV flags exist only when the database write failed (see markBudgetExhausted).
  const [kvCredits, kvAgent] = await Promise.all([
    kvGet<string>(flagKey('model_credits')),
    kvGet<string>(flagKey('agent_dollars')),
  ])
  return {
    creditsExhaustedCycle: kvCredits === cycleKey ? kvCredits : dbCredits,
    agentExhaustedCycle: kvAgent === cycleKey ? kvAgent : dbAgent,
  }
}

function isCachedBudget(value: unknown, cycleKey: string): value is CartesiaBudgetState {
  if (!value || typeof value !== 'object') return false
  const v = value as Partial<CartesiaBudgetState>
  return (
    v.cycle_key === cycleKey &&
    typeof v.credits_exhausted === 'boolean' &&
    typeof v.agent_exhausted === 'boolean' &&
    typeof v.credits_remaining === 'number' &&
    typeof v.agent_cents_remaining === 'number'
  )
}

// ─── Public API ──────────────────────────────────────────────────────────────

/** Current budget, cached for 60 s in KV. `fresh` recomputes (ops endpoint, after a quota event). */
export async function getCartesiaBudget(opts: { fresh?: boolean } = {}): Promise<CartesiaBudgetState> {
  const now = new Date()
  const config = budgetConfig()
  const cycle = billingCycle(config.anchor, now)

  if (!opts.fresh) {
    const cached = await kvGet<unknown>(CACHE_KEY)
    // A cache entry from the previous cycle must not keep an exhausted flag alive past renewal.
    if (isCachedBudget(cached, cycle.key)) return cached
  }

  const [admin, local, flags] = await Promise.all([
    readAdminUsage(cycle, now),
    readLocalMetering(cycle, now),
    readExhaustionFlags(cycle.key),
  ])
  if (admin.credits === null && local === null) {
    warnOnce('no-source', 'no Cartesia usage source is available (admin key or provider_usage_events); credits used count as 0')
  }

  const state = computeBudgetState({
    cycle,
    config,
    now,
    adminCredits: admin.credits,
    adminAgentCents: admin.agentCents,
    local,
    flags,
  })
  await kvSet(CACHE_KEY, state, CACHE_TTL_SECONDS)
  return state
}

async function writeRuntimeFlag(budget: BudgetKind, cycleKey: string | null, now: Date): Promise<boolean> {
  if (!isSupabaseAdminConfigured()) return false
  const column = budget === 'model_credits' ? 'credits_exhausted_cycle' : 'agent_exhausted_cycle'
  try {
    // Upsert touches only the listed columns, so the other budget's flag survives.
    const { error } = await createAdminClient()
      .from('voice_runtime_state')
      .upsert({ id: true, [column]: cycleKey, updated_at: now.toISOString() }, { onConflict: 'id' })
      .abortSignal(AbortSignal.timeout(DB_TIMEOUT_MS))
    if (!error) return true
    if (isMissingTable(error)) {
      warnOnce('runtime-table', 'voice_runtime_state is missing (apply migration 010); quota flags live in KV only')
    } else {
      console.warn('[budget] writing voice_runtime_state failed', describeError(error))
    }
  } catch (error) {
    console.warn('[budget] writing voice_runtime_state failed', describeError(error))
  }
  return false
}

/**
 * Cartesia answered quota_exceeded: stop routing to that budget until the
 * cycle renews. The database row is shared by every instance; when it can't be
 * written the flag goes to KV (expiring at the cycle end) so routing still flips.
 */
export async function markBudgetExhausted(budget: BudgetKind): Promise<void> {
  try {
    const now = new Date()
    const cycle = billingCycle(budgetConfig().anchor, now)
    const label = budget === 'model_credits' ? 'model credits' : 'agent dollars'
    console.warn('[budget]', `Cartesia ${label} exhausted for cycle ${cycle.key}; routing away until renewal`)
    const stored = await writeRuntimeFlag(budget, cycle.key, now)
    if (!stored) {
      const ttlSeconds = Math.max(60, Math.ceil((cycle.end.getTime() - now.getTime()) / 1000))
      await kvSet(flagKey(budget), cycle.key, ttlSeconds)
    }
    await kvDel(CACHE_KEY)
  } catch (error) {
    console.warn('[budget] markBudgetExhausted failed', describeError(error))
  }
}

/** Ops escape hatch (e.g. after buying more credits): clears the quota flag for this cycle. */
export async function clearBudgetExhausted(budget: BudgetKind): Promise<void> {
  try {
    await writeRuntimeFlag(budget, null, new Date())
    await kvDel(flagKey(budget))
    await kvDel(CACHE_KEY)
  } catch (error) {
    console.warn('[budget] clearBudgetExhausted failed', describeError(error))
  }
}

interface UsageInsertRow {
  provider: ProviderUsageEvent['provider']
  kind: string
  quantity: number
  credits: number
  cost_cents: number | null
  org_id: string | null
  call_id: string | null
  meta: Record<string, unknown>
}

function toInsertRow(event: ProviderUsageEvent): UsageInsertRow | null {
  if (!event || typeof event !== 'object' || !PROVIDERS.has(event.provider)) return null
  const kind = typeof event.kind === 'string' ? event.kind.trim() : ''
  const quantity = usable(event.quantity)
  if (!kind || quantity === null) return null
  const credits = usable(event.credits) ?? 0
  const costCents = usable(event.cost_cents)
  // Nothing to meter; skip the row instead of storing noise.
  if (quantity === 0 && credits === 0 && !costCents) return null
  const uuidOrNull = (value: string | null | undefined) => (typeof value === 'string' && UUID_RE.test(value) ? value : null)
  const meta = event.meta && typeof event.meta === 'object' && !Array.isArray(event.meta) ? event.meta : {}
  return {
    provider: event.provider,
    kind,
    quantity,
    credits,
    cost_cents: costCents,
    org_id: uuidOrNull(event.org_id),
    call_id: uuidOrNull(event.call_id),
    meta,
  }
}

/** Appends metering rows. Best effort: invalid events are dropped and failures are logged, never thrown. */
export async function recordProviderUsage(events: ProviderUsageEvent[]): Promise<void> {
  try {
    if (!Array.isArray(events) || events.length === 0) return
    const rows = events.map(toInsertRow).filter((row): row is UsageInsertRow => row !== null)
    if (rows.length === 0) return
    if (!isSupabaseAdminConfigured()) {
      warnOnce('usage-no-db', 'Supabase admin is not configured; provider usage is not recorded')
      return
    }
    const db = createAdminClient()
    for (let i = 0; i < rows.length; i += INSERT_BATCH_SIZE) {
      const batch = rows.slice(i, i + INSERT_BATCH_SIZE)
      let result = await db.from('provider_usage_events').insert(batch)
      if (result.error?.code === '23503') {
        // A call or org deleted mid-flight fails the whole batch on its foreign
        // key. The credits still count toward the budget, so keep them unattributed.
        const unattributed = batch.map((row) => ({ ...row, org_id: null, call_id: null }))
        result = await db.from('provider_usage_events').insert(unattributed)
      }
      const { error } = result
      if (!error) continue
      if (isMissingTable(error)) {
        warnOnce('usage-table', 'provider_usage_events is missing (apply migration 010); local metering disabled')
        return
      }
      console.warn('[budget]', `recording ${batch.length} provider usage events failed`, describeError(error))
    }
  } catch (error) {
    console.warn('[budget] recordProviderUsage failed', describeError(error))
  }
}

/** Test hook: forgets which warnings were already logged. */
export function resetBudgetWarningsForTests(): void {
  warned.clear()
}
