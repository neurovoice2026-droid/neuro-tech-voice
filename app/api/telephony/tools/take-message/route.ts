// Webhook tool `take_message` (ElevenLabs agent, slice B2): saves the
// caller's message on the call and alerts the team by e-mail (recipients
// from the org's settings only). One message per call; a second request
// corrects it. Authentication, call resolution and error shape:
// ../_lib/business-tool.ts.
import { handleBusinessToolRequest } from '../_lib/business-tool'
import { takeMessageTool } from '@/lib/voice-tools/message-tools'

export async function POST(request: Request) {
  return handleBusinessToolRequest(request, {
    key: 'elevenlabs.tool.take_message',
    tool: 'take_message',
    perCallLimit: 5,
    run: (ctx, args, log) => takeMessageTool(ctx, args, log, 'elevenlabs'),
  })
}
