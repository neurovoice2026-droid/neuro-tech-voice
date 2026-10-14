import { describe, expect, it } from 'vitest'
import {
  clearSecrets,
  connectSchema,
  initialConnectValues,
  normalizeShopDomain,
  splitConnectValues,
} from '@/components/commerce/connect-schema'
import {
  ABANDONED_CART_MIN_DELAY,
  AUTOMATION_LIMITS,
  automationFormSchema,
  bodyFromValues,
  formFieldForIssuePath,
  formValuesFrom,
  serverFieldErrors,
  templateVariables,
  unknownTemplateVariables,
  type AutomationFormValues,
} from '@/components/commerce/automation-schema'
import { defaultConfig, defaultScript } from '@/lib/commerce/automations/config'
import { AutomationPatchSchema } from '@/lib/commerce/automations/service'
import { PLATFORM_CATALOG } from '@/lib/commerce/platforms'
import { AUTOMATION_TYPES, type AutomationDto } from '@/lib/commerce/types'

describe('connect form schema (from PLATFORM_CATALOG)', () => {
  const woo = PLATFORM_CATALOG.woocommerce.fields

  it('requires every required field and an https store url', () => {
    const schema = connectSchema(woo)
    const bad = schema.safeParse({ store_url: 'http://shop.ro', consumer_key: '', consumer_secret: 'cs_1' })
    expect(bad.success).toBe(false)
    if (!bad.success) {
      const paths = bad.error.issues.map((i) => i.path.join('.'))
      expect(paths).toContain('store_url')
      expect(paths).toContain('consumer_key')
    }
    const ok = schema.safeParse({ store_url: 'https://shop.ro', consumer_key: 'ck_1', consumer_secret: 'cs_1' })
    expect(ok.success).toBe(true)
  })

  it('splits the store url from the secrets and never keeps a secret after clearing', () => {
    const values = { store_url: ' https://shop.ro ', consumer_key: 'ck_1', consumer_secret: 'cs_1' }
    expect(splitConnectValues(woo, values)).toEqual({ store_url: 'https://shop.ro', secrets: { consumer_key: 'ck_1', consumer_secret: 'cs_1' } })
    expect(clearSecrets(woo, values)).toEqual({ store_url: ' https://shop.ro ', consumer_key: '', consumer_secret: '' })
    // A reconnect prefill never carries a secret, whatever the caller passes.
    expect(initialConnectValues(woo, { store_url: 'https://shop.ro', consumer_key: 'leak' })).toEqual({ store_url: 'https://shop.ro', consumer_key: '', consumer_secret: '' })
  })

  it('custom connector: the header name is required only for the header scheme', () => {
    const fields = PLATFORM_CATALOG.custom.fields
    const schema = connectSchema(fields)
    const base = { store_url: 'https://api.shop.ro/ntv', auth_token: 't', webhook_secret: '', auth_header_name: '' }
    expect(schema.safeParse({ ...base, auth_scheme: 'bearer' }).success).toBe(true)
    const header = schema.safeParse({ ...base, auth_scheme: 'api_key_header' })
    expect(header.success).toBe(false)
    expect(schema.safeParse({ ...base, auth_scheme: 'api_key_header', auth_header_name: 'X-API-Key' }).success).toBe(true)
    expect(initialConnectValues(fields).auth_scheme).toBe('bearer')
  })

  it('normalises a Shopify domain as merchants paste it', () => {
    expect(normalizeShopDomain('Magazin-Tau.myshopify.com')).toBe('magazin-tau.myshopify.com')
    expect(normalizeShopDomain('https://magazin-tau.myshopify.com/admin')).toBe('magazin-tau.myshopify.com')
    expect(normalizeShopDomain('magazin-tau.ro')).toBeNull()
    expect(normalizeShopDomain('')).toBeNull()
    const schema = connectSchema(PLATFORM_CATALOG.shopify.fields)
    expect(schema.safeParse({ shop_domain: 'x.myshopify.com' }).success).toBe(true)
    expect(schema.safeParse({ shop_domain: 'x.ro' }).success).toBe(false)
  })
})

const automation: AutomationDto = {
  id: 'a1',
  connection_id: 'c1',
  type: 'cod_confirmation',
  enabled: false,
  available: true,
  unavailable_reason: null,
  config: {
    delay_minutes: 15,
    call_window: { start: '09:00', end: '20:00', days: ['monday', 'tuesday', 'nope'] },
    timezone: null,
    daily_cap: 100,
    per_customer_daily_cap: 1,
    max_attempts: 2,
    retry_minutes: 60,
    cod_payment_methods: ['cod'],
    follow_up_status: 'processing',
    min_order_total: null,
  },
  script: { template: 'Bună ziua {{customer_name}}, sun de la {{store_name}} pentru comanda {{order_number}}.', tone: 'friendly', brand_name: null, transfer_number: null, return_policy_url: null },
  consent_confirmed_at: null,
  consent_version: null,
  stats: { eligible: 0, scheduled: 0, calling: 0, completed: 0, suppressed: 0, failed: 0 },
  created_at: '2026-10-13T00:00:00Z',
  updated_at: '2026-10-13T00:00:00Z',
}

