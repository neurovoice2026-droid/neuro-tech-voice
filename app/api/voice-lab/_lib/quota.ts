// Voice Lab monthly allowances. Pure (quota.test.ts): the period, the
// arithmetic and the headers the routes return.

export interface UsagePeriod {
  start: Date
  end: Date
}

/**
 * The organisation's billing period when it is set and covers `now`;
 * otherwise the current calendar month in UTC (trials, orgs created before
 * migration 010, or a period the daily cron hasn't rolled yet).
 */
export function toolUsagePeriod(
  org: { usage_period_start: string | null; usage_period_end: string | null },
  now: Date = new Date()
): UsagePeriod {
  const start = org.usage_period_start ? Date.parse(org.usage_period_start) : NaN
  const end = org.usage_period_end ? Date.parse(org.usage_period_end) : NaN
  const t = now.getTime()
  if (Number.isFinite(start) && Number.isFinite(end) && start < end && start <= t && t < end) {
    return { start: new Date(start), end: new Date(end) }
  }
  return {
    start: new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1)),
    end: new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1)),
  }
}

export interface QuotaState {
  limit: number
  used: number
  remaining: number
}

function clean(value: number): number {
  return Number.isFinite(value) && value > 0 ? value : 0
}

/** Used amounts keep two decimals (STT seconds); remaining never goes negative. */
export function quotaState(limit: number, used: number): QuotaState {
  const safeLimit = Math.floor(clean(limit))
  const safeUsed = Math.round(clean(used) * 100) / 100
  return {
    limit: safeLimit,
    used: safeUsed,
    remaining: Math.max(0, Math.round((safeLimit - safeUsed) * 100) / 100),
  }
}

/** Whether `amount` more fits in the allowance. A zero amount still needs something left. */
export function canConsume(state: QuotaState, amount: number): boolean {
  if (state.limit <= 0 || state.remaining <= 0) return false
  return clean(amount) <= state.remaining
}

/** Rows from provider_usage_events; PostgREST may return numerics as strings. */
export function sumQuantities(rows: readonly { quantity: number | string | null }[]): number {
  let total = 0
  for (const row of rows) {
    const value = typeof row.quantity === 'string' ? Number(row.quantity) : row.quantity
    if (typeof value === 'number' && Number.isFinite(value) && value > 0) total += value
  }
  return Math.round(total * 100) / 100
}

export function quotaHeaders(state: QuotaState, period: UsagePeriod): Record<string, string> {
  return {
    'X-Quota-Limit': String(state.limit),
    'X-Quota-Used': String(state.used),
    'X-Quota-Remaining': String(state.remaining),
    'X-Quota-Resets-At': period.end.toISOString(),
  }
}

/** Duration to charge for a transcription: Cartesia's number, else our own measurement, rounded up to 0.01 s. */
export function billableSeconds(reported: number | null | undefined, measured: number | null | undefined): number {
  const value = typeof reported === 'number' && Number.isFinite(reported) && reported > 0
    ? reported
    : typeof measured === 'number' && Number.isFinite(measured) && measured > 0
      ? measured
      : 0
  return Math.ceil(value * 100) / 100
}
