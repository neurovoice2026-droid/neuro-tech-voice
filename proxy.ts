import { NextResponse, type NextRequest } from 'next/server'
import { updateSession } from '@/lib/supabase/middleware'
import { businessIntentCookie, businessTypeFromIntent } from '@/lib/auth/business-intent'

const PROTECTED_PATHS = [
  '/dashboard',
  '/onboarding',
  '/agent',
  '/calls',
  '/phone',
  '/integrations',
  '/billing',
  '/store',
]

// Machine-to-machine endpoints: each authenticates itself (provider
// signatures, signed call tokens, bearer secrets) and must not depend on the
// Supabase session cookie.
const PUBLIC_API_PREFIXES = [
  '/api/elevenlabs/webhook',
  '/api/elevenlabs/initiation',
  '/api/elevenlabs/voice-notice',
  '/api/cartesia/',
  '/api/telephony/',
  '/api/cron/',
  '/api/billing/webhook',
  // Store platform webhooks (signature-verified per delivery, lib/commerce/webhooks).
  '/api/commerce/webhooks/',
]

// The production deployment also answers on its vercel.app alias, which
// served a full duplicate of the site, with a sign-in whose OAuth redirect
// and cookies belong to www. Only this exact host is sent to www: preview
// deployments have hosts of their own and keep working. lib/site.ts SITE_URL
// is the same origin; tests/proxy-canonical-host.test.ts keeps the two equal.
const PRODUCTION_ALIAS_HOST = 'neuro-tech-voice.vercel.app'
const CANONICAL_ORIGIN = 'https://www.neurotechvoice.com'

/**
 * A permanent redirect to www for a page read on the production alias, or
 * null. GET and HEAD only, which is all a crawler or a followed link sends,
 * and never /api/*: a provider webhook or a cron registered against the
 * alias would not follow a redirect, so the API stays answered there.
 *
 * The Host header first: it is what the request was addressed to, while
 * Next may rebuild the proxy's URL on its own hostname (`next start` puts
 * localhost there).
 */
function productionAliasRedirect(request: NextRequest): NextResponse | null {
  const host = (request.headers.get('host') ?? request.nextUrl.host).split(':', 1)[0].toLowerCase()
  if (host !== PRODUCTION_ALIAS_HOST) return null
  if (request.method !== 'GET' && request.method !== 'HEAD') return null
  const { pathname, search } = request.nextUrl
  if (pathname === '/api' || pathname.startsWith('/api/')) return null
  // The path is set on a www URL, never resolved against one: the proxy
  // sees the path before Next folds repeated slashes, and `//evil.example`
  // (or `/\evil.example`) resolved as a relative URL is that host.
  const target = new URL(CANONICAL_ORIGIN)
  target.pathname = pathname
  target.search = search
  return NextResponse.redirect(target, 308)
}

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl

  // Before the session refresh: a request that is leaving for www has no
  // use for a Supabase cookie set on the alias.
  const aliasRedirect = productionAliasRedirect(request)
  if (aliasRedirect) return aliasRedirect

  // Always allow public API routes through
  if (PUBLIC_API_PREFIXES.some((prefix) => pathname.startsWith(prefix))) {
    return NextResponse.next()
  }

  const { supabaseResponse, user, supabase } = await updateSession(request)

  const isProtected = PROTECTED_PATHS.some((p) => pathname.startsWith(p))
  const isAuthPage = pathname === '/login' || pathname === '/register'

  // Unauthenticated → redirect to /login
  if (!user && isProtected) {
    const loginUrl = request.nextUrl.clone()
    loginUrl.pathname = '/login'
    return NextResponse.redirect(loginUrl)
  }

  // Authenticated users
  if (user) {
    // Redirect away from auth pages
    if (isAuthPage) {
      const dashboardUrl = request.nextUrl.clone()
      dashboardUrl.pathname = '/dashboard'
      const response = NextResponse.redirect(dashboardUrl)
      // A signed-in owner who follows a store plan's "Start free"
      // (/register?intent=store) never reaches the register page, which is
      // what writes the intent cookie for Step 0 of the onboarding; written
      // here instead, the onboarding still pre-selects "Online store".
      const intent = businessTypeFromIntent(request.nextUrl.searchParams.get('intent'))
      if (intent) {
        response.headers.append('Set-Cookie', businessIntentCookie(intent, request.nextUrl.protocol === 'https:'))
      }
      return response
    }

    // Check onboarding completion for protected routes (except /onboarding itself)
    if (isProtected && !pathname.startsWith('/onboarding')) {
      const { data: org } = await supabase
        .from('organizations')
        .select('onboarding_completed')
        .eq('user_id', user.id)
        .single()

      if (org && !org.onboarding_completed) {
        const onboardingUrl = request.nextUrl.clone()
        onboardingUrl.pathname = '/onboarding'
        return NextResponse.redirect(onboardingUrl)
      }
    }
  }

  return supabaseResponse
}

export const config = {
  matcher: [
    /*
     * Match all request paths EXCEPT:
     * - _next/static (static files)
     * - _next/image (image optimization)
     * - favicon.ico
     * - public folder files
     */
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|mp3)$).*)',
  ],
}
