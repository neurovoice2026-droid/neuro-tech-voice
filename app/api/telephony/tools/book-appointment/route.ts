// Webhook tool `book_appointment` (ElevenLabs agent, slice B2): books one of
// the slots check_availability offered on this call, after a fresh busy
// check, in the business's Google Calendar (caller name and number from the
// call). Idempotent per call and slot; confirmed only once the event exists.
// Authentication, call resolution and error shape: ../_lib/business-tool.ts.
import { handleBusinessToolRequest } from '../_lib/business-tool'
import { bookAppointmentTool } from '@/lib/voice-tools/booking-tools'

// Lock wait + busy check + calendar write stay within the tool's 15 s timeout.
export const maxDuration = 30

export async function POST(request: Request) {
  return handleBusinessToolRequest(request, {
    key: 'elevenlabs.tool.book_appointment',
    tool: 'book_appointment',
    perCallLimit: 5,
    run: (ctx, args, log) => bookAppointmentTool(ctx, args, log),
  })
}
