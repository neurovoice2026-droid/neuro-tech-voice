import { describe, expect, it } from 'vitest'
import {
  AUTOMATION_TYPE_DESCRIPTION,
  AUTOMATION_TYPE_LABEL,
  CONNECTION_STATUSES,
  CONNECTION_STATUS_LABEL,
  CONNECTION_STATUS_TONE,
  CONSENT_TEXT,
  ENABLE_BLOCKED_REASON,
  FINANCIAL_STATUSES,
  FINANCIAL_STATUS_LABEL,
  FOLLOW_UP_STATUS_LABEL,
  FULFILLMENT_STATUSES,
  FULFILLMENT_STATUS_LABEL,
  OAUTH_ERRORS,
  ORDER_STATUSES,
  ORDER_STATUS_LABEL,
  ORDER_STATUS_TONE,
  PRODUCT_STATUSES,
  PRODUCT_STATUS_LABEL,
  RUN_OUTCOMES,
  RUN_OUTCOME_LABEL,
  RUN_OUTCOME_TONE,
  RUN_STATUSES,
  RUN_STATUS_LABEL,
  RUN_STATUS_TONE,
  SCRIPT_VARIABLES,
  STOCK_STATUSES,
  STOCK_STATUS_LABEL,
  STOCK_STATUS_TONE,
  STORE_PATHS,
  SUPPRESSION_SOURCES,
  SUPPRESSION_SOURCE_LABEL,
  SYNC_KIND_LABEL,
  SYNC_RESOURCE_LABEL,
  SYNC_STATUSES,
  SYNC_STATUS_LABEL,
  TONE_LABEL,
  WEEKDAY_LABEL,
  WEEKDAY_SHORT,
  automationHref,
  awaitsStoreSentEvents,
  connectionStatusLabel,
  WEBHOOK_ADDRESS_HINT,
  oauthErrorMessage,
  resourceCount,
  runOutcomeLabel,
  runReferenceLabel,
  runStatusLabel,
  runStatusReason,
  runSubjectLabel,
  runSummaryLine,
  runWhen,
  suppressionSourceLabel,
} from '@/components/commerce/labels'
import { MINUTES_SKIP_REASON, MINUTES_WAIT_REASON } from '@/lib/commerce/automations/dispatch'
import { CONSENT_TEXT as RECORDED_CONSENT_TEXT } from '@/lib/commerce/automations/config'
import { SCRIPT_VARIABLES as SERVER_SCRIPT_VARIABLES } from '@/lib/commerce/prompt'
import { OAUTH_ERROR_CODES } from '@/lib/commerce/shopify-state'
import { AUTOMATION_TYPES } from '@/lib/commerce/types'
import { WEEKDAYS } from '@/lib/scheduling/time'

// Guards the copy the compiler cannot: a total map with a blank or a
// Romanian leftover still type-checks. Every map is checked against its
// value list (same length, every key present, non-empty label), the labels
// are English (no Romanian diacritics, no pre-translation words), American
// like the rest of the app, and the chips read in sentence case like the
// rest of the dashboard.

/**
 * Romanian diacritics (comma-below and cedilla forms) or the words the
 * pre-translation copy used. Only forms that do not exist in English:
 * "clientul"/"clienti" are Romanian, "client" is a word the English
 * labels may use. The three stems take any ending ("Sincronizare",
 * "Conexiuni", "Automatizări"); no English word starts with them.
 */
const ROMANIAN = /[ăâîșşțţĂÂÎȘŞȚŢ]|\b(comand[aă]|clien[țt](?:i|ul|ii)|magazin|apel|sincroniz\w*|conexiun\w*|automatiz\w*|confirm[aă]t[aă]|programat|finalizat|anulat|neconfigurat|esuat|platit)\b/i

/** British spellings the vertical once used; the app writes American English ("canceled", "honor"). */
const BRITISH = /\b(cancelled|cancelling|honours?|honoured|colours?|catalogue|organis(e|ed|ation)|customis(e|ed)|recognis(e|ed)|licence)\b/i

function expectTotal<K extends string>(map: Record<K, string>, values: readonly K[]) {
  expect(Object.keys(map).sort()).toEqual([...values].sort())
  for (const value of values) {
    expect(map[value].trim().length, `label for ${value}`).toBeGreaterThan(0)
    expect(map[value], `label for ${value} is English`).not.toMatch(ROMANIAN)
    expect(map[value], `label for ${value} is American English`).not.toMatch(BRITISH)
  }
}

