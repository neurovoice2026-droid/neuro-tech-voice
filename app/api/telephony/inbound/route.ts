import type { NextRequest } from 'next/server'
import { handleRoute } from '@/lib/api/http'
import { readVerifiedTwilioForm } from '@/lib/twilio/signature'
import { handleInboundCall } from '@/lib/voice/router'

// voice_url of every number the app owns. An unexpected error answers 500 on
// purpose: Twilio then requests the number's voice_fallback_url
// (/api/telephony/fallback), which connects the caller to ElevenLabs directly.

export const runtime = 'nodejs'
// call_missed workflows (waits and webhook retries) run in after() for refused calls.
export const maxDuration = 300

export const POST = handleRoute(async (req: NextRequest) => {
  const form = await readVerifiedTwilioForm(req)
  return handleInboundCall(form)
})
