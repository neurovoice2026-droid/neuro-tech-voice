import { createServerClient } from '@supabase/ssr'
import { isAuthRetryableFetchError, type SupabaseClient } from '@supabase/supabase-js'
import { NextResponse, type NextRequest } from 'next/server'

// Session refresh for proxy.ts. Runs before every matched request so expired
// access tokens are refreshed and the new cookies reach the browser: Server
// Components can't write cookies, and a refresh they did on their own would
// rotate the refresh token without persisting it.
//
// No 'server-only' marker on purpose: this module is bundled into the proxy.

export interface SessionUser {
  id: string
  email: string | null
}

export interface SessionResult {
  /** Pass-through response carrying refreshed auth cookies (and request headers). */
  response: NextResponse
  /** Verified identity from the access token, or null when signed out. */
  user: SessionUser | null
  /** Null when Supabase isn't configured. */
  supabase: SupabaseClient | null
  /**
   * Asks the Auth server whether the session is still live. `user` above can
   * come from a locally verified token that outlives a sign-out on another
   * device by up to an hour, while pages ask the server. A revoked session has
   * its cookies cleared on the returned `response`, which replaces the one
   * above. Null `user` also when Auth can't be reached (logged).
   */
  confirmUser(): Promise<{ user: SessionUser | null; response: NextResponse }>
}

let warnedNotConfigured = false

/**
 * Supabase calls made from the proxy (token refresh, the onboarding lookup)
 * sit in front of every page, so a stalled connection must not hold the whole
 * site: each attempt gets a hard deadline. Auth retries a timed-out refresh on
 * its own, within its usual 30 s budget.
 */
const SUPABASE_FETCH_TIMEOUT_MS = 5_000

function fetchWithTimeout(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
  const timeout = AbortSignal.timeout(SUPABASE_FETCH_TIMEOUT_MS)
  const signal = init?.signal ? AbortSignal.any([init.signal, timeout]) : timeout
  return fetch(input, { ...init, signal })
}

function forward(request: NextRequest, extraHeaders?: Record<string, string>): NextResponse {
  if (!extraHeaders) return NextResponse.next({ request })
  // Built from request.headers at call time, so cookies refreshed a moment ago
  // (request.cookies.set writes the cookie header) are what the page sees.
  const headers = new Headers(request.headers)
  for (const [name, value] of Object.entries(extraHeaders)) headers.set(name, value)
  return NextResponse.next({ request: { headers } })
}

export async function updateSession(
  request: NextRequest,
  options: { requestHeaders?: Record<string, string> } = {}
): Promise<SessionResult> {
  let response = forward(request, options.requestHeaders)

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  if (!url || !anonKey) {
    if (!warnedNotConfigured) {
      warnedNotConfigured = true
      console.error('[auth] Supabase is not configured (NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_ANON_KEY); every visitor is treated as signed out')
    }
    return {
      response,
      user: null,
      supabase: null,
      confirmUser: async () => ({ user: null, response }),
    }
  }

  const supabase = createServerClient(url, anonKey, {
    global: { fetch: fetchWithTimeout },
    cookies: {
      getAll() {
        return request.cookies.getAll()
      },
      setAll(cookiesToSet, cacheHeaders) {
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))
        response = forward(request, options.requestHeaders)
        cookiesToSet.forEach(({ name, value, options: cookieOptions }) =>
          response.cookies.set(name, value, cookieOptions)
        )
        // A response that sets auth cookies must never be cached by a CDN.
        Object.entries(cacheHeaders ?? {}).forEach(([key, value]) => response.headers.set(key, value))
      },
    },
  })

  // getClaims() refreshes an expiring session exactly like getUser() (the new
  // cookies land in setAll above), then verifies the access token locally
  // against the project's JWKS when it uses asymmetric signing keys. Projects
  // still on the legacy shared secret fall back to one Auth server call.
  // Do not remove: it is what keeps sessions alive.
  let user: SessionUser | null = null
  try {
    const { data, error } = await supabase.auth.getClaims()
    const claims = data?.claims
    if (!error && claims && typeof claims.sub === 'string' && claims.sub) {
      user = { id: claims.sub, email: typeof claims.email === 'string' ? claims.email : null }
    }
  } catch (error) {
    // Network failures reaching Auth are thrown rather than returned. Treat the
    // visitor as signed out for this request; their cookies are left intact.
    console.error('[auth] session check failed', error instanceof Error ? error.name : 'unknown')
  }

  const confirmUser: SessionResult['confirmUser'] = async () => {
    try {
      const { data, error } = await supabase.auth.getUser()
      if (data?.user) return { user: { id: data.user.id, email: data.user.email ?? null }, response }
      // A revoked session is an ordinary answer (getUser has cleared its
      // cookies through setAll); only an unreachable Auth server is worth a log.
      if (error && isAuthRetryableFetchError(error)) {
        console.error('[auth] session confirmation failed', error.status ?? 0)
      }
    } catch (error) {
      console.error('[auth] session confirmation failed', error instanceof Error ? error.name : 'unknown')
    }
    return { user: null, response }
  }

  return { response, user, supabase, confirmUser }
}

/**
 * A redirect that keeps whatever auth cookies (and no-cache headers) the
 * session refresh put on `from`; dropping them would log the user out on the
 * next request because the refresh token was already rotated.
 */
export function redirectWithSession(target: URL, from: NextResponse): NextResponse {
  const redirect = NextResponse.redirect(target)
  for (const cookie of from.cookies.getAll()) redirect.cookies.set(cookie)
  for (const header of ['cache-control', 'expires', 'pragma']) {
    const value = from.headers.get(header)
    if (value) redirect.headers.set(header, value)
  }
  return redirect
}
