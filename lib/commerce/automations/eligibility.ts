// Eligibility and scheduling rules of the automations. Pure: the scheduler
// (DB) and the dispatcher (re-check before dialing) both call these, so one
// rule set decides whether a customer may be called and when.

import { WEEKDAYS, type Weekday, addDays, localDateOf, parseClock, safeTimeZone, wallTimeInZone, weekdayOf, zonedWallTimeToUtc } from '@/lib/scheduling/time'
import type { AutomationConfig, AutomationType, FinancialStatus, FulfillmentStatus, OrderStatus } from '../types'
import { ABANDONED_CART_MIN_DELAY_MINUTES } from './config'

export type IneligibleReason =
  | 'automation_disabled'
  | 'no_consent'
  | 'before_enabled'
  | 'not_cod'
  | 'order_not_open'
  | 'status_mismatch'
  | 'no_phone'
  | 'do_not_call'
  | 'below_min_total'
  | 'cart_not_abandoned'
  | 'cart_recovered'

export const INELIGIBLE_LABELS: Record<IneligibleReason, string> = {
  automation_disabled: 'Automatizarea este oprită',
  no_consent: 'Consimțământul nu a fost confirmat',
  before_enabled: 'Comandă anterioară activării',
  not_cod: 'Nu este plată ramburs',
  order_not_open: 'Comanda este anulată, plătită sau livrată',
  status_mismatch: 'Statusul comenzii nu este cel ales',
  no_phone: 'Fără număr de telefon valid',
  do_not_call: 'Clientul a cerut să nu fie sunat',
  below_min_total: 'Sub valoarea minimă configurată',
  cart_not_abandoned: 'Coșul nu este abandonat',
  cart_recovered: 'Clientul a finalizat comanda',
}

/** Reasons that produce a visible 'suppressed' run (the merchant should see them); the others produce nothing. */
export const SUPPRESSION_REASONS: ReadonlySet<IneligibleReason> = new Set(['no_phone', 'do_not_call'])

export interface AutomationState {
  enabled: boolean
  enabled_at: string | null
  consent_confirmed_at: string | null
  config: AutomationConfig
}

export interface OrderFacts {
  status: OrderStatus
  financial_status: FinancialStatus
  fulfillment_status: FulfillmentStatus
  is_cod: boolean
  total: number | null
  contact_phone_e164: string | null
  provider_created_at: string | null
}

export interface CartFacts {
  status: 'open' | 'abandoned' | 'recovered' | 'expired'
  total: number | null
  contact_phone_e164: string | null
  abandoned_at: string | null
  provider_updated_at: string | null
  created_at: string | null
}

export type Verdict =
  | { eligible: true; phone: string; scheduledFor: Date }
  | { eligible: false; reason: IneligibleReason }

/** An order that may still be confirmed or followed up (not cancelled, refunded, paid online or shipped). */
export function orderOpenForCod(o: OrderFacts): boolean {
  if (['cancelled', 'refunded', 'failed', 'draft', 'completed'].includes(o.status)) return false
  if (['paid', 'refunded', 'partially_refunded', 'voided'].includes(o.financial_status)) return false
  if (['fulfilled', 'cancelled'].includes(o.fulfillment_status)) return false
  return true
}

function orderCancelledOrRefunded(o: OrderFacts): boolean {
  return ['cancelled', 'refunded', 'failed'].includes(o.status) || ['refunded', 'voided'].includes(o.financial_status) || o.fulfillment_status === 'cancelled'
}

/** True when the order reached the merchant's follow-up status ('fulfilled' = shipped/delivered or completed). */
export function matchesFollowUpStatus(o: OrderFacts, wanted: AutomationConfig['follow_up_status']): boolean {
  if (wanted === 'fulfilled') return o.fulfillment_status === 'fulfilled' || o.status === 'completed'
  return o.status === wanted
}

function afterEnabled(automation: AutomationState, createdAt: string | null): boolean {
  const enabledAt = automation.enabled_at ? Date.parse(automation.enabled_at) : NaN
  const created = createdAt ? Date.parse(createdAt) : NaN
  // Unknown creation time: never dial (an import must not call historical orders).
  if (!Number.isFinite(enabledAt) || !Number.isFinite(created)) return false
  return created >= enabledAt
}

function commonGate(automation: AutomationState, phone: string | null, suppressed: boolean): IneligibleReason | null {
  if (!automation.enabled) return 'automation_disabled'
  if (!automation.consent_confirmed_at) return 'no_consent'
  if (!phone) return 'no_phone'
  if (suppressed) return 'do_not_call'
  return null
}

export interface EvaluateInput {
  type: AutomationType
  automation: AutomationState
  /** The organization's time zone (the window's own zone wins when set). */
  timezone: string
  now: Date
  /** Customer or phone asked not to be called. */
  suppressed: boolean
  order?: OrderFacts | null
  cart?: CartFacts | null
  /** Order status before this event (null = new or unknown). */
  previousStatus?: OrderStatus | null
}

