import { agents as elAgents, TTS_MODEL } from './client'
import { composeSystemPrompt } from './prompt'

export interface AgentInput {
  name: string
  system_prompt?: string | null
  first_message?: string | null
  language?: string | null
  voice_id?: string | null
  fallback_message?: string | null
}

// Re-exported so the PATCH sync path (app/api/agent/route.ts) and other
// existing importers keep working - TTS_MODEL's canonical definition now
// lives in ./client since textToSpeech() (the voice-preview endpoint) needs
// it too and client.ts must not import from this higher-level module.
export { TTS_MODEL }

// gpt-5.4-mini: GPT-5-tier quality at "mini" latency/cost, the right balance
// for a real-time phone conversation (a receptionist-style agent needs to
// respond fast far more than it needs maximum reasoning depth).
export const LLM_MODEL = 'gpt-5.4-mini'

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
      prompt: {
        prompt: composeSystemPrompt({
          system_prompt: params.system_prompt,
          language: params.language,
          fallback_message: params.fallback_message,
        }),
        llm: LLM_MODEL,
      },
      first_message: params.first_message ?? 'Hello! How can I help you today?',
      language: params.language ?? 'en',
    },
  }

  try {
    const created = await elAgents.create({
      name: params.name,
      conversation_config: {
        ...base,
        tts: {
          model_id: TTS_MODEL,
          expressive_mode: true,
          ...(params.voice_id ? { voice_id: params.voice_id } : {}),
        },
      },
    })
    return { agent_id: created.agent_id ?? null }
  } catch (e1) {
    try {
      const created = await elAgents.create({
        name: params.name,
        conversation_config: { ...base, tts: { model_id: TTS_MODEL, expressive_mode: true } },
      })
      return { agent_id: created.agent_id ?? null, voiceError: msg(e1) }
    } catch (e2) {
      console.error('ElevenLabs agent creation failed (with and without voice):', e2)
      return { agent_id: null, error: msg(e2) }
    }
  }
}
