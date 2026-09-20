import type { NextRequest } from 'next/server'
import { handleRoute } from '@/lib/api/http'
import { maskPhone, normalizeE164 } from '@/lib/phone/e164'
import { createAdminClient } from '@/lib/supabase/admin'
import { MESSAGE_SID_REGEX } from '@/lib/twilio/client'
import { readVerifiedTwilioForm } from '@/lib/twilio/signature'
import { smsKeyword, smsStatusesReplaceableBy } from '@/lib/twilio/sms'
import { EMPTY_TWIML } from '@/lib/twilio/twiml'
import { twimlResponse } from '@/lib/voice/router'
import { loadPhoneNumberByNumber } from '@/lib/voice/session-loader'

// Two Twilio messaging webhooks share this route:
// - the number's sms_url (inbound texts): logged, and STOP / START keywords
//   update sms_opt_outs so sendSms never texts someone who opted out. The
//   reply is an empty <Response/>: Twilio's own keyword handling answers
//   STOP/HELP at the carrier level.
// - ?event=status, the statusCallback of texts sendSms sent: delivery status.

export const runtime = 'nodejs'

const MAX_INBOUND_BODY = 1600

export const POST = handleRoute(async (req: NextRequest) => {
  const form = await readVerifiedTwilioForm(req)
  const messageSid = form.MessageSid ?? form.SmsSid ?? ''
  if (!MESSAGE_SID_REGEX.test(messageSid)) return twimlResponse(EMPTY_TWIML)
  const supabase = createAdminClient()

  if (req.nextUrl.searchParams.get('event') === 'status') {
    const status = (form.MessageStatus ?? form.SmsStatus ?? '').trim().toLowerCase()
    const replaceable = status ? smsStatusesReplaceableBy(status) : null
    if (status && !replaceable) console.warn('[telephony] ignoring unknown sms status', messageSid, status.slice(0, 32))
    if (replaceable) {
      const errorCode = form.ErrorCode ? form.ErrorCode.slice(0, 16) : null
      // Only move forward: a late "sent" must not overwrite "delivered".
      const { error } = await supabase
        .from('sms_messages')
        .update({ status, error_code: errorCode })
        .eq('twilio_sid', messageSid)
        .in('status', replaceable)
      if (error) console.error('[telephony] sms status update failed', error.code, error.message)
      if (errorCode) console.warn('[telephony] sms delivery problem', messageSid, status, errorCode)
    }
    return new Response(null, { status: 204 })
  }

  const to = normalizeE164(form.To ?? '')
  const number = to ? await loadPhoneNumberByNumber(to) : null
  if (!number) {
    console.warn('[telephony] inbound sms to an unknown number')
    return twimlResponse(EMPTY_TWIML)
  }
  // Short codes and alphanumeric senders aren't E.164; keep what Twilio sent.
  const from = normalizeE164(form.From ?? '') ?? (form.From ?? '').trim().slice(0, 32)
  const body = (form.Body ?? '').slice(0, MAX_INBOUND_BODY)

  const { error: logError } = await supabase.from('sms_messages').insert({
    org_id: number.org_id,
    direction: 'inbound',
    kind: 'inbound',
    to_number: number.number,
    from_number: from || 'unknown',
    body,
    twilio_sid: messageSid,
    status: 'received',
  })
  // 23505: Twilio retried a message we already logged.
  if (logError && logError.code !== '23505') {
    console.error('[telephony] inbound sms log failed', logError.code, logError.message)
  }

  const keyword = smsKeyword(body)
  const phone = normalizeE164(form.From ?? '')
  if (phone && keyword === 'opt_out') {
    const { error } = await supabase
      .from('sms_opt_outs')
      .upsert({ org_id: number.org_id, phone }, { onConflict: 'org_id,phone', ignoreDuplicates: true })
    if (error) {
      console.error('[telephony] sms opt-out insert failed', error.code, error.message)
      throw new Error('Opt-out could not be saved')
    }
    console.info('[telephony] sms opt-out recorded', maskPhone(phone))
  } else if (phone && keyword === 'opt_in') {
    const { error } = await supabase.from('sms_opt_outs').delete().eq('org_id', number.org_id).eq('phone', phone)
    if (error) {
      console.error('[telephony] sms opt-in delete failed', error.code, error.message)
      throw new Error('Opt-in could not be saved')
    }
  }

  return twimlResponse(EMPTY_TWIML)
})
