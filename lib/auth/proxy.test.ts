import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'
import { AuthRetryableFetchError, AuthSessionMissingError } from '@supabase/supabase-js'

// Exercises proxy.ts end to end (session refresh, redirects, onboarding hint,
// CSP) with a fake Supabase client in place of @supabase/ssr.

type CookieToSet = { name: string; value: string; options: Record<string, unknown> }
type CookieMethods = {
  getAll: () => { name: string; value: string }[]
  setAll: (cookies: CookieToSet[], headers: Record<string, string>) => void
}

const state = {
  claims: null as null | { sub: string; email?: string },
  /** What the Auth server says about the session: live, revoked elsewhere, or unreachable. */
  session: 'live' as 'live' | 'revoked' | 'unreachable',
  getUserCalls: 0,
  refreshCookies: null as CookieToSet[] | null,
  onboardingCompleted: true as boolean | null,
  orgQueries: 0,
  clientsCreated: 0,
  globalFetch: null as null | ((input: string, init?: RequestInit) => Promise<Response>),
}

vi.mock('@supabase/ssr', () => ({
  createServerClient: (
    _url: string,
    _key: string,
    options: { cookies: CookieMethods; global?: { fetch?: (input: string, init?: RequestInit) => Promise<Response> } }
  ) => {
    state.clientsCreated++
    state.globalFetch = options.global?.fetch ?? null
    return {
      auth: {
        getClaims: async () => {
          if (state.refreshCookies) {
            options.cookies.setAll(state.refreshCookies, { 'Cache-Control': 'private, no-cache, no-store, must-revalidate, max-age=0' })
          }
          return state.claims
            ? { data: { claims: state.claims }, error: null }
            : { data: null, error: null }
        },
        getUser: async () => {
          state.getUserCalls++
          if (state.claims && state.session === 'live') {
            return { data: { user: { id: state.claims.sub, email: state.claims.email } }, error: null }
          }
          if (state.session === 'unreachable') {
            return { data: { user: null }, error: new AuthRetryableFetchError('fetch failed', 0) }
          }
          // supabase-js removes a revoked session, which clears its cookies.
          options.cookies.setAll([{ name: 'sb-project-auth-token', value: '', options: { maxAge: 0, path: '/' } }], {})
          return { data: { user: null }, error: new AuthSessionMissingError() }
        },
      },
      from: () => ({
        select: () => ({
          eq: () => ({
            maybeSingle: async () => {
              state.orgQueries++
              if (state.onboardingCompleted === null) return { data: null, error: null }
              return { data: { onboarding_completed: state.onboardingCompleted }, error: null }
            },
          }),
        }),
      }),
    }
  },
}))

const { proxy } = await import('@/proxy')

const USER = { sub: '5b0b8a53-2b43-4a4b-9d53-0f5b1d3f2d11', email: 'owner@example.com' }

function request(path: string, init: { cookies?: Record<string, string>; method?: string } = {}) {
  const headers = new Headers()
  if (init.cookies) {
    headers.set('cookie', Object.entries(init.cookies).map(([k, v]) => `${k}=${v}`).join('; '))
  }
  return new NextRequest(`https://app.example.com${path}`, { headers, method: init.method ?? 'GET' })
}

function csp(res: Response): string | null {
  return res.headers.get('content-security-policy')
}

beforeEach(() => {
  state.claims = null
  state.session = 'live'
  state.getUserCalls = 0
  state.refreshCookies = null
  state.onboardingCompleted = true
  state.orgQueries = 0
  state.clientsCreated = 0
  state.globalFetch = null
  vi.stubEnv('NEXT_PUBLIC_SUPABASE_URL', 'https://project.supabase.co')
  vi.stubEnv('NEXT_PUBLIC_SUPABASE_ANON_KEY', 'anon-key')
  vi.stubEnv('VOICE_GATEWAY_URL', 'wss://gateway.example.com')
  vi.stubEnv('NODE_ENV', 'production')
  vi.spyOn(console, 'error').mockImplementation(() => {})
})

afterEach(() => {
  vi.unstubAllEnvs()
  vi.restoreAllMocks()
})

describe('public machine routes', () => {
  it.each([
    '/api/telephony/inbound',
    '/api/voice/internal/session',
    '/api/cron/daily',
    '/api/ops/voice-status',
    '/api/billing/webhook',
    '/api/elevenlabs/webhook',
  ])('passes %s straight through without session work', async (path) => {
    const res = await proxy(request(path))
    expect(res.status).toBe(200)
    expect(res.headers.get('location')).toBeNull()
    expect(csp(res)).toBeNull()
    expect(state.clientsCreated).toBe(0)
  })

  it('does not treat look-alike paths as public', async () => {
    await proxy(request('/api/elevenlabs/voices'))
    await proxy(request('/api/elevenlabs/webhooks-extra'))
    expect(state.clientsCreated).toBe(2)
  })
})

