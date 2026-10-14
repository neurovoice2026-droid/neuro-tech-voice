// Pure pieces of the store onboarding UI that run in node: the Shopify domain
// normalizer, the English copy helpers, the store's hydration and plan
// default, and the top bar's step list (the service flow's default must stay
// exactly as it was).

import { describe, expect, it, vi } from 'vitest'
import { normalizeShopDomain, oauthReturnFrom, shopifyStartUrl } from '@/components/onboarding/commerce/shopify'
import {
  CAPABILITY_LABELS,
  CONNECTION_STATUS,
  CONSENT_TEXT,
  COUNTRIES,
  CURRENCIES,
  OAUTH_ERRORS,
  SYNC_STATUS,
  automationRules,
  checklistStepFor,
  formatDate,
  formatDays,
  formatMinutes,
  oauthErrorMessage,
} from '@/components/onboarding/commerce/copy'
import {
  CONNECTION_STATUSES,
  CONNECTION_STATUS_LABEL,
  CONNECTION_STATUS_TONE,
  OAUTH_ERRORS as DASHBOARD_OAUTH_ERRORS,
  SYNC_STATUS_LABEL,
} from '@/components/commerce/labels'
import { CONSENT_TEXT as RECORDED_CONSENT_TEXT } from '@/lib/commerce/automations/config'
import { CommerceRequestError, TIMEOUT_MESSAGE, commerceErrorMessage, isAbort, readCommerceError, requestJson } from '@/components/onboarding/commerce/api'
import { connectionBusy, isLiveConnection } from '@/components/onboarding/commerce/hooks'
import { DEFAULT_STORE_PLAN, useCommerceOnboardingStore } from '@/store/useCommerceOnboardingStore'
import { COMMERCE_ONBOARDING_STEPS } from '@/lib/commerce/business-type'
import { ONBOARDING_STEPS } from '@/components/onboarding/StepIndicator'
import { PLANS, STORE_PLANS, planAllowedFor, plansForBusinessType } from '@/types'
import type { AutomationConfig, ConnectionDto, ConnectionStatus } from '@/lib/commerce/types'

/** Romanian diacritics and Romanian stems the old copy used (none shared with English): none may survive in merchant-facing text. */
const ROMANIAN = /[ăâîșşțţ]|\b(magazin|sincroniz|conexiun|automatiz|reîncearc)/i

describe('normalizeShopDomain', () => {
  it('accepts a bare shop name, a full domain and a URL, lower-cased and trimmed', () => {
    expect(normalizeShopDomain('  My-Store ')).toBe('my-store.myshopify.com')
    expect(normalizeShopDomain('my-store.myshopify.com')).toBe('my-store.myshopify.com')
    expect(normalizeShopDomain('https://My-Store.myshopify.com/admin')).toBe('my-store.myshopify.com')
  })
  it('refuses anything that is not a myshopify.com domain', () => {
    expect(normalizeShopDomain('')).toBeNull()
    expect(normalizeShopDomain('my-store.com')).toBeNull()
    expect(normalizeShopDomain('evil.com/my-store.myshopify.com')).toBeNull()
    expect(normalizeShopDomain('-bad.myshopify.com')).toBeNull()
  })
  it('builds the start URL with the onboarding return target', () => {
    expect(shopifyStartUrl('my-store.myshopify.com')).toBe('/api/commerce/oauth/shopify/start?shop=my-store.myshopify.com&return_to=onboarding')
  })
  it('reads the install result from the return URL under both spellings of the failure code', () => {
    expect(oauthReturnFrom(new URLSearchParams('commerce=connected'))).toEqual({ kind: 'connected' })
    expect(oauthReturnFrom(new URLSearchParams('commerce_error=access_denied'))).toEqual({ kind: 'error', code: 'access_denied' })
    expect(oauthReturnFrom(new URLSearchParams('error=state_mismatch'))).toEqual({ kind: 'error', code: 'state_mismatch' })
    // A code is never shown as received: unsafe characters go, the length is bounded, an empty one is named.
    expect(oauthReturnFrom(new URLSearchParams('commerce_error=<script>'))).toEqual({ kind: 'error', code: 'script' })
    expect(oauthReturnFrom(new URLSearchParams('error='))).toEqual({ kind: 'error', code: 'unknown' })
    expect(oauthReturnFrom(new URLSearchParams(''))).toBeNull()
  })
})

