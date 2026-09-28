import { NextResponse, type NextRequest } from 'next/server'
import { RECOVERY_COOKIE, RECOVERY_TTL_SECONDS, issueRecoveryGrant } from '@/lib/auth/recovery'
import { createClient } from '@/lib/supabase/server'

// Landing point of the password-reset email (redirectTo in
// requestPasswordReset). Supabase has verified the emailed token and sends a
// one-time PKCE code; exchanging it here, in a route handler that may write
// cookies, starts a short recovery session for /reset-password. It also
// issues the recovery grant (lib/auth/recovery.ts): only a browser that came
// through this link may set a new password without the old one.

const MAX_CODE_LENGTH = 512

// Same host the request came in on: the recovery session cookie is set for it.
function back(request: NextRequest, path: string): NextResponse {
  return NextResponse.redirect(new URL(path, request.url))
}

export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams

  // Expired or already-used links come back as ?error=…&error_code=otp_expired.
  const upstreamError = params.get('error_code') ?? params.get('error')
  if (upstreamError) {
    console.warn('[auth] password reset link rejected', upstreamError.slice(0, 64))
    return back(request, '/forgot-password?error=link_expired')
  }

  const code = params.get('code')
  if (!code || code.length > MAX_CODE_LENGTH) {
    return back(request, '/forgot-password?error=link_invalid')
  }

  const supabase = await createClient()
  const { data, error } = await supabase.auth.exchangeCodeForSession(code)
  if (error || !data.user) {
    // Most often the link was opened in a different browser than the one that
    // asked for it (no code verifier cookie), or it was already used.
    console.warn('[auth] password reset code exchange failed', error?.code ?? 'no_user', error?.status ?? 0)
    return back(request, '/forgot-password?error=link_expired')
  }

  const response = back(request, '/reset-password')
  try {
    const nonce = await issueRecoveryGrant(data.user.id)
    response.cookies.set(RECOVERY_COOKIE, nonce, {
      httpOnly: true,
      sameSite: 'lax',
      secure: process.env.NODE_ENV === 'production',
      path: '/',
      maxAge: RECOVERY_TTL_SECONDS,
    })
  } catch (grantError) {
    // Without the grant the form says the link expired; the owner asks for a new one.
    console.error('[auth] could not store the password recovery grant', grantError instanceof Error ? grantError.message : grantError)
  }
  return response
}
