// The platform's ElevenLabs webhook tools. Each one is a workspace resource
// shared by every tenant (one per deployment), created and reconciled by
// lib/voice-providers/platform-tools.ts from the definition below, and
// attached to agents through prompt.tool_ids. A tenant never chooses a tool,
// a URL or an id: the endpoint resolves everything from the per-call token.
//
// To add a tool: add a definition here (and its key to PlatformToolKey and to
// PlatformResourceKey in lib/voice-providers/platform-resources.ts), its route
// under app/api/telephony/tools/ using the shared helper
// (app/api/telephony/tools/_lib/elevenlabs-tool.ts), and attach its id in
// lib/elevenlabs/agent-config.ts (adapters.ts obtains it with ensurePlatformTool).

import { TRANSFER_BEHAVIOUR } from './behaviour'
import { BOOK_APPOINTMENT_TOOL, CHECK_AVAILABILITY_TOOL, TAKE_MESSAGE_TOOL } from './business'
import type { WebhookToolDefinition } from './types'

export type PlatformToolKey =
  | 'elevenlabs.transfer_tool'
  // In-call business tools (slice B2, ./business.ts).
  | 'elevenlabs.tool.check_availability'
  | 'elevenlabs.tool.book_appointment'
  | 'elevenlabs.tool.take_message'

/** Human transfer for app-routed calls (ElevenLabs cannot transfer a call it does not control). */
export const TRANSFER_TOOL: WebhookToolDefinition = {
  key: 'elevenlabs.transfer_tool',
  name: 'transfer_to_human',
  description:
    'Transfer the live phone call to a human member of the team. Use it only when the caller asks for a person or the business rules in your instructions require it. Tell the caller you are transferring them before you use it. If the result has ok = false, apologise, do not try again, and offer to take a message for the team instead.',
  path: '/api/telephony/tools/transfer',
  method: 'POST',
  behaviour: TRANSFER_BEHAVIOUR,
  body: {
    properties: {
      reason: {
        type: 'string',
        description:
          'One short sentence (at most 200 characters) saying why the caller wants a person. Do not include phone numbers, card numbers or other personal data.',
      },
    },
    required: ['reason'],
  },
  // The route answers {ok, message}: nothing else ever reaches the LLM.
  responseFilter: { mode: 'allow', filters: ['ok', 'message'] },
}

export const PLATFORM_WEBHOOK_TOOLS: Record<PlatformToolKey, WebhookToolDefinition> = {
  'elevenlabs.transfer_tool': TRANSFER_TOOL,
  'elevenlabs.tool.check_availability': CHECK_AVAILABILITY_TOOL,
  'elevenlabs.tool.book_appointment': BOOK_APPOINTMENT_TOOL,
  'elevenlabs.tool.take_message': TAKE_MESSAGE_TOOL,
}

export const PLATFORM_TOOL_KEYS = Object.keys(PLATFORM_WEBHOOK_TOOLS) as PlatformToolKey[]

export function isPlatformToolKey(key: string): key is PlatformToolKey {
  return Object.hasOwn(PLATFORM_WEBHOOK_TOOLS, key)
}
