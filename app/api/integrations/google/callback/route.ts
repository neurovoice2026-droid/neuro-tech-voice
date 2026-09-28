import { NextResponse, type NextRequest } from 'next/server'
import { unstable_rethrow } from 'next/navigation'
import { getOrgContext } from '@/lib/api/auth'
import { noStore } from '@/lib/api/http'
import { entitlementsFor } from '@/lib/billing/entitlements'
import { isGoogleConfigured } from '@/lib/env'
import { isEncryptionConfigured } from '@/lib/security/crypto'
import { timingSafeEqualString } from '@/lib/security/signing'
import {
  exchangeGoogleCode,
  GoogleConnectionError,
  googleErrorInfo,
  storeGoogleConnection,
} from '@/lib/google/client'
import {
  emailFromIdToken,
  GOOGLE_OAUTH_COOKIE_PATH,
  GOOGLE_OAUTH_RETURN_COOKIE,
  GOOGLE_OAUTH_STATE_COOKIE,
  missingScopes,
  parseOAuthState,
  safeReturnPath,
  withQuery,
} from '@/lib/google/scopes'
import { resyncOrgAgentsAfterResponse } from '@/lib/voice/sync'

// GET /api/integrations/google/callback — Google redirects here after consent.
// Verifies the CSRF nonce, re-checks the plan, exchanges the code, checks the
// account granted every permission the integration needs, and stores the
// refresh token encrypted (service-role client, scoped to the org). The user
// goes back to the page they started from with ?connected=<type> or
// ?error=<code>: oauth_denied, invalid_state, upgrade_required,
// google_not_configured, encryption_not_configured, token_exchange,
// missing_permissions, no_refresh_token, setup_incomplete, save_failed, unexpected.

export const runtime = 'nodejs'
// A calendar connection re-syncs the provider agents after the redirect.
export const maxDuration = 60

const CONNECTION_ERROR_CODES: Record<GoogleConnectionError['code'], string> = {
  not_configured: 'google_not_configured',
  encryption_not_configured: 'encryption_not_configured',
  migration_missing: 'setup_incomplete',
  no_refresh_token: 'no_refresh_token',
  storage_failed: 'save_failed',
}

export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams
  const returnTo = safeReturnPath(request.cookies.get(GOOGLE_OAUTH_RETURN_COOKIE)?.value)
  const finish = (query: Record<string, string>) => {
    const res = NextResponse.redirect(new URL(withQuery(returnTo, query), request.url))
    res.cookies.set(GOOGLE_OAUTH_STATE_COOKIE, '', { path: GOOGLE_OAUTH_COOKIE_PATH, maxAge: 0 })
    res.cookies.set(GOOGLE_OAUTH_RETURN_COOKIE, '', { path: GOOGLE_OAUTH_COOKIE_PATH, maxAge: 0 })
    return noStore(res)
  }

  try {
    if (params.get('error')) return finish({ error: 'oauth_denied' })

    const state = parseOAuthState(params.get('state'))
    const cookieNonce = request.cookies.get(GOOGLE_OAUTH_STATE_COOKIE)?.value
    const code = params.get('code')
    if (!state || !cookieNonce || !code || code.length > 2048 || !timingSafeEqualString(state.nonce, cookieNonce)) {
      return finish({ error: 'invalid_state' })
    }

    const ctx = await getOrgContext()
    if (!ctx) return noStore(NextResponse.redirect(new URL('/login', request.url)))
    if (!entitlementsFor(ctx.org.plan).googleIntegrations) return finish({ error: 'upgrade_required' })
    if (!isGoogleConfigured()) return finish({ error: 'google_not_configured' })
    if (!isEncryptionConfigured()) {
      console.error('[google] connection refused: TOKEN_ENCRYPTION_KEY is missing or invalid')
      return finish({ error: 'encryption_not_configured' })
    }

    let exchange: Awaited<ReturnType<typeof exchangeGoogleCode>>
    try {
      exchange = await exchangeGoogleCode(code)
    } catch (error) {
      const info = googleErrorInfo(error)
      console.error('[google] token exchange failed', { status: info.status, reason: info.reason })
      return finish({ error: 'token_exchange' })
    }

    // People can untick permissions on Google's consent screen; a half-granted
    // connection would look connected and then fail during a call.
    if (missingScopes(state.type, exchange.scopes).length > 0) {
      console.warn('[google] connection missing permissions', { orgId: ctx.org.id, type: state.type })
      return finish({ error: 'missing_permissions', type: state.type })
    }

    try {
      await storeGoogleConnection({
        orgId: ctx.org.id,
        type: state.type,
        refreshToken: exchange.refreshToken,
        scopes: exchange.scopes,
        accountEmail: emailFromIdToken(exchange.idToken),
      })
    } catch (error) {
      if (error instanceof GoogleConnectionError) {
        console.error('[google] storing the connection failed', error.code)
        return finish({ error: CONNECTION_ERROR_CODES[error.code] })
      }
      throw error
    }

    // Booking tools depend on the calendar connection.
    if (state.type === 'google_calendar') await resyncOrgAgentsAfterResponse(ctx.org.id, 'connecting Google Calendar')
    return finish({ connected: state.type })
  } catch (error) {
    unstable_rethrow(error)
    console.error('[google] OAuth callback failed', error instanceof Error ? error.message : error)
    return finish({ error: 'unexpected' })
  }
}
