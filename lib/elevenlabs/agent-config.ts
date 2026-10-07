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
import { maxDurationMessage } from '@/lib/voice/conversation-phrases'
import { agentLlm, ragEmbeddingModel } from './models'
import {
  DTMF_INPUT_SETTINGS,
  VOICEMAIL_TOOL_DESCRIPTION,
  additionalLanguagesOf,
  asrConfig,
  dataCollectionProperty,
  languageDetectionTool,
  languagePresets,
  skipTurnTool,
  ttsConfig,
  turnBehaviour,
  vadConfig,
} from './conversation-behaviour'
import type { AgentBody } from './client'

export interface PlatformResources {
  /** Workspace webhook tool used for human transfer on app-routed calls. */
  transferToolId: string | null
  /** Workspace webhook that receives post-call events. */
  postCallWebhookId: string | null
}

/** Values read from provider catalogues at sync time (kept out of AgentSpec, which is provider-neutral). */
export interface AgentRuntimeOptions {
  /** prompt.reasoning_effort for the configured LLM; null/undefined = not sent (model without configurable reasoning). */
  reasoningEffort?: string | null
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

function builtInTools(spec: AgentSpec, hasLanguagePresets: boolean) {
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
          // Outbound calls only (prompt rule on {{ntv_call_direction}}): an
          // inbound caller must never be hung up on as a "voicemail".
          description: VOICEMAIL_TOOL_DESCRIPTION,
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
    language_detection: hasLanguagePresets ? languageDetectionTool() : null,
    transfer_to_agent: null,
    skip_turn: c.skip_turn ? skipTurnTool() : null,
    play_keypad_touch_tone: null,
  }
}

export function buildElevenLabsAgentBody(spec: AgentSpec, platform: PlatformResources, runtime: AgentRuntimeOptions = {}): AgentBody {
  const c = spec.conversation
  const presets = languagePresets(spec)
  const hasPresets = Object.keys(presets).length > 0
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
    rag: { enabled: knowledge.length > 0, embedding_model: ragEmbeddingModel(spec.language, additionalLanguagesOf(spec)) },
    timezone: spec.timezone,
    built_in_tools: builtInTools(spec, hasPresets),
    tool_ids: appTransfer ? [platform.transferToolId] : [],
    // Never omitted: a custom value pushed earlier must not survive "Off".
    // The spec default is 0 (null would drop temperature from the LLM request).
    temperature: typeof c.temperature === 'number' ? clamp(c.temperature, 0, 1) : 0,
    // The composed prompt defines the persona; no default personality lines.
    ignore_default_personality: true,
    enable_reasoning_summary: false,
  }
  if (runtime.reasoningEffort) prompt.reasoning_effort = runtime.reasoningEffort

  const tts = ttsConfig(spec, telephonyFormat)

  const conversation_config = {
    agent: {
      first_message: spec.firstMessage,
      language: spec.language,
      // The first message carries the mandatory AI disclosure (and the
      // recording notice): a caller's "Alo?" must not cut it off.
      disable_first_message_interruptions: true,
      max_conversation_duration_message: maxDurationMessage(spec.language),
      // ntv_call_direction (A1, voicemail gating): 'inbound' unless the call
      // was started with client data (router / outbound) saying otherwise.
      dynamic_variables: { dynamic_variable_placeholders: { [PLATFORM_VARIABLES.callDirection]: 'inbound', ...dynamicVariablePlaceholders(spec) } },
      prompt,
    },
    asr: asrConfig(spec, telephonyFormat),
    turn: {
      mode: 'turn',
      turn_timeout: clamp(c.turn_timeout_seconds, 1, 30),
      silence_end_call_timeout: c.silence_end_call_seconds === null ? -1 : clamp(c.silence_end_call_seconds, 5, 600),
      turn_eagerness: c.turn_eagerness,
      ...turnBehaviour(spec),
    },
    tts,
    vad: vadConfig(spec),
    conversation: {
      max_duration_seconds: clamp(Math.round(c.max_call_duration_minutes * 60), 60, 7200),
      client_events: c.allow_interruptions ? ['audio', 'interruption'] : ['audio'],
      dtmf_input_settings: { ...DTMF_INPUT_SETTINGS },
    },
    // Always sent (possibly empty). Removing a key relies on the PATCH merge
    // semantics (unverified, see docs/elevenlabs/A1.md).
    language_presets: presets,
  }

  const criteria = spec.analysis.success_criteria.slice(0, 30).map((cr) => ({
    id: cr.id,
    name: cr.name.slice(0, 100),
    type: 'prompt',
    conversation_goal_prompt: cr.prompt.slice(0, 2000),
  }))
  const dataCollection: Record<string, ReturnType<typeof dataCollectionProperty>> = {}
  for (const f of spec.analysis.data_collection.slice(0, 25)) {
    dataCollection[f.id] = dataCollectionProperty(f)
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
