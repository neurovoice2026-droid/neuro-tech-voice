import 'server-only'
import { mergeLeadDetails } from '@/lib/voice/tools/lead-fields'
import { parseToolArguments } from '@/lib/voice/tools/schemas'
import { failure, success, type ToolHandler } from '@/lib/voice/tools/runtime'

// save_lead_details: merges answers into calls.extracted. Later calls in the
// same conversation update the same keys, so the lead ends up complete.

export const saveLeadDetailsTool: ToolHandler = async (ctx, args) => {
  const parsed = parseToolArguments('save_lead_details', args)
  if (!parsed.ok) return failure(parsed.message)

  const { extracted, saved, invalidEmail } = mergeLeadDetails(ctx.call.extracted, parsed.data, ctx.agent?.lead_fields ?? [])
  if (saved.length === 0) {
    return invalidEmail
      ? failure("The email address doesn't look complete. Spell it back to the caller, then call save_lead_details again with the corrected address.")
      : success('Nothing new to save. Carry on with the conversation; do not mention this to the caller.')
  }

  const { error } = await ctx.admin
    .from('calls')
    .update({ extracted })
    .eq('id', ctx.call.id)
    .eq('org_id', ctx.org.id)
    .abortSignal(ctx.signal)
  if (error) {
    console.error('[tools] saving lead details failed', error.code, error.message)
    return failure('The details could not be saved right now. Carry on with the conversation without mentioning it; they are still in the call transcript.')
  }

  const emailNote = invalidEmail
    ? " The email address doesn't look complete: spell it back to the caller and save it again once confirmed."
    : ''
  return success(`Saved: ${saved.join(', ')}.${emailNote} Carry on with the conversation; do not mention saving to the caller.`)
}
