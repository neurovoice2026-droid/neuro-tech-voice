import { describe, expect, it } from 'vitest'
import { defaultConfig } from './config'
import { evaluate, insideCallWindow, localDayBounds, nextCallSlot, type AutomationState, type OrderFacts } from './eligibility'

const TZ = 'Europe/Bucharest'
const enabledAt = '2026-10-01T00:00:00Z'
const automation = (over: Partial<AutomationState> = {}): AutomationState => ({ enabled: true, enabled_at: enabledAt, consent_confirmed_at: '2026-10-01T00:00:00Z', config: defaultConfig('cod_confirmation'), ...over })
const order = (over: Partial<OrderFacts> = {}): OrderFacts => ({
  status: 'processing',
  financial_status: 'pending',
  fulfillment_status: 'unfulfilled',
  is_cod: true,
  total: 189.9,
  contact_phone_e164: '+40722123456',
  provider_created_at: '2026-10-13T08:00:00Z',
  ...over,
})
// A Tuesday, 11:00 in Bucharest (summer time, UTC+3).
const now = new Date('2026-10-13T08:00:00Z')

describe('COD confirmation eligibility', () => {
  it('schedules an eligible COD order after the delay, inside the window', () => {
    const v = evaluate({ type: 'cod_confirmation', automation: automation(), timezone: TZ, now, suppressed: false, order: order() })
    expect(v).toMatchObject({ eligible: true, phone: '+40722123456' })
    if (v.eligible) expect(v.scheduledFor.toISOString()).toBe('2026-10-13T08:15:00.000Z')
  })
  it('refuses disabled, unconsented, suppressed, phoneless, historical, non-COD and closed orders', () => {
    const cases: Array<[Parameters<typeof evaluate>[0], string]> = [
      [{ type: 'cod_confirmation', automation: automation({ enabled: false }), timezone: TZ, now, suppressed: false, order: order() }, 'automation_disabled'],
      [{ type: 'cod_confirmation', automation: automation({ consent_confirmed_at: null }), timezone: TZ, now, suppressed: false, order: order() }, 'no_consent'],
      [{ type: 'cod_confirmation', automation: automation(), timezone: TZ, now, suppressed: true, order: order() }, 'do_not_call'],
      [{ type: 'cod_confirmation', automation: automation(), timezone: TZ, now, suppressed: false, order: order({ contact_phone_e164: null }) }, 'no_phone'],
      [{ type: 'cod_confirmation', automation: automation(), timezone: TZ, now, suppressed: false, order: order({ provider_created_at: '2026-09-01T00:00:00Z' }) }, 'before_enabled'],
      [{ type: 'cod_confirmation', automation: automation({ enabled_at: null }), timezone: TZ, now, suppressed: false, order: order() }, 'before_enabled'],
      [{ type: 'cod_confirmation', automation: automation(), timezone: TZ, now, suppressed: false, order: order({ is_cod: false }) }, 'not_cod'],
      [{ type: 'cod_confirmation', automation: automation(), timezone: TZ, now, suppressed: false, order: order({ status: 'cancelled' }) }, 'order_not_open'],
      [{ type: 'cod_confirmation', automation: automation(), timezone: TZ, now, suppressed: false, order: order({ financial_status: 'paid' }) }, 'order_not_open'],
      [{ type: 'cod_confirmation', automation: automation(), timezone: TZ, now, suppressed: false, order: order({ fulfillment_status: 'fulfilled' }) }, 'order_not_open'],
      [{ type: 'cod_confirmation', automation: automation({ config: { ...defaultConfig('cod_confirmation'), min_order_total: 200 } }), timezone: TZ, now, suppressed: false, order: order() }, 'below_min_total'],
    ]
    for (const [input, reason] of cases) expect(evaluate(input), reason).toEqual({ eligible: false, reason })
  })
})

