import 'server-only'
import { after } from 'next/server'
import { env, isElevenLabsConfigured } from '@/lib/env'
import type { CallDirection, ElevenLabsFallbackConfig } from '@/lib/voice/contracts'
import { baseLanguage } from '@/lib/voice/languages'
import { breakerFailureKind, recordBreakerFailure, recordBreakerSuccess } from '@/lib/voice/breaker'

// ElevenLabs as the whole-call fallback (elevenlabs-fallback.md §2.1, §5.4):
// POST /v1/convai/twilio/register-call returns TwiML that connects the Twilio
// call to the standby ElevenLabs agent. The router returns that TwiML as is.
// The agent must have overrides enabled for prompt, first message, language
// and voice, and μ-law 8 kHz audio (lib/voice/sync keeps it that way).

export const REGISTER_CALL_URL = 'https://api.elevenlabs.io/v1/convai/twilio/register-call'
export const REGISTER_CALL_TIMEOUT_MS = 3_000

/** Twilio answers within seconds; a transcript override must stay small. */
const MAX_PRIOR_TRANSCRIPT_CHARS = 6_000

export interface RegisterElevenLabsCallInput {
  /** agents.elevenlabs_agent_id */
  agentId: string
  from: string
  to: string
  direction: CallDirection
  /** calls.id; echoed back by the post-call webhook as a dynamic variable. */
  callId: string
  overrides: ElevenLabsFallbackConfig
  /** Why ElevenLabs serves this call (mode reason, 'stream_ended', 'voice_url_error'…). */
  reason: string
  orgId?: string | null
  twilioCallSid?: string | null
  /** "Conversation so far" when a call is handed over mid-way; '' otherwise. */
  priorTranscript?: string | null
}

/**
 * ElevenLabs parses {{name}} in prompts and first messages as dynamic
 * variables; an owner's text containing braces would otherwise fail the call
 * or be substituted. A space between the braces keeps the text readable.
 */
export function escapeDynamicVariables(text: string): string {
  return text.replace(/\{\{/g, '{ {').replace(/\}\}/g, '} }')
}

export function buildRegisterCallBody(input: RegisterElevenLabsCallInput): Record<string, unknown> {
  const agentOverride: Record<string, unknown> = {
    prompt: { prompt: escapeDynamicVariables(input.overrides.prompt) },
    language: baseLanguage(input.overrides.language),
  }
  const firstMessage = input.overrides.first_message?.trim()
  if (firstMessage) agentOverride.first_message = escapeDynamicVariables(firstMessage)

  const configOverride: Record<string, unknown> = { agent: agentOverride }
  if (input.overrides.voice_id) configOverride.tts = { voice_id: input.overrides.voice_id }

  const prior = (input.priorTranscript ?? '').slice(-MAX_PRIOR_TRANSCRIPT_CHARS)

  return {
    agent_id: input.agentId,
    from_number: input.from,
    to_number: input.to,
    direction: input.direction,
    conversation_initiation_client_data: {
      ...(input.orgId ? { user_id: input.orgId } : {}),
      dynamic_variables: {
        call_id: input.callId,
        org_id: input.orgId ?? '',
        twilio_call_sid: input.twilioCallSid ?? '',
        failover_reason: input.reason,
        prior_transcript: prior,
      },
      conversation_config_override: configOverride,
    },
  }
}

function inBackground(work: () => Promise<unknown>): void {
  const task = () => work().catch((error) => console.warn('[elevenlabs] breaker update failed', error instanceof Error ? error.message : error))
  try {
    after(task)
  } catch {
    // Outside a request scope (scripts, tests): run detached.
    void task()
  }
}

/** TwiML from ElevenLabs, or null when it can't serve the call (logged). Never throws. */
export async function registerElevenLabsCall(input: RegisterElevenLabsCallInput): Promise<string | null> {
  const apiKey = env.ELEVENLABS_API_KEY
  if (!isElevenLabsConfigured() || !apiKey || !input.agentId) return null

  let res: Response
  try {
    res = await fetch(REGISTER_CALL_URL, {
      method: 'POST',
      headers: { 'xi-api-key': apiKey, 'Content-Type': 'application/json' },
      body: JSON.stringify(buildRegisterCallBody(input)),
      signal: AbortSignal.timeout(REGISTER_CALL_TIMEOUT_MS),
      cache: 'no-store',
    })
  } catch (error) {
    const timedOut = error instanceof Error && (error.name === 'TimeoutError' || error.name === 'AbortError')
    console.error('[elevenlabs] register-call', timedOut ? 'timed out' : 'failed', input.callId)
    inBackground(() => recordBreakerFailure('elevenlabs', 'hard'))
    return null
  }

  if (!res.ok) {
    let detail = ''
    try {
      const body = (await res.json()) as { detail?: { msg?: unknown }[] | { message?: unknown } }
      const first = Array.isArray(body.detail) ? body.detail[0]?.msg : (body.detail as { message?: unknown } | undefined)?.message
      detail = typeof first === 'string' ? first.slice(0, 200) : ''
    } catch {
      // Non-JSON error bodies carry nothing we need.
    }
    console.error('[elevenlabs] register-call rejected', res.status, input.callId, detail)
    const kind = breakerFailureKind({ status: res.status }, { provider: 'elevenlabs' })
    if (kind) inBackground(() => recordBreakerFailure('elevenlabs', kind))
    return null
  }

  const twiml = (await res.text().catch(() => '')).trim()
  // An empty <Response/> would silently hang up the caller: treat it as a failure.
  if (!/<Response[\s>]/.test(twiml) || !/<(Connect|Stream|Dial|Redirect)[\s>/]/.test(twiml)) {
    console.error('[elevenlabs] register-call returned no TwiML', input.callId)
    inBackground(() => recordBreakerFailure('elevenlabs', 'hard'))
    return null
  }
  inBackground(() => recordBreakerSuccess('elevenlabs'))
  return twiml
}
