// Pure pieces of the store onboarding UI that run in node: the Shopify domain
// normalizer, the Romanian copy helpers, the store's hydration and the top
// bar's step list (the service flow's default must stay exactly as it was).

import { describe, expect, it, vi } from 'vitest'
import { normalizeShopDomain, oauthReturnFrom, shopifyStartUrl } from '@/components/onboarding/commerce/shopify'
import { automationRules, checklistStepFor, formatDays, formatMinutes, oauthErrorMessage } from '@/components/onboarding/commerce/copy'
import { CommerceRequestError, TIMEOUT_MESSAGE, commerceErrorMessage, isAbort, requestJson } from '@/components/onboarding/commerce/api'
import { connectionBusy, isLiveConnection } from '@/components/onboarding/commerce/hooks'
import { useCommerceOnboardingStore } from '@/store/useCommerceOnboardingStore'
import { COMMERCE_ONBOARDING_STEPS } from '@/lib/commerce/business-type'
import type { AutomationConfig, ConnectionDto, ConnectionStatus } from '@/lib/commerce/types'

describe('normalizeShopDomain', () => {
  it('accepts a bare shop name, a full domain and a URL, lower-cased and trimmed', () => {
    expect(normalizeShopDomain('  Magazinul-Tau ')).toBe('magazinul-tau.myshopify.com')
    expect(normalizeShopDomain('magazinul-tau.myshopify.com')).toBe('magazinul-tau.myshopify.com')
    expect(normalizeShopDomain('https://Magazinul-Tau.myshopify.com/admin')).toBe('magazinul-tau.myshopify.com')
  })
  it('refuses anything that is not a myshopify.com domain', () => {
    expect(normalizeShopDomain('')).toBeNull()
    expect(normalizeShopDomain('magazin.ro')).toBeNull()
    expect(normalizeShopDomain('evil.com/magazin.myshopify.com')).toBeNull()
    expect(normalizeShopDomain('-bad.myshopify.com')).toBeNull()
  })
  it('builds the start URL with the onboarding return target', () => {
    expect(shopifyStartUrl('magazin.myshopify.com')).toBe('/api/commerce/oauth/shopify/start?shop=magazin.myshopify.com&return_to=onboarding')
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

  it('gives up after the time limit with a Romanian error the callers show (not a silent abort)', async () => {
    vi.stubGlobal('fetch', stalledFetch())
    const err = await requestJson('/api/commerce/onboarding/state', { fallback: 'x', timeoutMs: 10 }).catch((e: unknown) => e)
    expect(err).toBeInstanceOf(CommerceRequestError)
    expect((err as CommerceRequestError).code).toBe('timeout')
    expect(isAbort(err)).toBe(false)
    expect(commerceErrorMessage(err, 'fallback')).toBe(TIMEOUT_MESSAGE)
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
      vi.fn(async () => new Response(JSON.stringify({ error: 'Bifează mai întâi', code: 'precondition_failed', details: { reason: 'no_consent' } }), { status: 409 })),
    )
    const err = (await requestJson('/api/commerce/automations/cod_confirmation', { method: 'PUT', body: {}, fallback: 'x' }).catch((e: unknown) => e)) as CommerceRequestError
    expect(err).toBeInstanceOf(CommerceRequestError)
    expect(err.status).toBe(409)
    expect(err.code).toBe('precondition_failed')
    expect(err.reason).toBe('no_consent')
    expect(err.message).toBe('Bifează mai întâi')
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
  it('maps the pages that are steps of the flow, and nothing else, to a step', () => {
    expect(checklistStepFor('/magazin/conexiuni')).toBe(3)
    expect(checklistStepFor('/magazin/automatizari?type=cod_confirmation')).toBe(4)
    expect(checklistStepFor('/agent')).toBe(5)
    expect(checklistStepFor('/agent?tab=voice')).toBe(5)
    expect(checklistStepFor('/agentx')).toBeNull()
    expect(checklistStepFor('/phone')).toBeNull()
    expect(checklistStepFor('/magazin/setari')).toBeNull()
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
  it('formats delays and days in Romanian', () => {
    expect(formatMinutes(30)).toBe('30 min')
    expect(formatMinutes(90)).toBe('1 h 30 min')
    expect(formatMinutes(120)).toBe('2 h')
    expect(formatDays(['mon', 'sat', 'sun'])).toBe('Lu, Sâ, Du')
    expect(formatDays([])).toBe('nicio zi')
  })
  it('describes each automation from its config', () => {
    expect(automationRules('cod_confirmation', config).trigger).toContain('cod')
    expect(automationRules('abandoned_cart', config).trigger).toContain('150')
    expect(automationRules('abandoned_cart', config).trigger).toContain('1 h 30 min')
    expect(automationRules('order_follow_up', config).trigger).toContain('livrată')
    for (const type of ['cod_confirmation', 'abandoned_cart', 'order_follow_up'] as const) {
      expect(automationRules(type, config).contact).toContain('„Nu suna”')
    }
  })
  it('maps known OAuth error codes and never echoes an unknown one at length', () => {
    expect(oauthErrorMessage('access_denied')).toContain('refuzată')
    expect(oauthErrorMessage('x'.repeat(100))).toBe(`Conectarea cu Shopify nu a reușit (cod: ${'x'.repeat(40)}).`)
  })
})

describe('useCommerceOnboardingStore', () => {
  const connection = {
    id: 'c1',
    platform: 'woocommerce',
    store_url: 'https://magazin.ro',
    store_domain: 'magazin.ro',
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
      profile: { display_name: 'Magazinul Exemplu', currency: 'not-a-code', tone: 'formal' },
      connection,
      automations: [],
      agent: null,
      has_phone_number: true,
      checklist: [{ key: 'connection', label: 'Magazin conectat', ok: true, href: null }],
    })
    const s = useCommerceOnboardingStore.getState()
    expect(s.hydrated).toBe(true)
    expect(s.profile.display_name).toBe('Magazinul Exemplu')
    expect(s.profile.tone).toBe('formal')
    // A bad field falls back to its default instead of breaking the whole profile.
    expect(s.profile.currency).toBe('RON')
    expect(s.platform).toBe('woocommerce')
    expect(s.hasPhoneNumber).toBe(true)
    expect(s.checklist).toHaveLength(1)
    // The server never sets the client's current step through hydrate (the wrapper does).
    expect(s.currentStep).toBe(1)
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
  it('the store flow has the six labelled steps the top bar and headers read', () => {
    expect(COMMERCE_ONBOARDING_STEPS.map((s) => s.label)).toEqual([
      'Despre magazin',
      'Conectează magazinul',
      'Acces și sincronizare',
      'Automatizări',
      'Agentul tău',
      'Lansare',
    ])
  })
})