function expectTotalTone<K extends string>(map: Record<K, string>, values: readonly K[]) {
  expect(Object.keys(map).sort()).toEqual([...values].sort())
  for (const value of values) expect(map[value]).toMatch(/^(neutral|muted|brand|success|warning|danger|info|outline)$/)
}

/** Chip labels start with a capital and never shout (no "ALL CAPS", no "Title Case Of Every Word"). */
function expectSentenceCase(map: Record<string, string>) {
  for (const [key, label] of Object.entries(map)) {
    expect(label, `${key}: capitalised`).toMatch(/^[A-Z]/)
    expect(label, `${key}: not all caps`).not.toMatch(/^[A-Z]{3,}$/)
  }
}

describe('commerce labels are total', () => {
  it('run statuses', () => {
    expectTotal(RUN_STATUS_LABEL, RUN_STATUSES)
    expectTotalTone(RUN_STATUS_TONE, RUN_STATUSES)
    expectSentenceCase(RUN_STATUS_LABEL)
    expect(RUN_STATUS_LABEL).toEqual({
      eligible: 'Eligible',
      scheduled: 'Scheduled',
      calling: 'Calling',
      completed: 'Completed',
      suppressed: 'Suppressed',
      skipped: 'Skipped',
      failed: 'Failed',
      retry_waiting: 'Retrying',
      cancelled: 'Canceled',
    })
  })

  it('prints why a run waits or was skipped for lack of minutes, not only why it was suppressed', () => {
    expect(runStatusReason({ status: 'scheduled', eligibility_reason: MINUTES_WAIT_REASON })).toBe(MINUTES_WAIT_REASON)
    expect(runStatusReason({ status: 'skipped', eligibility_reason: MINUTES_SKIP_REASON })).toBe(MINUTES_SKIP_REASON)
    expect(runStatusReason({ status: 'suppressed', eligibility_reason: 'Customer opted out' })).toBe('Customer opted out')
    expect(runStatusReason({ status: 'scheduled', eligibility_reason: null })).toBeNull()
    expect(runStatusReason({ status: 'skipped', eligibility_reason: '  ' })).toBeNull()
    // A reason left over from an earlier wait is not shown once the run moved on.
    expect(runStatusReason({ status: 'completed', eligibility_reason: MINUTES_WAIT_REASON })).toBeNull()
    // The skip reason fits every plan: a trial can neither buy minutes nor turn on auto top-up.
    expect(MINUTES_SKIP_REASON).toBe('Out of call minutes for 24 hours, so this call was skipped. Add minutes on the Billing page to keep store calls running.')
    expect(MINUTES_SKIP_REASON).not.toMatch(/buy extra minutes|auto top-up/i)
  })

  it('run outcomes', () => {
    expectTotal(RUN_OUTCOME_LABEL, RUN_OUTCOMES)
    expectTotalTone(RUN_OUTCOME_TONE, RUN_OUTCOMES)
    expectSentenceCase(RUN_OUTCOME_LABEL)
    expect(RUN_OUTCOME_LABEL).toEqual({
      confirmed: 'Confirmed',
      not_confirmed: 'Not confirmed',
      callback_requested: 'Callback requested',
      voicemail: 'Voicemail',
      no_answer: 'No answer',
      opted_out: 'Opted out',
      failed: 'Failed',
    })
  })

  it('connection statuses', () => {
    expectTotal(CONNECTION_STATUS_LABEL, CONNECTION_STATUSES)
    expectTotalTone(CONNECTION_STATUS_TONE, CONNECTION_STATUSES)
    expectSentenceCase(CONNECTION_STATUS_LABEL)
    expect(CONNECTION_STATUS_LABEL).toEqual({
      draft: 'Not set up',
      connecting: 'Connecting',
      active: 'Connected',
      degraded: 'Connected with issues',
      disconnected: 'Disconnected',
      error: 'Error',
    })
  })

  it('records, sync, automations and sources', () => {
    expectTotal(ORDER_STATUS_LABEL, ORDER_STATUSES)
    expectTotalTone(ORDER_STATUS_TONE, ORDER_STATUSES)
    expectTotal(FINANCIAL_STATUS_LABEL, FINANCIAL_STATUSES)
    expectTotal(FULFILLMENT_STATUS_LABEL, FULFILLMENT_STATUSES)
    expectTotal(PRODUCT_STATUS_LABEL, PRODUCT_STATUSES)
    expectTotal(STOCK_STATUS_LABEL, STOCK_STATUSES)
    expectTotalTone(STOCK_STATUS_TONE, STOCK_STATUSES)
    expectTotal(SYNC_STATUS_LABEL, SYNC_STATUSES)
    expectTotal(SYNC_KIND_LABEL, ['initial', 'incremental', 'manual', 'recovery'])
    expectTotal(SYNC_RESOURCE_LABEL, ['all', 'products', 'customers', 'orders', 'carts'])
    expectTotal(SUPPRESSION_SOURCE_LABEL, SUPPRESSION_SOURCES)
    expectTotal(AUTOMATION_TYPE_LABEL, AUTOMATION_TYPES)
    expectTotal(AUTOMATION_TYPE_DESCRIPTION, AUTOMATION_TYPES)
    expectTotal(WEEKDAY_LABEL, WEEKDAYS)
    expectTotal(WEEKDAY_SHORT, WEEKDAYS)
    expectTotal(TONE_LABEL, ['formal', 'friendly'])
    expectTotal(FOLLOW_UP_STATUS_LABEL, [...ORDER_STATUSES, 'fulfilled'])
    expectSentenceCase(ORDER_STATUS_LABEL)
    expectSentenceCase(STOCK_STATUS_LABEL)
    expectSentenceCase(PRODUCT_STATUS_LABEL)
    expect(ORDER_STATUS_LABEL.on_hold).toBe('On hold')
    expect(STOCK_STATUS_LABEL.out_of_stock).toBe('Out of stock')
    expect(SUPPRESSION_SOURCE_LABEL.customer_opt_out).toBe('Customer asked')
    expect(AUTOMATION_TYPE_LABEL).toEqual({ cod_confirmation: 'COD confirmation', abandoned_cart: 'Abandoned cart', order_follow_up: 'Order follow-up' })
    expect(WEEKDAY_LABEL.monday).toBe('Monday')
    expect(WEEKDAY_SHORT.monday).toBe('Mon')
    expect(ORDER_STATUS_LABEL.cancelled).toBe('Canceled')
    expect(SYNC_STATUS_LABEL.cancelled).toBe('Sync canceled')
    expect(FULFILLMENT_STATUS_LABEL.cancelled).toBe('Fulfillment canceled')
  })

  it('explains every Shopify callback code the server can send, and never echoes an unknown one at length', () => {
    for (const code of OAUTH_ERROR_CODES) {
      expect(OAUTH_ERRORS[code]?.length, code).toBeGreaterThan(10)
      expect(OAUTH_ERRORS[code], code).not.toMatch(ROMANIAN)
      expect(oauthErrorMessage(code)).toBe(OAUTH_ERRORS[code])
    }
    expect(oauthErrorMessage('access_denied')).toBe('The app install was declined in Shopify. You can try again whenever you are ready.')
    expect(oauthErrorMessage('x'.repeat(100))).toBe(`The Shopify connection failed (code: ${'x'.repeat(40)}).`)
  })

  it('pairs every enable-blocked reason of the contract with a Store section link (the text itself is the route’s)', () => {
    for (const reason of ['no_consent', 'unavailable', 'agent_inactive', 'no_phone_number', 'encryption_not_configured', 'connection_inactive']) {
      const entry = ENABLE_BLOCKED_REASON[reason]
      expect(entry, reason).toBeDefined()
      expect(Object.keys(entry).sort(), `${reason} carries no wording of its own`).toEqual(['action', 'href'])
      if (entry.href) expect(entry.href, reason).toMatch(/^\/(store|agent|phone)/)
      if (entry.action) expect(entry.action, reason).not.toMatch(ROMANIAN)
      expect(Boolean(entry.href), `${reason}: an action needs a page`).toBe(Boolean(entry.action))
    }
    expect(ENABLE_BLOCKED_REASON.no_consent.href).toBe('/store/automations')
    expect(ENABLE_BLOCKED_REASON.unavailable.href).toBe('/store/connections')
    expect(ENABLE_BLOCKED_REASON.encryption_not_configured.href).toBeNull()
  })

  it('points every Store section path at the English routes', () => {
    expect(STORE_PATHS).toEqual({
      overview: '/store',
      connections: '/store/connections',
      orders: '/store/orders',
      customers: '/store/customers',
      products: '/store/products',
      automations: '/store/automations',
      doNotCall: '/store/do-not-call',
      settings: '/store/settings',
    })
    expect(automationHref('abandoned_cart')).toBe('/store/automations?type=abandoned_cart')
  })

  it('shows the merchant English copy only (no Romanian diacritics or leftovers)', () => {
    const all = [
      ...Object.values(RUN_STATUS_LABEL), ...Object.values(RUN_OUTCOME_LABEL), ...Object.values(CONNECTION_STATUS_LABEL),
      ...Object.values(ORDER_STATUS_LABEL), ...Object.values(AUTOMATION_TYPE_DESCRIPTION), CONSENT_TEXT,
      ...SCRIPT_VARIABLES.map((v) => v.description),
    ]
    for (const text of all) {
      expect(text).not.toMatch(ROMANIAN)
      expect(text).not.toMatch(BRITISH)
    }
    expect(CONSENT_TEXT).toMatch(/consent/i)
    expect(CONSENT_TEXT).toMatch(/AI assistant/)
  })

  it('shows the merchant the exact consent wording the server records under CONSENT_VERSION', () => {
    expect(CONSENT_TEXT).toBe(RECORDED_CONSENT_TEXT)
  })

  it('documents every typed script variable of the server, in its order, with an English description', () => {
    // The help box and the form's variable check read this list; the server (and the
    // default scripts) use lib/commerce/prompt.ts, so a name missing here would make the
    // form reject a script the server accepts.
    expect(SCRIPT_VARIABLES.map((v) => v.name)).toEqual([...SERVER_SCRIPT_VARIABLES])
    expect(SCRIPT_VARIABLES.map((v) => v.name)).toContain('agent_name')
    expect(SCRIPT_VARIABLES.map((v) => v.name)).toContain('delivery_city')
    for (const v of SCRIPT_VARIABLES) {
      expect(v.description.trim().length, v.name).toBeGreaterThan(10)
      expect(v.description, v.name).not.toMatch(ROMANIAN)
    }
    expect(SCRIPT_VARIABLES.find((v) => v.name === 'order_total')?.description).toBe('The order total, with the currency.')
  })

  it('reads unknown values as themselves rather than blank', () => {
    expect(runStatusLabel('completed')).toBe('Completed')
    expect(runStatusLabel('brand_new')).toBe('brand_new')
    expect(runStatusLabel(null)).toBe('—')
    expect(runOutcomeLabel(null)).toBeNull()
    expect(connectionStatusLabel(undefined)).toBe('Not set up')
    expect(suppressionSourceLabel('provider')).toBe('Store platform')
    expect(suppressionSourceLabel(null)).toBe('Unknown')
  })

  it('builds the call sheet summary line from the bare reference the server sends (one #, carts read as carts)', () => {
    // runDto (lib/commerce/store.ts) sends the order number without '#'.
    expect(runSummaryLine({ automation_type: 'cod_confirmation', reference: '10487', reference_kind: 'order', outcome: 'confirmed', status: 'completed' })).toBe(
      'Automated call · COD confirmation · Order #10487 · Confirmed',
    )
    expect(runSummaryLine({ automation_type: 'abandoned_cart', reference: 'sfvoyz', reference_kind: 'cart', outcome: null, status: 'scheduled' })).toBe(
      'Automated call · Abandoned cart · Cart …sfvoyz · Scheduled',
    )
  })

  it('labels a run reference once, as an order or a cart', () => {
    expect(runReferenceLabel({ reference: '10491', reference_kind: 'order' })).toBe('#10491')
    expect(runSubjectLabel({ reference: '10491', reference_kind: 'order' })).toBe('Order #10491')
    expect(runReferenceLabel({ reference: 'sfvoyz', reference_kind: 'cart' })).toBe('Cart …sfvoyz')
    expect(runSubjectLabel({ reference: 'sfvoyz', reference_kind: 'cart' })).toBe('Cart …sfvoyz')
    for (const label of [runReferenceLabel({ reference: '10491', reference_kind: 'order' }), runSubjectLabel({ reference: '10491', reference_kind: 'order' })]) {
      expect(label).not.toContain('##')
    }
  })

  it('labels the When column with the run\'s own end state', () => {
    const base = { scheduled_for: null, last_attempt_at: '2026-10-14T09:00:00Z', completed_at: '2026-10-14T09:05:00Z', created_at: '2026-10-14T08:00:00Z' }
    expect(runWhen({ ...base, status: 'completed' })).toEqual({ label: 'Completed', iso: base.completed_at })
    expect(runWhen({ ...base, status: 'cancelled' })).toEqual({ label: 'Canceled', iso: base.completed_at })
    expect(runWhen({ ...base, status: 'suppressed' })).toEqual({ label: 'Skipped', iso: base.completed_at })
    expect(runWhen({ ...base, status: 'skipped' })).toEqual({ label: 'Skipped', iso: base.completed_at })
    expect(runWhen({ ...base, status: 'failed' })).toEqual({ label: 'Failed', iso: base.completed_at })
    expect(runWhen({ ...base, status: 'retry_waiting', scheduled_for: '2026-10-14T11:00:00Z' })).toEqual({ label: 'Scheduled', iso: '2026-10-14T11:00:00Z' })
    expect(runWhen({ ...base, status: 'calling', completed_at: null })).toEqual({ label: 'Last attempt', iso: base.last_attempt_at })
  })

  it('pluralises synced counts', () => {
    expect(resourceCount('customers', 1)).toBe('1 customer')
    expect(resourceCount('customers', 2)).toBe('2 customers')
    expect(resourceCount('orders', 0)).toBe('0 orders')
    expect(resourceCount('products', 1)).toBe('1 product')
    expect(resourceCount('carts', 1)).toBe('1 cart')
    expect(resourceCount('orders', 1240)).toBe('1,240 orders')
    expect(resourceCount('widgets', 3)).toBe('3 widgets')
    expect(['3 orders', '1 customer', '1 product', '1 cart'].join(' · ')).toBe(
      (['orders', 'customers', 'products', 'carts'] as const).map((k, i) => resourceCount(k, [3, 1, 1, 1][i])).join(' · '),
    )
  })

  it('waits for store-sent events only on the custom connector, never on a WooCommerce store whose registration failed', () => {
    const caps = { products: true, customers: true, orders: true, webhooks: true, abandoned_carts: true, customer_phone: true, polling_minutes: null, notes: [] }
    const url = 'https://app.example.com/api/commerce/webhooks/x/abc'
    expect(awaitsStoreSentEvents({ platform: 'custom', capabilities: caps, webhook_url: url })).toBe(true)
    // WooCommerce shows its address for cart events, but its order webhooks are registered through its API:
    // no topics there means "reconnect", not "waiting for your store".
    expect(awaitsStoreSentEvents({ platform: 'woocommerce', capabilities: caps, webhook_url: url })).toBe(false)
    expect(awaitsStoreSentEvents({ platform: 'custom', capabilities: caps, webhook_url: null })).toBe(false)
    expect(awaitsStoreSentEvents({ platform: 'custom', capabilities: { ...caps, webhooks: false }, webhook_url: url })).toBe(false)
  })

  it('explains the webhook address in English for the platforms that show it', () => {
    expect(Object.keys(WEBHOOK_ADDRESS_HINT).sort()).toEqual(['custom', 'woocommerce'])
    for (const hint of Object.values(WEBHOOK_ADDRESS_HINT)) {
      expect(hint).not.toMatch(ROMANIAN)
      expect(hint).not.toMatch(BRITISH)
    }
  })
})

describe('the Romanian-leak guard', () => {
  it('flags the pre-translation words and diacritics', () => {
    for (const leak of ['Comandă confirmată', 'Clientul a sunat', 'clienti noi', 'Magazin', 'Apel programat', 'Sincronizare', 'neconfigurat']) {
      expect(leak, leak).toMatch(ROMANIAN)
    }
  })

  it('passes English labels, including ones that use the word "client"', () => {
    for (const english of ['Client phone', 'client ID', 'Clients', 'Order confirmed', 'Automated call', 'Store settings']) {
      expect(english, english).not.toMatch(ROMANIAN)
    }
  })
})
