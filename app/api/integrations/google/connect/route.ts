import { NextResponse, type NextRequest } from 'next/server'
import { unstable_rethrow } from 'next/navigation'
import { getOrgContext } from '@/lib/api/auth'
import { noStore } from '@/lib/api/http'
import { entitlementsFor } from '@/lib/billing/entitlements'
import { isGoogleConfigured, isProduction } from '@/lib/env'
import { isEncryptionConfigured, randomToken } from '@/lib/security/crypto'
import { RATE_LIMITS, rateLimit } from '@/lib/security/rate-limit'
import { createAdminClient } from '@/lib/supabase/admin'
import { getGoogleOAuthUrl } from '@/lib/google/client'
import {
  GOOGLE_INTEGRATION_TYPES,
  GOOGLE_OAUTH_COOKIE_PATH,
  GOOGLE_OAUTH_RETURN_COOKIE,
  GOOGLE_OAUTH_STATE_COOKIE,
  isGoogleIntegrationType,
  safeReturnPath,
  withQuery,
} from '@/lib/google/scopes'

// GET /api/integrations/google/connect?type=google_calendar&return_to=/agent
// Starts Google OAuth for one integration. Problems before Google is reached
// send the user back to `return_to` (an internal path, default /integrations)
// with ?error=<code>: invalid_type, upgrade_required, google_not_configured,
// encryption_not_configured, rate_limited, unexpected.

export const runtime = 'nodejs'

const OAUTH_COOKIE_MAX_AGE = 10 * 60

/** A Google account already connected for another integration, suggested on the consent screen. */
async function connectedAccountEmail(orgId: string): Promise<string | null> {
  try {
    const { data, error } = await createAdminClient()
      .from('integrations')
      .select('account_email')
      .eq('org_id', orgId)
      .eq('is_active', true)
      .in('type', [...GOOGLE_INTEGRATION_TYPES])
      .not('account_email', 'is', null)
      .limit(1)
    if (error) return null
    const email = data?.[0]?.account_email
    return typeof email === 'string' && email ? email : null
  } catch {
    return null
  }
}

export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams
  const returnTo = safeReturnPath(params.get('return_to'))
  const back = (error: string) => noStore(NextResponse.redirect(new URL(withQuery(returnTo, { error }), request.url)))

  try {
    const ctx = await getOrgContext()
    if (!ctx) return noStore(NextResponse.redirect(new URL('/login', request.url)))

    const type = params.get('type') ?? 'google_calendar'
    if (!isGoogleIntegrationType(type)) return back('invalid_type')
    if (!entitlementsFor(ctx.org.plan).googleIntegrations) return back('upgrade_required')
    if (!isGoogleConfigured()) return back('google_not_configured')
    if (!isEncryptionConfigured()) {
      // Refresh tokens are only ever stored encrypted; without the key there is nowhere safe to keep one.
      console.error('[google] connect refused: TOKEN_ENCRYPTION_KEY is missing or invalid')
      return back('encryption_not_configured')
    }
    const limit = await rateLimit(RATE_LIMITS.apiWrite, ctx.user.id)
    if (!limit.ok) return back('rate_limited')

    // CSRF: the nonce travels in `state` and in an httpOnly cookie; the callback compares them.
    const nonce = randomToken(24)
    const loginHint = await connectedAccountEmail(ctx.org.id)
    const res = NextResponse.redirect(getGoogleOAuthUrl(`${type}.${nonce}`, { type, loginHint }))
    const cookie = {
      httpOnly: true,
      secure: isProduction(),
      sameSite: 'lax' as const,
      maxAge: OAUTH_COOKIE_MAX_AGE,
      path: GOOGLE_OAUTH_COOKIE_PATH,
    }
    res.cookies.set(GOOGLE_OAUTH_STATE_COOKIE, nonce, cookie)
    res.cookies.set(GOOGLE_OAUTH_RETURN_COOKIE, returnTo, cookie)
    return noStore(res)
  } catch (error) {
    unstable_rethrow(error)
    console.error('[google] starting the connection failed', error instanceof Error ? error.message : error)
    return back('unexpected')
  }
}
