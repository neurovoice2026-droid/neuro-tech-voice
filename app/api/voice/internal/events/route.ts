import { after, type NextRequest } from 'next/server'
import { z } from 'zod'
import { ApiError, handleRoute, validationError, zUuid } from '@/lib/api/http'
import { entitlementsFor } from '@/lib/billing/entitlements'
import { isTwilioConfigured } from '@/lib/env'
import { RATE_LIMITS, enforceRateLimit } from '@/lib/security/rate-limit'
import { readVerifiedInternalBody } from '@/lib/security/signing'
import { createAdminClient } from '@/lib/supabase/admin'
import { startRecording } from '@/lib/twilio/calls'
import { breakerFailureKind, recordBreakerFailure, recordBreakerSuccess } from '@/lib/voice/breaker'
import { markBudgetExhausted } from '@/lib/voice/budget'
import { breakerKeyForProviderError, markStreamStarted, providerErrorFacts } from '@/lib/voice/router'
import { behaviorFor } from '@/lib/voice/session'
import { loadAgent, loadCallById, loadOrganization, type CallRow } from '@/lib/voice/session-loader'

// Gateway → app: what happened during a call. Feeds the circuit breakers and
// the Cartesia budget flags that steer the next calls, starts the Twilio
// recording once the agent is live, and records fallbacks on the call row.
// Answers 204 at once; slower work runs after the response.

export const runtime = 'nodejs'

const modeSchema = z.enum(['cartesia_self', 'cartesia_managed', 'elevenlabs'])
const codeSchema = z
  .union([z.string().max(200), z.number()])
  .transform((value) => String(value))
  .nullable()
  .optional()

const BodySchema = z.object({
  session_id: zUuid,
  call_id: zUuid,
  type: z.enum(['stream_started', 'mode_switched', 'component_fallback', 'quota_exceeded', 'provider_error', 'agent_ended', 'transferred']),
  at: z.string().max(64),
  data: z
    .object({
      provider: z.enum(['cartesia', 'openai', 'elevenlabs', 'gateway']).optional(),
      component: z.enum(['stt', 'tts', 'llm', 'agent']).optional(),
      from_mode: modeSchema.optional(),
      to_mode: modeSchema.optional(),
      code: codeSchema,
      message: z.string().max(2000).nullable().optional(),
      budget: z.enum(['model_credits', 'agent_dollars']).optional(),
      cartesia_call_id: z.string().max(200).nullable().optional(),
      stream_sid: z.string().max(64).nullable().optional(),
    })
    .default({}),
})

function background(label: string, work: () => Promise<unknown>): void {
  after(async () => {
    try {
      await work()
    } catch (error) {
      console.error('[voice] event', label, 'failed', error instanceof Error ? error.message : error)
    }
  })
}

async function updateCall(call: CallRow, patch: Record<string, unknown>, onlyIfNull?: string): Promise<void> {
  let query = createAdminClient().from('calls').update(patch).eq('id', call.id).eq('org_id', call.org_id)
  if (onlyIfNull) query = query.is(onlyIfNull, null)
  const { error } = await query
  if (error) console.error('[voice] event call update failed', error.code, error.message)
}

function shortReason(parts: (string | null | undefined)[]): string {
  return parts.filter(Boolean).join(':').slice(0, 200)
}

async function startRecordingIfWanted(call: CallRow): Promise<void> {
  if (!call.twilio_call_sid || call.recording_sid || !isTwilioConfigured()) return
  const [org, agent] = await Promise.all([loadOrganization(call.org_id), loadAgent(call.org_id, call.agent_id)])
  if (!org || !agent) return
  const behavior = behaviorFor(agent, { isTest: call.is_test })
  if (!behavior.record || !entitlementsFor(org.plan).recordings) return
  const { sid } = await startRecording({ callSid: call.twilio_call_sid, callId: call.id })
  await updateCall(call, { recording_sid: sid }, 'recording_sid')
}

export const POST = handleRoute(async (req: NextRequest) => {
  const raw = await readVerifiedInternalBody(req)
  let json: unknown
  try {
    json = JSON.parse(raw)
  } catch {
    throw new ApiError(400, 'invalid_json', 'Request body must be valid JSON.')
  }
  const parsed = BodySchema.safeParse(json)
  if (!parsed.success) throw validationError(parsed.error)
  const event = parsed.data
  if (event.call_id !== event.session_id) {
    throw new ApiError(400, 'validation_error', 'call_id must equal session_id.')
  }
  await enforceRateLimit(RATE_LIMITS.gatewayInternal, event.session_id)

  const call = await loadCallById(event.call_id)
  if (!call) throw new ApiError(404, 'call_not_found', 'Call not found.')
  const { data } = event

  switch (event.type) {
    case 'stream_started': {
      await markStreamStarted(call.id)
      const mode = call.pipeline_mode
      background('breaker success', async () => {
        await recordBreakerSuccess('gateway')
        if (mode) await recordBreakerSuccess(mode)
      })
      background('start recording', () => startRecordingIfWanted(call))
      break
    }
    case 'provider_error': {
      const key = breakerKeyForProviderError(data, call.pipeline_mode)
      // null = configuration or quota error: fix the setup, don't trip the breaker.
      const kind = key ? breakerFailureKind(providerErrorFacts(data.code), { provider: data.provider }) : null
      console.warn('[voice] provider error', call.id, data.provider ?? '', data.component ?? '', data.code ?? '')
      if (key && kind) background('breaker failure', () => recordBreakerFailure(key, kind))
      break
    }
    case 'quota_exceeded': {
      const budget = data.budget ?? (data.component === 'agent' ? 'agent_dollars' : 'model_credits')
      console.warn('[voice] Cartesia quota exceeded', budget, call.id)
      await markBudgetExhausted(budget)
      break
    }
    case 'mode_switched': {
      const toMode = data.to_mode
      await updateCall(call, {
        fallback_used: true,
        fallback_reason: shortReason(['mode_switched', data.from_mode, data.to_mode, data.code]),
        ...(toMode ? { pipeline_mode: toMode, voice_provider: toMode === 'elevenlabs' ? 'elevenlabs' : 'cartesia' } : {}),
      })
      break
    }
    case 'component_fallback': {
      await updateCall(call, {
        fallback_used: true,
        fallback_reason: shortReason(['component_fallback', data.component, data.provider, data.code]),
      })
      break
    }
    case 'agent_ended': {
      await updateCall(call, { end_reason: 'agent_hangup' }, 'end_reason')
      break
    }
    case 'transferred': {
      await updateCall(call, { end_reason: 'transferred' }, 'end_reason')
      break
    }
  }

  return new Response(null, { status: 204 })
})
