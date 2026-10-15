// GET /api/phone/search?country=XX → numbers the signed-in organization can buy
// now. Signed in and rate-limited per organization: every search is a request
// on the platform's Twilio account. Only real numbers: when Twilio is not
// configured or fails, the answer is an error the buy dialog shows, never a
// made-up list (a made-up number would go to checkout, be paid for and never
// be delivered).
import { NextResponse } from 'next/server'
import { requireOrg } from '@/lib/api/auth'
import { RequestError, apiError, errorResponse, requestErrorResponse } from '@/lib/api/http'
import { createLogger, requestIdFrom, type Logger } from '@/lib/observability/logger'
import { RATE_LIMITS, enforceRateLimit } from '@/lib/security/rate-limit'
import { getTwilioClient, isTwilioConfigured } from '@/lib/twilio/client'

interface PhoneResult {
  number: string
  friendly_name: string
  locality: string
  region: string
}

// The countries the buy dialog offers (COUNTRIES in app/(dashboard)/phone/page.tsx);
// anything else never reaches Twilio.
const SEARCHABLE_COUNTRIES = new Set([
  'US', 'CA', 'GB', 'NZ', 'AT', 'BE', 'CH', 'CZ', 'DK', 'FI', 'HU',
  'LU', 'NO', 'PT', 'SE', 'SK', 'SG', 'JP', 'IN', 'BR', 'ZA',
])

/** Status and Twilio error code only: a Twilio message can carry the account SID in its resource path. */
function twilioErrorFields(err: unknown): { status: number | null; code: number | string | null } {
  const e = (err ?? {}) as { status?: unknown; code?: unknown }
  return {
    status: typeof e.status === 'number' ? e.status : null,
    code: typeof e.code === 'number' || typeof e.code === 'string' ? e.code : null,
  }
}

export async function GET(request: Request) {
  const requestId = requestIdFrom(request)
  let log: Logger = createLogger({ requestId, route: 'phone.search' })
  try {
    const { org } = await requireOrg()
    log = log.child({ orgId: org.id })

    const country = (new URL(request.url).searchParams.get('country') ?? 'US').trim().toUpperCase()
    if (!SEARCHABLE_COUNTRIES.has(country)) {
      return apiError('invalid_request', 'Numbers are not available in this country.', 400, { requestId })
    }
    await enforceRateLimit(RATE_LIMITS.phoneSearch, org.id, 'Too many searches. Please wait a minute and try again.')

    if (!isTwilioConfigured()) {
      return apiError('not_configured', 'Phone numbers are not available on this platform yet.', 503, { requestId })
    }

    let results: PhoneResult[]
    try {
      const available = await getTwilioClient()
        .availablePhoneNumbers(country)
        .local.list({ voiceEnabled: true, limit: 20 })

      // Only offer numbers Twilio can provision instantly. Anything requiring
      // a regulatory bundle (address_requirements !== 'none') is excluded so we
      // never promise a number the org can't actually complete the purchase of.
      results = available
        .filter((n) => n.addressRequirements === 'none')
        .slice(0, 5)
        .map((n) => ({
          number:        n.phoneNumber,
          friendly_name: n.friendlyName,
          locality:      n.locality ?? '',
          region:        n.region ?? '',
        }))
    } catch (err) {
      log.error('phone.search_failed', undefined, { country, ...twilioErrorFields(err) })
      return apiError('provider_error', 'Number search is unavailable right now. Please try again.', 502, { requestId })
    }

    return NextResponse.json(results, { headers: { 'Cache-Control': 'private, no-store' } })
  } catch (err) {
    if (err instanceof RequestError) return requestErrorResponse(err, requestId)
    return errorResponse(err, log, 'phone.search_error', requestId)
  }
}
