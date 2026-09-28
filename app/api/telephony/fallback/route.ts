import type { NextRequest } from 'next/server'
import { handleRoute, zUuid } from '@/lib/api/http'
import { readVerifiedTwilioForm } from '@/lib/twilio/signature'
import { handleFallbackCall } from '@/lib/voice/router'

// voice_fallback_url (inbound) and fallbackUrl (outbound calls): Twilio asks
// here when the primary webhook failed or timed out. The handler never throws;
// the worst case is a spoken apology.

export const runtime = 'nodejs'
// call_missed workflows run in after() for refused calls.
export const maxDuration = 300

export const POST = handleRoute(async (req: NextRequest) => {
  const form = await readVerifiedTwilioForm(req)
  const parsed = zUuid.safeParse(req.nextUrl.searchParams.get('call_id'))
  return handleFallbackCall(form, parsed.success ? parsed.data : null)
})
