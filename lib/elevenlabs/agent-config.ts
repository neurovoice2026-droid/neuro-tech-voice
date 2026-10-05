// Builds the COMPLETE ElevenLabs agent configuration from a provider-neutral
// AgentSpec. Create and update both send this full body: objects are
// deep-merged by the API and arrays (knowledge_base, tool_ids, criteria) are
// replaced, so sending everything we own every time is what keeps the remote
// agent identical to our database (the old code PATCHed fragments and could
// silently lose or never send fields).
//
// Field names and enums verified against the official OpenAPI spec (2026-10).
// Pure: no I/O, unit-tested.

import type { AgentSpec } from '@/lib/voice-providers/types'
import { PLATFORM_VARIABLES } from '@/lib/voice-providers/prompt'
import { agentLlm, ragEmbeddingModel, ttsModelFor } from './models'
import type { AgentBody } from './client'

export interface PlatformResources {
  /** Workspace webhook tool used for human transfer on app-routed calls. */
  transferToolId: string | null
  /** Workspace webhook that receives post-call events. */
  postCallWebhookId: string | null
}

const clamp = (v: number, min: number, max: number) => Math.min(max, Math.max(min, v))

export function agentTags(spec: Pick<AgentSpec, 'orgId' | 'localAgentId'>): string[] {
  const env = (process.env.VERCEL_ENV ?? process.env.NODE_ENV ?? 'development').slice(0, 20)
  return ['ntv', `ntv-org:${spec.orgId}`, `ntv-agent:${spec.localAgentId}`, `ntv-env:${env}`]
}

/** Dynamic variables every call receives; placeholders are the defaults for native calls. */
export function dynamicVariablePlaceholders(spec: AgentSpec): Record<string, string> {
  return {
    ...spec.dynamicVariables,
    [PLATFORM_VARIABLES.callId]: 'unknown',
    [PLATFORM_VARIABLES.callToken]: 'none',
    [PLATFORM_VARIABLES.afterHours]: 'false',
    [PLATFORM_VARIABLES.businessName]: spec.orgName ?? '',
  }
}

function builtInTools(spec: AgentSpec) {
  const c = spec.conversation
  const nativeTransfer = spec.transfer.enabled && !!spec.transfer.number && !spec.appRouted
  return {
    end_call: c.allow_end_call
      ? { type: 'system', name: 'end_call', description: '', params: { system_tool_type: 'end_call' } }
      : null,
    voicemail_detection: c.voicemail_detection
      ? {
          type: 'system',
          name: 'voicemail_detection',
          description: '',
          params: { system_tool_type: 'voicemail_detection', voicemail_message: c.voicemail_message?.trim() || null },
        }
      : null,
    // Native Twilio numbers only: ElevenLabs cannot transfer calls it does not
    // control (register-call); app-routed calls use the platform webhook tool.
    transfer_to_number: nativeTransfer
      ? {
          type: 'system',
          name: 'transfer_to_number',
          description: '',
          params: {
            system_tool_type: 'transfer_to_number',
            enable_client_message: true,
            transfers: [
              {
                transfer_destination: { type: 'phone', phone_number: spec.transfer.number },
                condition: spec.transfer.condition?.trim() || 'The caller asks to speak with a person.',
                transfer_type: 'conference',
              },
            ],
          },
        }
      : null,
    language_detection: null,
    transfer_to_agent: null,
    skip_turn: null,
    play_keypad_touch_tone: null,
  }
}

