import 'server-only'
import { parseToolArguments } from '@/lib/voice/tools/schemas'
import { failure, success, type ToolHandler } from '@/lib/voice/tools/runtime'

// end_call: the gateway hangs up after the reply that follows has been played.

export const endCallTool: ToolHandler = async (_ctx, args) => {
  const parsed = parseToolArguments('end_call', args)
  if (!parsed.ok) return failure(parsed.message)
  const reason = parsed.data.reason ?? 'conversation finished'
  return success(
    "The call will end right after your next reply is spoken. If you haven't said goodbye yet, say a short, warm goodbye now and nothing else.",
    { action: { type: 'end_call', reason } }
  )
}
