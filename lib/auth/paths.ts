// Shared by proxy.ts, the auth server actions and the sign-in form. No
// secrets and no server-only imports, so every one of them can use it.

/**
 * Remembers, per user id, that onboarding is finished so the proxy doesn't
 * query organizations on every request. Only a hint: the dashboard layout
 * re-reads the organization and redirects on its own.
 */
export const ONBOARDED_COOKIE = 'ntv_onboarded'

/**
 * Cookies @supabase/ssr keeps the session in: `sb-<project ref>-auth-token`,
 * its chunks (`.0`, `.1`…) when the session is large, and the PKCE
 * `-code-verifier`.
 */
export function isSupabaseAuthCookie(name: string): boolean {
  return /^sb-[A-Za-z0-9_-]+-auth-token(?:-code-verifier)?(?:\.\d+)?$/.test(name)
}

const MAX_NEXT_LENGTH = 512
const BASE = 'http://internal.invalid'

/** Paths a post-sign-in redirect must never land on. */
const BLOCKED_PREFIXES = ['/api', '/_next', '/login', '/register', '/auth', '/reset-password']

/**
 * A same-origin path to return to after signing in, or null.
 *
 * Rejects anything that could leave the site or loop: absolute and
 * protocol-relative URLs, backslash tricks browsers normalise to `//`,
 * control characters, API routes and the auth pages themselves.
 */
export function safeNextPath(raw: string | null | undefined): string | null {
  if (typeof raw !== 'string') return null
  const value = raw.trim()
  if (!value || value.length > MAX_NEXT_LENGTH) return null
  if (!value.startsWith('/') || value.startsWith('//')) return null
  // Backslashes and control characters (CR/LF could split a header).
  if (/[\\\u0000-\u001f\u007f]/.test(value)) return null

  let url: URL
  try {
    url = new URL(value, BASE)
  } catch {
    return null
  }
  if (url.origin !== BASE) return null

  const path = url.pathname
  if (BLOCKED_PREFIXES.some((prefix) => path === prefix || path.startsWith(`${prefix}/`))) {
    return null
  }
  return `${path}${url.search}`
}
