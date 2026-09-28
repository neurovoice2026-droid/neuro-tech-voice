import 'server-only'
import { kvIncr } from '@/lib/kv'
import { sendSms } from '@/lib/twilio/sms'
import { linksOutsideWebsite } from '@/lib/sms/links'
import { callerMessageSms } from '@/lib/sms/templates'
import { parseToolArguments } from '@/lib/voice/tools/schemas'
import { failure, lastFour, success, type ToolHandler } from '@/lib/voice/tools/runtime'

// send_sms: a text to the caller's own number (from the call row, never an
// argument), at most MAX_TEXTS_PER_CALL per call so a confused conversation
// can't flood someone's phone.

export const MAX_TEXTS_PER_CALL = 2
const COUNTER_TTL_SECONDS = 6 * 3600

export const sendSmsTool: ToolHandler = async (ctx, args) => {
  const parsed = parseToolArguments('send_sms', args)
  if (!parsed.ok) return failure(parsed.message)
  if (!ctx.entitlements.smsConfirmations || !ctx.org.sms_enabled) {
    return failure("Texts are turned off for this business. Don't promise a text; give the information aloud instead.")
  }
  if (!ctx.callerPhone) {
    return failure("There's no phone number to text on this call. Give the information aloud instead.")
  }

  // Caller id can be spoofed, so the "caller" may be someone else: no links except the business's own site.
  if (linksOutsideWebsite(parsed.data.message, ctx.org.website).length > 0) {
    return failure(
      "Texts can only link to this business's own website, so nothing was sent. Leave the link out, or give the information aloud instead."
    )
  }

  const count = await kvIncr(`tool:sms:${ctx.call.id}`, COUNTER_TTL_SECONDS)
  if (count > MAX_TEXTS_PER_CALL) {
    return failure(`The limit of ${MAX_TEXTS_PER_CALL} texts per call has been reached. Give any further details aloud.`)
  }

  const body = callerMessageSms({ businessName: ctx.businessName, message: parsed.data.message })
  const result = await sendSms({ orgId: ctx.org.id, to: ctx.callerPhone, body, kind: 'custom', callId: ctx.call.id })
  if (result.ok) {
    const ending = lastFour(ctx.callerPhone)
    return success(`Text sent to the caller's phone${ending ? ` ending in ${ending}` : ''}. Tell them it's on its way.`)
  }
  switch (result.reason) {
    case 'opted_out':
      return failure('The caller has opted out of texts from this business, so nothing was sent. Give the information aloud instead.')
    case 'invalid_number':
      return failure("The caller's number can't receive texts, so nothing was sent. Give the information aloud instead.")
    case 'sms_disabled':
    case 'not_configured':
    case 'no_sms_number':
      return failure("This business can't send texts right now, so nothing was sent. Give the information aloud instead.")
    default:
      return failure("The text couldn't be sent. Apologise and give the information aloud instead.")
  }
}
