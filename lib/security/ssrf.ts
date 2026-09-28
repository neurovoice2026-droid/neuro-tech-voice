import 'server-only'
import dns from 'node:dns'
import net from 'node:net'

// Outbound fetches of user-supplied URLs (workflow webhooks, knowledge-base
// pages). The WHATWG URL parser already canonicalises host tricks such as
// "0x7f.1", "2130706433", "0177.0.0.1" or "[::ffff:127.0.0.1]" to plain IP
// literals, so every check below runs on the canonical form, and names are
// resolved with dns.lookup (the same resolver fetch uses).
//
// Known limit: fetch resolves the name again when it connects, so a DNS server
// that answers differently within milliseconds (rebinding) could still slip
// through. Pinning the address needs an undici dispatcher, which isn't a
// dependency; the window is tiny and redirects are re-validated hop by hop.

export class UnsafeUrlError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'UnsafeUrlError'
  }
}

export class ResponseTooLargeError extends Error {
  constructor(maxBytes: number) {
    super(`Response is larger than ${maxBytes} bytes`)
    this.name = 'ResponseTooLargeError'
  }
}

const MAX_URL_LENGTH = 2048
const DEFAULT_TIMEOUT_MS = 10_000
const DEFAULT_MAX_BYTES = 2 * 1024 * 1024
const DEFAULT_MAX_REDIRECTS = 3
const REDIRECT_STATUSES = new Set([301, 302, 303, 307, 308])

// ─── IPv4 ────────────────────────────────────────────────────────────────────

type Cidr4 = [base: number, prefix: number]

function ipv4ToInt(ip: string): number | null {
  const parts = ip.split('.')
  if (parts.length !== 4) return null
  let value = 0
  for (const part of parts) {
    if (!/^\d{1,3}$/.test(part)) return null
    const octet = Number(part)
    if (octet > 255) return null
    value = value * 256 + octet
  }
  return value
}

function cidr4(ip: string, prefix: number): Cidr4 {
  return [ipv4ToInt(ip) as number, prefix]
}

const BLOCKED_IPV4: Cidr4[] = [
  cidr4('0.0.0.0', 8), // "this network"
  cidr4('10.0.0.0', 8), // private
  cidr4('100.64.0.0', 10), // carrier-grade NAT
  cidr4('127.0.0.0', 8), // loopback
  cidr4('169.254.0.0', 16), // link-local, cloud metadata (169.254.169.254)
  cidr4('172.16.0.0', 12), // private
  cidr4('192.0.0.0', 24), // IETF protocol assignments (reserved)
  cidr4('192.0.2.0', 24), // TEST-NET-1 (reserved)
  cidr4('192.168.0.0', 16), // private
  cidr4('198.18.0.0', 15), // benchmarking (reserved)
  cidr4('198.51.100.0', 24), // TEST-NET-2 (reserved)
  cidr4('203.0.113.0', 24), // TEST-NET-3 (reserved)
  cidr4('224.0.0.0', 4), // multicast
  cidr4('240.0.0.0', 4), // reserved, includes 255.255.255.255 broadcast
]

function inCidr4(value: number, [base, prefix]: Cidr4): boolean {
  const size = 2 ** (32 - prefix)
  return Math.floor(value / size) === Math.floor(base / size)
}

function isBlockedIpv4(ip: string): boolean {
  const value = ipv4ToInt(ip)
  if (value === null) return true
  return BLOCKED_IPV4.some((range) => inCidr4(value, range))
}

// ─── IPv6 ────────────────────────────────────────────────────────────────────

/** Parses an IPv6 literal (with optional dotted IPv4 tail) into 16 bytes. */
function ipv6ToBytes(input: string): number[] | null {
  let ip = input
  const zone = ip.indexOf('%')
  if (zone !== -1) ip = ip.slice(0, zone)

  let tail: number[] = []
  const lastColon = ip.lastIndexOf(':')
  if (lastColon === -1) return null
  if (ip.includes('.')) {
    const v4 = ipv4ToInt(ip.slice(lastColon + 1))
    if (v4 === null) return null
    tail = [(v4 >>> 24) & 255, (v4 >>> 16) & 255, (v4 >>> 8) & 255, v4 & 255]
    // "::ffff:1.2.3.4" → "::ffff", but "::1.2.3.4" → "::" (keep the compression marker).
    ip = ip.slice(0, lastColon + 1)
    if (!ip.endsWith('::')) ip = ip.slice(0, -1)
  }

  const halves = ip.split('::')
  if (halves.length > 2) return null
  const splitGroups = (s: string) => (s === '' ? [] : s.split(':'))
  const head = splitGroups(halves[0])
  const rest = halves.length === 2 ? splitGroups(halves[1]) : []
  const groupsNeeded = tail.length ? 6 : 8
  let groups = head
  if (halves.length === 2) {
    const missing = groupsNeeded - head.length - rest.length
    if (missing < 1) return null
    groups = [...head, ...Array<string>(missing).fill('0'), ...rest]
  }
  if (groups.length !== groupsNeeded) return null

  const bytes: number[] = []
  for (const group of groups) {
    if (!/^[0-9a-f]{1,4}$/i.test(group)) return null
    const n = parseInt(group, 16)
    bytes.push((n >> 8) & 255, n & 255)
  }
  return [...bytes, ...tail]
}

