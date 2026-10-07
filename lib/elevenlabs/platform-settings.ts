// Platform-owned parts of the ElevenLabs agent body that no tenant can edit:
// call limits, wait queue, guardrails, transcript redaction, trust context
// and the backup-LLM cascade. Every block is ALWAYS sent with explicit values
// (never omitted), so switching something off reaches agents created earlier
// whatever the PATCH merge semantics are.
//
// Field names, enums and limits verified against the official OpenAPI spec
// (2026-10): AgentCallLimits, AgentQueueingConfig, GuardrailsV1-Input,
// ConversationHistoryRedactionConfig, AgentTrustContext, BackupLLMDefault /
// BackupLLMDisabled, PromptAgentAPIModel.cascade_timeout_seconds.
// Pure (env in, JSON out): no I/O, unit-tested.

import type { AgentSpec } from '@/lib/voice-providers/types'

type Env = Record<string, string | undefined>

function flag(raw: string | undefined, fallback: boolean): boolean {
  const v = (raw ?? '').trim().toLowerCase()
  if (v === 'true' || v === '1' || v === 'on') return true
  if (v === 'false' || v === '0' || v === 'off') return false
  return fallback
}

// ─── Call limits and wait queue ──────────────────────────────────────────────

/**
 * platform_settings.call_limits. agent_concurrency_limit and daily_limit come
 * from the org plan (AgentSpec.callLimits, lib/voice-providers/call-limits.ts);
 * bursting_enabled is a platform decision (ELEVENLABS_BURSTING, default true:
 * calls above the workspace concurrency are still answered, at double price).
 */
export function callLimitsConfig(spec: Pick<AgentSpec, 'callLimits'>) {
  return {
    agent_concurrency_limit: spec.callLimits.concurrency,
    daily_limit: spec.callLimits.daily,
    bursting_enabled: spec.callLimits.bursting,
  }
}

/** Seconds a native-number caller may wait for a free slot (spec: 0 < x ≤ 1800). */
export const NATIVE_QUEUE_WAIT_SECONDS = 30

/**
 * platform_settings.queueing_config. Owned explicitly ("New agents are
 * created with queueing enabled unless this field is set explicitly"):
 * - any app-routed number: off, so a capacity rejection fails fast and our
 *   router answers that call with the Cartesia fallback instead of holding
 *   the caller on a tone for minutes;
 * - native numbers only (no failover exists): a short queue.
 */
export function queueingConfig(spec: Pick<AgentSpec, 'appRouted'>) {
  return spec.appRouted ? { enabled: false } : { enabled: true, wait_timeout_seconds: NATIVE_QUEUE_WAIT_SECONDS }
}

// ─── Guardrails ──────────────────────────────────────────────────────────────

/** ContentConfig categories of the spec. */
export const CONTENT_GUARDRAIL_CATEGORIES = [
  'sexual',
  'violence',
  'harassment',
  'self_harm',
  'profanity',
  'religion_or_politics',
  'medical_and_legal_information',
] as const
export type ContentGuardrailCategory = (typeof CONTENT_GUARDRAIL_CATEGORIES)[number]

const DEFAULT_CONTENT_THRESHOLD = 0.3

/** Spoken by the agent after a content guardrail blocked a reply (any agent language). */
const CONTENT_RETRY_FEEDBACK =
  "Your previous reply was blocked by a content guardrail ({{trigger_reason}}). In your next turn, briefly apologise in the language of the conversation, say you cannot help with that topic on this call, and ask whether the caller needs anything else."

export interface GuardrailSettings {
  focus: boolean
  promptInjection: boolean
  content: ContentGuardrailCategory[]
  contentThreshold: number
}

/**
 * Guardrail choices from env. Focus and prompt-injection ("Manipulation") are
 * GA and free, so they are on by default; content categories are opt-in
 * (ELEVENLABS_CONTENT_GUARDRAILS="sexual,violence,…"). The legacy switch
 * ELEVENLABS_ENABLE_GUARDRAILS=false turns every guardrail off.
 */
export function guardrailSettings(env: Env = process.env): GuardrailSettings {
  const master = flag(env.ELEVENLABS_ENABLE_GUARDRAILS, true)
  const requested = (env.ELEVENLABS_CONTENT_GUARDRAILS ?? '')
    .split(',')
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean)
  const content = CONTENT_GUARDRAIL_CATEGORIES.filter((c) => requested.includes(c))
  const t = Number(env.ELEVENLABS_CONTENT_GUARDRAIL_THRESHOLD)
  return {
    focus: master && flag(env.ELEVENLABS_GUARDRAIL_FOCUS, true),
    promptInjection: master && flag(env.ELEVENLABS_GUARDRAIL_PROMPT_INJECTION, true),
    content: master ? content : [],
    contentThreshold: Number.isFinite(t) && t > 0 && t <= 1 ? t : DEFAULT_CONTENT_THRESHOLD,
  }
}

