import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const lookup = vi.hoisted(() => vi.fn())

vi.mock('node:dns', () => ({ default: { promises: { lookup } } }))

import { assertPublicHttpsUrl, isBlockedIp, ResponseTooLargeError, safeFetch, UnsafeUrlError } from './ssrf'

beforeEach(() => {
  lookup.mockReset()
  lookup.mockResolvedValue([{ address: '93.184.216.34', family: 4 }])
})

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('isBlockedIp', () => {
  it.each([
    '0.0.0.0', '0.1.2.3', '10.0.0.1', '10.255.255.255', '100.64.0.1', '100.127.255.255',
    '127.0.0.1', '127.255.0.9', '169.254.169.254', '172.16.0.1', '172.31.255.255',
    '192.0.0.8', '192.0.2.1', '192.168.1.1', '198.18.0.1', '198.51.100.7', '203.0.113.5',
    '224.0.0.1', '239.255.255.250', '240.0.0.1', '255.255.255.255',
  ])('blocks IPv4 %s', (ip) => {
    expect(isBlockedIp(ip)).toBe(true)
  })

  it.each(['8.8.8.8', '1.1.1.1', '93.184.216.34', '100.63.255.255', '100.128.0.1', '172.15.255.255', '172.32.0.1', '11.0.0.1'])(
    'allows public IPv4 %s',
    (ip) => {
      expect(isBlockedIp(ip)).toBe(false)
    }
  )

  it.each([
    '::', '::1', '0:0:0:0:0:0:0:1', 'fc00::1', 'fd12:3456::1', 'fe80::1', 'febf::1', 'fec0::1', 'ff02::1',
    '::ffff:127.0.0.1', '::ffff:7f00:1', '::ffff:10.0.0.1', '::ffff:a9fe:a9fe', '::127.0.0.1',
    '64:ff9b::a9fe:a9fe', '2002:7f00:0001::', '2002:c0a8:0101::1', '2001:db8::1', '2001::1', '3fff::1',
    '100::1',
  ])('blocks IPv6 %s', (ip) => {
    expect(isBlockedIp(ip)).toBe(true)
  })

  it.each(['2606:4700:4700::1111', '2001:4860:4860::8888', '::ffff:8.8.8.8', '64:ff9b::808:808', '2002:0808:0808::1'])(
    'allows public IPv6 %s',
    (ip) => {
      expect(isBlockedIp(ip)).toBe(false)
    }
  )

  it('blocks anything that is not an IP', () => {
    expect(isBlockedIp('example.com')).toBe(true)
    expect(isBlockedIp('')).toBe(true)
  })
})