function prefixMatches(bytes: number[], prefix: number[], bits: number): boolean {
  for (let i = 0; i < bits; i++) {
    const byte = i >> 3
    const mask = 0x80 >> i % 8
    if ((bytes[byte] & mask) !== ((prefix[byte] ?? 0) & mask)) return false
  }
  return true
}

function embeddedIpv4(bytes: number[], offset: number): string {
  return bytes.slice(offset, offset + 4).join('.')
}

function isBlockedIpv6(ip: string): boolean {
  const bytes = ipv6ToBytes(ip)
  if (!bytes) return true

  // IPv4-mapped (::ffff:a.b.c.d) and NAT64 (64:ff9b::a.b.c.d) inherit the IPv4 verdict.
  if (prefixMatches(bytes, [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0xff, 0xff], 96)) {
    return isBlockedIpv4(embeddedIpv4(bytes, 12))
  }
  if (prefixMatches(bytes, [0x00, 0x64, 0xff, 0x9b], 96)) {
    return isBlockedIpv4(embeddedIpv4(bytes, 12))
  }
  // Only global unicast (2000::/3) is reachable on the public internet. This
  // covers ::, ::1, IPv4-compatible ::/96, fc00::/7, fe80::/10, fec0::/10, ff00::/8.
  if (!prefixMatches(bytes, [0x20], 3)) return true
  // 6to4 (2002::/16) tunnels to the embedded IPv4 address.
  if (prefixMatches(bytes, [0x20, 0x02], 16)) return isBlockedIpv4(embeddedIpv4(bytes, 2))
  // IETF protocol assignments incl. Teredo (2001::/23) and documentation ranges.
  if (prefixMatches(bytes, [0x20, 0x01, 0x00, 0x00], 23)) return true
  if (prefixMatches(bytes, [0x20, 0x01, 0x0d, 0xb8], 32)) return true
  if (prefixMatches(bytes, [0x3f, 0xff], 20)) return true
  return false
}

/** True when the address must never be fetched (loopback, private, link-local, reserved…). */
export function isBlockedIp(ip: string): boolean {
  const kind = net.isIP(ip)
  if (kind === 4) return isBlockedIpv4(ip)
  if (kind === 6) return isBlockedIpv6(ip)
  return true
}

// ─── URL validation ──────────────────────────────────────────────────────────

function isLocalName(host: string): boolean {
  return host === 'localhost' || host.endsWith('.localhost')
}

export async function assertPublicHttpsUrl(raw: string, opts?: { allowHttp?: boolean }): Promise<URL> {
  if (typeof raw !== 'string' || !raw.trim()) throw new UnsafeUrlError('URL is required')
  if (raw.length > MAX_URL_LENGTH) throw new UnsafeUrlError('URL is too long')

  let url: URL
  try {
    url = new URL(raw.trim())
  } catch {
    throw new UnsafeUrlError('URL is not valid')
  }

  if (url.protocol !== 'https:' && !(opts?.allowHttp && url.protocol === 'http:')) {
    throw new UnsafeUrlError(opts?.allowHttp ? 'URL must use http or https' : 'URL must use https')
  }
  if (url.username || url.password) throw new UnsafeUrlError('URLs with credentials are not allowed')
  // URL drops default ports, so an empty port means 443 for https / 80 for http.
  if (url.port && url.port !== '443' && url.port !== '80') {
    throw new UnsafeUrlError('Only ports 80 and 443 are allowed')
  }

  let host = url.hostname.toLowerCase()
  if (host.startsWith('[') && host.endsWith(']')) host = host.slice(1, -1)
  host = host.replace(/\.$/, '')
  if (!host) throw new UnsafeUrlError('URL has no host')

  if (net.isIP(host)) {
    if (isBlockedIp(host)) throw new UnsafeUrlError('URL points to a private or reserved address')
    return url
  }
  if (isLocalName(host)) throw new UnsafeUrlError('URL points to a private or reserved address')

  let addresses: { address: string; family: number }[]
  try {
    addresses = await dns.promises.lookup(host, { all: true })
  } catch {
    throw new UnsafeUrlError('URL host could not be resolved')
  }
  if (addresses.length === 0) throw new UnsafeUrlError('URL host could not be resolved')
  // Every record must be public: a mixed answer is a classic rebinding setup.
  if (addresses.some(({ address }) => isBlockedIp(address))) {
    throw new UnsafeUrlError('URL points to a private or reserved address')
  }
  return url
}