describe('signed-out visitors', () => {
  it('sends app pages to /login, remembering where they were going', async () => {
    const res = await proxy(request('/calls?status=completed'))
    expect(res.status).toBe(307)
    const location = new URL(res.headers.get('location')!)
    expect(location.pathname).toBe('/login')
    expect(location.searchParams.get('next')).toBe('/calls?status=completed')
  })

  it('omits next for the default destination', async () => {
    const res = await proxy(request('/dashboard'))
    expect(new URL(res.headers.get('location')!).search).toBe('')
  })

  it.each(['/inbox', '/voice-lab', '/settings', '/workflows', '/onboarding'])('protects %s', async (path) => {
    const res = await proxy(request(path))
    expect(new URL(res.headers.get('location')!).pathname).toBe('/login')
  })

  it('leaves marketing, auth and API routes alone', async () => {
    for (const path of ['/', '/product/ai-agents', '/login', '/forgot-password', '/reset-password', '/agents', '/api/agent']) {
      const res = await proxy(request(path))
      expect(res.headers.get('location'), path).toBeNull()
    }
  })

  it('never redirects a server action POST, which would replay it on another page', async () => {
    const res = await proxy(request('/dashboard', { method: 'POST' }))
    expect(res.status).toBe(200)
    expect(res.headers.get('location')).toBeNull()
    expect(csp(res)).toContain("'strict-dynamic'")
  })

  it('keeps refreshed cookies on the redirect', async () => {
    state.refreshCookies = [{ name: 'sb-project-auth-token', value: '', options: { maxAge: 0, path: '/' } }]
    const res = await proxy(request('/dashboard'))
    expect(res.status).toBe(307)
    expect(res.headers.get('set-cookie')).toContain('sb-project-auth-token=')
    expect(res.headers.get('cache-control')).toContain('no-store')
  })
})

describe('signed-in users', () => {
  beforeEach(() => {
    state.claims = USER
  })

  it('are sent from /login and /register to the dashboard', async () => {
    for (const path of ['/login', '/register']) {
      const res = await proxy(request(path))
      expect(new URL(res.headers.get('location')!).pathname).toBe('/dashboard')
    }
  })

  it('check with the Auth server before sending them away from /login', async () => {
    const res = await proxy(request('/login'))
    expect(new URL(res.headers.get('location')!).pathname).toBe('/dashboard')
    expect(state.getUserCalls).toBe(1)
    // Other pages trust the locally verified token.
    await proxy(request('/calls', { cookies: { ntv_onboarded: USER.sub } }))
    expect(state.getUserCalls).toBe(1)
  })

  it('show /login and clear the cookies when the session was revoked on another device', async () => {
    state.session = 'revoked'
    const res = await proxy(request('/login'))
    expect(res.headers.get('location')).toBeNull()
    expect(res.headers.get('set-cookie')).toContain('sb-project-auth-token=;')
    expect(csp(res)).toContain("script-src 'self' 'unsafe-inline'")
  })

  it('show /login rather than redirect when the Auth server cannot be reached', async () => {
    state.session = 'unreachable'
    const res = await proxy(request('/register'))
    expect(res.headers.get('location')).toBeNull()
  })

  it('follow a safe next from /login, and ignore an unsafe one', async () => {
    const res = await proxy(request('/login?next=%2Fcalls%3Fstatus%3Dcompleted'))
    const location = new URL(res.headers.get('location')!)
    expect(location.origin).toBe('https://app.example.com')
    expect(`${location.pathname}${location.search}`).toBe('/calls?status=completed')

    for (const next of ['https://evil.example', '//evil.example', '/login']) {
      const unsafe = await proxy(request(`/login?next=${encodeURIComponent(next)}`))
      const target = new URL(unsafe.headers.get('location')!)
      expect(`${target.origin}${target.pathname}${target.search}`, next).toBe('https://app.example.com/dashboard')
    }
  })

  it('are not redirected when posting a sign-in action from a stale /login tab', async () => {
    const res = await proxy(request('/login', { method: 'POST' }))
    expect(res.headers.get('location')).toBeNull()
  })

  it('skip the onboarding redirect for server action POSTs', async () => {
    state.onboardingCompleted = false
    const res = await proxy(request('/calls', { method: 'POST' }))
    expect(res.headers.get('location')).toBeNull()
    expect(state.orgQueries).toBe(0)
  })

  it('can still reach password reset pages', async () => {
    expect((await proxy(request('/reset-password'))).headers.get('location')).toBeNull()
    expect((await proxy(request('/forgot-password'))).headers.get('location')).toBeNull()
  })

  it('look up onboarding once, then remember it in a cookie tied to the user', async () => {
    const first = await proxy(request('/calls'))
    expect(first.status).toBe(200)
    expect(state.orgQueries).toBe(1)
    const setCookie = first.headers.get('set-cookie') ?? ''
    expect(setCookie).toContain(`ntv_onboarded=${USER.sub}`)
    expect(setCookie.toLowerCase()).toContain('httponly')

    await proxy(request('/agent', { cookies: { ntv_onboarded: USER.sub } }))
    expect(state.orgQueries).toBe(1)
  })

  it("ignore another user's onboarding cookie", async () => {
    await proxy(request('/calls', { cookies: { ntv_onboarded: 'someone-else' } }))
    expect(state.orgQueries).toBe(1)
  })

  it('send unfinished accounts to onboarding and clear the hint', async () => {
    state.onboardingCompleted = false
    const res = await proxy(request('/billing', { cookies: { ntv_onboarded: 'stale' } }))
    expect(new URL(res.headers.get('location')!).pathname).toBe('/onboarding')
    expect(res.headers.get('set-cookie')).toContain('ntv_onboarded=;')
  })

  it('never query organizations on the onboarding page itself', async () => {
    state.onboardingCompleted = false
    const res = await proxy(request('/onboarding'))
    expect(res.headers.get('location')).toBeNull()
    expect(state.orgQueries).toBe(0)
  })

  it('let the page decide when the organization row is missing', async () => {
    state.onboardingCompleted = null
    const res = await proxy(request('/dashboard'))
    expect(res.headers.get('location')).toBeNull()
    expect(res.headers.get('set-cookie') ?? '').not.toContain('ntv_onboarded')
  })
})

