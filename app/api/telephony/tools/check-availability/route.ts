// Webhook tool `check_availability` (ElevenLabs agent, slice B2): at most
// three free appointment times from the business's Google Calendar, within
// its opening hours and booking rules. The offered slot ids are remembered
// for the call; book_appointment only books one of them. Authentication,
// call resolution and error shape: ../_lib/business-tool.ts.
import { handleBusinessToolRequest } from '../_lib/business-tool'
import { checkAvailabilityTool } from '@/lib/voice-tools/booking-tools'

export async function POST(request: Request) {
  return handleBusinessToolRequest(request, {
    key: 'elevenlabs.tool.check_availability',
    tool: 'check_availability',
    perCallLimit: 10,
    run: (ctx, args, log) => checkAvailabilityTool(ctx, args, log),
  })
}