/** Unknown names in ELEVENLABS_CONTENT_GUARDRAILS (diagnostics). */
export function unknownContentGuardrails(env: Env = process.env): string[] {
  return (env.ELEVENLABS_CONTENT_GUARDRAILS ?? '')
    .split(',')
    .map((s) => s.trim().toLowerCase())
    .filter((s) => s && !(CONTENT_GUARDRAIL_CATEGORIES as readonly string[]).includes(s))
}

/**
 * platform_settings.guardrails, always complete: every category is sent with
 * is_enabled true or false, and the custom list is sent empty (custom
 * guardrails are usage-billed and not offered), so nothing enabled earlier
 * (or in the ElevenLabs dashboard) survives a sync.
 */
export function guardrailsConfig(settings: GuardrailSettings = guardrailSettings()) {
  const enabled = new Set<string>(settings.content)
  return {
    version: '1' as const,
    focus: { is_enabled: settings.focus },
    prompt_injection: { is_enabled: settings.promptInjection },
    content: {
      // Streaming is the mode the guardrails guide recommends for voice.
      execution_mode: 'streaming' as const,
      config: Object.fromEntries(CONTENT_GUARDRAIL_CATEGORIES.map((c) => [c, { is_enabled: enabled.has(c), threshold: settings.contentThreshold }])),
      // Retry (the agent apologises and moves on) rather than hanging up on a caller.
      trigger_action: { type: 'retry' as const, feedback: CONTENT_RETRY_FEEDBACK },
    },
    custom: { config: { configs: [] as never[] } },
  }
}

// ─── Privacy: transcript redaction ───────────────────────────────────────────

/** ConfigEntityType redacted from stored transcripts, audio and analysis. */
export const PII_REDACTION_ENTITIES = ['financial_id.payment_card'] as const

/**
 * privacy.conversation_history_redaction: payment card numbers (number,
 * expiry, CVV) are redacted from what ElevenLabs stores, even though the
 * prompt already forbids taking them. Enterprise-only at ElevenLabs: when the
 * workspace rejects it, the adapter retries without it (see adapters.ts) and
 * diagnostics report it. ELEVENLABS_PII_REDACTION=false turns it off.
 */
export function piiRedactionConfig(env: Env = process.env) {
  const enabled = flag(env.ELEVENLABS_PII_REDACTION, true)
  return {
    enabled,
    entities: enabled ? [...PII_REDACTION_ENTITIES] : [],
    excluded_data_collection_ids: [] as string[],
  }
}

// ─── Trust context and LLM cascade ───────────────────────────────────────────

export const TRUST_CONTEXTS = ['unknown', 'low'] as const
export type TrustContext = (typeof TRUST_CONTEXTS)[number]

/**
 * platform_settings.trust_context. 'low' ("serves untrusted external
 * participants") describes a public receptionist, but its runtime effect on
 * tools is undocumented: the default stays 'unknown' (the value every
 * existing agent has) until a staging test with the transfer, end_call and
 * voicemail tools passes. 'high' (owner-facing) is never allowed.
 */
export function trustContext(env: Env = process.env): TrustContext {
  const v = (env.ELEVENLABS_TRUST_CONTEXT ?? '').trim().toLowerCase()
  return (TRUST_CONTEXTS as readonly string[]).includes(v) ? (v as TrustContext) : 'unknown'
}

export const DEFAULT_CASCADE_TIMEOUT_SECONDS = 4

/**
 * prompt.backup_llm_config + cascade_timeout_seconds. The provider's default
 * backup cascade stays on (a slow or failing primary LLM falls back instead
 * of leaving the caller in silence); ELEVENLABS_BACKUP_LLM=disabled turns it
 * off. The timeout keeps the spec default (4 s) unless
 * ELEVENLABS_LLM_CASCADE_TIMEOUT_SECONDS (2–15) says otherwise. A custom
 * override order is not offered: backups must be models validated for the
 * agent languages.
 */
export function llmCascadeConfig(env: Env = process.env) {
  const preference = (env.ELEVENLABS_BACKUP_LLM ?? '').trim().toLowerCase() === 'disabled' ? 'disabled' : 'default'
  const t = Number(env.ELEVENLABS_LLM_CASCADE_TIMEOUT_SECONDS)
  const timeout = Number.isFinite(t) && t >= 2 && t <= 15 ? t : DEFAULT_CASCADE_TIMEOUT_SECONDS
  return { backup_llm_config: { preference } as { preference: 'default' | 'disabled' }, cascade_timeout_seconds: timeout }
}
