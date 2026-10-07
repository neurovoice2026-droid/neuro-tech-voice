import { NextResponse, type NextRequest } from 'next/server'
import { randomBytes } from 'crypto'
import { createClient } from '@/lib/supabase/server'
import { getGoogleOAuthUrl } from '@/lib/google/client'
import { oauthReturnKey, oauthStateCookieValue } from '@/lib/google/oauth-return'

const GOOGLE_TYPES = ['google_calendar', 'gmail', 'google_sheets', 'google_docs', 'google_drive']

// Starts the Google OAuth flow for a given integration type.
// ?return_to= picks the page the callback returns to; only allow-listed
// same-origin paths are kept (lib/google/oauth-return.ts), default /integrations.
export async function GET(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.redirect(new URL('/login', request.url))
  }

  const type = request.nextUrl.searchParams.get('type') ?? 'google_calendar'
  if (!GOOGLE_TYPES.includes(type)) {
    return NextResponse.redirect(new URL('/integrations?error=invalid_type', request.url))
  }

  if (!process.env.GOOGLE_CLIENT_ID || !process.env.GOOGLE_CLIENT_SECRET) {
    return NextResponse.redirect(new URL('/integrations?error=google_not_configured', request.url))
  }

  // CSRF: random nonce echoed back in `state` and verified against an httpOnly
  // cookie on the callback.
  const nonce = randomBytes(16).toString('hex')
  const state = `${type}.${nonce}`
  const returnKey = oauthReturnKey(request.nextUrl.searchParams.get('return_to'))

  const res = NextResponse.redirect(getGoogleOAuthUrl(state))
  res.cookies.set('g_oauth_state', oauthStateCookieValue(nonce, returnKey), {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 600,
    path: '/',
  })
  return res
}
