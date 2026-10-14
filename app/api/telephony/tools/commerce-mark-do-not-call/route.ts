// Webhook tool `mark_do_not_call` (ElevenLabs store agent, e-commerce vertical).
// Authentication, call resolution and error shape: ../_lib/business-tool.ts;
// the handler: lib/commerce/tools/handlers.ts.
import { handleBusinessToolRequest } from '../_lib/business-tool'
import { COMMERCE_TOOL_HANDLERS } from '@/lib/commerce/tools/handlers'

export async function POST(request: Request) {
  return handleBusinessToolRequest(request, {
    key: 'elevenlabs.tool.commerce_mark_do_not_call',
    tool: 'mark_do_not_call',
    perCallLimit: 3,
    run: (ctx, args, log) => COMMERCE_TOOL_HANDLERS.mark_do_not_call(ctx, args, log),
  })
}
