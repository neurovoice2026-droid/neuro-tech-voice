import 'server-only'
import { addToWaitlist } from '@/lib/scheduling/waitlist'
import { parseToolArguments } from '@/lib/voice/tools/schemas'
import { failure, success, type ToolHandler } from '@/lib/voice/tools/runtime'

// add_to_waitlist: the caller's own number is attached from the call row.

export const addToWaitlistTool: ToolHandler = async (ctx, args) => {
  const parsed = parseToolArguments('add_to_waitlist', args)
  if (!parsed.ok) return failure(parsed.message)
  if (!ctx.entitlements.googleIntegrations) {
    return failure("The waitlist isn't part of this business's plan. Offer to take a message so the team can call back if a time opens up.")
  }

  const result = await addToWaitlist({
    orgId: ctx.org.id,
    agentId: ctx.agent?.id ?? null,
    callId: ctx.call.id,
    callerName: parsed.data.caller_name,
    callerPhone: ctx.callerPhone,
    service: parsed.data.service,
    preferredTimes: parsed.data.preferred_times,
  })
  if (!result.ok) {
    return failure(
      result.reason === 'no_phone'
        ? "The caller's number is withheld or unknown, so they can't be added to the waitlist. Offer to take a message with a callback number instead."
        : "The waitlist couldn't be updated right now. Apologise and offer to take a message instead."
    )
  }

  const textsOn = ctx.org.sms_enabled && ctx.entitlements.smsConfirmations
  const followUp = textsOn
    ? 'If a matching time opens up, they will get a text and can call back to book it.'
    : 'The team can see the waitlist and will be in touch if a matching time opens up.'
  return success(
    `${result.alreadyWaiting ? 'The caller was already on the waitlist; their details were updated.' : 'The caller was added to the waitlist.'} ${followUp} Tell the caller this, without promising that a time will come up.`
  )
}
