import { agents as elAgents } from './client'

export interface AgentInput {
  name: string
  system_prompt?: string | null
  first_message?: string | null
  language?: string | null
  voice_id?: string | null
}

// Multilingual TTS model. ElevenLabs requires turbo/flash v2_5 for non-English
// agents, and it works for English too — so we always use it.
const TTS_MODEL = 'eleven_turbo_v2_5'

function msg(e: unknown): string {
  return e instanceof Error ? e.message : String(e)
}

/**
 * Creates an ElevenLabs conversational agent with the multilingual TTS model.
 * If creating with the chosen voice fails, retries without the voice so the
 * agent is still created and can take calls.
 */
export async function createAgentWithFallback(
  params: AgentInput
): Promise<{ agent_id: string | null; voiceError?: string; error?: string }> {
  const base = {
    agent: {
      prompt: { prompt: params.system_prompt ?? 'You are a helpful assistant.' },
      first_message: params.first_message ?? 'Hello! How can I help you today?',
      language: params.language ?? 'en',
    },
  }

  try {
    const created = await elAgents.create({
      name: params.name,
      conversation_config: {
        ...base,
        tts: { model_id: TTS_MODEL, ...(params.voice_id ? { voice_id: params.voice_id } : {}) },
      },
    })
    return { agent_id: created.agent_id ?? null }
  } catch (e1) {
    try {
      const created = await elAgents.create({
        name: params.name,
        conversation_config: { ...base, tts: { model_id: TTS_MODEL } },
      })
      return { agent_id: created.agent_id ?? null, voiceError: msg(e1) }
    } catch (e2) {
      console.error('ElevenLabs agent creation failed (with and without voice):', e2)
      return { agent_id: null, error: msg(e2) }
    }
  }
}
