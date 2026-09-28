// Google OAuth scopes per integration, and small pure helpers for the OAuth
// routes. Each integration asks only for what it uses (incremental
// authorization with include_granted_scopes), so connecting Calendar never
// asks for Gmail. Client-safe: no secrets, no I/O.

import type { IntegrationType } from '@/types'

export type GoogleIntegrationType = Exclude<IntegrationType, 'webhook'>

export const GOOGLE_INTEGRATION_TYPES: readonly GoogleIntegrationType[] = [
  'google_calendar',
  'gmail',
  'google_sheets',
  'google_docs',
  'google_drive',
] as const

const SCOPE_BASE = 'https://www.googleapis.com/auth/'

/** Identity scopes: the connected account's email is shown in the dashboard. */
export const GOOGLE_IDENTITY_SCOPES: readonly string[] = ['openid', 'email']

export const GOOGLE_SCOPES: Record<GoogleIntegrationType, readonly string[]> = {
  google_calendar: [
    `${SCOPE_BASE}calendar.events`,
    `${SCOPE_BASE}calendar.freebusy`,
    `${SCOPE_BASE}calendar.calendarlist.readonly`,
  ],
  gmail: [`${SCOPE_BASE}gmail.send`],
  google_sheets: [`${SCOPE_BASE}spreadsheets`],
  google_docs: [`${SCOPE_BASE}documents`],
  google_drive: [`${SCOPE_BASE}drive.file`],
}

/**
 * Broader scopes that already include a narrow one. Connections made before
 * incremental scopes were granted the full calendar scope.
 */
const IMPLIED_BY: Record<string, readonly string[]> = {
  [`${SCOPE_BASE}calendar.events`]: [`${SCOPE_BASE}calendar`],
  [`${SCOPE_BASE}calendar.freebusy`]: [`${SCOPE_BASE}calendar`, `${SCOPE_BASE}calendar.readonly`],
  [`${SCOPE_BASE}calendar.calendarlist.readonly`]: [
    `${SCOPE_BASE}calendar`,
    `${SCOPE_BASE}calendar.readonly`,
    `${SCOPE_BASE}calendar.calendarlist`,
  ],
  [`${SCOPE_BASE}drive.file`]: [`${SCOPE_BASE}drive`],
}

export function isGoogleIntegrationType(value: unknown): value is GoogleIntegrationType {
  return typeof value === 'string' && (GOOGLE_INTEGRATION_TYPES as readonly string[]).includes(value)
}

/** Everything one connect request asks for. */
export function scopesForType(type: GoogleIntegrationType): string[] {
  return [...GOOGLE_IDENTITY_SCOPES, ...GOOGLE_SCOPES[type]]
}

/** The space-separated `scope` of a token response → unique list. */
export function parseGrantedScopes(scope: string | null | undefined): string[] {
  if (typeof scope !== 'string') return []
  return [...new Set(scope.split(/\s+/).filter(Boolean))]
}

/**
 * Scopes the integration needs but the account didn't grant. Google's consent
 * screen lets people untick individual permissions, so a successful OAuth
 * round trip doesn't mean the integration can work.
 */
export function missingScopes(type: GoogleIntegrationType, granted: readonly string[]): string[] {
  const have = new Set(granted)
  return GOOGLE_SCOPES[type].filter((scope) => !have.has(scope) && !(IMPLIED_BY[scope] ?? []).some((broader) => have.has(broader)))
}

/**
 * Email claim of an ID token from Google's token endpoint. The token came
 * straight from Google over TLS in the code exchange, which OpenID Connect
 * allows to trust without re-checking the signature; it is only displayed.
 */
export function emailFromIdToken(idToken: string | null | undefined): string | null {
  if (typeof idToken !== 'string') return null
  const payload = idToken.split('.')[1]
  if (!payload) return null
  try {
    const base64 = payload.replace(/-/g, '+').replace(/_/g, '/').padEnd(Math.ceil(payload.length / 4) * 4, '=')
    const bytes = Uint8Array.from(atob(base64), (c) => c.charCodeAt(0))
    const claims = JSON.parse(new TextDecoder().decode(bytes)) as Record<string, unknown>
    const email = typeof claims.email === 'string' ? claims.email.trim() : ''
    return email && email.length <= 320 && email.includes('@') ? email : null
  } catch {
    return null
  }
}

/** httpOnly cookies that carry the OAuth round trip: CSRF nonce and where to return. */
export const GOOGLE_OAUTH_STATE_COOKIE = 'g_oauth_state'
export const GOOGLE_OAUTH_RETURN_COOKIE = 'g_oauth_return'
export const GOOGLE_OAUTH_COOKIE_PATH = '/api/integrations/google'

/** `<type>.<nonce>` from the OAuth state parameter, or null when it isn't one of ours. */
export function parseOAuthState(state: string | null | undefined): { type: GoogleIntegrationType; nonce: string } | null {
  if (typeof state !== 'string' || state.length > 256) return null
  const dot = state.indexOf('.')
  if (dot <= 0) return null
  const type = state.slice(0, dot)
  const nonce = state.slice(dot + 1)
  if (!isGoogleIntegrationType(type) || !/^[A-Za-z0-9_-]{16,128}$/.test(nonce)) return null
  return { type, nonce }
}

const DEFAULT_RETURN_PATH = '/integrations'

/**
 * A same-site path to send the user back to after OAuth. Anything that could
 * leave the app (absolute URLs, protocol-relative "//host", backslashes,
 * control characters) falls back to the integrations page.
 */
export function safeReturnPath(raw: string | null | undefined, fallback = DEFAULT_RETURN_PATH): string {
  if (typeof raw !== 'string') return fallback
  const value = raw.trim()
  if (!value || value.length > 512) return fallback
  if (!value.startsWith('/') || value.startsWith('//') || value.includes('\\') || /\p{Cc}/u.test(value)) return fallback
  try {
    const base = 'https://app.invalid'
    const url = new URL(value, base)
    if (url.origin !== base) return fallback
    if (url.pathname.startsWith('/api/')) return fallback
    return `${url.pathname}${url.search}${url.hash}`
  } catch {
    return fallback
  }
}

/** Adds query parameters to an internal path, keeping its existing query and hash. */
export function withQuery(path: string, params: Record<string, string>): string {
  const base = 'https://app.invalid'
  const url = new URL(path, base)
  for (const [key, value] of Object.entries(params)) url.searchParams.set(key, value)
  return `${url.pathname}${url.search}${url.hash}`
}
