import { createHash } from 'node:crypto'
import { HEADER_BOOT } from '@/lib/header-dock'

// Content Security Policy for every HTML response, built by proxy.ts.
//
// Two policies, because a nonce only works on HTML that is rendered per
// request (Next reads it from the request's CSP header while rendering):
//
//   dynamic  pages rendered on every request (the dashboard, onboarding) get
//            a fresh nonce + 'strict-dynamic'. Next stamps the nonce on its own
//            scripts; the root layout's inline header boot script is allowed
//            by its sha256 hash, so the layout never has to read headers()
//            (which would turn every static route dynamic).
//   static   prerendered pages (marketing, product, legal, sign-in) are HTML
//            built once at deploy time, so no nonce can exist. They get a host
//            allowlist with 'unsafe-inline' scripts instead.
//
// The static policy works for any page; the nonce policy only works for pages
// that really render per request. So classification is by exact route, and
// anything unknown (a new nested page, a 404) falls back to the static one.
//
// No 'server-only' marker: this module holds no secrets and runs inside the
// proxy bundle. It reads two non-secret URLs from the environment.

export type PathKind = 'dynamic' | 'static' | 'api'

/** Request header carrying the per-request nonce to server components. */
export const NONCE_HEADER = 'x-nonce'

/**
 * Pages that are rendered per request (their layout or page reads cookies).
 * Exact paths: keep this list in step with app/(dashboard) and app/onboarding.
 * A dynamic page missing from here still works, under the static policy.
 */
export const DYNAMIC_APP_ROUTES: readonly string[] = [
  '/dashboard',
  '/calls',
  '/agent',
  '/phone',
  '/integrations',
  '/workflows',
  '/billing',
  '/inbox',
  '/voice-lab',
  '/settings',
  '/onboarding',
]

const DYNAMIC_ROUTE_SET = new Set(DYNAMIC_APP_ROUTES)

/** Sources every policy allows images from (org logos, Google avatars). */
const IMAGE_HOSTS = ['https://*.supabase.co', 'https://lh3.googleusercontent.com']

const STRIPE_API = 'https://api.stripe.com'
const VERCEL_LIVE = 'https://vercel.live'

export function classifyPath(pathname: string): PathKind {
  const path = pathname.length > 1 ? pathname.replace(/\/+$/, '') || '/' : pathname
  if (path === '/api' || path.startsWith('/api/')) return 'api'
  return DYNAMIC_ROUTE_SET.has(path) ? 'dynamic' : 'static'
}

/** 128 random bits, base64. Unique per request, never reused. */
export function createNonce(): string {
  const bytes = new Uint8Array(16)
  crypto.getRandomValues(bytes)
  return Buffer.from(bytes).toString('base64')
}

/** CSP hash source for an inline script, computed over its exact text. */
export function scriptHash(source: string): string {
  return `'sha256-${createHash('sha256').update(source, 'utf8').digest('base64')}'`
}

/**
 * Hash of the header boot script app/layout.tsx inlines verbatim. Computed
 * from the same constant the layout renders, so the two cannot drift.
 */
export const HEADER_BOOT_HASH = scriptHash(HEADER_BOOT)

/** `https://host[:port]` of an http(s) URL, or null when it doesn't parse. */
export function httpsOrigin(raw: string | null | undefined): string | null {
  if (!raw) return null
  try {
    const url = new URL(raw.trim())
    if (url.protocol !== 'https:' && url.protocol !== 'http:') return null
    return url.origin
  } catch {
    return null
  }
}

/** The WebSocket origin matching an http(s) or ws(s) URL, or null. */
export function webSocketOrigin(raw: string | null | undefined): string | null {
  if (!raw) return null
  try {
    const url = new URL(raw.trim())
    const secure = url.protocol === 'https:' || url.protocol === 'wss:'
    const plain = url.protocol === 'http:' || url.protocol === 'ws:'
    if (!secure && !plain) return null
    return `${secure ? 'wss' : 'ws'}://${url.host}`
  } catch {
    return null
  }
}

export interface CspOptions {
  /** Per-request nonce for dynamic pages; null builds the static policy. */
  nonce: string | null
  /** `next dev`: React needs eval for its debugging aids, HMR needs ws. */
  dev: boolean
  /** Supabase project URL. Defaults to NEXT_PUBLIC_SUPABASE_URL; null omits it. */
  supabaseUrl?: string | null
  /** Voice gateway base URL. Defaults to VOICE_GATEWAY_URL; null omits it. */
  gatewayUrl?: string | null
  /** Defaults to !dev. Pass false for plain-http hosts such as `next start` on localhost. */
  upgradeInsecureRequests?: boolean
  /** Vercel preview deployments inject the Vercel toolbar. Defaults to VERCEL_ENV === 'preview'. */
  vercelPreview?: boolean
}

function unique(values: (string | null | undefined | false)[]): string[] {
  return [...new Set(values.filter((v): v is string => typeof v === 'string' && v.length > 0))]
}

export function buildCsp(options: CspOptions): string {
  const { nonce, dev } = options
  const supabaseUrl =
    options.supabaseUrl === undefined ? process.env.NEXT_PUBLIC_SUPABASE_URL : options.supabaseUrl
  const gatewayUrl =
    options.gatewayUrl === undefined ? process.env.VOICE_GATEWAY_URL : options.gatewayUrl
  const upgrade = options.upgradeInsecureRequests ?? !dev
  const preview = options.vercelPreview ?? process.env.VERCEL_ENV === 'preview'

  if (nonce !== null && !/^[A-Za-z0-9+/=_-]{16,}$/.test(nonce)) {
    // A nonce that could break out of the header value is a bug, not an input.
    throw new Error('Invalid CSP nonce')
  }

  const scriptSrc =
    nonce !== null
      ? unique(["'self'", `'nonce-${nonce}'`, "'strict-dynamic'", HEADER_BOOT_HASH, dev && "'unsafe-eval'"])
      : unique(["'self'", "'unsafe-inline'", dev && "'unsafe-eval'", preview && VERCEL_LIVE])

  const connectSrc = unique([
    "'self'",
    httpsOrigin(supabaseUrl),
    webSocketOrigin(supabaseUrl),
    STRIPE_API,
    webSocketOrigin(gatewayUrl),
    dev && 'ws:',
    preview && VERCEL_LIVE,
    preview && 'wss://ws-us3.pusher.com',
  ])

  const directives: [string, string[]][] = [
    ['default-src', ["'self'"]],
    ['script-src', scriptSrc],
    ['style-src', unique(["'self'", "'unsafe-inline'", preview && VERCEL_LIVE])],
    ['img-src', unique(["'self'", 'data:', 'blob:', ...IMAGE_HOSTS, preview && VERCEL_LIVE, preview && 'https://vercel.com'])],
    ['font-src', unique(["'self'", 'data:', preview && VERCEL_LIVE, preview && 'https://assets.vercel.com'])],
    ['connect-src', connectSrc],
    ['media-src', ["'self'", 'blob:', 'data:']],
    ['worker-src', ["'self'", 'blob:']],
    ['frame-src', unique(["'self'", preview && VERCEL_LIVE])],
    ['object-src', ["'none'"]],
    ['base-uri', ["'self'"]],
    ['form-action', ["'self'"]],
    ['frame-ancestors', ["'none'"]],
  ]

  const parts = directives.map(([name, sources]) => `${name} ${sources.join(' ')}`)
  if (upgrade) parts.push('upgrade-insecure-requests')
  return parts.join('; ')
}