describe('requestJson', () => {
  /** A fetch that never answers but honours its abort signal, like a stalled server. */
  function stalledFetch() {
    return vi.fn((_url: string, init?: RequestInit) => {
      return new Promise<Response>((_resolve, reject) => {
        init?.signal?.addEventListener('abort', () => reject(init.signal?.reason ?? new DOMException('Aborted', 'AbortError')))
      })
    })
  }

  it('gives up after the time limit with an English error the callers show (not a silent abort)', async () => {
    vi.stubGlobal('fetch', stalledFetch())
    const err = await requestJson('/api/commerce/onboarding/state', { fallback: 'x', timeoutMs: 10 }).catch((e: unknown) => e)
    expect(err).toBeInstanceOf(CommerceRequestError)
    expect((err as CommerceRequestError).code).toBe('timeout')
    expect(isAbort(err)).toBe(false)
    expect(commerceErrorMessage(err, 'fallback')).toBe(TIMEOUT_MESSAGE)
    expect(TIMEOUT_MESSAGE).toBe('The server did not respond in time. Please try again.')
  })

  it("the caller's own abort still surfaces as an AbortError, which the hooks ignore", async () => {
    vi.stubGlobal('fetch', stalledFetch())
    const ctrl = new AbortController()
    const pending = requestJson('/api/commerce/onboarding/state', { fallback: 'x', signal: ctrl.signal, timeoutMs: 10_000 }).catch((e: unknown) => e)
    ctrl.abort()
    const err = await pending
    expect(isAbort(err)).toBe(true)
    expect(err).not.toBeInstanceOf(CommerceRequestError)
  })

  it('reads the server message, code and precondition reason from a failed response', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response(JSON.stringify({ error: 'Confirm the statement first', code: 'precondition_failed', details: { reason: 'no_consent' } }), { status: 409 })),
    )
    const err = (await requestJson('/api/commerce/automations/cod_confirmation', { method: 'PUT', body: {}, fallback: 'x' }).catch((e: unknown) => e)) as CommerceRequestError
    expect(err).toBeInstanceOf(CommerceRequestError)
    expect(err.status).toBe(409)
    expect(err.code).toBe('precondition_failed')
    expect(err.reason).toBe('no_consent')
    expect(err.message).toBe('Confirm the statement first')
  })

  it('falls back to an English line per status when the server sends no message, and to the caller’s otherwise', async () => {
    const without = (status: number) => readCommerceError(new Response('<html>', { status }), 'Caller fallback.')
    expect((await without(401)).message).toBe('Your session has expired. Sign in again.')
    expect((await without(429)).message).toBe('Too many requests. Wait a moment and try again.')
    expect((await without(500)).message).toBe('Caller fallback.')
    expect(commerceErrorMessage(new TypeError('Failed to fetch'), 'x')).toBe('Network error. Check your connection and try again.')
  })
})

describe('connection liveness', () => {
  const base = { id: 'c1', sync: null } as unknown as ConnectionDto
  const withStatus = (status: ConnectionStatus): ConnectionDto => ({ ...base, status })

  it('a draft or disconnected row is not a store yet (the connect form shows), the other statuses are', () => {
    expect(isLiveConnection(null)).toBe(false)
    expect(isLiveConnection(withStatus('draft'))).toBe(false)
    expect(isLiveConnection(withStatus('disconnected'))).toBe(false)
    for (const status of ['connecting', 'active', 'degraded', 'error'] as const) expect(isLiveConnection(withStatus(status))).toBe(true)
  })

  it('polls only while connecting or syncing', () => {
    expect(connectionBusy(withStatus('connecting'))).toBe(true)
    expect(connectionBusy({ ...withStatus('active'), sync: { status: 'running', kind: 'initial', resource: 'all', counts: {}, error_message: null, updated_at: null } })).toBe(true)
    expect(connectionBusy(withStatus('active'))).toBe(false)
    expect(connectionBusy(withStatus('error'))).toBe(false)
  })
})

describe('checklistStepFor', () => {
  it('maps the /store pages that are steps of the flow, and nothing else, to a step', () => {
    expect(checklistStepFor('/store/connections')).toBe(3)
    expect(checklistStepFor('/store/automations?type=cod_confirmation')).toBe(4)
    expect(checklistStepFor('/agent')).toBe(5)
    expect(checklistStepFor('/agent?tab=voice')).toBe(5)
    expect(checklistStepFor('/agentx')).toBeNull()
    expect(checklistStepFor('/phone')).toBeNull()
    expect(checklistStepFor('/store/settings')).toBeNull()
    // The old Romanian paths are gone: a stale link from them is not a step any more.
    expect(checklistStepFor('/magazin/conexiuni')).toBeNull()
    expect(checklistStepFor(null)).toBeNull()
  })
})

