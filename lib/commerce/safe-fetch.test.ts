import { describe, expect, it, vi } from 'vitest'

vi.mock('server-only', () => ({}))

import { StoreHttpError, UnsafeUrlError, assertSafeStoreUrl, isBlockedAddress, safeFetch } from './safe-fetch'

const publicLookup = async () => ['93.184.216.34']

describe('isBlockedAddress', () => {
  it('blocks loopback, private, link-local, metadata, multicast and reserved ranges', () => {
    for (const ip of ['127.0.0.1', '10.1.2.3', '172.16.5.5', '172.31.255.255', '192.168.0.1', '169.254.169.254', '100.64.0.1', '0.0.0.0', '224.0.0.1', '255.255.255.255', '::1', '::', 'fe80::1', 'fc00::1', 'fd12::1', 'ff02::1', '::ffff:127.0.0.1', '::ffff:7f00:1', '64:ff9b::a00:1']) {
      expect(isBlockedAddress(ip), ip).toBe(true)
    }
  })
  it('allows public addresses', () => {
    for (const ip of ['93.184.216.34', '8.8.8.8', '172.32.0.1', '2606:2800:220:1:248:1893:25c8:1946']) expect(isBlockedAddress(ip), ip).toBe(false)
  })
  it('treats anything that is not an IP as blocked', () => {
    expect(isBlockedAddress('example.com')).toBe(true)
  })
})

describe('assertSafeStoreUrl', () => {
  it('accepts a public https store', async () => {
    const url = await assertSafeStoreUrl('https://Shop.Example.com/wp-json/', { lookup: publicLookup })
    expect(url.hostname).toBe('shop.example.com')
  })
  it('rejects http, credentials, odd ports, local names and IP literals in private ranges', async () => {
    await expect(assertSafeStoreUrl('http://shop.example.com', { lookup: publicLookup })).rejects.toThrow(UnsafeUrlError)
    await expect(assertSafeStoreUrl('https://user:pw@shop.example.com', { lookup: publicLookup })).rejects.toThrow(/credentials/)
    await expect(assertSafeStoreUrl('https://shop.example.com:8080', { lookup: publicLookup })).rejects.toThrow(/port/)
    await expect(assertSafeStoreUrl('https://localhost', { lookup: publicLookup })).rejects.toThrow(/local/)
    await expect(assertSafeStoreUrl('https://shop.internal', { lookup: publicLookup })).rejects.toThrow(/local/)
    await expect(assertSafeStoreUrl('https://169.254.169.254/latest/meta-data', { lookup: publicLookup })).rejects.toThrow(/private or reserved/)
    await expect(assertSafeStoreUrl('https://[::1]/', { lookup: publicLookup })).rejects.toThrow(/private or reserved/)
    await expect(assertSafeStoreUrl('not a url', { lookup: publicLookup })).rejects.toThrow(/not a URL/)
  })
  it('rejects a host that resolves to a private address on any record, and one that does not resolve', async () => {
    await expect(assertSafeStoreUrl('https://evil.example.com', { lookup: async () => ['93.184.216.34', '10.0.0.5'] })).rejects.toThrow(/resolves to a private/)
    await expect(assertSafeStoreUrl('https://evil.example.com', { lookup: async () => ['::ffff:10.0.0.5'] })).rejects.toThrow(/resolves to a private/)
    await expect(assertSafeStoreUrl('https://nowhere.example.com', { lookup: async () => [] })).rejects.toThrow(/does not resolve/)
    await expect(assertSafeStoreUrl('https://nowhere.example.com', { lookup: async () => { throw new Error('ENOTFOUND') } })).rejects.toThrow(/does not resolve/)
  })
  it('accepts an explicitly allowed host without DNS checks', async () => {
    const url = await assertSafeStoreUrl('https://store.test:8443/api', { allowHosts: new Set(['store.test']), lookup: async () => [] })
    expect(url.port).toBe('8443')
  })
})

describe('safeFetch', () => {
  it('never follows redirects and bounds the response size', async () => {
    const redirect = vi.fn(async () => new Response(null, { status: 302, headers: { location: 'https://other.example.com' } }))
    await expect(safeFetch('https://shop.example.com/x', { lookup: publicLookup, fetchImpl: redirect as unknown as typeof fetch })).rejects.toMatchObject({ code: 'redirect' })
    expect((redirect.mock.calls[0] as unknown[])?.[1]).toMatchObject({ redirect: 'manual' })

    const big = vi.fn(async () => new Response('x'.repeat(2048), { status: 200 }))
    await expect(safeFetch('https://shop.example.com/x', { lookup: publicLookup, fetchImpl: big as unknown as typeof fetch, maxBytes: 1024 })).rejects.toMatchObject({ code: 'too_large' })
  })
  it('maps timeouts and network failures, parses JSON when present', async () => {
    const timeout = vi.fn(async () => { throw new DOMException('timed out', 'TimeoutError') })
    await expect(safeFetch('https://shop.example.com/x', { lookup: publicLookup, fetchImpl: timeout as unknown as typeof fetch })).rejects.toBeInstanceOf(StoreHttpError)
    const down = vi.fn(async () => { throw new TypeError('fetch failed') })
    await expect(safeFetch('https://shop.example.com/x', { lookup: publicLookup, fetchImpl: down as unknown as typeof fetch })).rejects.toMatchObject({ code: 'network' })
    const ok = vi.fn(async () => new Response(JSON.stringify({ a: 1 }), { status: 200, headers: { 'content-type': 'application/json' } }))
    const res = await safeFetch('https://shop.example.com/x', { lookup: publicLookup, fetchImpl: ok as unknown as typeof fetch })
    expect(res.json).toEqual({ a: 1 })
    expect(res.status).toBe(200)
  })
  it('maps a timeout that fires while the body streams, and a broken body, to StoreHttpError like a failed fetch', async () => {
    const slowBody = vi.fn(async () => new Response(new ReadableStream({ start(c) { c.error(new DOMException('timed out', 'TimeoutError')) } }), { status: 200 }))
    await expect(safeFetch('https://shop.example.com/x', { lookup: publicLookup, fetchImpl: slowBody as unknown as typeof fetch })).rejects.toMatchObject({ name: 'StoreHttpError', code: 'timeout', status: 200 })
    const broken = vi.fn(async () => new Response(new ReadableStream({ start(c) { c.error(new TypeError('terminated')) } }), { status: 200 }))
    await expect(safeFetch('https://shop.example.com/x', { lookup: publicLookup, fetchImpl: broken as unknown as typeof fetch })).rejects.toMatchObject({ name: 'StoreHttpError', code: 'network' })
  })
})
