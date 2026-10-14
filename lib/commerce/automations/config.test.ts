import { describe, expect, it } from 'vitest'
import type { CommerceCapabilities } from '../types'
import { AutomationConfigSchema, AutomationScriptSchema, CONSENT_TEXT, CONSENT_VERSION, automationAvailability, defaultConfig, defaultScript } from './config'

const CAPS: CommerceCapabilities = { products: true, customers: true, orders: true, webhooks: true, abandoned_carts: true, customer_phone: true, polling_minutes: null, notes: [] }
const ROMANIAN = /[ăâîșțĂÂÎȘȚ]/

describe('automation consent', () => {
  it('records the English wording under its own version (the earlier Romanian wording keeps 2026-10-v1)', () => {
    expect(CONSENT_VERSION).toBe('2026-10-v2')
    expect(CONSENT_TEXT).toMatch(/^I confirm that I have a lawful basis/)
    expect(CONSENT_TEXT).toContain('AI assistant')
    expect(CONSENT_TEXT).not.toMatch(ROMANIAN)
  })
})

describe('automation availability', () => {
  it('explains in English what the connection lacks', () => {
    expect(automationAvailability('cod_confirmation', { ...CAPS, orders: false })).toEqual({ available: false, reason: 'The connection cannot read orders.' })
    expect(automationAvailability('order_follow_up', { ...CAPS, customer_phone: false })).toEqual({ available: false, reason: 'The platform does not provide customer phone numbers for this connection.' })
    expect(automationAvailability('abandoned_cart', { ...CAPS, abandoned_carts: false })).toEqual({ available: false, reason: 'The platform does not send abandoned-cart events with the customer phone number.' })
    expect(automationAvailability('abandoned_cart', CAPS)).toEqual({ available: true, reason: null })
  })

  it("prefers the adapter's own note about carts over the generic line, and only a note about carts", () => {
    const carts = 'Abandoned carts are not part of the standard WooCommerce API: they appear only after the companion plugin is installed.'
    const unrelated = 'The key cannot read the store settings (name, currency, country).'
    // A note that merely starts a word with "cart"/"cos" is not about carts.
    const lookalike = 'Carting the catalog costs one request per product: products are refreshed every 15 minutes.'
    expect(automationAvailability('abandoned_cart', { ...CAPS, abandoned_carts: false, notes: [unrelated, carts] }).reason).toBe(carts)
    expect(automationAvailability('abandoned_cart', { ...CAPS, abandoned_carts: false, notes: [unrelated, lookalike] }).reason).toBe('The platform does not send abandoned-cart events with the customer phone number.')
    expect(automationAvailability('abandoned_cart', { ...CAPS, abandoned_carts: false, notes: [unrelated] }).reason).toBe('The platform does not send abandoned-cart events with the customer phone number.')
  })
})

describe('automation schemas', () => {
  it('accepts the defaults and reports validation problems in English', () => {
    expect(AutomationConfigSchema.safeParse(defaultConfig('cod_confirmation')).success).toBe(true)
    expect(AutomationScriptSchema.safeParse(defaultScript('cod_confirmation', 'Shop')).success).toBe(true)
    const badWindow = AutomationConfigSchema.safeParse({ ...defaultConfig('cod_confirmation'), call_window: { start: '20:00', end: '09:00', days: [] } })
    expect(badWindow.success).toBe(false)
    const windowMessages = badWindow.success ? [] : badWindow.error.issues.map((i) => i.message)
    expect(windowMessages).toContain('Choose at least one day')
    expect(windowMessages).toContain('Start time must be before end time')
    const badScript = AutomationScriptSchema.safeParse({ ...defaultScript('cod_confirmation'), template: 'Hello {{customer_name}}, this is {{ntv_call_id}} calling.', transfer_number: '0712345678' })
    expect(badScript.success).toBe(false)
    const scriptMessages = badScript.success ? [] : badScript.error.issues.map((i) => i.message)
    expect(scriptMessages.some((m) => m.startsWith('Only the variables {{store_name}}'))).toBe(true)
    expect(scriptMessages).toContain('Use the international format, e.g. +40712345678')
    for (const m of [...windowMessages, ...scriptMessages]) expect(m).not.toMatch(ROMANIAN)
  })
})
