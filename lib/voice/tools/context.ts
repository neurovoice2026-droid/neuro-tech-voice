import 'server-only'
import { composeCallContext } from '@/lib/voice/prompt'
import { summarizeWorkingHours } from '@/lib/voice/session'
import { loadSchedulingSettings } from '@/lib/scheduling/settings'
import { success, type ToolHandler } from '@/lib/voice/tools/runtime'

// get_call_context: today's date and time in the business zone, business
// hours, direction and the caller's number. Same wording as the per-call
// context the self-run pipeline already sends, so the model sees one format.

export const getCallContext: ToolHandler = async (ctx) => {
  let hours = ctx.agent?.working_hours ?? null
  try {
    // Booking hours win when they exist: they are what check_availability uses.
    const { settings, exists } = await loadSchedulingSettings(ctx.org.id, { fallbackHours: hours, signal: ctx.signal })
    if (exists) hours = settings.business_hours
  } catch {
    // Agent hours are a good enough answer when the settings can't be read.
  }
  const context = composeCallContext({
    now: ctx.now,
    timezone: ctx.timezone,
    direction: ctx.call.direction,
    caller_number: ctx.callerPhone,
    business_hours_summary: hours ? summarizeWorkingHours(hours, ctx.timezone) : null,
    is_test: ctx.call.is_test,
  })
  return success(context)
}
