import { NextResponse, type NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { getGoogleOAuthClient } from '@/lib/google/client'
import { googleScopesFor, isGoogleIntegrationType } from '@/lib/google/scopes'
import { createLogger } from '@/lib/observability/logger'
import { scheduleCalendarResync } from '@/lib/voice-tools/calendar-resync'
import { parseOAuthStateCookie, withQuery } from '@/lib/google/oauth-return'

// Google OAuth redirect target — exchanges the code and stores the refresh token.
// Returns to the allow-listed page the connect route stored in the state
// cookie (default /integrations), with ?connected= or ?error=.
// The token is written with the service role, scoped to the signed-in owner's
// organization: tenants cannot read or write the token column (migration 030).
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
  if (!code || !isGoogleIntegrationType(type) || !nonce || !cookieNonce || nonce !== cookieNonce) {
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
  const orgId = org.id as string
  const log = createLogger({ route: 'integrations.google_callback', orgId })

  try {
    const client = getGoogleOAuthClient()
    const { tokens } = await client.getToken(code)
    // Google's consent screen lets the owner untick a scope and still finish:
    // a token without this type's scope would show "Connected" and fail on
    // first use, so it is not stored.
    if (typeof tokens.scope === 'string') {
      const granted = new Set(tokens.scope.split(/\s+/))
      if (!googleScopesFor(type).every((scope) => granted.has(scope))) {
        log.warn('integrations.google_callback.scope_not_granted', { integration: type })
        return back({ error: 'oauth_denied' })
      }
    }
    const db = createAdminClient()

    const connected = { is_active: true, connected_at: new Date().toISOString() }
    if (tokens.refresh_token) {
      const { error } = await db
        .from('integrations')
        .upsert({ org_id: orgId, type, ...connected, google_refresh_token: tokens.refresh_token }, { onConflict: 'org_id,type' })
      if (error) throw error
    } else {
      // Google only returns a refresh token on first consent; keep the existing
      // one otherwise (we force prompt=consent, so this is normally present).
      // Without either, the integration would show "Connected" and fail on
      // first use: report the failed connection instead. An UPDATE, not an
      // upsert: the database refuses an active Google row without a token
      // (030) and checks the proposed row before resolving the conflict.
      const { data: existing, error: readError } = await db
        .from('integrations')
        .select('google_refresh_token')
        .eq('org_id', orgId)
        .eq('type', type)
        .maybeSingle()
      if (readError) throw readError
      if (!existing?.google_refresh_token) {
        log.warn('integrations.google_callback.no_refresh_token', { integration: type })
        return back({ error: 'token_exchange' })
      }
      const { error } = await db
        .from('integrations')
        .update(connected)
        .eq('org_id', orgId)
        .eq('type', type)
      if (error) throw error
    }
  } catch (err) {
    log.error('integrations.google_callback.failed', err, { integration: type })
    return back({ error: 'token_exchange' })
  }

  // In-call booking uses the calendar: attach the booking tools now (slice B2).
  if (type === 'google_calendar') scheduleCalendarResync(orgId, log)

  const res = back({ connected: type })
  res.cookies.delete('g_oauth_state')
  return res
}
