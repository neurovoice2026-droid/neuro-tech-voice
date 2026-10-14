import { beforeEach, describe, expect, it, vi } from 'vitest'
import { installFetch, jsonResponse, callAt, type FetchMock } from '@/tests/helpers/fetch'
import {
  CommerceApiError,
  NETWORK_ERROR,
  TIMEOUT_ERROR,
  appendUnique,
  buildQuery,
  commerceErrorMessage,
  commerceRequest,
  readCommerceError,
} from '@/hooks/useCommerceApi'
import { enableBlocked } from '@/hooks/useCommerceAutomations'
import { isSyncInProgress, pickCurrentConnection, shopifyStartUrl } from '@/hooks/useCommerceConnections'
import { isCancellable } from '@/hooks/useCommerceRuns'
import type { ConnectionDto } from '@/lib/commerce/types'

let fetchMock: FetchMock

beforeEach(() => {
  fetchMock = installFetch()
})

describe('commerceRequest', () => {
  it('sends JSON with the same-origin headers and returns the parsed body', async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse({ queued: true }, 202))
    // Absolute here only so the recorder can parse it; the hooks send relative paths.
    const out = await commerceRequest<{ queued: boolean }>('http://localhost/api/commerce/connections/c1/sync', { method: 'POST', json: { resource: 'all' }, fallback: 'x' })
    expect(out).toEqual({ queued: true })
    const call = callAt(fetchMock)
    expect(call.url.pathname).toBe('/api/commerce/connections/c1/sync')
    expect(call.method).toBe('POST')
    expect(call.headers.get('content-type')).toBe('application/json')
    expect(call.headers.get('accept')).toBe('application/json')
    expect(call.json).toEqual({ resource: 'all' })
  })

  it('turns the route error body into a CommerceApiError with the reason', async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse({ error: 'Confirmă acordul mai întâi.', code: 'precondition_failed', details: { reason: 'no_consent' } }, 409))
    const err = await commerceRequest('/api/commerce/automations/cod_confirmation', { method: 'PUT', json: { enabled: true }, fallback: 'x' }).catch((e: unknown) => e)
    expect(err).toBeInstanceOf(CommerceApiError)
    const apiErr = err as CommerceApiError
    expect(apiErr.status).toBe(409)
    expect(apiErr.code).toBe('precondition_failed')
    expect(apiErr.reason).toBe('no_consent')
    expect(apiErr.message).toBe('Confirmă acordul mai întâi.')
    expect(enableBlocked(apiErr)?.href).toBe('/magazin/automatizari')
  })

  it('falls back to a Romanian status message when the body is not JSON', async () => {
    const err = await readCommerceError(new Response('<html>', { status: 503 }), 'fallback')
    expect(err.message).toMatch(/indisponibil/)
    const generic = await readCommerceError(new Response('', { status: 500 }), 'fallback')
    expect(generic.message).toBe('fallback')
    expect(generic.reason).toBeNull()
  })

  it('maps thrown errors to messages', () => {
    expect(commerceErrorMessage(new TypeError('fetch failed'), 'x')).toBe(NETWORK_ERROR)
    expect(commerceErrorMessage(new CommerceApiError('server said', 400), 'x')).toBe('server said')
    expect(commerceErrorMessage('weird', 'x')).toBe('x')
  })

  it('handles an empty body', async () => {
    fetchMock.mockResolvedValueOnce(new Response(null, { status: 204 }))
    await expect(commerceRequest('/api/commerce/x', { method: 'DELETE', fallback: 'x' })).resolves.toBeUndefined()
  })

  it('gives up on a stalled route after its time budget, in Romanian', async () => {
    vi.useFakeTimers()
    try {
      fetchMock.mockImplementationOnce(
        (_input, init) =>
          new Promise<Response>((_resolve, reject) => {
            init?.signal?.addEventListener('abort', () => reject(new DOMException('The operation was aborted.', 'AbortError')))
          }),
      )
      const pending = commerceRequest('/api/commerce/overview', { fallback: 'x', timeoutMs: 1_000 })
      const settled = pending.catch((e: unknown) => e)
      await vi.advanceTimersByTimeAsync(1_001)
      const err = await settled
      expect(err).toBeInstanceOf(CommerceApiError)
      expect((err as CommerceApiError).code).toBe('timeout')
      expect((err as CommerceApiError).message).toBe(TIMEOUT_ERROR)
      expect(commerceErrorMessage(err, 'x')).toBe(TIMEOUT_ERROR)
    } finally {
      vi.useRealTimers()
    }
  })

  it('lets the caller abort before the budget and keeps the abort as an abort', async () => {
    const ctrl = new AbortController()
    fetchMock.mockImplementationOnce(
      (_input, init) =>
        new Promise<Response>((_resolve, reject) => {
          init?.signal?.addEventListener('abort', () => reject(new DOMException('The operation was aborted.', 'AbortError')))
        }),
    )
    const pending = commerceRequest('/api/commerce/overview', { fallback: 'x', signal: ctrl.signal })
    const settled = pending.catch((e: unknown) => e)
    ctrl.abort()
    const err = await settled
    expect(err).toBeInstanceOf(DOMException)
    expect((err as DOMException).name).toBe('AbortError')
    // Browser abort text never reaches the screen.
    expect(commerceErrorMessage(err, 'fallback')).toBe('fallback')
  })
})