export function buildElevenLabsAgentBody(spec: AgentSpec, platform: PlatformResources): AgentBody {
  const c = spec.conversation
  const knowledge = spec.knowledge
    .filter((k) => !!k.elevenlabsId)
    .map((k) => ({ type: k.type, name: k.name.slice(0, 200), id: k.elevenlabsId as string, usage_mode: 'auto' }))
  const telephonyFormat = spec.appRouted ? 'ulaw_8000' : 'pcm_16000'
  const appTransfer = spec.appRouted && spec.transfer.enabled && !!spec.transfer.number && !!platform.transferToolId

  const prompt: Record<string, unknown> = {
    prompt: spec.systemPrompt,
    llm: agentLlm(),
    max_tokens: -1,
    knowledge_base: knowledge,
    rag: { enabled: knowledge.length > 0, embedding_model: ragEmbeddingModel(spec.language) },
    timezone: spec.timezone,
    built_in_tools: builtInTools(spec),
    tool_ids: appTransfer ? [platform.transferToolId] : [],
  }
  if (typeof c.temperature === 'number') prompt.temperature = clamp(c.temperature, 0, 1)

  const tts: Record<string, unknown> = {
    model_id: ttsModelFor(spec.language),
    agent_output_audio_format: telephonyFormat,
    expressive_mode: false, // flash models: expressive tags are not supported
  }
  if (spec.voiceId) tts.voice_id = spec.voiceId
  if (spec.voiceTuning.stability !== null) tts.stability = clamp(spec.voiceTuning.stability, 0, 1)
  if (spec.voiceTuning.similarity_boost !== null) tts.similarity_boost = clamp(spec.voiceTuning.similarity_boost, 0, 1)
  if (spec.voiceTuning.speed !== null) tts.speed = clamp(spec.voiceTuning.speed, 0.7, 1.2)

  const conversation_config = {
    agent: {
      first_message: spec.firstMessage,
      language: spec.language,
      disable_first_message_interruptions: false,
      dynamic_variables: { dynamic_variable_placeholders: dynamicVariablePlaceholders(spec) },
      prompt,
    },
    asr: {
      quality: 'high',
      user_input_audio_format: telephonyFormat,
      keywords: spec.orgName ? [spec.orgName.slice(0, 50)] : [],
    },
    turn: {
      mode: 'turn',
      turn_timeout: clamp(c.turn_timeout_seconds, 1, 30),
      silence_end_call_timeout: c.silence_end_call_seconds === null ? -1 : clamp(c.silence_end_call_seconds, 5, 600),
      turn_eagerness: c.turn_eagerness,
    },
    tts,
    conversation: {
      max_duration_seconds: clamp(Math.round(c.max_call_duration_minutes * 60), 60, 7200),
      client_events: c.allow_interruptions ? ['audio', 'interruption'] : ['audio'],
    },
  }

  const criteria = spec.analysis.success_criteria.slice(0, 30).map((cr) => ({
    id: cr.id,
    name: cr.name.slice(0, 100),
    type: 'prompt',
    conversation_goal_prompt: cr.prompt.slice(0, 2000),
  }))
  const dataCollection: Record<string, { type: string; description: string }> = {}
  for (const f of spec.analysis.data_collection.slice(0, 25)) {
    dataCollection[f.id] = { type: f.type, description: f.description.slice(0, 1000) }
  }

  const platform_settings: Record<string, unknown> = {
    evaluation: { criteria },
    data_collection: dataCollection,
    summary_language: spec.language,
    privacy: {
      record_voice: spec.privacy.record_audio,
      retention_days: spec.privacy.retention_days,
      delete_transcript_and_pii: false,
      delete_audio: false,
      apply_to_existing_conversations: false,
      zero_retention_mode: false,
    },
    overrides: {
      // Outbound calls get their own opening line; nothing else is overridable.
      conversation_config_override: { agent: { first_message: true } },
    },
    // Every legitimate session starts server-side (register-call, outbound
    // call, native telephony): nobody may open an anonymous web session on a
    // tenant's agent (it could inject dynamic variables and burn minutes).
    // Opt out with ELEVENLABS_AGENT_AUTH=false only if a live test shows a
    // telephony path that needs it.
    auth: { enable_auth: process.env.ELEVENLABS_AGENT_AUTH !== 'false' },
  }
  if (platform.postCallWebhookId) {
    platform_settings.workspace_overrides = {
      webhooks: {
        post_call_webhook_id: platform.postCallWebhookId,
        // Audio is fetched on demand (bounded, authenticated proxy) instead of
        // receiving multi-MB base64 bodies that exceed serverless body limits.
        events: ['transcript', 'call_initiation_failure'],
        transcript_format: 'json',
      },
    }
  }
  if (process.env.ELEVENLABS_ENABLE_GUARDRAILS === 'true') {
    platform_settings.guardrails = { version: '1', prompt_injection: { is_enabled: true } }
  }

  return {
    name: spec.name.slice(0, 100),
    tags: agentTags(spec),
    conversation_config,
    platform_settings,
  }
}

/** Webhook tool that lets an app-routed agent hand the caller to a human. */
export function transferToolConfig(url: string): Record<string, unknown> {
  return {
    type: 'webhook',
    name: 'transfer_to_human',
    description:
      'Transfer the live phone call to a human member of the team. Use it only when the caller asks for a person or the business rules require it, and only after telling the caller you are transferring them.',
    response_timeout_secs: 10,
    api_schema: {
      url,
      method: 'POST',
      content_type: 'application/json',
      request_body_schema: {
        type: 'object',
        required: ['call_token', 'reason'],
        properties: {
          call_token: { type: 'string', dynamic_variable: PLATFORM_VARIABLES.callToken },
          reason: { type: 'string', description: 'One short sentence: why the caller is being transferred.' },
        },
      },
    },
  }
}

/** Stable fingerprint of what we push, to skip no-op updates and detect drift. */
export async function configHash(body: AgentBody): Promise<string> {
  const data = new TextEncoder().encode(JSON.stringify(body))
  const digest = await crypto.subtle.digest('SHA-256', data)
  return Buffer.from(digest).toString('hex').slice(0, 32)
}