describe('automation form schema', () => {
  it('round-trips an AutomationDto into form values and back into a PUT body for its type only', () => {
    const values = formValuesFrom(automation)
    expect(values.days).toEqual(['monday', 'tuesday'])
    expect(values.timezone).toBe('')
    expect(values.min_order_total).toBe('')
    const parsed = automationFormSchema('cod_confirmation').safeParse(values)
    expect(parsed.success).toBe(true)
    const body = bodyFromValues('cod_confirmation', values)
    expect(body.config).toMatchObject({ delay_minutes: 15, timezone: null, cod_payment_methods: ['cod'], call_window: { start: '09:00', end: '20:00', days: ['monday', 'tuesday'] } })
    expect(body.config).not.toHaveProperty('follow_up_status')
    expect(body.config).not.toHaveProperty('min_order_total')
    expect(body.script).toEqual({ template: automation.script.template, tone: 'friendly', brand_name: null, transfer_number: null, return_policy_url: null })
  })

  it('applies the per-type rules', () => {
    const values = formValuesFrom({ ...automation, type: 'abandoned_cart' })
    const tooSoon = automationFormSchema('abandoned_cart').safeParse({ ...values, delay_minutes: 5 })
    expect(tooSoon.success).toBe(false)
    if (!tooSoon.success) expect(tooSoon.error.issues.some((i) => i.path[0] === 'delay_minutes')).toBe(true)
    const fine = automationFormSchema('abandoned_cart').safeParse({ ...values, delay_minutes: ABANDONED_CART_MIN_DELAY, min_order_total: '150' })
    expect(fine.success).toBe(true)
    expect(bodyFromValues('abandoned_cart', { ...values, min_order_total: '150' }).config.min_order_total).toBe(150)

    const noMethods = automationFormSchema('cod_confirmation').safeParse({ ...formValuesFrom(automation), cod_payment_methods: [] })
    expect(noMethods.success).toBe(false)

    const followUp = bodyFromValues('order_follow_up', { ...formValuesFrom(automation), follow_up_status: 'fulfilled' })
    expect(followUp.config.follow_up_status).toBe('fulfilled')
  })

  it('rejects an empty window, a bad phone number, a non-https url and unknown variables', () => {
    const schema = automationFormSchema('cod_confirmation')
    const base = formValuesFrom(automation)
    const issues = (values: Partial<typeof base>) => {
      const result = schema.safeParse({ ...base, ...values })
      return result.success ? [] : result.error.issues.map((i) => i.path.join('.'))
    }
    expect(issues({ window_end: '09:00' })).toContain('window_end')
    expect(issues({ transfer_number: '0712 345 678' })).toContain('transfer_number')
    expect(issues({ transfer_number: '+40712345678' })).not.toContain('transfer_number')
    expect(issues({ return_policy_url: 'http://shop.ro/retur' })).toContain('return_policy_url')
    expect(issues({ template: 'Bună ziua, comanda {{order_id}} este gata de livrare.' })).toContain('template')
    expect(issues({ days: [] })).toContain('days')
    expect(issues({ delay_minutes: Number.NaN })).toContain('delay_minutes')
  })

  it('lists the variables of a template', () => {
    expect(templateVariables('{{store_name}} {{ order_number }} {{store_name}}')).toEqual(['store_name', 'order_number'])
    expect(unknownTemplateVariables('{{store_name}} {{foo}}')).toEqual(['foo'])
    // Every name the server accepts is known to the form (the default scripts use agent_name and delivery_city).
    expect(unknownTemplateVariables('{{agent_name}} {{delivery_city}} {{call_reason}}')).toEqual([])
  })

  it('accepts the unconfigured automation (server defaults) of every type, so the first save works untouched', () => {
    for (const type of AUTOMATION_TYPES) {
      // What GET /api/commerce/automations answers for a template that was never configured.
      const dto: AutomationDto = { ...automation, id: null, type, config: defaultConfig(type), script: defaultScript(type) }
      const values = formValuesFrom(dto)
      const parsed = automationFormSchema(type).safeParse(values)
      expect(parsed.success, `${type}: ${parsed.success ? '' : parsed.error.issues.map((i) => i.message).join('; ')}`).toBe(true)
      const server = AutomationPatchSchema.safeParse({ connection_id: '11111111-1111-4111-8111-111111111111', ...bodyFromValues(type, values) })
      expect(server.success, type).toBe(true)
    }
  })
})

