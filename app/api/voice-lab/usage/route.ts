import { NextResponse } from 'next/server'
import { handleRoute } from '@/lib/api/http'
import { requireOrgContext } from '@/lib/api/auth'
import { isCartesiaConfigured } from '@/lib/env'
import { STT_MAX_BYTES, TTS_TOOL_MAX_CHARS } from '@/components/voice/voice-options'
import { getToolQuota } from '../_lib/usage'

export const runtime = 'nodejs'

// GET /api/voice-lab/usage → this period's Voice Lab allowances for the meters.

export const GET = handleRoute(async () => {
  const ctx = await requireOrgContext()
  const [tts, stt] = await Promise.all([getToolQuota(ctx, 'tts_tool'), getToolQuota(ctx, 'stt_tool')])
  return NextResponse.json(
    {
      configured: isCartesiaConfigured(),
      plan: ctx.org.plan,
      period: { start: tts.period.start.toISOString(), end: tts.period.end.toISOString() },
      tts: { ...tts.state, max_chars_per_request: TTS_TOOL_MAX_CHARS },
      stt: { ...stt.state, max_bytes_per_file: STT_MAX_BYTES },
    },
    { headers: { 'Cache-Control': 'private, no-cache' } }
  )
})
