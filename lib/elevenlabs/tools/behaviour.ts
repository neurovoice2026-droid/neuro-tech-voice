// Central tool behaviour presets (spec enums in ./types). Every platform tool
// picks one of these, so what the caller hears around a tool call is decided
// in one place.

import type { SystemToolBehaviour, WebhookToolBehaviour } from './types'

/**
 * Transfer to a human (the call leaves the agent):
 * - post_tool_speech: the tool runs only after the agent finished saying it
 *   is transferring, so the TwiML redirect never cuts that sentence off;
 * - pre_tool_speech force: the agent always announces the transfer;
 * - disable_during_tool: the caller cannot interrupt while the redirect runs;
 * - passthrough: our {ok:false, message} guidance (and any error) reaches the
 *   LLM, which then offers to take a message ('auto' means 'hide' for webhook tools);
 * - 15 s: one DB claim plus one Twilio call update, with margin.
 */
export const TRANSFER_BEHAVIOUR: WebhookToolBehaviour = {
  execution_mode: 'post_tool_speech',
  pre_tool_speech: 'force',
  interruption_mode: 'disable_during_tool',
  tool_error_handling_mode: 'passthrough',
  tool_call_sound: null,
  tool_call_sound_behavior: 'auto',
  response_timeout_secs: 15,
}

/** Look-ups whose answer the LLM needs (availability, opening hours): typing sound while waiting. */
export const READ_BEHAVIOUR: WebhookToolBehaviour = {
  execution_mode: 'immediate',
  pre_tool_speech: 'auto',
  interruption_mode: 'disable_during_tool',
  tool_error_handling_mode: 'passthrough',
  tool_call_sound: 'typing',
  tool_call_sound_behavior: 'auto',
  response_timeout_secs: 8,
}

/** Actions with a result the caller must hear (book, cancel): announced, not interruptible. */
export const WRITE_BEHAVIOUR: WebhookToolBehaviour = {
  execution_mode: 'immediate',
  pre_tool_speech: 'force',
  interruption_mode: 'disable_during_tool',
  tool_error_handling_mode: 'passthrough',
  tool_call_sound: 'typing',
  tool_call_sound_behavior: 'auto',
  response_timeout_secs: 15,
}

/** Fire-and-forget notifications (the LLM never waits for, nor reads, the result). */
export const NOTIFY_BEHAVIOUR: WebhookToolBehaviour = {
  execution_mode: 'async',
  pre_tool_speech: 'off',
  interruption_mode: 'allow',
  tool_error_handling_mode: 'hide',
  tool_call_sound: null,
  tool_call_sound_behavior: 'auto',
  response_timeout_secs: 10,
}

/**
 * Built-in transfer_to_number (native numbers): the agent always says it is
 * transferring, and the caller cannot cut the hand-off short.
 */
export const SYSTEM_TRANSFER_BEHAVIOUR: SystemToolBehaviour = {
  pre_tool_speech: 'force',
  interruption_mode: 'disable_during_tool',
}

/** Deprecated tool keys (spec: replaced by pre_tool_speech / interruption_mode). Never written. */
export const DEPRECATED_TOOL_KEYS = ['force_pre_tool_speech', 'disable_interruptions'] as const

/** Throws when a tool config carries a deprecated key at any depth (a builder bug). */
export function assertNoDeprecatedToolKeys(config: unknown, path = 'tool'): void {
  if (!config || typeof config !== 'object') return
  for (const [k, v] of Object.entries(config as Record<string, unknown>)) {
    if ((DEPRECATED_TOOL_KEYS as readonly string[]).includes(k)) throw new Error(`${path}.${k} is deprecated in the ElevenLabs spec`)
    assertNoDeprecatedToolKeys(v, `${path}.${k}`)
  }
}
