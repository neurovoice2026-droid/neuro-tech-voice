import type { NextRequest } from 'next/server'
import { handleRoute, zUuid } from '@/lib/api/http'
import { readVerifiedTwilioForm } from '@/lib/twilio/signature'
import { handleStreamEnded } from '@/lib/voice/router'

// <Connect action>: Twilio asks what to do once the gateway stream closes.
// A deliberate end (hang-up, transfer) hangs up; a gateway failure hands the
// live caller to ElevenLabs, or apologises when that isn't possible.

export const runtime = 'nodejs'
// call_missed workflows or the hand-over bookkeeping may run after the response.
export const maxDuration = 300

export const POST = handleRoute(async (req: NextRequest) => {
  const form = await readVerifiedTwilioForm(req)
  const parsed = zUuid.safeParse(req.nextUrl.searchParams.get('call_id'))
  return handleStreamEnded(form, parsed.success ? parsed.data : null)
})