describe('Content-Security-Policy', () => {
  it('gives dynamic app pages a fresh nonce, shared with the renderer', async () => {
    state.claims = USER
    const a = await proxy(request('/dashboard'))
    const b = await proxy(request('/dashboard'))
    const policy = csp(a)!
    const nonce = /'nonce-([^']+)'/.exec(policy)?.[1]
    expect(nonce).toBeTruthy()
    expect(policy).toContain("'strict-dynamic'")
    expect(policy).not.toContain("'unsafe-inline' 'unsafe-eval'")
    expect(csp(b)).not.toBe(policy)

    // Next renders with the request headers the proxy forwards.
    expect(a.headers.get('x-middleware-request-content-security-policy')).toBe(policy)
    expect(a.headers.get('x-middleware-request-x-nonce')).toBe(nonce)
    expect(a.headers.get('x-middleware-override-headers')).toContain('x-nonce')
  })

  it('gives prerendered pages the allowlist policy and no nonce', async () => {
    for (const path of ['/', '/login', '/product/ai-agents', '/privacy']) {
      const res = await proxy(request(path))
      const policy = csp(res)!
      expect(policy, path).toContain("script-src 'self' 'unsafe-inline'")
      expect(policy, path).not.toContain("'nonce-")
      expect(res.headers.get('x-middleware-request-x-nonce'), path).toBeNull()
    }
  })

  it('upgrades insecure requests only when served over https', async () => {
    expect(csp(await proxy(request('/')))).toContain('upgrade-insecure-requests')
    const local = await proxy(new NextRequest('http://localhost:3000/'))
    expect(csp(local)).not.toContain('upgrade-insecure-requests')
  })

  it('allows eval only in development', async () => {
    vi.stubEnv('NODE_ENV', 'development')
    expect(csp(await proxy(request('/')))).toContain("'unsafe-eval'")
  })

  it('includes the Supabase, Stripe and gateway origins for connections', async () => {
    const policy = csp(await proxy(request('/')))!
    expect(policy).toContain(
      "connect-src 'self' https://project.supabase.co wss://project.supabase.co https://api.stripe.com wss://gateway.example.com"
    )
  })

  it('is not added to API responses', async () => {
    expect(csp(await proxy(request('/api/calls')))).toBeNull()
  })
})

describe('Supabase calls from the proxy', () => {
  it('carry a deadline, so a stalled connection cannot hold every page', async () => {
    await proxy(request('/'))
    expect(state.globalFetch).toBeTypeOf('function')

    const seen: (AbortSignal | null | undefined)[] = []
    vi.stubGlobal('fetch', async (_input: string, init?: RequestInit) => {
      seen.push(init?.signal)
      return new Response('{}')
    })
    try {
      await state.globalFetch!('https://project.supabase.co/auth/v1/token', { method: 'POST' })
      const caller = new AbortController()
      await state.globalFetch!('https://project.supabase.co/rest/v1/organizations', { signal: caller.signal })
      expect(seen[0]).toBeInstanceOf(AbortSignal)
      expect(seen[0]!.aborted).toBe(false)
      // A caller's own signal still aborts the request.
      caller.abort()
      expect(seen[1]!.aborted).toBe(true)
    } finally {
      vi.unstubAllGlobals()
    }
  })
})

describe('without Supabase configured', () => {
  it('treats everyone as signed out instead of crashing', async () => {
    vi.stubEnv('NEXT_PUBLIC_SUPABASE_URL', '')
    const res = await proxy(request('/dashboard'))
    expect(new URL(res.headers.get('location')!).pathname).toBe('/login')
    expect(state.clientsCreated).toBe(0)
  })
})