describe('copy helpers', () => {
  const config: AutomationConfig = {
    delay_minutes: 90,
    call_window: { start: '09:00', end: '20:00', days: ['mon', 'tue', 'wed', 'thu', 'fri'] },
    timezone: null,
    daily_cap: 100,
    per_customer_daily_cap: 1,
    max_attempts: 2,
    retry_minutes: 120,
    cod_payment_methods: ['cod'],
    follow_up_status: 'fulfilled',
    min_order_total: 150,
  }
  it('formats delays, days and dates in English', () => {
    expect(formatMinutes(30)).toBe('30 min')
    expect(formatMinutes(90)).toBe('1 h 30 min')
    expect(formatMinutes(120)).toBe('2 h')
    expect(formatDays(['mon', 'sat', 'sun'])).toBe('Mon, Sat, Sun')
    expect(formatDays([])).toBe('no days')
    expect(formatDate('2026-10-14T13:05:00Z')).toMatch(/^Oct 14, 2026/)
    expect(formatDate('not a date')).toBeNull()
  })
  it('describes each automation from its config', () => {
    expect(automationRules('cod_confirmation', config).trigger).toBe('New cash-on-delivery order (cod)')
    expect(automationRules('abandoned_cart', config).trigger).toBe('Abandoned cart worth at least 150, after 1 h 30 min')
    expect(automationRules('order_follow_up', config).trigger).toBe('Order moves to the “fulfilled” status')
    for (const type of ['cod_confirmation', 'abandoned_cart', 'order_follow_up'] as const) {
      expect(automationRules(type, config).contact).toContain('do-not-call list')
    }
  })
  it('maps known OAuth error codes and never echoes an unknown one at length', () => {
    expect(oauthErrorMessage('access_denied')).toBe('The app install was declined in Shopify. You can try again whenever you are ready.')
    expect(oauthErrorMessage('x'.repeat(100))).toBe(`The Shopify connection failed (code: ${'x'.repeat(40)}).`)
  })
  it('keeps every merchant-facing table in English', () => {
    const lines = [
      ...COUNTRIES.map((c) => c.label),
      ...CURRENCIES.map((c) => c.label),
      ...Object.values(CONNECTION_STATUS).map((s) => s.label),
      ...Object.values(SYNC_STATUS),
      ...CAPABILITY_LABELS.map((c) => c.label),
      ...Object.values(OAUTH_ERRORS),
      CONSENT_TEXT,
    ]
    for (const line of lines) expect(line, line).not.toMatch(ROMANIAN)
    expect(CONSENT_TEXT).toMatch(/^I confirm that I have a lawful basis/)
  })
  it('reads statuses, the Shopify install errors and the consent from the dashboard, so a row never changes wording after the launch', () => {
    expect(Object.keys(CONNECTION_STATUS).sort()).toEqual([...CONNECTION_STATUSES].sort())
    for (const status of CONNECTION_STATUSES) {
      expect(CONNECTION_STATUS[status]).toEqual({ label: CONNECTION_STATUS_LABEL[status], tone: CONNECTION_STATUS_TONE[status] })
    }
    expect(CONNECTION_STATUS.degraded.label).toBe('Connected with issues')
    expect(SYNC_STATUS).toBe(SYNC_STATUS_LABEL)
    expect(OAUTH_ERRORS).toBe(DASHBOARD_OAUTH_ERRORS)
    // The checkbox shows the very text recorded under CONSENT_VERSION (a diverging copy would record a consent the merchant never saw).
    expect(CONSENT_TEXT).toBe(RECORDED_CONSENT_TEXT)
  })
})

