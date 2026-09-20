import type { NextRequest } from 'next/server'
import { z } from 'zod'
import { handleRoute, zUuid } from '@/lib/api/http'
import { readVerifiedTwilioForm } from '@/lib/twilio/signature'
import { hangup, twimlDocument } from '@/lib/twilio/twiml'
import { handleOutboundCall, twimlResponse } from '@/lib/voice/router'

// TwiML for calls the app places (test calls, outbound calls). The call row
// was created before dialling; ?call_id= ties Twilio's request to it.

export const runtime = 'nodejs'
// call_missed workflows run in after() for refused calls.
export const maxDuration = 300

const QuerySchema = z.object({ call_id: zUuid })

export const POST = handleRoute(async (req: NextRequest) => {
  const form = await readVerifiedTwilioForm(req)
  const query = QuerySchema.safeParse({ call_id: req.nextUrl.searchParams.get('call_id') })
  if (!query.success) {
    console.warn('[telephony] outbound webhook without a valid call_id')
    return twimlResponse(twimlDocument(hangup()))
  }
  return handleOutboundCall(query.data.call_id, form)
})