describe('assertPublicHttpsUrl', () => {
  it.each([
    'https://127.0.0.1/',
    'https://0x7f.1/',
    'https://2130706433/',
    'https://017700000001/',
    'https://0177.0.0.1/',
    'https://127.1/',
    'https://[::1]/',
    'https://[::ffff:127.0.0.1]/',
    'https://[::ffff:169.254.169.254]/latest/meta-data',
    'https://169.254.169.254/latest/meta-data/',
    'https://10.0.0.5/',
    'https://[fd00::1]/',
    'https://[fe80::1]/',
    'https://100.100.100.200/',
  ])('blocks literal private host %s without DNS', async (url) => {
    await expect(assertPublicHttpsUrl(url)).rejects.toThrow(UnsafeUrlError)
    expect(lookup).not.toHaveBeenCalled()
  })

  it('blocks localhost names', async () => {
    await expect(assertPublicHttpsUrl('https://localhost/')).rejects.toThrow(/private/)
    await expect(assertPublicHttpsUrl('https://LOCALHOST./')).rejects.toThrow(/private/)
    await expect(assertPublicHttpsUrl('https://api.localhost/')).rejects.toThrow(/private/)
    expect(lookup).not.toHaveBeenCalled()
  })

  it('requires https unless http is allowed', async () => {
    await expect(assertPublicHttpsUrl('http://example.com/')).rejects.toThrow(/https/)
    await expect(assertPublicHttpsUrl('http://example.com/', { allowHttp: true })).resolves.toBeInstanceOf(URL)
    await expect(assertPublicHttpsUrl('ftp://example.com/', { allowHttp: true })).rejects.toThrow(UnsafeUrlError)
    await expect(assertPublicHttpsUrl('file:///etc/passwd')).rejects.toThrow(UnsafeUrlError)
    await expect(assertPublicHttpsUrl('javascript:alert(1)')).rejects.toThrow(UnsafeUrlError)
  })

  it('rejects credentials, odd ports and junk', async () => {
    await expect(assertPublicHttpsUrl('https://user:pass@example.com/')).rejects.toThrow(/credentials/)
    await expect(assertPublicHttpsUrl('https://user@example.com/')).rejects.toThrow(/credentials/)
    await expect(assertPublicHttpsUrl('https://example.com:8443/')).rejects.toThrow(/ports/)
    await expect(assertPublicHttpsUrl('https://example.com:22/')).rejects.toThrow(/ports/)
    await expect(assertPublicHttpsUrl('not a url')).rejects.toThrow(/not valid/)
    await expect(assertPublicHttpsUrl('')).rejects.toThrow(/required/)
    await expect(assertPublicHttpsUrl(`https://example.com/${'a'.repeat(3000)}`)).rejects.toThrow(/too long/)
  })

  it('allows explicit ports 80 and 443', async () => {
    await expect(assertPublicHttpsUrl('https://example.com:443/x')).resolves.toBeInstanceOf(URL)
    await expect(assertPublicHttpsUrl('https://example.com:80/x')).resolves.toBeInstanceOf(URL)
  })

  it('resolves names with dns.lookup({ all: true })', async () => {
    const url = await assertPublicHttpsUrl('https://hooks.example.com/path?q=1')
    expect(url.toString()).toBe('https://hooks.example.com/path?q=1')
    expect(lookup).toHaveBeenCalledWith('hooks.example.com', expect.objectContaining({ all: true }))
  })

  it('blocks names that resolve to private addresses', async () => {
    lookup.mockResolvedValueOnce([{ address: '10.1.2.3', family: 4 }])
    await expect(assertPublicHttpsUrl('https://internal.example.com/')).rejects.toThrow(/private/)
    lookup.mockResolvedValueOnce([{ address: '::ffff:169.254.169.254', family: 6 }])
    await expect(assertPublicHttpsUrl('https://metadata.example.com/')).rejects.toThrow(/private/)
  })

  it('blocks when any resolved address is private', async () => {
    lookup.mockResolvedValueOnce([
      { address: '93.184.216.34', family: 4 },
      { address: '127.0.0.1', family: 4 },
    ])
    await expect(assertPublicHttpsUrl('https://rebind.example.com/')).rejects.toThrow(/private/)
  })

  it('fails closed when DNS fails or returns nothing', async () => {
    lookup.mockRejectedValueOnce(Object.assign(new Error('getaddrinfo ENOTFOUND'), { code: 'ENOTFOUND' }))
    await expect(assertPublicHttpsUrl('https://nope.example.com/')).rejects.toThrow(/resolved/)
    lookup.mockResolvedValueOnce([])
    await expect(assertPublicHttpsUrl('https://empty.example.com/')).rejects.toThrow(/resolved/)
  })
})