describe('useCommerceOnboardingStore', () => {
  const connection = {
    id: 'c1',
    platform: 'woocommerce',
    store_url: 'https://my-store.com',
    store_domain: 'my-store.com',
    display_name: null,
    status: 'active',
    capabilities: { products: true, customers: true, orders: true, webhooks: true, abandoned_carts: false, customer_phone: true, polling_minutes: null, notes: [] },
    webhook_topics: ['order.created'],
    last_sync_at: null,
    last_successful_sync_at: null,
    error_code: null,
    error_message: null,
    connected_at: null,
    disconnected_at: null,
    counts: { products: 1, customers: 2, orders: 3, carts: 0 },
    sync: null,
    created_at: '2026-10-13T00:00:00Z',
  } satisfies ConnectionDto

  it('hydrates from the server state, reading the profile leniently and taking the connection platform', () => {
    const store = useCommerceOnboardingStore.getState()
    store.reset()
    store.setPlatform('shopify')
    store.hydrate({
      business_type: 'ecommerce',
      onboarding_step: 3,
      profile: { display_name: 'Example Store', currency: 'not-a-code', tone: 'formal' },
      connection,
      automations: [],
      agent: null,
      has_phone_number: true,
      checklist: [{ key: 'connection', label: 'Store connected', ok: true, href: null }],
    })
    const s = useCommerceOnboardingStore.getState()
    expect(s.hydrated).toBe(true)
    expect(s.profile.display_name).toBe('Example Store')
    expect(s.profile.tone).toBe('formal')
    // A bad field falls back to its default instead of breaking the whole profile.
    expect(s.profile.currency).toBe('RON')
    expect(s.platform).toBe('woocommerce')
    expect(s.hasPhoneNumber).toBe(true)
    expect(s.checklist).toHaveLength(1)
    // The server never sets the client's current step through hydrate (the wrapper does).
    expect(s.currentStep).toBe(1)
  })

  it('starts on the store family’s entry plan, which an online store may hold, and keeps it across a reset', () => {
    const store = useCommerceOnboardingStore.getState()
    store.setPlan('store_scale')
    store.reset()
    expect(useCommerceOnboardingStore.getState().plan).toBe(DEFAULT_STORE_PLAN)
    expect(DEFAULT_STORE_PLAN).toBe('store_starter')
    expect(STORE_PLANS[0]).toBe(DEFAULT_STORE_PLAN)
    expect(planAllowedFor(DEFAULT_STORE_PLAN, 'ecommerce')).toBe(true)
    expect(PLANS[DEFAULT_STORE_PLAN].price_monthly).toBe(100)
    // The launch step offers exactly this family: the self-serve tiers plus one contact-sales tier.
    const offered = plansForBusinessType('ecommerce')
    expect(offered.filter((p) => PLANS[p].contact_sales)).toEqual(['store_enterprise'])
    expect(offered.filter((p) => !PLANS[p].contact_sales)).toEqual(['store_starter', 'store_growth', 'store_scale'])
  })

  it('never holds a secret: the state shape has no credential field', () => {
    const keys = Object.keys(useCommerceOnboardingStore.getState())
    expect(keys.some((k) => /secret|token|key|password|credential/i.test(k))).toBe(false)
  })

  it('upserts an automation by type', () => {
    const store = useCommerceOnboardingStore.getState()
    store.reset()
    const base = {
      id: 'a1',
      connection_id: 'c1',
      type: 'cod_confirmation' as const,
      enabled: false,
      available: true,
      unavailable_reason: null,
      config: {} as AutomationConfig,
      script: { template: '', tone: 'friendly' as const, brand_name: null, transfer_number: null, return_policy_url: null },
      consent_confirmed_at: null,
      consent_version: null,
      stats: { eligible: 0, scheduled: 0, calling: 0, completed: 0, suppressed: 0, failed: 0 },
      created_at: '',
      updated_at: '',
    }
    store.upsertAutomation(base)
    store.upsertAutomation({ ...base, enabled: true })
    const list = useCommerceOnboardingStore.getState().automations
    expect(list).toHaveLength(1)
    expect(list[0].enabled).toBe(true)
  })
})

describe('step lists', () => {
  it('the store flow has the six English steps the top bar and headers read', () => {
    expect(COMMERCE_ONBOARDING_STEPS.map((s) => s.label)).toEqual([
      'About your store',
      'Connect your store',
      'Access & sync',
      'Automations',
      'Your agent',
      'Launch',
    ])
    expect(COMMERCE_ONBOARDING_STEPS.map((s) => s.num)).toEqual([1, 2, 3, 4, 5, 6])
  })

  it('the service flow keeps its four steps untouched', () => {
    expect(ONBOARDING_STEPS.map((s) => s.label)).toEqual(['Company', 'Agent', 'Voice', 'Launch'])
  })
})
