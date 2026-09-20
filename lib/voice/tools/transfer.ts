import 'server-only'
import { localized, TRANSFER_ANNOUNCE } from '@/lib/voice/greetings'
import { pickTransferContact } from '@/lib/voice/tools/contacts'
import { parseToolArguments } from '@/lib/voice/tools/schemas'
import { failure, loadContacts, success, type ToolContact, type ToolHandler } from '@/lib/voice/tools/runtime'

// transfer_call: only to a team member the owner allowed transfers to, on the
// number the owner saved. The model names a person or role; the number never
// comes from the model. The gateway plays `announce`, then asks the app
// (/api/voice/internal/call-control) to bridge the call.

export const transferCallTool: ToolHandler = async (ctx, args) => {
  const parsed = parseToolArguments('transfer_call', args)
  if (!parsed.ok) return failure(parsed.message)
  const requested = parsed.data.contact

  let contacts: ToolContact[]
  try {
    contacts = await loadContacts(ctx)
  } catch {
    return failure("Transfers aren't available right now. Apologise and offer to take a message.")
  }

  const match = pickTransferContact(contacts, requested)
  if (!match) {
    return failure(
      requested
        ? `${requested} can't take transferred calls and nobody is on call right now. Apologise and offer to take a message for them.`
        : 'Nobody is available to take a transferred call right now. Apologise and offer to take a message.'
    )
  }
  const { contact, matchedBy } = match
  const label = contact.role ? `${contact.name} (${contact.role})` : contact.name

  if (!ctx.call.twilio_call_sid) {
    return failure(
      `This is a test call from the browser, so it can't be connected to a phone. Tell the caller that on a real call you would now transfer them to ${label}.`
    )
  }

  const instruction =
    requested && matchedBy !== 'requested'
      ? `${requested} isn't available for transfers, so the call goes to ${label}${matchedBy === 'on_call' ? ', who is on call' : ''}. Tell the caller that in one short sentence and say nothing else;`
      : "Say nothing more than a very short acknowledgement;"
  return success(
    `Transferring the caller to ${label}. ${instruction} a connecting message plays automatically and then the call is handed over.`,
    {
      action: {
        type: 'transfer',
        to_e164: contact.phone as string,
        announce: localized(TRANSFER_ANNOUNCE, ctx.language, { name: contact.name }),
      },
    }
  )
}
