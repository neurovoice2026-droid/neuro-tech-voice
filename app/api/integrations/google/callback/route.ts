import { NextResponse, type NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getGoogleOAuthClient } from '@/lib/google/client'

// Google OAuth redirect target — exchanges the code and stores the refresh token.
export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams

  if (params.get('error')) {
    return NextResponse.redirect(new URL('/integrations?error=oauth_denied', request.url))
  }

  const code = params.get('code')
  const state = params.get('state') ?? ''
  const [type, nonce] = state.split('.')

  // Verify CSRF nonce against the cookie set at connect time.
  const cookieNonce = request.cookies.get('g_oauth_state')?.value
  if (!code || !type || !nonce || !cookieNonce || nonce !== cookieNonce) {
    return NextResponse.redirect(new URL('/integrations?error=invalid_state', request.url))
  }

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.redirect(new URL('/login', request.url))
  }

  const { data: org } = await supabase
    .from('organizations')
    .select('id')
    .eq('user_id', user.id)
    .single()
  if (!org) {
    return NextResponse.redirect(new URL('/login', request.url))
  }

  try {
    const client = getGoogleOAuthClient()
    const { tokens } = await client.getToken(code)

    const row: Record<string, unknown> = {
      org_id: org.id,
      type,
      is_active: true,
      connected_at: new Date().toISOString(),
    }
    // Google only returns a refresh token on first consent; keep the existing
    // one otherwise (we force prompt=consent, so this is normally present).
    if (tokens.refresh_token) row.google_refresh_token = tokens.refresh_token

    const { error } = await supabase
      .from('integrations')
      .upsert(row, { onConflict: 'org_id,type' })
    if (error) throw error
  } catch (err) {
    console.error('Google OAuth token exchange failed:', err)
    return NextResponse.redirect(new URL('/integrations?error=token_exchange', request.url))
  }

  const res = NextResponse.redirect(new URL(`/integrations?connected=${type}`, request.url))
  res.cookies.delete('g_oauth_state')
  return res
}
