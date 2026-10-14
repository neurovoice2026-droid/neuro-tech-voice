import 'server-only'
// Outbound HTTP to merchant stores with an SSRF guard. Every store URL
// (WooCommerce, Magento, PrestaShop, custom) is merchant-supplied, so before
// each request:
//   • https only, no credentials in the URL, a public port;
//   • the host must not be an IP literal in a loopback / private / link-local
//     / metadata / multicast / reserved range, and every address it resolves
//     to must be public as well (A and AAAA, checked on each request so a
//     changed record is caught);
//   • redirects are never followed automatically (a 3xx is an error unless the
//     caller re-validates the Location and asks again);
//   • a timeout and a response-size limit apply.
// DNS rebinding between the check and the connection cannot be excluded with
// the platform fetch (no connection pinning); the check runs per request and
// the allow-list of ports keeps the reachable surface small.

import dns from 'node:dns/promises'
import net from 'node:net'

export class UnsafeUrlError extends Error {
  constructor(readonly reason: string) {
    super(`unsafe store URL: ${reason}`)
    this.name = 'UnsafeUrlError'
  }
}

export class StoreHttpError extends Error {
  constructor(
    readonly code: 'timeout' | 'network' | 'too_large' | 'redirect' | 'http',
    message: string,
    readonly status: number | null = null,
  ) {
    super(message)
    this.name = 'StoreHttpError'
  }
}

export const DEFAULT_TIMEOUT_MS = 15_000
export const DEFAULT_MAX_BYTES = 4 * 1024 * 1024
const ALLOWED_PORTS = new Set(['', '443', '8443'])

function ipv4ToInt(ip: string): number {
  return ip.split('.').reduce((acc, part) => acc * 256 + Number(part), 0) >>> 0
}

function inV4Range(ip: string, cidr: string): boolean {
  const [base, bits] = cidr.split('/')
  const mask = bits === '0' ? 0 : (~0 << (32 - Number(bits))) >>> 0
  return (ipv4ToInt(ip) & mask) === (ipv4ToInt(base) & mask)
}

const BLOCKED_V4 = [
  '0.0.0.0/8', // "this" network
  '10.0.0.0/8', // private
  '100.64.0.0/10', // carrier-grade NAT
  '127.0.0.0/8', // loopback
  '169.254.0.0/16', // link-local (cloud metadata lives at 169.254.169.254)
  '172.16.0.0/12', // private
  '192.0.0.0/24', // IETF protocol assignments
  '192.0.2.0/24', // TEST-NET-1
  '192.168.0.0/16', // private
  '198.18.0.0/15', // benchmarking
  '198.51.100.0/24', // TEST-NET-2
  '203.0.113.0/24', // TEST-NET-3
  '224.0.0.0/4', // multicast
  '240.0.0.0/4', // reserved + broadcast
]

/** True for an address that must never be contacted. Unknown shapes count as blocked. */
export function isBlockedAddress(address: string): boolean {
  const family = net.isIP(address)
  if (family === 4) return BLOCKED_V4.some((cidr) => inV4Range(address, cidr))
  if (family !== 6) return true
  const ip = address.toLowerCase().replace(/^\[|\]$/g, '')
  // IPv4-mapped (::ffff:a.b.c.d) → judge the embedded IPv4.
  const mapped = ip.match(/^::ffff:(\d+\.\d+\.\d+\.\d+)$/)
  if (mapped) return isBlockedAddress(mapped[1])
  const mappedHex = ip.match(/^::ffff:([0-9a-f]{1,4}):([0-9a-f]{1,4})$/)
  if (mappedHex) {
    const hi = parseInt(mappedHex[1], 16)
    const lo = parseInt(mappedHex[2], 16)
    return isBlockedAddress(`${hi >> 8}.${hi & 255}.${lo >> 8}.${lo & 255}`)
  }
  if (ip === '::' || ip === '::1') return true
  if (/^fe[89ab]/.test(ip)) return true // link-local fe80::/10
  if (/^f[cd]/.test(ip)) return true // unique local fc00::/7
  if (/^ff/.test(ip)) return true // multicast
  if (/^64:ff9b:/.test(ip)) return true // NAT64 (embeds IPv4)
  if (/^2001:db8:/.test(ip)) return true // documentation
  if (/^::/.test(ip)) return true // IPv4-compatible and other :: prefixes
  return false
}

export interface SafeUrlOptions {
  /** Extra ports to accept (merchant-run stores sometimes use 8443). */
  allowedPorts?: readonly string[]
  /** Hosts to accept without the IP checks (tests, a documented local store). Never read from user input. */
  allowHosts?: ReadonlySet<string>
  lookup?: (hostname: string) => Promise<string[]>
}

async function defaultLookup(hostname: string): Promise<string[]> {
  const records = await dns.lookup(hostname, { all: true, verbatim: true })
  return records.map((r) => r.address)
}

