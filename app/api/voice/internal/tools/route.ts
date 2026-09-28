import { after, NextResponse } from 'next/server'
import { z } from 'zod'
import { ApiError, handleRoute, noStore, zUuid } from '@/lib/api/http'
import { readVerifiedInternalBody } from '@/lib/security/signing'
import { RATE_LIMITS, rateLimit } from '@/lib/security/rate-limit'
import { runVoiceTool, TOOL_BUDGET_MS } from '@/lib/voice/tools'
import type { ToolRequest, ToolResponse, VoiceToolName } from '@/lib/voice/contracts'

// POST /api/voice/internal/tools — the voice gateway runs one tool call.
// Signed with VOICE_GATEWAY_SECRET (x-ntv-signature). Authentication and
// malformed bodies get the standard error body; everything after that answers
// 200 with a ToolResponse, because the gateway hands `result` straight to the
// model and a failed tool must still tell it what to say.

export const runtime = 'nodejs'
// The tool itself answers within 8 s; background work (logging, texts to the
// waitlist, a slow calendar write finishing) may run a little longer.
export const maxDuration = 30

/**
 * Arguments as the model produced them. Providers hand them over either parsed
 * or as the raw JSON string; anything unusable becomes {} so the tool itself
 * tells the model which values are missing instead of the call failing here.
 */
const toolArguments = z
  .unknown()
  .transform((value): Record<string, unknown> => {
    let parsed = value
    if (typeof value === 'string') {
      try {
        parsed = JSON.parse(value)
      } catch {
        parsed = null
      }
    }
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? (parsed as Record<string, unknown>) : {}
  })

const toolRequestSchema = z.object({
  session_id: zUuid,
  call_id: zUuid,
  tool_call_id: z.string().trim().min(1).max(200),
  name: z.string().trim().min(1).max(80),
  arguments: toolArguments,
})

export const POST = handleRoute(async (req) => {
  const raw = await readVerifiedInternalBody(req)

  let json: unknown
  try {
    json = JSON.parse(raw)
  } catch {
    throw new ApiError(400, 'invalid_json', 'Request body must be valid JSON.')
  }
  const body = toolRequestSchema.parse(json)
  if (body.session_id !== body.call_id) {
    throw new ApiError(400, 'session_mismatch', 'session_id must match call_id.')
  }

  const limit = await rateLimit(RATE_LIMITS.gatewayInternal, body.session_id)
  if (!limit.ok) {
    console.warn('[tools] rate limited', { callId: body.call_id })
    // Still a ToolResponse: the gateway forwards it to the model as the tool output.
    const res: ToolResponse = {
      ok: false,
      result: "Too many requests on this call right now. Don't retry; continue the conversation and offer to take a message if needed.",
      action: null,
    }
    return noStore(NextResponse.json(res, { headers: { 'Retry-After': String(limit.resetSeconds) } }))
  }

  const request: ToolRequest = {
    session_id: body.session_id,
    call_id: body.call_id,
    tool_call_id: body.tool_call_id,
    name: body.name as VoiceToolName,
    arguments: body.arguments ?? {},
  }
  const result = await runVoiceTool(request, {
    signal: AbortSignal.any([req.signal, AbortSignal.timeout(TOOL_BUDGET_MS)]),
    defer: (task) => after(task),
  })
  return noStore(NextResponse.json(result))
})
