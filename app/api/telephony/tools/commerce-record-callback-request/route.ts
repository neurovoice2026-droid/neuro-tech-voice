// Webhook tool `record_callback_request` (ElevenLabs store agent, e-commerce vertical).
// Authentication, call resolution and error shape: ../_lib/business-tool.ts;
// the handler: lib/commerce/tools/handlers.ts.
import { handleBusinessToolRequest } from '../_lib/business-tool'
import { COMMERCE_TOOL_HANDLERS } from '@/lib/commerce/tools/handlers'

export async function POST(request: Request) {
  return handleBusinessToolRequest(request, {
    key: 'elevenlabs.tool.commerce_record_callback_request',
    tool: 'record_callback_request',
    perCallLimit: 4,
    run: (ctx, args, log) => COMMERCE_TOOL_HANDLERS.record_callback_request(ctx, args, log),
  })
}
