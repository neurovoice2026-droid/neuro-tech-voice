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
import { buildKnowledgePromptConfig } from './rag-config'
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
import {
  callLimitsConfig,
  guardrailsConfig,
  llmCascadeConfig,
  piiRedactionConfig,
  queueingConfig,
  trustContext,
} from './platform-settings'
import { pausedAgentBody } from './paused-agent'
import { SYSTEM_TRANSFER_BEHAVIOUR } from './tools/behaviour'
import { OFFERED_SLOTS_VARIABLE } from './tools/business'
import { initiationWebhookBlock } from './api/telephony'

/**
 * Version of the platform-owned agent configuration. Part of the config hash:
 * bumping it marks every agent as drifted, and the maintenance step
 * `config_rollout` then re-syncs them in batches (lib/voice-providers/config-rollout.ts).
 * Bump it whenever this builder changes what existing agents should receive.
 */
export const PLATFORM_AGENT_CONFIG_VERSION = 5

export interface PlatformResources {
  /** Workspace webhook tool used for human transfer on app-routed calls. */
  transferToolId: string | null
  /** Workspace webhook that receives post-call events. */
  postCallWebhookId: string | null
  /** In-call business tools to attach (slice B2: check_availability, book_appointment, take_message). */
  businessToolIds?: string[]
  /** check_availability/book_appointment are attached: the offered-slots list variable needs a placeholder. */
  bookingToolsAttached?: boolean
  /**
   * Conversation initiation webhook for native inbound calls: our HTTPS URL and
   * the workspace secret sent in its header (lib/telephony/initiation-config.ts).
   * null/absent = not configured (native calls keep the placeholders).
   */
  initiationWebhook?: { url: string; secretId: string } | null
}

/** Values read from provider catalogues at sync time (kept out of AgentSpec, which is provider-neutral). */
export interface AgentRuntimeOptions {
  /** prompt.reasoning_effort for the configured LLM; null/undefined = not sent (model without configurable reasoning). */
  reasoningEffort?: string | null
  /** prompt.llm validated against GET /v1/convai/llm/list (lib/elevenlabs/llm-selection.ts); default agentLlm(). */
  llm?: string | null
}

const clamp = (v: number, min: number, max: number) => Math.min(max, Math.max(min, v))

export function agentTags(spec: Pick<AgentSpec, 'orgId' | 'localAgentId'>): string[] {
  const env = (process.env.VERCEL_ENV ?? process.env.NODE_ENV ?? 'development').slice(0, 20)
  return ['ntv', `ntv-org:${spec.orgId}`, `ntv-agent:${spec.localAgentId}`, `ntv-env:${env}`]
}

/**
 * Every platform variable with a typed, null-safe default. Real values arrive
 * per call in conversation_initiation_client_data (register-call for
 * app-routed calls, outbound-call for native outbound calls); native INBOUND
 * calls get only these placeholders. Platform keys always win over a tenant
 * variable of the same name (the settings schema reserves them as well).
 */
export function dynamicVariablePlaceholders(spec: AgentSpec): Record<string, string> {
  return {
    ...spec.dynamicVariables,
    [PLATFORM_VARIABLES.callId]: 'unknown',
    [PLATFORM_VARIABLES.callToken]: 'none',
    [PLATFORM_VARIABLES.secretCallToken]: 'none',
    // Native calls cannot know: with opening hours in the prompt the model
    // decides from them ("unknown"); without a schedule the business is open.
    [PLATFORM_VARIABLES.afterHours]: spec.openingHours ? 'unknown' : 'false',
    [PLATFORM_VARIABLES.businessName]: spec.orgName ?? '',
    // Voicemail gating (slice A1): 'outbound' only when client data says so.
    [PLATFORM_VARIABLES.callDirection]: 'inbound',
    // Transfer tool choice in mixed-mode orgs: register-call passes 'app_routed'.
    [PLATFORM_VARIABLES.routingMode]: 'native',
  }
}

/** version_description of every PATCH: config revision and platform version only (no tenant data). */
export function versionDescription(spec: Pick<AgentSpec, 'revision'>): string {
  return `ntv r${spec.revision} p${PLATFORM_AGENT_CONFIG_VERSION}`
}

/** One-shot privacy push: the stricter retention/recording also applies to stored conversations. */
export function withRetroactivePrivacy(body: AgentBody): AgentBody {
  const out = structuredClone(body)
  const privacy = (out.platform_settings.privacy ?? {}) as Record<string, unknown>
  out.platform_settings.privacy = { ...privacy, apply_to_existing_conversations: true }
  return out
}

