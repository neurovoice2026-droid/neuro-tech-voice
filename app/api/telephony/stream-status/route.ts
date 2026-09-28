import { after, type NextRequest } from 'next/server'
import { handleRoute } from '@/lib/api/http'
import { readVerifiedTwilioForm } from '@/lib/twilio/signature'
import { recordBreakerFailure } from '@/lib/voice/breaker'

// <Stream statusCallback>: stream-started / stream-stopped / stream-error.
// A stream-error means Twilio could not reach or keep the gateway WebSocket,
// so it counts against the gateway breaker; enough of them route new calls
// straight to ElevenLabs until the gateway recovers. Successes are recorded
// by the gateway itself (stream_started event), which proves more than a
// socket merely opening.

export const runtime = 'nodejs'

export const POST = handleRoute(async (req: NextRequest) => {
  const form = await readVerifiedTwilioForm(req)
  if (form.StreamEvent === 'stream-error') {
    const detail = (form.StreamError ?? '').slice(0, 200)
    console.error('[telephony] media stream error', req.nextUrl.searchParams.get('call_id') ?? form.CallSid ?? '', detail)
    after(async () => {
      try {
        await recordBreakerFailure('gateway', 'hard')
      } catch (error) {
        console.error('[telephony] breaker update failed', error instanceof Error ? error.message : error)
      }
    })
  }
  return new Response(null, { status: 204 })
})
