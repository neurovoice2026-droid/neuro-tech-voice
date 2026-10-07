// The "paused" variant of a tenant's ElevenLabs agent (agents.is_active =
// false). App-routed calls never reach a paused agent (the router answers
// them with the localized "unavailable" message), but calls to numbers
// imported natively into ElevenLabs bypass our router. While paused, the agent
// is therefore synced as this variant: it says the same "unavailable" line,
// holds no conversation and ends the call. Resuming syncs the normal body
// again (the variant is derived from the spec, so the config hash differs and
// the next sync restores everything).
//
// Only spec-defined fields are overridden: agent.first_message,
// agent.prompt.{prompt, built_in_tools, tool_ids}, language_presets,
// turn.{turn_timeout, silence_end_call_timeout} and
// conversation.max_duration_seconds. Platform settings (privacy, limits,
// guardrails, webhooks, analysis) are unchanged. Pure.

import type { AgentSpec } from '@/lib/voice-providers/types'
import { UNAVAILABLE_MESSAGE, localized } from '@/lib/voice/greetings'
import { AGENT_LANGUAGES } from '@/lib/agent-languages'
import type { AgentBody } from './client'

const LANGUAGE_NAMES: Record<string, string> = Object.fromEntries(AGENT_LANGUAGES.map((l) => [l.value, l.label]))

/** Seconds a paused call may last at most (the line takes a few seconds). */
export const PAUSED_MAX_DURATION_SECONDS = 60

export function pausedPrompt(spec: Pick<AgentSpec, 'orgName' | 'language'>): string {
  const business = spec.orgName?.trim() ? ` for ${spec.orgName.trim().slice(0, 100)}` : ''
  const language = LANGUAGE_NAMES[spec.language] ?? spec.language
  return [
    `You answer the phone line${business}, but the business has paused its AI assistant, so this call cannot be handled now.`,
    'You have already told the caller that the call cannot be taken right now and to try again later.',
    `Do not answer questions, do not take messages, do not transfer the call and do not start a conversation. If the caller says anything, reply with one short polite goodbye in ${language} and immediately use the end_call tool. If nobody speaks, use the end_call tool.`,
    'If asked, say truthfully that you are an AI assistant.',
  ].join('\n\n')
}

/** Returns a copy of `body` turned into the paused variant (the input is not modified). */
export function pausedAgentBody(body: AgentBody, spec: Pick<AgentSpec, 'orgName' | 'language'>): AgentBody {
  const out = structuredClone(body)
  const cc = out.conversation_config as Record<string, Record<string, unknown>>
  const agent = cc.agent
  const prompt = agent.prompt as Record<string, unknown>
  agent.first_message = localized(UNAVAILABLE_MESSAGE, spec.language)
  prompt.prompt = pausedPrompt(spec)
  // Only end_call: no transfer, no voicemail handling, no language switching.
  prompt.built_in_tools = {
    end_call: { type: 'system', name: 'end_call', description: '', params: { system_tool_type: 'end_call' } },
    voicemail_detection: null,
    transfer_to_number: null,
    language_detection: null,
    transfer_to_agent: null,
    skip_turn: null,
    play_keypad_touch_tone: null,
  }
  prompt.tool_ids = []
  cc.language_presets = {}
  cc.turn = { ...cc.turn, turn_timeout: 3, silence_end_call_timeout: 10 }
  cc.conversation = { ...cc.conversation, max_duration_seconds: PAUSED_MAX_DURATION_SECONDS }
  return out
}