/** Parses and validates a merchant URL for outbound use; throws UnsafeUrlError. Pure except for the DNS lookup. */
export async function assertSafeStoreUrl(raw: string, opts: SafeUrlOptions = {}): Promise<URL> {
  let url: URL
  try {
    url = new URL(raw)
  } catch (err) {
    throw new UnsafeUrlError(`not a URL (${err instanceof Error ? err.message : 'parse failed'})`)
  }
  if (url.protocol !== 'https:') throw new UnsafeUrlError('only https is allowed')
  if (url.username || url.password) throw new UnsafeUrlError('credentials in the URL are not allowed')
  const ports = new Set([...ALLOWED_PORTS, ...(opts.allowedPorts ?? [])])
  if (!ports.has(url.port)) throw new UnsafeUrlError(`port ${url.port} is not allowed`)
  const host = url.hostname.toLowerCase().replace(/\.$/, '')
  if (!host) throw new UnsafeUrlError('empty host')
  if (opts.allowHosts?.has(host)) return url
  if (host === 'localhost' || host.endsWith('.localhost') || host.endsWith('.local') || host.endsWith('.internal') || host.endsWith('.home.arpa')) {
    throw new UnsafeUrlError('local hosts are not allowed')
  }
  const literal = host.replace(/^\[|\]$/g, '')
  if (net.isIP(literal)) {
    if (isBlockedAddress(literal)) throw new UnsafeUrlError('private or reserved address')
    return url
  }
  if (!/^[a-z0-9]([a-z0-9-]{0,62}[a-z0-9])?(\.[a-z0-9]([a-z0-9-]{0,62}[a-z0-9])?)+$/.test(host)) throw new UnsafeUrlError('host name is not valid')
  let addresses: string[]
  try {
    addresses = await (opts.lookup ?? defaultLookup)(host)
  } catch (err) {
    throw new UnsafeUrlError(`host does not resolve (${err instanceof Error ? err.message : 'lookup failed'})`)
  }
  if (!addresses.length) throw new UnsafeUrlError('host does not resolve')
  for (const address of addresses) {
    if (isBlockedAddress(address)) throw new UnsafeUrlError('host resolves to a private or reserved address')
  }
  return url
}

export interface SafeFetchOptions extends SafeUrlOptions {
  method?: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH'
  headers?: Record<string, string>
  body?: string
  timeoutMs?: number
  maxBytes?: number
  fetchImpl?: typeof fetch
}

export interface SafeFetchResult {
  status: number
  headers: Headers
  text: string
  /** Parsed JSON body, or undefined when the body is not JSON. */
  json: unknown
}

/** HTTPS request to a validated store URL. Rejects redirects; bounds time and size. */
export async function safeFetch(raw: string, opts: SafeFetchOptions = {}): Promise<SafeFetchResult> {
  const url = await assertSafeStoreUrl(raw, opts)
  const doFetch = opts.fetchImpl ?? fetch
  let res: Response
  try {
    res = await doFetch(url.toString(), {
      method: opts.method ?? 'GET',
      headers: { accept: 'application/json', ...(opts.headers ?? {}) },
      body: opts.body,
      redirect: 'manual',
      signal: AbortSignal.timeout(opts.timeoutMs ?? DEFAULT_TIMEOUT_MS),
    })
  } catch (err) {
    const name = err instanceof Error ? err.name : ''
    if (name === 'TimeoutError' || name === 'AbortError') throw new StoreHttpError('timeout', 'the store did not answer in time')
    throw new StoreHttpError('network', `the store could not be reached (${err instanceof Error ? err.message.slice(0, 120) : 'network error'})`)
  }
  if (res.status >= 300 && res.status < 400) {
    throw new StoreHttpError('redirect', 'the store answered with a redirect; use the final https address', res.status)
  }
  const limit = opts.maxBytes ?? DEFAULT_MAX_BYTES
  const declared = Number(res.headers.get('content-length') ?? '0')
  if (declared > limit) throw new StoreHttpError('too_large', 'the store response is too large', res.status)
  let text: string
  try {
    text = await readBounded(res, limit)
  } catch (err) {
    // The timeout signal also aborts the body stream: a body that trickles past the deadline is a timeout, not a crash.
    if (err instanceof StoreHttpError) throw err
    const name = err instanceof Error ? err.name : ''
    if (name === 'TimeoutError' || name === 'AbortError') throw new StoreHttpError('timeout', 'the store did not answer in time', res.status)
    throw new StoreHttpError('network', `the store body could not be read (${err instanceof Error ? err.message.slice(0, 120) : 'read error'})`, res.status)
  }
  let json: unknown
  const type = res.headers.get('content-type') ?? ''
  if (text && (type.includes('json') || /^[\s]*[[{]/.test(text))) {
    try {
      json = JSON.parse(text)
    } catch (err) {
      void err // Not JSON after all: callers see `text` and decide.
      json = undefined
    }
  }
  return { status: res.status, headers: res.headers, text, json }
}

async function readBounded(res: Response, limit: number): Promise<string> {
  if (!res.body) return ''
  const reader = res.body.getReader()
  const chunks: Uint8Array[] = []
  let size = 0
  for (;;) {
    const { done, value } = await reader.read()
    if (done) break
    size += value.byteLength
    if (size > limit) {
      await reader.cancel()
      throw new StoreHttpError('too_large', 'the store response is too large', res.status)
    }
    chunks.push(value)
  }
  return Buffer.concat(chunks).toString('utf8')
}