/** Decides whether an order/cart event creates a run, and when it may be dialed. */
export function evaluate(input: EvaluateInput): Verdict {
  const { automation, type } = input
  const cfg = automation.config
  if (type === 'abandoned_cart') {
    const cart = input.cart
    if (!cart) return { eligible: false, reason: 'cart_not_abandoned' }
    const gate = commonGate(automation, cart.contact_phone_e164, input.suppressed)
    if (gate) return { eligible: false, reason: gate }
    if (cart.status === 'recovered') return { eligible: false, reason: 'cart_recovered' }
    // 'open' is a checkout still in progress (the customer is shopping); only a cart the store reports as abandoned is called.
    if (cart.status !== 'abandoned') return { eligible: false, reason: 'cart_not_abandoned' }
    const startedAt = cart.abandoned_at ?? cart.provider_updated_at ?? cart.created_at
    if (!afterEnabled(automation, startedAt)) return { eligible: false, reason: 'before_enabled' }
    if (cfg.min_order_total !== null && (cart.total ?? 0) < cfg.min_order_total) return { eligible: false, reason: 'below_min_total' }
    const base = Math.max(input.now.getTime(), Date.parse(startedAt as string))
    const delay = Math.max(cfg.delay_minutes, ABANDONED_CART_MIN_DELAY_MINUTES)
    return { eligible: true, phone: cart.contact_phone_e164 as string, scheduledFor: nextCallSlot(new Date(base + delay * 60_000), cfg, input.timezone) }
  }

  const order = input.order
  if (!order) return { eligible: false, reason: 'order_not_open' }
  const gate = commonGate(automation, order.contact_phone_e164, input.suppressed)
  if (gate) return { eligible: false, reason: gate }
  if (!afterEnabled(automation, order.provider_created_at)) return { eligible: false, reason: 'before_enabled' }
  if (cfg.min_order_total !== null && (order.total ?? 0) < cfg.min_order_total) return { eligible: false, reason: 'below_min_total' }

  if (type === 'cod_confirmation') {
    if (!order.is_cod) return { eligible: false, reason: 'not_cod' }
    if (!orderOpenForCod(order)) return { eligible: false, reason: 'order_not_open' }
  } else {
    if (orderCancelledOrRefunded(order)) return { eligible: false, reason: 'order_not_open' }
    if (!matchesFollowUpStatus(order, cfg.follow_up_status)) return { eligible: false, reason: 'status_mismatch' }
  }
  const base = Math.max(input.now.getTime(), Date.parse(order.provider_created_at as string))
  return { eligible: true, phone: order.contact_phone_e164 as string, scheduledFor: nextCallSlot(new Date(base + cfg.delay_minutes * 60_000), cfg, input.timezone) }
}

/** Whether a scheduled COD run should be cancelled after an order update. */
export function codRunObsolete(order: OrderFacts): boolean {
  return !orderOpenForCod(order)
}

export function windowTimeZone(cfg: AutomationConfig, orgTimezone: string): string {
  return safeTimeZone(cfg.timezone ?? orgTimezone)
}

/**
 * The first instant at or after `earliest` inside the call window (local
 * days and hours); `earliest` itself when it already is. Never more than
 * two weeks ahead (a window with no valid day falls back to `earliest`).
 */
export function nextCallSlot(earliest: Date, cfg: AutomationConfig, orgTimezone: string): Date {
  const tz = windowTimeZone(cfg, orgTimezone)
  const start = parseClock(cfg.call_window.start) ?? 9 * 60
  const end = parseClock(cfg.call_window.end) ?? 20 * 60
  const days = new Set<Weekday>(cfg.call_window.days.filter((d): d is Weekday => (WEEKDAYS as readonly string[]).includes(d)))
  if (!days.size || start >= end) return earliest
  const ms = earliest.getTime()
  const wall = wallTimeInZone(ms, tz)
  const minuteOfDay = wall.hour * 60 + wall.minute
  let date = localDateOf(ms, tz)
  if (days.has(weekdayOf(date)) && minuteOfDay >= start && minuteOfDay < end) return earliest
  // Today after the window, or a day off: the next allowed day's window start.
  if (!(days.has(weekdayOf(date)) && minuteOfDay < start)) date = addDays(date, 1)
  for (let i = 0; i < 14; i++) {
    if (days.has(weekdayOf(date))) {
      const utc = zonedWallTimeToUtc({ ...date, hour: Math.floor(start / 60), minute: start % 60 }, tz)
      if (utc !== null && utc >= ms) return new Date(utc)
    }
    date = addDays(date, 1)
  }
  return earliest
}

/** True when `at` is inside the call window (used by the dispatcher before dialing). */
export function insideCallWindow(at: Date, cfg: AutomationConfig, orgTimezone: string): boolean {
  return nextCallSlot(at, cfg, orgTimezone).getTime() === at.getTime()
}

/** UTC bounds of the local day containing `at` (daily caps count within them). */
export function localDayBounds(at: Date, cfg: AutomationConfig, orgTimezone: string): { start: Date; end: Date } {
  const tz = windowTimeZone(cfg, orgTimezone)
  const date = localDateOf(at.getTime(), tz)
  const start = zonedWallTimeToUtc({ ...date, hour: 0, minute: 0 }, tz) ?? at.getTime()
  const next = addDays(date, 1)
  const end = zonedWallTimeToUtc({ ...next, hour: 0, minute: 0 }, tz) ?? start + 24 * 3_600_000
  return { start: new Date(start), end: new Date(end) }
}
