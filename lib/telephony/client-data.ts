import 'server-only'
// ONE builder for conversation_initiation_client_data, used by every path that
// starts an ElevenLabs conversation for a call:
//   • register-call (app-routed inbound and outbound, lib/telephony/router.ts)
//   • POST /v1/convai/twilio/outbound-call (native outbound, ./outbound.ts)
//   • the conversation initiation webhook (native inbound, ./initiation.ts)
//
// dynamic_variables: the platform variables (PLATFORM_VARIABLES), always with
// real per-call values: our call id, the signed correlation token
// (ntv_call_token, purpose 'transfer', post-call matching), the signed tool
// token (secret__ntv_call_token, purpose 'tool', X-NTV-Call-Token header of
// every platform tool; secret__ values never reach the LLM), the direction,
// the routing mode, after_hours and the business name. Tenant variables come
// first and never override a platform key.
//
// conversation_config_override: only fields the agent allows
// (platform_settings.overrides, see lib/elevenlabs/client-overrides.ts):
//   • outbound calls open with the outbound greeting, which carries the AI
//     disclosure AND the recording notice when the business enabled it;
//   • a paused agent/number or a used-up trial opens with the "unavailable"
//     line and is cut short;
//   • a trial call is capped to the minutes left.
//
// user_id identifies the END caller (opaque, per organization: an HMAC of the
// other party's number), never the organization.

import crypto from 'crypto'
import type { ClientData } from '@/lib/elevenlabs/client'
import { OVERRIDE_FIRST_MESSAGE, OVERRIDE_MAX_DURATION } from '@/lib/elevenlabs/client-overrides'
import { PLATFORM_VARIABLES } from '@/lib/voice-providers/prompt'
import { voiceTokenSecret } from '@/lib/voice-providers/config'
import { normalizeE164 } from '@/lib/phone/e164'
import { UNAVAILABLE_MESSAGE, applyDisclosure, localized, outboundGreetingFor } from '@/lib/voice/greetings'
import { signCallToken } from './tokens'

/** Lifetime of the per-call tokens (longer than any call). */
export const CALL_TOKEN_TTL_S = 4 * 60 * 60
/** A call refused at answer (paused, trial used up) lasts at most this long: the "unavailable" line, then the end. */
export const UNAVAILABLE_MAX_DURATION_S = 20

export type RoutingModeVariable = 'app_routed' | 'native'

export interface ClientDataInput {
  /** calls.id (null only when no row could be created: the tokens are then the placeholders). */
  callId: string | null
  orgId: string
  direction: 'inbound' | 'outbound'
  routingMode: RoutingModeVariable
  afterHours: boolean
  businessName: string
  agent: { name: string; language: string; recordingNotice: boolean; maxDurationSeconds: number }
  /** The other party (caller of an inbound call, callee of an outbound call), for user_id. */
  endUserNumber?: string | null
  /** Tenant dynamic variables (already stripped of platform references). */
  tenantVariables?: Record<string, string>
  /** Override fields the agent accepts (default: first message only). */
  allowedOverrides?: ReadonlySet<string>
  /** Plan cap in seconds (lib/telephony/quota.ts), null = none. */
  capSeconds?: number | null
  /** Paused agent or number, or a used-up trial: open with the "unavailable" line and end soon. */
  unavailable?: boolean
}

/** Opaque end-user id for provider analytics: per organization, never the raw number. */
export function endUserId(orgId: string, number: string | null | undefined): string | null {
  const e164 = number ? normalizeE164(number) : null
  const secret = voiceTokenSecret()
  if (!e164 || !secret) return null
  const mac = crypto.createHmac('sha256', secret).update(`user:${orgId}:${e164}`).digest('hex')
  return `ntvu_${mac.slice(0, 32)}`
}

/** The platform variables with their real per-call values. */
export function platformVariables(input: ClientDataInput): Record<string, string> {
  return {
    [PLATFORM_VARIABLES.callId]: input.callId ?? 'unknown',
    // Correlation only (post-call webhook matching needs a non-redacted value).
    [PLATFORM_VARIABLES.callToken]: input.callId ? signCallToken(input.callId, 'transfer', CALL_TOKEN_TTL_S) : 'none',
    // Tool authentication (X-NTV-Call-Token header), never sent to the LLM.
    [PLATFORM_VARIABLES.secretCallToken]: input.callId ? signCallToken(input.callId, 'tool', CALL_TOKEN_TTL_S) : 'none',
    // Which transfer tool applies in mixed-mode orgs (prompt rule).
    [PLATFORM_VARIABLES.routingMode]: input.routingMode,
    [PLATFORM_VARIABLES.afterHours]: input.afterHours ? 'true' : 'false',
    [PLATFORM_VARIABLES.businessName]: input.businessName,
    // Gates voicemail_detection to outbound calls (prompt rule).
    [PLATFORM_VARIABLES.callDirection]: input.direction,
  }
}

/** conversation_config_override for this call, limited to the fields the agent allows; null when nothing applies. */
export function conversationOverride(input: ClientDataInput): Record<string, unknown> | null {
  const allowed = input.allowedOverrides ?? new Set([OVERRIDE_FIRST_MESSAGE])
  const agent: Record<string, unknown> = {}
  const conversation: Record<string, unknown> = {}
  const language = input.agent.language

  if (input.unavailable) {
    if (allowed.has(OVERRIDE_FIRST_MESSAGE)) agent.first_message = localized(UNAVAILABLE_MESSAGE, language)
    if (allowed.has(OVERRIDE_MAX_DURATION)) conversation.max_duration_seconds = UNAVAILABLE_MAX_DURATION_S
  } else {
    if (input.direction === 'outbound' && allowed.has(OVERRIDE_FIRST_MESSAGE)) {
      // The agent placed this call: an outbound opening line, with the AI
      // disclosure and, when the business enabled it, the recording notice.
      const greeting = outboundGreetingFor({ language, company: input.businessName, agentName: input.agent.name })
      agent.first_message = applyDisclosure(greeting, { language, businessName: input.businessName, recordingNotice: input.agent.recordingNotice })
    }
    const cap = input.capSeconds
    if (typeof cap === 'number' && cap > 0 && cap < input.agent.maxDurationSeconds && allowed.has(OVERRIDE_MAX_DURATION)) {
      conversation.max_duration_seconds = Math.floor(cap)
    }
  }
  const out: Record<string, unknown> = {}
  if (Object.keys(agent).length) out.agent = agent
  if (Object.keys(conversation).length) out.conversation = conversation
  return Object.keys(out).length ? out : null
}

/** Complete client data for register-call and outbound-call. */
export function buildClientData(input: ClientDataInput): ClientData {
  const data: ClientData = {
    dynamic_variables: { ...(input.tenantVariables ?? {}), ...platformVariables(input) },
  }
  const override = conversationOverride(input)
  if (override) data.conversation_config_override = override
  const userId = endUserId(input.orgId, input.endUserNumber)
  if (userId) data.user_id = userId
  return data
}
