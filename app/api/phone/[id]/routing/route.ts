import type { NextRequest } from 'next/server'
import { ApiError, handleRoute, noStore, zUuid } from '@/lib/api/http'
import { requireOrgContext } from '@/lib/api/auth'
import { isTwilioConfigured } from '@/lib/env'
import { RATE_LIMITS, enforceRateLimit } from '@/lib/security/rate-limit'
import { configureNumberRouting, getPhoneNumberView, isVoiceRoutingReady } from '@/lib/twilio/numbers'

// "Reconnect": points the Twilio number at the app router (voice, fallback,
// status and SMS webhooks) and removes a legacy ElevenLabs import. Safe to
// repeat; it also repairs numbers whose webhooks were changed elsewhere.

export const runtime = 'nodejs'

type Params = { params: Promise<{ id: string }> }

export const POST = handleRoute(async (_req: NextRequest, ctx: Params) => {
  const org = await requireOrgContext()
  const { id } = await ctx.params
  if (!zUuid.safeParse(id).success) throw new ApiError(404, 'not_found', 'Phone number not found.')
  await enforceRateLimit(RATE_LIMITS.apiWrite, org.user.id)

  const existing = await getPhoneNumberView(org.supabase, org.org.id, id)
  if (!existing) throw new ApiError(404, 'not_found', 'Phone number not found.')
  if (!isTwilioConfigured()) {
    throw new ApiError(503, 'not_configured', 'The phone service isn’t configured yet, so numbers can’t be reconnected.')
  }
  if (!isVoiceRoutingReady()) {
    // Reconnecting now would move calls away from a setup that answers them to one that can't.
    throw new ApiError(
      503,
      'voice_not_configured',
      'Your agent’s voice service isn’t set up yet, so this number stays as it is for now. Your callers aren’t affected.'
    )
  }

  const result = await configureNumberRouting(id)
  if (!result.ok) {
    throw new ApiError(502, 'routing_failed', result.error ?? 'We couldn’t reconnect this number. Please try again.')
  }
  const view = await getPhoneNumberView(org.supabase, org.org.id, id)
  return noStore(Response.json(view ?? existing))
})
