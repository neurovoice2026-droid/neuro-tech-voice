// ElevenLabs telephony models shared by the call-start paths. Verified against
// the official OpenAPI spec (2026-10) and, for the conversation initiation
// webhook (which has no OpenAPI path: ElevenLabs calls US), against the
// twilio-personalization docs:
//
//   POST /v1/convai/twilio/outbound-call   (wrapper: twilio.outboundCall in ../client.ts)
//     body {agent_id*, agent_phone_number_id*, to_number*,
//           conversation_initiation_client_data: ConversationInitiationClientDataRequest-Input,
//           call_recording_enabled: bool | null,
//           telephony_call_config: TelephonyCallConfig-Input
//             {ringing_timeout_secs: integer 1–999 (default 60),
//              twilio_call_recording_enabled (default false), twilio_machine_detection}}
//     → TwilioOutboundCallResponse {success*, message*, conversation_id* (nullable), callSid* (nullable)}
//
//   Agent config: platform_settings.workspace_overrides.conversation_initiation_client_data_webhook
//     = ConversationInitiationClientDataWebhook {url*, request_headers*: {name: string | ConvAISecretLocator {secret_id}}}
//   and platform_settings.overrides.enable_conversation_initiation_client_data_from_webhook (default false).
//   For an inbound native Twilio call ElevenLabs POSTs {caller_id, agent_id,
//   called_number, call_sid, conversation_id} and expects
//   {type: 'conversation_initiation_client_data', dynamic_variables (ALL the
//   agent's variables), conversation_config_override?}.
//
// Pure (types and small builders): safe to import from tests and route code.

import { TOOL_KEY_HEADER } from '../tools/webhook-tool'

/** Ring the callee this long before giving up: the same for native (ElevenLabs) and app-routed (Twilio) outbound calls. */
export const OUTBOUND_RING_TIMEOUT_S = 30

/** TelephonyCallConfig-Input (subset the platform sends). */
export interface TelephonyCallConfig {
  /** 1–999 seconds (spec default 60). */
  ringing_timeout_secs?: number
  /** Twilio-side recording; the platform never uses it (ElevenLabs records the conversation). */
  twilio_call_recording_enabled?: boolean
}

/** TwilioOutboundCallResponse. */
export interface TwilioOutboundCallResponse {
  success: boolean
  message: string
  conversation_id: string | null
  callSid: string | null
}

/** What ElevenLabs posts to the conversation initiation webhook (inbound native Twilio calls). */
export interface InitiationWebhookRequest {
  caller_id?: string | null
  agent_id: string
  called_number?: string | null
  call_sid?: string | null
  conversation_id?: string | null
}

/** The webhook's answer. Only documented fields are sent (no user_id, branch_id or environment). */
export interface InitiationWebhookResponse {
  type: 'conversation_initiation_client_data'
  dynamic_variables: Record<string, string | number | boolean>
  conversation_config_override?: Record<string, unknown>
}

/** Header carrying the workspace secret on initiation webhook requests (the platform tools' key, same secret). */
export const INITIATION_KEY_HEADER = TOOL_KEY_HEADER

/** ConversationInitiationClientDataWebhook for an agent: our URL and the secret header by reference (never the value). */
export function initiationWebhookBlock(url: string, secretId: string): { url: string; request_headers: Record<string, { secret_id: string }> } {
  return { url, request_headers: { [INITIATION_KEY_HEADER]: { secret_id: secretId } } }
}
