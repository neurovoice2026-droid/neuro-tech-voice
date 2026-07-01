import { agents as elAgents } from './client'

export interface AgentInput {
  name: string
  system_prompt?: string | null
  first_message?: string | null
  language?: string | null
  voice_id?: string | null
}

/**
 * Creates an ElevenLabs conversational agent. If creating with the chosen voice
 * fails (the usual cause of a silent failure — e.g. a library voice not usable
 * for the account), it retries with the default voice so the agent still gets
 * created and can take calls. Returns the agent id (or null) + any voice error.
 */
export async function createAgentWithFallback(
  params: AgentInput
): Promise<{ agent_id: string | null; voiceError?: string }> {
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
        ...(params.voice_id ? { tts: { voice_id: params.voice_id } } : {}),
      },
    })
    return { agent_id: created.agent_id ?? null }
  } catch (e1) {
    try {
      const created = await elAgents.create({ name: params.name, conversation_config: base })
      return { agent_id: created.agent_id ?? null, voiceError: e1 instanceof Error ? e1.message : String(e1) }
    } catch (e2) {
      console.error('ElevenLabs agent creation failed (with and without voice):', e2)
      return { agent_id: null }
    }
  }
}