/** The body without transcript redaction (workspace plans that reject the enterprise-only feature). */
export function withoutPiiRedaction(body: AgentBody): AgentBody {
  const out = structuredClone(body)
  const privacy = { ...((out.platform_settings.privacy ?? {}) as Record<string, unknown>) }
  delete privacy.conversation_history_redaction
  out.platform_settings.privacy = privacy
  return out
}

/** Native transfer tool description when the platform webhook tool is attached too (mixed routing). */
const MIXED_NATIVE_TRANSFER_DESCRIPTION =
  'Transfer the live call to the business\'s human contact. Use it only when the ntv_routing_mode variable is "native" (a number connected directly to the voice platform); when it is "app_routed", use the transfer_to_human tool instead.'

function builtInTools(spec: AgentSpec, hasLanguagePresets: boolean) {
  const c = spec.conversation
  // Native numbers (ElevenLabs controls the call): the native tool. Orgs with
  // both kinds of numbers get it next to the platform webhook tool, and the
  // prompt routes on {{ntv_routing_mode}}.
  const nativeTransfer = spec.transfer.enabled && !!spec.transfer.number && spec.hasNativeNumbers
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
          description: spec.appRouted ? MIXED_NATIVE_TRANSFER_DESCRIPTION : '',
          // The agent always announces the transfer and is not cut off (lib/elevenlabs/tools/behaviour.ts).
          ...SYSTEM_TRANSFER_BEHAVIOUR,
          params: {
            system_tool_type: 'transfer_to_number',
            enable_client_message: true,
            transfers: [
              {
                transfer_destination: { type: 'phone', phone_number: spec.transfer.number },
                condition: spec.transfer.condition?.trim() || 'The caller asks to speak with a person.',
                // conference (warm message to the human) or blind (keeps the caller's number); sip_refer is SIP-trunk only.
                transfer_type: spec.transfer.transfer_type === 'blind' ? 'blind' : 'conference',
                // Extension behind a PBX, dialed after the destination answers (Twilio transfers only).
                ...(spec.transfer.extension ? { post_dial_digits: { type: 'static', value: spec.transfer.extension } } : {}),
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
  const knowledge = buildKnowledgePromptConfig(spec.knowledge, ragEmbeddingModel(spec.language, additionalLanguagesOf(spec)))
  const telephonyFormat = spec.appRouted ? 'ulaw_8000' : 'pcm_16000'
  const appTransfer = spec.appRouted && spec.transfer.enabled && !!spec.transfer.number && !!platform.transferToolId
  // Only native numbers call the initiation webhook (it fires for inbound native Twilio calls).
  const initiation = spec.hasNativeNumbers ? (platform.initiationWebhook ?? null) : null

  const prompt: Record<string, unknown> = {
    prompt: spec.systemPrompt,
    llm: runtime.llm || agentLlm(),
    // Backup LLM cascade (provider default order) and its timeout, owned explicitly.
    ...llmCascadeConfig(),
    max_tokens: -1,
    knowledge_base: knowledge.knowledge_base,
    rag: knowledge.rag,
    timezone: spec.timezone,
    built_in_tools: builtInTools(spec, hasPresets),
    tool_ids: [...(appTransfer ? [platform.transferToolId] : []), ...(platform.businessToolIds ?? [])],
    // Never omitted: a custom value pushed earlier must not survive "Off".
    // The spec default is 0 (null would drop temperature from the LLM request).
    temperature: typeof c.temperature === 'number' ? clamp(c.temperature, 0, 1) : 0,
    // The composed prompt defines the persona; no default personality lines.
    ignore_default_personality: true,
    enable_reasoning_summary: false,
  }
  if (runtime.reasoningEffort) prompt.reasoning_effort = runtime.reasoningEffort

  const tts = ttsConfig(spec, telephonyFormat)
  // Voices (slice F): a new agent without a chosen voice gets the curated
  // voice of its language, never the API default (a retiring premade voice).
  if (!tts.voice_id && spec.defaultVoiceId) tts.voice_id = spec.defaultVoiceId
  // Always sent (arrays are replaced): [] removes a dictionary cleanly.
  tts.pronunciation_dictionary_locators = spec.pronunciationLocator
    ? [{ pronunciation_dictionary_id: spec.pronunciationLocator.dictionaryId, version_id: spec.pronunciationLocator.versionId }]
    : []

  const conversation_config = {
    agent: {
      first_message: spec.firstMessage,
      language: spec.language,
      // The first message carries the mandatory AI disclosure (and the
      // recording notice): a caller's "Alo?" must not cut it off.
      disable_first_message_interruptions: true,
      max_conversation_duration_message: maxDurationMessage(spec.language),
      dynamic_variables: {
        dynamic_variable_placeholders: {
          ...dynamicVariablePlaceholders(spec),
          // book_appointment's allowed values: empty (nothing bookable) until check_availability offers slots.
          ...(platform.bookingToolsAttached ? { [OFFERED_SLOTS_VARIABLE]: [] as string[] } : {}),
        },
      },
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
      // Steady state (and config hash): false. A sync after the tenant made
      // retention or recording stricter sends true once (withRetroactivePrivacy).
      apply_to_existing_conversations: false,
      zero_retention_mode: false,
      // Payment card numbers redacted from stored transcripts/audio/analysis.
      conversation_history_redaction: piiRedactionConfig(),
    },
    // Plan-based per-agent caps (shared workspace: no noisy neighbour) and the
    // wait queue, both owned explicitly so the vendor defaults never apply.
    call_limits: callLimitsConfig(spec),
    queueing_config: queueingConfig(spec),
    // Always complete, so turning a guardrail off reaches every agent.
    guardrails: guardrailsConfig(),
    trust_context: trustContext(),
    overrides: {
      conversation_config_override: {
        // Outbound calls get their own opening line (and paused or over-quota
        // native calls the "unavailable" line, from the initiation webhook).
        agent: { first_message: true },
        // Per-call cap set server-side: the plan minutes left on a trial, or a
        // short "unavailable" call. Never prompt, LLM, tools or voice.
        // text_only: the owner's "Chat with your agent" browser test (slice G);
        // sessions need a token minted for the org's own agent (auth below).
        conversation: { max_duration_seconds: true, text_only: true },
      },
      // Native inbound calls fetch their per-call variables from our webhook.
      enable_conversation_initiation_client_data_from_webhook: !!initiation,
    },
    // Every legitimate session starts server-side (register-call, outbound
    // call, native telephony): nobody may open an anonymous web session on a
    // tenant's agent (it could inject dynamic variables and burn minutes).
    // Opt out with ELEVENLABS_AGENT_AUTH=false only if a live test shows a
    // telephony path that needs it.
    auth: { enable_auth: process.env.ELEVENLABS_AGENT_AUTH !== 'false' },
  }
  const workspaceOverrides: Record<string, unknown> = {}
  if (platform.postCallWebhookId) {
    workspaceOverrides.webhooks = {
      post_call_webhook_id: platform.postCallWebhookId,
      // Audio is fetched on demand (bounded, authenticated proxy) instead of
      // receiving multi-MB base64 bodies that exceed serverless body limits.
      events: ['transcript', 'call_initiation_failure'],
      transcript_format: 'json',
    }
  }
  // Agents with native numbers: our webhook, or null to clear one pushed
  // earlier (objects are deep-merged). Elsewhere the key is left out: the
  // enable flag above (false) already stops ElevenLabs from calling it.
  if (spec.hasNativeNumbers) {
    workspaceOverrides.conversation_initiation_client_data_webhook = initiation ? initiationWebhookBlock(initiation.url, initiation.secretId) : null
  }
  if (Object.keys(workspaceOverrides).length) platform_settings.workspace_overrides = workspaceOverrides

  const body: AgentBody = {
    name: spec.name.slice(0, 100),
    tags: agentTags(spec),
    conversation_config,
    platform_settings,
  }
  // Paused agent: native numbers still reach it, so it only says "unavailable".
  return spec.active ? body : pausedAgentBody(body, spec)
}

/**
 * Stable fingerprint of what we push, to skip no-op updates and detect drift.
 * Includes PLATFORM_AGENT_CONFIG_VERSION, so bumping it marks every agent as
 * drifted (config rollout). One-shot additions (retroactive privacy) and the
 * version_description are never part of it.
 */
export async function configHash(body: AgentBody): Promise<string> {
  const { version_description: _ignored, ...stable } = body
  void _ignored
  const data = new TextEncoder().encode(JSON.stringify({ platform: PLATFORM_AGENT_CONFIG_VERSION, body: stable }))
  const digest = await crypto.subtle.digest('SHA-256', data)
  return Buffer.from(digest).toString('hex').slice(0, 32)
}