describe('automation form ↔ PUT body contract', () => {
  const CONNECTION = '11111111-1111-4111-8111-111111111111'
  const base = formValuesFrom({ ...automation, config: defaultConfig('cod_confirmation'), script: defaultScript('cod_confirmation') })
  const client = (over: Partial<AutomationFormValues>) => automationFormSchema('cod_confirmation').safeParse({ ...base, ...over })
  const server = (over: Partial<AutomationFormValues>) =>
    AutomationPatchSchema.safeParse({ connection_id: CONNECTION, ...bodyFromValues('cod_confirmation', { ...base, ...over }) })

  it('reads its bounds from the server schema', () => {
    expect(AUTOMATION_LIMITS.daily_cap).toEqual([1, 2000])
    expect(AUTOMATION_LIMITS.per_customer_daily_cap).toEqual([1, 5])
    expect(AUTOMATION_LIMITS.max_attempts).toEqual([1, 4])
    expect(AUTOMATION_LIMITS.retry_minutes).toEqual([15, 4320])
    expect(AUTOMATION_LIMITS.delay_minutes).toEqual([0, 10080])
    expect(AUTOMATION_LIMITS.cod_method_max_length).toBe(60)
  })

  it('never accepts a value the server rejects (boundary cases on both sides)', () => {
    const cases: Array<[string, Partial<AutomationFormValues>, boolean]> = [
      ['daily cap at max', { daily_cap: 2000 }, true],
      ['daily cap over max', { daily_cap: 2001 }, false],
      ['daily cap 3000', { daily_cap: 3000 }, false],
      ['per-customer cap at max', { per_customer_daily_cap: 5 }, true],
      ['per-customer cap over max', { per_customer_daily_cap: 6 }, false],
      ['attempts at max', { max_attempts: 4 }, true],
      ['attempts over max', { max_attempts: 5 }, false],
      ['retry at min', { retry_minutes: 15 }, true],
      ['retry under min', { retry_minutes: 10 }, false],
      ['retry at max', { retry_minutes: 4320 }, true],
      ['retry over max', { retry_minutes: 4321 }, false],
      ['delay at max', { delay_minutes: 10080 }, true],
      ['delay over max', { delay_minutes: 10081 }, false],
      ['COD method at max length', { cod_payment_methods: ['x'.repeat(60)] }, true],
      ['COD method over max length', { cod_payment_methods: ['x'.repeat(70)] }, false],
      ['window one minute long', { window_start: '09:00', window_end: '09:01' }, true],
      ['window empty', { window_start: '09:00', window_end: '09:00' }, false],
      ['window overnight', { window_start: '20:00', window_end: '09:00' }, false],
    ]
    for (const [name, over, ok] of cases) {
      expect(client(over).success, `client: ${name}`).toBe(ok)
      expect(server(over).success, `server: ${name}`).toBe(ok)
    }
    const overnight = client({ window_start: '20:00', window_end: '09:00' })
    if (!overnight.success) expect(overnight.error.issues.map((i) => i.path.join('.'))).toContain('window_end')
  })

  it('maps the paths of a 400 onto form fields', () => {
    expect(formFieldForIssuePath('config.daily_cap')).toBe('daily_cap')
    expect(formFieldForIssuePath('config.call_window')).toBe('window_end')
    expect(formFieldForIssuePath('config.call_window.start')).toBe('window_start')
    expect(formFieldForIssuePath('config.call_window.days.0')).toBe('days')
    expect(formFieldForIssuePath('config.cod_payment_methods.3')).toBe('cod_payment_methods')
    expect(formFieldForIssuePath('script.template')).toBe('template')
    expect(formFieldForIssuePath('connection_id')).toBeNull()
    expect(formFieldForIssuePath('config')).toBeNull()
    expect(formFieldForIssuePath('')).toBeNull()

    const details = [
      { path: 'config.retry_minutes', message: 'Too small: expected number to be >=15' },
      { path: 'config.retry_minutes', message: 'duplicate for the same field' },
      { path: 'config.call_window', message: 'Ora de început trebuie să fie înaintea orei de sfârșit' },
      { path: 'connection_id', message: 'Invalid UUID' },
      { path: 'script.template', message: '   ' },
      'garbage',
      null,
    ]
    expect(serverFieldErrors(details)).toEqual([
      { field: 'retry_minutes', message: 'Too small: expected number to be >=15' },
      { field: 'window_end', message: 'Ora de început trebuie să fie înaintea orei de sfârșit' },
      { field: 'template', message: 'Valoarea nu este acceptată' },
    ])
    expect(serverFieldErrors(undefined)).toEqual([])
    expect(serverFieldErrors({ reason: 'no_consent' })).toEqual([])
  })
})
