// Webhook tool `get_order_items` (ElevenLabs store agent, e-commerce vertical).
// Authentication, call resolution and error shape: ../_lib/business-tool.ts;
// the handler: lib/commerce/tools/handlers.ts.
import { handleBusinessToolRequest } from '../_lib/business-tool'
import { COMMERCE_TOOL_HANDLERS } from '@/lib/commerce/tools/handlers'

export async function POST(request: Request) {
  return handleBusinessToolRequest(request, {
    key: 'elevenlabs.tool.commerce_get_order_items',
    tool: 'get_order_items',
    perCallLimit: 10,
    run: (ctx, args, log) => COMMERCE_TOOL_HANDLERS.get_order_items(ctx, args, log),
  })
}
