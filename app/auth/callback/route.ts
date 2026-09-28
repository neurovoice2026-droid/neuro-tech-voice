import { NextResponse, type NextRequest } from 'next/server'
import { ONBOARDED_COOKIE, safeNextPath } from '@/lib/auth/paths'
import { createClient } from '@/lib/supabase/server'

// Google sign-in and email confirmation land here with a PKCE code. After the
// exchange the user goes to onboarding, or to the internal page they asked for
// (?next=, checked by safeNextPath), else the dashboard.

export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url)
  const code = searchParams.get('code')
  const next = safeNextPath(searchParams.get('next'))

  if (!code) return NextResponse.redirect(`${origin}/login?error=auth_failed`)

  const supabase = await createClient()
  const { error } = await supabase.auth.exchangeCodeForSession(code)
  if (error) {
    // Code and status only: the message can echo the code.
    console.error('[auth] code exchange failed', error.code ?? 'unknown', error.status ?? '')
    return NextResponse.redirect(`${origin}/login?error=auth_failed`)
  }

  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) {
    console.error('[auth] no user after a successful code exchange')
    return NextResponse.redirect(`${origin}/login?error=auth_failed`)
  }

  const { data: org, error: orgError } = await supabase
    .from('organizations')
    .select('onboarding_completed')
    .eq('user_id', user.id)
    .maybeSingle()
  if (orgError) console.error('[auth] onboarding lookup after the code exchange failed', orgError.code)
  if (!org?.onboarding_completed) return NextResponse.redirect(`${origin}/onboarding`)

  const response = NextResponse.redirect(`${origin}${next ?? '/dashboard'}`)
  // Same hint the email sign-in sets, so the proxy skips its onboarding lookup.
  response.cookies.set(ONBOARDED_COOKIE, user.id, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: 60 * 60 * 24 * 30,
  })
  return response
}
