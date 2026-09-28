import type { NextRequest } from 'next/server'
import { z } from 'zod'
import { handleRoute, zUuid } from '@/lib/api/http'
import { readVerifiedTwilioForm } from '@/lib/twilio/signature'
import { hangup, twimlDocument } from '@/lib/twilio/twiml'
import { handleTransferStatus, twimlResponse } from '@/lib/voice/router'

// <Dial action> of a live transfer (or the fallback hand-off to the on-call
// contact). Answered → hang up when the bridged call ends; not answered →
// tell the caller, log a message for the team, hang up.

export const runtime = 'nodejs'
// The team notification for an unanswered transfer runs after the response.
export const maxDuration = 300

const QuerySchema = z.object({
  call_id: zUuid,
  contact_id: zUuid.nullable(),
  reason: z.enum(['transfer', 'fallback']).nullable(),
})

export const POST = handleRoute(async (req: NextRequest) => {
  const form = await readVerifiedTwilioForm(req)
  const params = req.nextUrl.searchParams
  const query = QuerySchema.safeParse({
    call_id: params.get('call_id'),
    contact_id: params.get('contact_id'),
    reason: params.get('reason'),
  })
  if (!query.success) {
    console.warn('[telephony] transfer-status without a valid call_id')
    return twimlResponse(twimlDocument(hangup()))
  }
  return handleTransferStatus(form, {
    callId: query.data.call_id,
    contactId: query.data.contact_id,
    reason: query.data.reason ?? 'transfer',
  })
})