// ─── Fetch ───────────────────────────────────────────────────────────────────

const CREDENTIAL_HEADERS = ['authorization', 'cookie', 'proxy-authorization']

async function readLimited(res: Response, maxBytes: number): Promise<Uint8Array> {
  const declared = res.headers.get('content-length')
  if (declared && /^\d+$/.test(declared) && Number(declared) > maxBytes) {
    await res.body?.cancel().catch(() => undefined)
    throw new ResponseTooLargeError(maxBytes)
  }
  if (!res.body) return new Uint8Array(0)

  const reader = res.body.getReader()
  const chunks: Uint8Array[] = []
  let received = 0
  for (;;) {
    const { done, value } = await reader.read()
    if (done) break
    received += value.byteLength
    if (received > maxBytes) {
      await reader.cancel().catch(() => undefined)
      throw new ResponseTooLargeError(maxBytes)
    }
    chunks.push(value)
  }
  const body = new Uint8Array(received)
  let offset = 0
  for (const chunk of chunks) {
    body.set(chunk, offset)
    offset += chunk.byteLength
  }
  return body
}

/**
 * fetch() for untrusted URLs: validates the URL (and every redirect hop),
 * caps time and response size, and never follows redirects automatically.
 */
export async function safeFetch(
  raw: string,
  init?: RequestInit,
  opts?: { timeoutMs?: number; maxBytes?: number; maxRedirects?: number; allowHttp?: boolean }
): Promise<{ status: number; headers: Headers; body: Uint8Array; finalUrl: string }> {
  const timeoutMs = opts?.timeoutMs ?? DEFAULT_TIMEOUT_MS
  const maxBytes = opts?.maxBytes ?? DEFAULT_MAX_BYTES
  const maxRedirects = opts?.maxRedirects ?? DEFAULT_MAX_REDIRECTS

  const controller = new AbortController()
  const timer = setTimeout(
    () => controller.abort(new DOMException(`Request timed out after ${timeoutMs} ms`, 'TimeoutError')),
    timeoutMs
  )
  const outer = init?.signal
  const forwardAbort = () => controller.abort(outer?.reason)
  if (outer) {
    if (outer.aborted) forwardAbort()
    else outer.addEventListener('abort', forwardAbort, { once: true })
  }

  let method = (init?.method ?? 'GET').toUpperCase()
  let body = init?.body
  const headers = new Headers(init?.headers)

  try {
    let current = await assertPublicHttpsUrl(raw, { allowHttp: opts?.allowHttp })
    for (let hop = 0; ; hop++) {
      const res = await fetch(current, {
        ...init,
        method,
        headers,
        body,
        redirect: 'manual',
        signal: controller.signal,
      })

      const location = res.headers.get('location')
      if (!REDIRECT_STATUSES.has(res.status) || !location) {
        return {
          status: res.status,
          headers: res.headers,
          body: await readLimited(res, maxBytes),
          finalUrl: current.toString(),
        }
      }

      await res.body?.cancel().catch(() => undefined)
      if (hop >= maxRedirects) throw new UnsafeUrlError('Too many redirects')

      let nextUrl: URL
      try {
        nextUrl = new URL(location, current)
      } catch {
        throw new UnsafeUrlError('Redirect location is not valid')
      }
      const next = await assertPublicHttpsUrl(nextUrl.toString(), { allowHttp: opts?.allowHttp })

      // Same method rewrites as the fetch spec: 303 (non-HEAD) and POST on 301/302 become GET.
      if ((res.status === 303 && method !== 'HEAD') || ((res.status === 301 || res.status === 302) && method === 'POST')) {
        method = 'GET'
        body = undefined
        headers.delete('content-type')
        headers.delete('content-length')
      }
      // Never forward credentials to another origin.
      if (next.origin !== current.origin) {
        for (const name of CREDENTIAL_HEADERS) headers.delete(name)
      }
      current = next
    }
  } finally {
    clearTimeout(timer)
    outer?.removeEventListener('abort', forwardAbort)
  }
}
