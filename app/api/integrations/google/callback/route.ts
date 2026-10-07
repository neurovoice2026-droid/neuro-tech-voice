import { NextResponse, type NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getGoogleOAuthClient } from '@/lib/google/client'
import { createLogger } from '@/lib/observability/logger'
import { scheduleCalendarResync } from '@/lib/voice-tools/calendar-resync'
import { parseOAuthStateCookie, withQuery } from '@/lib/google/oauth-return'

// Google OAuth redirect target — exchanges the code and stores the refresh token.
// Returns to the allow-listed page the connect route stored in the state
// cookie (default /integrations), with ?connected= or ?error=.
export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams
  const { nonce: cookieNonce, returnPath } = parseOAuthStateCookie(request.cookies.get('g_oauth_state')?.value)
  const back = (query: Record<string, string>) => NextResponse.redirect(new URL(withQuery(returnPath, query), request.url))

  if (params.get('error')) {
    return back({ error: 'oauth_denied' })
  }

  const code = params.get('code')
  const state = params.get('state') ?? ''
  const [type, nonce] = state.split('.')

  // Verify CSRF nonce against the cookie set at connect time.
  if (!code || !type || !nonce || !cookieNonce || nonce !== cookieNonce) {
    return back({ error: 'invalid_state' })
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
    return back({ error: 'token_exchange' })
  }

  // In-call booking uses the calendar: attach the booking tools now (slice B2).
  if (type === 'google_calendar') scheduleCalendarResync(org.id as string, createLogger({ route: 'integrations.google_callback', orgId: org.id as string }))

  const res = back({ connected: type })
  res.cookies.delete('g_oauth_state')
  return res
}
