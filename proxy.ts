import { NextResponse, type NextRequest } from 'next/server'
import type { SupabaseClient } from '@supabase/supabase-js'
import { redirectWithSession, updateSession } from '@/lib/supabase/middleware'
import { NONCE_HEADER, buildCsp, classifyPath, createNonce } from '@/lib/security/csp'
import { ONBOARDED_COOKIE, safeNextPath } from '@/lib/auth/paths'

// Runs before every page and API request (see the matcher below):
//   1. public machine-to-machine routes pass straight through;
//   2. the Supabase session is refreshed so cookies stay valid;
//   3. signed-out visitors are sent to /login from app pages, signed-in ones
//      away from /login and /register, unfinished accounts to /onboarding;
//   4. every HTML response gets its Content-Security-Policy (lib/security/csp.ts).
// These are optimistic checks. Layouts, pages, route handlers and server
// actions all verify the session again; nothing relies on this file alone.

/**
 * Called by Twilio, Stripe, ElevenLabs, the voice gateway and Vercel Cron.
 * They authenticate with signatures or bearer secrets, never cookies, and
 * Twilio needs an answer within seconds, so no session work happens here.
 */
const PUBLIC_API_PREFIXES = [
  '/api/elevenlabs/webhook',
  '/api/billing/webhook',
  '/api/telephony/',
  '/api/voice/internal/',
  '/api/cron/',
  '/api/ops/',
]

const PROTECTED_PAGES = [
  '/dashboard',
  '/onboarding',
  '/agent',
  '/calls',
  '/phone',
  '/integrations',
  '/workflows',
  '/billing',
  '/inbox',
  '/voice-lab',
  '/settings',
]

/** Signed-in users have no business on these; /forgot-password and /reset-password stay reachable. */
const AUTH_PAGES = ['/login', '/register']

const ONBOARDED_COOKIE_MAX_AGE = 60 * 60 * 24 * 30

/** Segment-aware: '/agent' matches '/agent' and '/agent/x', never '/agents'. */
function matchesPath(pathname: string, prefix: string): boolean {
  if (prefix.endsWith('/')) return pathname.startsWith(prefix)
  return pathname === prefix || pathname.startsWith(`${prefix}/`)
}

function isHttps(request: NextRequest): boolean {
  return request.nextUrl.protocol === 'https:' || request.headers.get('x-forwarded-proto') === 'https'
}

type OnboardingStatus = 'complete' | 'incomplete' | 'unknown'

async function onboardingStatus(supabase: SupabaseClient, userId: string): Promise<OnboardingStatus> {
  const { data, error } = await supabase
    .from('organizations')
    .select('onboarding_completed')
    .eq('user_id', userId)
    .maybeSingle()
  if (error) {
    // The layout checks again and shows the error boundary if it's real.
    console.error('[auth] onboarding lookup failed', error.code)
    return 'unknown'
  }
  if (!data) return 'unknown'
  return data.onboarding_completed ? 'complete' : 'incomplete'
}

export async function proxy(request: NextRequest) {
  const { pathname, search } = request.nextUrl

  if (PUBLIC_API_PREFIXES.some((prefix) => matchesPath(pathname, prefix))) {
    return NextResponse.next()
  }

  const kind = classifyPath(pathname)
  const dev = process.env.NODE_ENV === 'development'
  const nonce = kind === 'dynamic' ? createNonce() : null
  const csp =
    kind === 'api'
      ? null
      : buildCsp({ nonce, dev, upgradeInsecureRequests: !dev && isHttps(request) })

  // Next reads the nonce from the request's CSP header while rendering and
  // stamps it on its own scripts; x-nonce is for any <Script> that needs it.
  const { response, user, supabase, confirmUser } = await updateSession(request, {
    requestHeaders: nonce && csp ? { 'content-security-policy': csp, [NONCE_HEADER]: nonce } : undefined,
  })

  // API routes authenticate themselves and answer 401 as JSON; never redirect them.
  if (kind === 'api') return response

  const withCsp = (res: NextResponse) => {
    if (csp) res.headers.set('Content-Security-Policy', csp)
    return res
  }

  // Redirects are for page navigations only. A POST to a page is a server
  // action (sign in, sign out): redirecting it would replay the POST against
  // another page, where the action doesn't exist. Actions and the page render
  // that follows them check the session themselves.
  if (request.method !== 'GET' && request.method !== 'HEAD') return withCsp(response)

  const isProtected = PROTECTED_PAGES.some((prefix) => matchesPath(pathname, prefix))

  if (!user) {
    if (isProtected) {
      const login = request.nextUrl.clone()
      login.pathname = '/login'
      login.search = ''
      const next = safeNextPath(`${pathname}${search}`)
      if (next && next !== '/dashboard') login.searchParams.set('next', next)
      return redirectWithSession(login, response)
    }
    return withCsp(response)
  }

  if (AUTH_PAGES.includes(pathname)) {
    // The pages behind this redirect ask the Auth server about the session,
    // while `user` may come from a token verified locally that outlives a
    // sign-out elsewhere. Ask the server too, or a revoked session would
    // bounce between /login and /dashboard until the token expires. Signed-in
    // people rarely open /login, so the extra round trip is cheap.
    const confirmed = await confirmUser()
    if (!confirmed.user) return withCsp(confirmed.response)
    // Already signed in (another tab, a bookmark): go where /login was asked to send them.
    const target = new URL(
      safeNextPath(request.nextUrl.searchParams.get('next')) ?? '/dashboard',
      request.nextUrl.origin
    )
    return redirectWithSession(target, confirmed.response)
  }

  if (isProtected && !matchesPath(pathname, '/onboarding') && supabase) {
    // One organizations query per user, not per request: once onboarding is
    // known to be finished the answer is remembered in a cookie tied to the
    // user id. That also covers link prefetches, whose headers Next hides
    // from the proxy. The dashboard layout stays the authority either way.
    if (request.cookies.get(ONBOARDED_COOKIE)?.value !== user.id) {
      const status = await onboardingStatus(supabase, user.id)
      if (status === 'incomplete') {
        const onboarding = request.nextUrl.clone()
        onboarding.pathname = '/onboarding'
        onboarding.search = ''
        const redirect = redirectWithSession(onboarding, response)
        redirect.cookies.delete(ONBOARDED_COOKIE)
        return redirect
      }
      if (status === 'complete') {
        response.cookies.set(ONBOARDED_COOKIE, user.id, {
          httpOnly: true,
          sameSite: 'lax',
          secure: process.env.NODE_ENV === 'production',
          path: '/',
          maxAge: ONBOARDED_COOKIE_MAX_AGE,
        })
      }
    }
  }

  return withCsp(response)
}

export const config = {
  matcher: [
    /*
     * Every path except build assets and plain files from public/ (images,
     * video, audio, fonts, audio worklets, robots/sitemap). Those need neither
     * a session nor a CSP header.
     */
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|avif|ico|mp4|webm|mp3|wav|woff2?|js|mjs|map|txt|xml|webmanifest)$).*)',
  ],
}