describe('safeFetch', () => {
  it('returns status, headers, body and final url', async () => {
    const fetchMock = vi.fn(async () => new Response('hello', { status: 200, headers: { 'content-type': 'text/plain' } }))
    vi.stubGlobal('fetch', fetchMock)
    const res = await safeFetch('https://example.com/a')
    expect(res.status).toBe(200)
    expect(res.headers.get('content-type')).toBe('text/plain')
    expect(new TextDecoder().decode(res.body)).toBe('hello')
    expect(res.finalUrl).toBe('https://example.com/a')
    const calls = fetchMock.mock.calls as unknown as [URL, RequestInit][]
    expect(calls[0][1].redirect).toBe('manual')
  })

  it('never fetches a blocked URL', async () => {
    const fetchMock = vi.fn()
    vi.stubGlobal('fetch', fetchMock)
    await expect(safeFetch('https://169.254.169.254/')).rejects.toThrow(UnsafeUrlError)
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('re-validates every redirect hop', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(new Response(null, { status: 302, headers: { location: 'https://127.0.0.1/admin' } }))
    vi.stubGlobal('fetch', fetchMock)
    await expect(safeFetch('https://example.com/start')).rejects.toThrow(/private/)
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })

  it('follows safe relative redirects and rewrites POST to GET on 303', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(new Response(null, { status: 303, headers: { location: '/done' } }))
      .mockResolvedValueOnce(new Response('ok'))
    vi.stubGlobal('fetch', fetchMock)
    const res = await safeFetch('https://example.com/submit', {
      method: 'POST',
      body: '{}',
      headers: { 'content-type': 'application/json', authorization: 'Bearer t' },
    })
    expect(res.finalUrl).toBe('https://example.com/done')
    const second = fetchMock.mock.calls[1] as [URL, RequestInit]
    expect(second[0].toString()).toBe('https://example.com/done')
    expect(second[1].method).toBe('GET')
    expect(second[1].body).toBeUndefined()
    // Same origin: credentials may stay.
    expect(new Headers(second[1].headers).get('authorization')).toBe('Bearer t')
  })

  it('drops credentials on cross-origin redirects and keeps the method on 307', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(new Response(null, { status: 307, headers: { location: 'https://other.example.net/x' } }))
      .mockResolvedValueOnce(new Response('ok'))
    vi.stubGlobal('fetch', fetchMock)
    await safeFetch('https://example.com/submit', { method: 'POST', body: 'a=1', headers: { authorization: 'Bearer t', cookie: 'c=1' } })
    const second = fetchMock.mock.calls[1] as [URL, RequestInit]
    expect(second[1].method).toBe('POST')
    expect(second[1].body).toBe('a=1')
    const headers = new Headers(second[1].headers)
    expect(headers.get('authorization')).toBeNull()
    expect(headers.get('cookie')).toBeNull()
  })

  it('stops after maxRedirects', async () => {
    const fetchMock = vi.fn(async () => new Response(null, { status: 301, headers: { location: 'https://example.com/loop' } }))
    vi.stubGlobal('fetch', fetchMock)
    await expect(safeFetch('https://example.com/loop', undefined, { maxRedirects: 2 })).rejects.toThrow(/Too many redirects/)
    expect(fetchMock).toHaveBeenCalledTimes(3)
  })

  it('returns a redirect without location as a normal response', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response('moved', { status: 302 })))
    await expect(safeFetch('https://example.com/')).resolves.toMatchObject({ status: 302 })
  })

  it('enforces maxBytes while streaming', async () => {
    const chunk = new Uint8Array(400)
    let pulls = 0
    const stream = new ReadableStream<Uint8Array>({
      pull(controller) {
        pulls++
        controller.enqueue(chunk)
        if (pulls > 100) controller.close()
      },
    })
    vi.stubGlobal('fetch', vi.fn(async () => new Response(stream)))
    await expect(safeFetch('https://example.com/big', undefined, { maxBytes: 1000 })).rejects.toThrow(ResponseTooLargeError)
    expect(pulls).toBeLessThan(10)
  })

  it('rejects early on a large content-length', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response('x', { headers: { 'content-length': '5000000' } })))
    await expect(safeFetch('https://example.com/big', undefined, { maxBytes: 1000 })).rejects.toThrow(ResponseTooLargeError)
  })

  it('times out', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(
        (_url: URL, init: RequestInit) =>
          new Promise((_resolve, reject) => {
            init.signal?.addEventListener('abort', () => reject(init.signal?.reason))
          })
      )
    )
    await expect(safeFetch('https://example.com/slow', undefined, { timeoutMs: 20 })).rejects.toMatchObject({ name: 'TimeoutError' })
  })

  it('honours the caller abort signal', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(
        (_url: URL, init: RequestInit) =>
          new Promise((_resolve, reject) => {
            init.signal?.addEventListener('abort', () => reject(new DOMException('aborted', 'AbortError')))
          })
      )
    )
    const controller = new AbortController()
    const pending = safeFetch('https://example.com/slow', { signal: controller.signal })
    setTimeout(() => controller.abort(), 5)
    await expect(pending).rejects.toMatchObject({ name: 'AbortError' })
  })
})