describe('follow-up and abandoned cart eligibility', () => {
  it('follows up only when the chosen status is reached and the order is not cancelled', () => {
    const a = automation({ config: defaultConfig('order_follow_up') })
    expect(evaluate({ type: 'order_follow_up', automation: a, timezone: TZ, now, suppressed: false, order: order() })).toEqual({ eligible: false, reason: 'status_mismatch' })
    expect(evaluate({ type: 'order_follow_up', automation: a, timezone: TZ, now, suppressed: false, order: order({ fulfillment_status: 'fulfilled', is_cod: false }) })).toMatchObject({ eligible: true })
    expect(evaluate({ type: 'order_follow_up', automation: a, timezone: TZ, now, suppressed: false, order: order({ status: 'cancelled', fulfillment_status: 'fulfilled' }) })).toEqual({ eligible: false, reason: 'order_not_open' })
  })
  it('calls an abandoned cart no earlier than 30 minutes after the event, never a recovered one', () => {
    const a = automation({ config: { ...defaultConfig('abandoned_cart'), delay_minutes: 5 } })
    const cart = { status: 'abandoned' as const, total: 100, contact_phone_e164: '+40722123456', abandoned_at: '2026-10-13T08:00:00Z', provider_updated_at: null, created_at: null }
    const v = evaluate({ type: 'abandoned_cart', automation: a, timezone: TZ, now, suppressed: false, cart })
    expect(v).toMatchObject({ eligible: true })
    if (v.eligible) expect(v.scheduledFor.toISOString()).toBe('2026-10-13T08:30:00.000Z')
    expect(evaluate({ type: 'abandoned_cart', automation: a, timezone: TZ, now, suppressed: false, cart: { ...cart, status: 'recovered' } })).toEqual({ eligible: false, reason: 'cart_recovered' })
    expect(evaluate({ type: 'abandoned_cart', automation: a, timezone: TZ, now, suppressed: false, cart: { ...cart, contact_phone_e164: null } })).toEqual({ eligible: false, reason: 'no_phone' })
  })
  it('never calls a cart the store still reports as open (checkout in progress) or as expired', () => {
    const a = automation({ config: defaultConfig('abandoned_cart') })
    const cart = { status: 'open' as const, total: 100, contact_phone_e164: '+40722123456', abandoned_at: null, provider_updated_at: '2026-10-13T08:00:00Z', created_at: '2026-10-13T07:55:00Z' }
    expect(evaluate({ type: 'abandoned_cart', automation: a, timezone: TZ, now, suppressed: false, cart })).toEqual({ eligible: false, reason: 'cart_not_abandoned' })
    expect(evaluate({ type: 'abandoned_cart', automation: a, timezone: TZ, now, suppressed: false, cart: { ...cart, status: 'expired' } })).toEqual({ eligible: false, reason: 'cart_not_abandoned' })
    expect(evaluate({ type: 'abandoned_cart', automation: a, timezone: TZ, now, suppressed: false, cart: { ...cart, status: 'abandoned', abandoned_at: '2026-10-13T08:00:00Z' } })).toMatchObject({ eligible: true })
  })
})

describe('call window', () => {
  const cfg = defaultConfig('cod_confirmation') // 09:00–20:00 Mon–Sat
  it('keeps an instant inside the window and defers evenings, nights and Sundays', () => {
    const inWindow = new Date('2026-10-13T08:00:00Z') // Tue 11:00 local
    expect(nextCallSlot(inWindow, cfg, TZ)).toEqual(inWindow)
    expect(insideCallWindow(inWindow, cfg, TZ)).toBe(true)
    // Tue 21:30 local → Wed 09:00 local (06:00Z)
    expect(nextCallSlot(new Date('2026-10-13T18:30:00Z'), cfg, TZ).toISOString()).toBe('2026-10-14T06:00:00.000Z')
    // Tue 03:00 local → Tue 09:00 local
    expect(nextCallSlot(new Date('2026-10-13T00:00:00Z'), cfg, TZ).toISOString()).toBe('2026-10-13T06:00:00.000Z')
    // Sunday 12:00 local → Monday 09:00 local
    expect(nextCallSlot(new Date('2026-10-18T09:00:00Z'), cfg, TZ).toISOString()).toBe('2026-10-19T06:00:00.000Z')
    // Saturday 19:59 local is still inside
    expect(insideCallWindow(new Date('2026-10-17T16:59:00Z'), cfg, TZ)).toBe(true)
    expect(insideCallWindow(new Date('2026-10-17T17:00:00Z'), cfg, TZ)).toBe(false)
  })
  it('uses the window time zone over the organization zone and bounds the local day', () => {
    const utcCfg = { ...cfg, timezone: 'UTC' }
    expect(nextCallSlot(new Date('2026-10-13T10:00:00Z'), utcCfg, TZ)).toEqual(new Date('2026-10-13T10:00:00Z'))
    // 08:00 UTC is before the UTC window even though it is 11:00 in Bucharest.
    expect(nextCallSlot(new Date('2026-10-13T08:00:00Z'), utcCfg, TZ).toISOString()).toBe('2026-10-13T09:00:00.000Z')
    expect(nextCallSlot(new Date('2026-10-13T20:30:00Z'), utcCfg, TZ).toISOString()).toBe('2026-10-14T09:00:00.000Z')
    const bounds = localDayBounds(new Date('2026-10-13T08:00:00Z'), cfg, TZ)
    expect(bounds.start.toISOString()).toBe('2026-10-12T21:00:00.000Z')
    expect(bounds.end.toISOString()).toBe('2026-10-13T21:00:00.000Z')
  })
})
