import { NextResponse, type NextRequest } from 'next/server'
import { updateSession } from '@/lib/supabase/middleware'

const PROTECTED_PATHS = [
  '/dashboard',
  '/onboarding',
  '/agent',
  '/calls',
  '/phone',
  '/integrations',
  '/billing',
]

const PUBLIC_API_PREFIXES = [
  '/api/elevenlabs/',
  '/api/billing/webhook',
]

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl

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
      return NextResponse.redirect(dashboardUrl)
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
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}