describe('query helpers', () => {
  it('builds a stable query without empty values', () => {
    expect(buildQuery({ q: 'ab', status: undefined, cod: true, limit: 25, connection_id: '' })).toBe('cod=1&limit=25&q=ab')
    expect(buildQuery({ limit: 25, q: 'ab' })).toBe(buildQuery({ q: 'ab', limit: 25 }))
  })

  it('appends a page without repeating ids', () => {
    expect(appendUnique([{ id: 'a' }, { id: 'b' }], [{ id: 'b' }, { id: 'c' }])).toEqual([{ id: 'a' }, { id: 'b' }, { id: 'c' }])
  })
})

function connection(over: Partial<ConnectionDto>): ConnectionDto {
  return {
    id: 'c',
    platform: 'woocommerce',
    store_url: 'https://shop.ro',
    store_domain: 'shop.ro',
    display_name: null,
    status: 'active',
    capabilities: { products: true, customers: true, orders: true, webhooks: true, abandoned_carts: false, customer_phone: true, polling_minutes: null, notes: [] },
    webhook_topics: [],
    last_sync_at: null,
    last_successful_sync_at: null,
    error_code: null,
    error_message: null,
    connected_at: null,
    disconnected_at: null,
    counts: { products: 0, customers: 0, orders: 0, carts: 0 },
    sync: null,
    created_at: '2026-10-13T00:00:00Z',
    ...over,
  }
}

describe('connection helpers', () => {
  it('prefers the live connection, else the first one', () => {
    const dead = connection({ id: 'dead', status: 'disconnected' })
    const live = connection({ id: 'live', status: 'degraded' })
    expect(pickCurrentConnection([dead, live])?.id).toBe('live')
    expect(pickCurrentConnection([dead])?.id).toBe('dead')
    expect(pickCurrentConnection([])).toBeNull()
  })

  it('knows when a sync is in progress', () => {
    expect(isSyncInProgress(connection({ status: 'connecting' }))).toBe(true)
    expect(isSyncInProgress(connection({ sync: { status: 'running', kind: 'initial', resource: 'all', counts: {}, error_message: null, updated_at: null } }))).toBe(true)
    expect(isSyncInProgress(connection({ sync: { status: 'succeeded', kind: 'initial', resource: 'all', counts: {}, error_message: null, updated_at: null } }))).toBe(false)
    expect(isSyncInProgress(null)).toBe(false)
  })

  it('builds the Shopify start link as a full-page navigation target', () => {
    expect(shopifyStartUrl('x.myshopify.com')).toBe('/api/commerce/oauth/shopify/start?shop=x.myshopify.com&return_to=magazin')
  })
})

describe('run helpers', () => {
  it('only waiting runs can be cancelled', () => {
    expect(isCancellable({ status: 'scheduled' })).toBe(true)
    expect(isCancellable({ status: 'retry_waiting' })).toBe(true)
    expect(isCancellable({ status: 'calling' })).toBe(false)
    expect(isCancellable({ status: 'completed' })).toBe(false)
  })
})
