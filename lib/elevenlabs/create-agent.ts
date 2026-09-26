import 'server-only'
import type { Agent } from '@/types'
import { agents as elAgents, TTS_MODEL, type CreateAgentParams, type ElevenLabsOverrideSettings } from './client'
import { fallbackElevenLabsVoiceId } from '@/lib/voice/voice-map'
import { composeProviderAgentText, escapeDynamicVariables, providerAgentName } from '@/lib/voice/sync/compose'
import type { AgentSyncContext, SyncOrg } from '@/lib/voice/sync/context'

// The ElevenLabs standby agent: a warm fallback the router reaches through
// register-call and the gateway through the agent WebSocket. Twilio carries
// μ-law 8 kHz, so both directions are ulaw_8000 (register-call requires it).
// Prompt, greeting, language and voice are also sent as per-call overrides, so
// a stale sync never serves an old configuration; the overrides must be
// enabled on the agent for that to be allowed.

export { TTS_MODEL }

/** GPT-5-tier quality at "mini" latency, valid in the ElevenLabs LLM enum. */
export const LLM_MODEL = 'gpt-5.4-mini'

export const TELEPHONY_AUDIO_FORMAT = 'ulaw_8000'

export const STANDBY_OVERRIDES: ElevenLabsOverrideSettings = {
  conversation_config_override: {
    agent: { prompt: { prompt: true }, first_message: true, language: true },
    tts: { voice_id: true },
  },
}

/**
 * ElevenLabs reads `{{name}}` as a dynamic variable. Customer text can contain
 * braces ("{{first_name}}" pasted from a CRM template), so they are broken up
 * before being sent as agent config or as an override.
 */
export const escapeElevenLabsVariables = escapeDynamicVariables

export interface StandbyAgentInput {
  agent: Agent
  org: SyncOrg
  ctx: AgentSyncContext
  /** Gender of the agent's Cartesia voice when known, to pick a matching fallback voice. */
  voiceGender?: 'masculine' | 'feminine' | 'gender_neutral' | null
}

export function standbyVoiceId(
  agent: Pick<Agent, 'voice_id' | 'cartesia_voice_id'>,
  voiceGender?: StandbyAgentInput['voiceGender'],
  twinVoiceId?: string | null
): string {
  return fallbackElevenLabsVoiceId({
    twinVoiceId,
    cartesiaVoiceId: agent.cartesia_voice_id,
    legacyVoiceId: agent.voice_id,
    gender: voiceGender,
  })
}

/**
 * Full create body. The same object is used for PATCH, which keeps the
 * standby in lockstep with the database. The prompt has no tool rules: the
 * ElevenLabs agent can't call our tools (same as the session's override).
 */
export function buildElevenLabsStandbyConfig(input: StandbyAgentInput): CreateAgentParams {
  const { agent, org, ctx } = input
  const text = composeProviderAgentText(agent, org, ctx, [])
  return {
    name: providerAgentName(org.name, agent.name),
    conversation_config: {
      asr: { user_input_audio_format: TELEPHONY_AUDIO_FORMAT },
      tts: {
        model_id: TTS_MODEL,
        agent_output_audio_format: TELEPHONY_AUDIO_FORMAT,
        voice_id: standbyVoiceId(agent, input.voiceGender, ctx.elevenLabsTwinVoiceId),
      },
      agent: {
        prompt: { prompt: escapeElevenLabsVariables(text.instructions), llm: LLM_MODEL },
        first_message: escapeElevenLabsVariables(text.initialMessage),
        language: text.language,
      },
    },
    // ElevenLabs keeps conversation audio unless told not to; follow the owner's
    // recording switch and plan, as the gateway and Twilio recordings do.
    platform_settings: { overrides: STANDBY_OVERRIDES, privacy: { record_voice: text.recorded } },
  }
}

export async function createStandbyAgent(config: CreateAgentParams): Promise<string> {
  const created = await elAgents.create(config)
  if (!created?.agent_id) throw new Error('ElevenLabs create agent returned no agent_id')
  return created.agent_id
}

export async function updateStandbyAgent(agentId: string, config: CreateAgentParams): Promise<void> {
  await elAgents.update(agentId, {
    name: config.name,
    conversation_config: config.conversation_config,
    platform_settings: config.platform_settings,
  })
}
