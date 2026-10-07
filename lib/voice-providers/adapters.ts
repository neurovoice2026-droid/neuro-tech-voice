import 'server-only'
// Provider adapters behind one interface. Routes and the sync engine use
// these; nothing outside lib/elevenlabs and lib/cartesia sees vendor payloads.

import type { AgentSpec, ExternalAgentRef, ProviderHealth } from './types'
import { ProviderError, isProviderError, type VoiceProvider } from './errors'
import * as el from '@/lib/elevenlabs/client'
import { createLogger } from '@/lib/observability/logger'
import * as ct from '@/lib/cartesia/client'
import {
  PLATFORM_AGENT_CONFIG_VERSION,
  agentTags,
  buildElevenLabsAgentBody,
  configHash,
  versionDescription,
  withRetroactivePrivacy,
  withoutPiiRedaction,
} from '@/lib/elevenlabs/agent-config'
import { effectiveAgentLlm } from '@/lib/elevenlabs/llm-selection'
import { inspectRemoteAgent } from '@/lib/elevenlabs/remote-agent-checks'
import type { AgentBody, ELAgent } from '@/lib/elevenlabs/client'
import { buildCartesiaAgentConfig } from '@/lib/cartesia/agent-config'
import { cartesiaFallbackVoices } from './config'
import { isAllowedFallbackVoice } from '@/lib/cartesia/voice-policy'
import { forgetPlatformResource, tryPlatformResource } from './platform-resources'
import { TRANSFER_TOOL_DEGRADED, ensurePlatformTool, invalidatePlatformToolMemo, storedPlatformToolId } from './platform-tools'
import { composeSystemPrompt } from './prompt'
import { invalidateBusinessToolMemo, resolveBusinessToolIds, withAttachedBusinessTools } from './business-tools'

export interface SyncedAgent extends ExternalAgentRef {
  configHash: string
  /** What the provider reports back after the write (voice confirmation). */
  appliedVoiceId: string | null
  /** Provider-specific, non-sensitive details worth remembering. */
  details: Record<string, unknown>
  /**
   * The write succeeded without part of the intended config (a platform tool
   * could not be obtained): the sync is recorded as degraded with this
   * tenant-safe message and retried by the maintenance job.
   */
  degraded?: SyncDegradation | null
}

export interface SyncDegradation {
  code: string
  message: string
}

export interface UpdateOptions {
  /**
   * ElevenLabs: the tenant made retention or recording stricter since the
   * last applied privacy: send apply_to_existing_conversations: true once.
   */
  applyPrivacyToExisting?: boolean
}

export interface AgentLifecycle {
  provider: VoiceProvider
  isConfigured(): boolean
  /** Payload fingerprint for the spec (skip no-op writes). */
  hash(spec: AgentSpec): Promise<string>
  create(spec: AgentSpec): Promise<SyncedAgent>
  update(externalId: string, spec: AgentSpec, opts?: UpdateOptions): Promise<SyncedAgent>
  delete(externalId: string): Promise<void>
  /** Agents carrying our local id (reconciliation after a crash between create and DB write). */
  findByLocalAgent(localAgentId: string): Promise<string[]>
  health(): Promise<ProviderHealth>
}

async function timed<T>(fn: () => Promise<T>): Promise<{ value: T | null; ms: number; error: unknown }> {
  const t = Date.now()
  try {
    return { value: await fn(), ms: Date.now() - t, error: null }
  } catch (error) {
    return { value: null, ms: Date.now() - t, error }
  }
}

// ─── ElevenLabs ──────────────────────────────────────────────────────────────

/** App-routed calls need the platform transfer_to_human tool (ElevenLabs cannot transfer a call it does not control). */
function needsAppTransferTool(spec: AgentSpec): boolean {
  return spec.active && spec.appRouted && spec.transfer.enabled && !!spec.transfer.number
}

const APP_TRANSFER_UNAVAILABLE_RULE =
  '- Override: transferring calls that arrive through the business line is not possible right now. If the caller asks for a human, say so and offer to take a message with their name, number and reason so the team can call back.'

/** The spec whose prompt promises no app-routed transfer (the tool is unavailable). */
export function withoutAppTransfer(spec: AgentSpec): AgentSpec {
  if (!spec.promptInput) return { ...spec, systemPrompt: `${spec.systemPrompt}\n\n${APP_TRANSFER_UNAVAILABLE_RULE}` }
  // The prompt input carries the flag too, so a later recomposition (business tools) keeps it.
  const promptInput = { ...spec.promptInput, appTransferUnavailable: true }
  return { ...spec, promptInput, systemPrompt: composeSystemPrompt(promptInput) }
}

type AppTransfer = 'attached' | 'unavailable' | 'not_needed'

/**
 * 'write' (create/update) obtains the platform tools (reconciled, created on
 * first use); 'hash' only reads their stored ids and never creates anything.
 * A tool that cannot be obtained is never swallowed: the body leaves it out,
 * the prompt stops promising it, and the sync is reported degraded.
 */
async function elevenLabsBody(
  spec: AgentSpec,
  mode: 'write' | 'hash' = 'write',
): Promise<{ body: AgentBody; degraded: SyncDegradation | null; appTransfer: AppTransfer; business: { booking: boolean; takeMessage: boolean } }> {
  let transferToolId: string | null = null
  let degraded: SyncDegradation | null = null
  const needsTransferTool = needsAppTransferTool(spec)
  if (needsTransferTool) {
    if (mode === 'hash') {
      transferToolId = await storedPlatformToolId('elevenlabs.transfer_tool')
    } else {
      try {
        transferToolId = (await ensurePlatformTool('elevenlabs.transfer_tool', { verify: 'cached' })).toolId
      } catch (err) {
        createLogger({ component: 'elevenlabs_lifecycle' }).error('agent_sync.transfer_tool_unavailable', err, { orgId: spec.orgId, agentId: spec.localAgentId })
        degraded = TRANSFER_TOOL_DEGRADED
      }
    }
  }
  // In-call business tools (slice B2): attached only when obtained; the prompt follows what is attached.
  const business = await resolveBusinessToolIds(spec, mode, createLogger({ component: 'elevenlabs_lifecycle' }))
  degraded = degraded ?? business.degraded
  const effective = withAttachedBusinessTools(needsTransferTool && !transferToolId ? withoutAppTransfer(spec) : spec, business)
  // ELEVENLABS_POST_CALL_WEBHOOK_ID, else the workspace webhook pointing at our receiver (discovered once).
  const postCallWebhookId = await import('./webhook-health').then((m) => m.resolvePostCallWebhookId())
  // Cached LLM catalogue: the configured LLM when offered and not deprecated,
  // else the platform default; plus the lowest reasoning level it supports.
  const llm = await effectiveAgentLlm()
  const body = buildElevenLabsAgentBody(
    effective,
    { transferToolId, postCallWebhookId, businessToolIds: business.ids, bookingToolsAttached: business.booking },
    { llm: llm.llm, reasoningEffort: llm.reasoningEffort },
  )
  return {
    body,
    degraded,
    appTransfer: !needsTransferTool ? 'not_needed' : transferToolId ? 'attached' : 'unavailable',
    business: { booking: business.booking, takeMessage: business.takeMessage },
  }
}

/**
 * A 404 on PATCH agent may come from a resource the body references (a tool
 * deleted in the dashboard) rather than from the agent itself: confirm with
 * GET before the sync engine recreates the agent. Throws the error to report.
 */
async function confirmAgentMissing(externalId: string, ctx: { orgId: string; agentId: string }, original: unknown): Promise<never> {
  // The next sync re-verifies the platform tools (a missing one is recreated).
  invalidatePlatformToolMemo()
  try {
    await el.agents.get(externalId, ctx)
  } catch (err) {
    if (isProviderError(err) && err.code === 'not_found') throw original // really gone: the sync engine recreates it
    throw err // unknown: degraded and retried, never a blind recreate
  }
  throw new ProviderError({
    system: 'elevenlabs',
    operation: 'agents.update_reference',
    code: 'not_found',
    detail: 'agent exists; a resource it references is missing',
    safeMessage: 'A platform resource used by your agent is missing. It is repaired automatically.',
  })
}

/** Transcript redaction rejected by the workspace (enterprise-only): skip it for an hour on this instance. */
const PII_REJECTION_MEMO_MS = 3_600_000
let piiRedactionRejectedAt = 0

function isPiiRedactionRejection(err: unknown): boolean {
  return isProviderError(err) && ['validation', 'permission', 'quota'].includes(err.code) && /redact/i.test(err.detail ?? '')
}

/**
 * Sends `body` with `send`. Payment-card redaction is enterprise-only at
 * ElevenLabs: when the workspace rejects it, the same write is repeated once
 * without it, so every tenant's sync keeps working (diagnostics report it).
 * The config hash stays that of the intended body: nothing re-syncs in a loop.
 */
async function sendWithRedactionFallback<T>(body: AgentBody, send: (b: AgentBody) => Promise<T>): Promise<{ result: T; pii: 'applied' | 'rejected' | 'disabled' }> {
  const privacy = body.platform_settings.privacy as { conversation_history_redaction?: { enabled?: boolean } } | undefined
  const wanted = privacy?.conversation_history_redaction?.enabled === true
  if (!wanted) return { result: await send(body), pii: 'disabled' }
  if (Date.now() - piiRedactionRejectedAt < PII_REJECTION_MEMO_MS) return { result: await send(withoutPiiRedaction(body)), pii: 'rejected' }
  try {
    return { result: await send(body), pii: 'applied' }
  } catch (err) {
    if (!isPiiRedactionRejection(err)) throw err
    piiRedactionRejectedAt = Date.now()
    createLogger({ component: 'elevenlabs_lifecycle' }).error('agent_sync.pii_redaction_rejected', err)
    return { result: await send(withoutPiiRedaction(body)), pii: 'rejected' }
  }
}

/** Test helper: forget a remembered redaction rejection. */
export function resetPiiRedactionMemo(): void {
  piiRedactionRejectedAt = 0
}

/** Non-sensitive facts about the write, merged into agent_provider_resources.details. */
function elevenLabsDetails(spec: AgentSpec, body: AgentBody, remote: ELAgent | null, pii: string, appTransfer: AppTransfer): Record<string, unknown> {
  const report = inspectRemoteAgent(body, remote)
  const prompt = (body.conversation_config.agent as { prompt?: { llm?: string } } | undefined)?.prompt
  return {
    // Platform transfer tool on app-routed calls: attached | unavailable | not_needed.
    app_transfer: appTransfer,
    tts_model: remote?.conversation_config?.tts?.model_id ?? null,
    llm: prompt?.llm ?? null,
    platform_version: PLATFORM_AGENT_CONFIG_VERSION,
    // The privacy now in force at the provider (decides the next one-shot retroactive push).
    privacy_applied: { record_audio: spec.privacy.record_audio, retention_days: spec.privacy.retention_days },
    paused: !spec.active,
    pii_redaction: pii,
    analysis_items_migrated: report.analysisItemsMigrated,
    stale_keys: report.staleKeys,
  }
}

export const elevenLabsLifecycle: AgentLifecycle = {
  provider: 'elevenlabs',
  isConfigured: el.isConfigured,
  async hash(spec) {
    // Read-only: hashing never creates a platform tool.
    return configHash((await elevenLabsBody(spec, 'hash')).body)
  },
  async create(spec) {
    const { body, degraded, appTransfer, business } = await elevenLabsBody(spec)
    const ctx = { orgId: spec.orgId, agentId: spec.localAgentId }
    let sent: { result: { agent_id: string }; pii: 'applied' | 'rejected' | 'disabled' }
    try {
      sent = await sendWithRedactionFallback(body, (b) =>
        el.agents.create({ name: b.name, tags: b.tags, conversation_config: b.conversation_config, platform_settings: b.platform_settings }, ctx),
      )
    } catch (err) {
      // A referenced tool may have been deleted: re-verify it on the next attempt.
      if (appTransfer === 'attached') invalidatePlatformToolMemo('elevenlabs.transfer_tool')
      if (business.booking || business.takeMessage) invalidateBusinessToolMemo()
      throw err
    }
    const { result, pii } = sent
    const agent_id = result.agent_id
    if (!agent_id) throw new ProviderError({ system: 'elevenlabs', operation: 'agents.create', code: 'bad_response', detail: 'no agent_id' })
    // Read back once: confirms the voice actually applied and gives the version id.
    const remote = await el.agents.get(agent_id, ctx)
    return {
      provider: 'elevenlabs',
      externalId: agent_id,
      version: remote.version_id ?? null,
      configHash: await configHash(body),
      appliedVoiceId: remote.conversation_config?.tts?.voice_id ?? null,
      details: { ...elevenLabsDetails(spec, body, remote, pii, appTransfer), business_tools: business },
      degraded,
    }
  },
  async update(externalId, spec, opts = {}) {
    const { body, degraded, appTransfer, business } = await elevenLabsBody(spec)
    const ctx = { orgId: spec.orgId, agentId: spec.localAgentId }
    // The hash is that of the steady-state body; the one-shot retroactive
    // privacy flag and the version description are only on the wire.
    const wire = opts.applyPrivacyToExisting ? withRetroactivePrivacy(body) : body
    let sent: { result: ELAgent; pii: 'applied' | 'rejected' | 'disabled' }
    try {
      sent = await sendWithRedactionFallback(wire, (b) => el.agents.update(externalId, { ...b, version_description: versionDescription(spec) }, ctx))
    } catch (err) {
      if (isProviderError(err) && err.code === 'not_found' && err.operation === 'agents.update') await confirmAgentMissing(externalId, ctx, err)
      if (appTransfer === 'attached') invalidatePlatformToolMemo('elevenlabs.transfer_tool')
      if (business.booking || business.takeMessage) invalidateBusinessToolMemo()
      throw err
    }
    const { result: remote, pii } = sent
    return {
      provider: 'elevenlabs',
      externalId,
      version: remote.version_id ?? null,
      configHash: await configHash(body),
      appliedVoiceId: remote.conversation_config?.tts?.voice_id ?? null,
      details: {
        ...elevenLabsDetails(spec, body, remote, pii, appTransfer),
        business_tools: business,
        ...(opts.applyPrivacyToExisting ? { privacy_retroactive_at: new Date().toISOString() } : {}),
      },
      degraded,
    }
  },
  async delete(externalId) {
    try {
      await el.agents.delete(externalId)
    } catch (err) {
      if (isProviderError(err) && err.code === 'not_found') return // already gone: idempotent
      throw err
    }
  },
  async findByLocalAgent(localAgentId) {
    const tag = agentTags({ orgId: '', localAgentId }).find((t) => t.startsWith('ntv-agent:')) as string
    const res = await el.agents.list({ tags: [tag], page_size: 10 })
    return (res.agents ?? []).filter((a) => (a.tags ?? []).includes(tag)).map((a) => a.agent_id)
  },
  async health() {
    const checkedAt = new Date().toISOString()
    if (!el.isConfigured()) return { provider: 'elevenlabs', configured: false, ok: false, latencyMs: null, errorCode: 'not_configured', checkedAt }
    let r: { ms: number; error: unknown } = await timed(() => el.subscription())
    if (r.error && isProviderError(r.error) && (r.error.code === 'auth' || r.error.code === 'permission')) {
      // Keys restricted to ConvAI scopes cannot read /v1/user: probe agents instead.
      r = await timed(() => el.agents.list({ page_size: 1 }))
    }
    const code = r.error ? (isProviderError(r.error) ? r.error.code : 'unknown') : null
    return { provider: 'elevenlabs', configured: true, ok: !r.error, latencyMs: r.ms, errorCode: code, checkedAt }
  },
}

// ─── Cartesia ────────────────────────────────────────────────────────────────

const AGENT_MARKER = (localAgentId: string) => `ntv-agent:${localAgentId}`

/**
 * Voice for the fallback agent: explicit per-agent choice, then the
 * per-language platform mapping (CARTESIA_FALLBACK_VOICES), then the first
 * active Cartesia voice for the agent's language (feminine preferred, stable
 * order). Throws a validation error when the language has no voice at all.
 */
export async function resolveFallbackVoice(spec: AgentSpec, preferredGender: 'feminine' | 'masculine' | null = null): Promise<{ voiceId: string; source: 'agent' | 'platform_map' | 'auto' }> {
  if (spec.fallbackVoiceId) {
    try {
      const v = await ct.voices.get(spec.fallbackVoiceId)
      // Re-validated at sync time: the stored id must still be a voice the
      // catalog would offer (never another account's private voice).
      if (v?.id && isAllowedFallbackVoice(v)) return { voiceId: v.id, source: 'agent' }
      if (v?.id) createLogger({ component: 'fallback_voice' }).warn('fallback_voice.agent_choice_not_allowed', { localAgentId: spec.localAgentId })
    } catch (err) {
      // The chosen voice was removed at Cartesia: fall back to the platform
      // choice so the fallback agent keeps working (logged for follow-up).
      // Any other error (outage, auth) propagates and fails the sync.
      if (!(isProviderError(err) && err.code === 'not_found')) throw err
      createLogger({ component: 'fallback_voice' }).warn('fallback_voice.agent_choice_missing', { localAgentId: spec.localAgentId })
    }
  }
  const mapped = cartesiaFallbackVoices()[spec.language]
  if (mapped) return { voiceId: mapped, source: 'platform_map' }
  for (const gender of [preferredGender ?? 'feminine', preferredGender === 'masculine' ? 'feminine' : 'masculine'] as const) {
    const page = await ct.voices.list({ language: spec.language, gender, limit: 20 })
    const candidate = (page.data ?? [])
      .filter((v) => (v.status ?? 'active') === 'active')
      .sort((a, b) => a.name.localeCompare(b.name))[0]
    if (candidate) return { voiceId: candidate.id, source: 'auto' }
  }
  throw new ProviderError({ system: 'cartesia', operation: 'voices.resolve', code: 'validation', detail: `no voice for language ${spec.language}`, safeMessage: 'No fallback voice is available for this language.' })
}

async function cartesiaConfig(spec: AgentSpec) {
  const voice = await resolveFallbackVoice(spec)
  const contextToolId = await tryPlatformResource('cartesia.context_tool')
  // take_message on the fallback agent (slice B2), when the owner enabled it.
  const messageToolId = spec.active && spec.businessTools?.takeMessage ? await tryPlatformResource('cartesia.message_tool') : null
  return { config: buildCartesiaAgentConfig(spec, voice.voiceId, { contextToolId, messageToolId }), voice }
}

/** Pages through the whole listing; throws (keep the id) if it cannot be read completely. */
async function cartesiaWebhookExists(webhookId: string): Promise<boolean> {
  let after: string | null = null
  for (let page = 0; page < 20; page++) {
    const res = await ct.webhooks.list({ limit: 100, starting_after: after })
    const data = res.data ?? []
    if (data.some((w) => w.id === webhookId)) return true
    if (!res.has_more || !data.length) return false
    after = data[data.length - 1].id
  }
  throw new Error('webhook listing too long to verify')
}

/**
 * Best effort: call-event webhooks are an optimisation (results are also
 * polled), so a failed attach must never fail the agent sync — and above all
 * must never look like "agent missing" to the sync engine. A webhook that no
 * longer exists is forgotten so it is recreated on the next sync.
 */
async function attachCartesiaWebhook(agentId: string): Promise<string | null> {
  const webhookId = await tryPlatformResource('cartesia.call_webhook')
  if (!webhookId) return null
  try {
    await ct.agents.attachWebhook(agentId, webhookId)
    return webhookId
  } catch (err) {
    createLogger({ component: 'cartesia_lifecycle' }).warn('cartesia.webhook_attach_failed', {
      externalAgentId: agentId,
      code: isProviderError(err) ? err.code : 'unknown',
    })
    // A 404 from the attach can mean "agent unknown to the legacy endpoint"
    // rather than "webhook gone": forget the id only when the webhook really
    // no longer exists, or every sync would create (and leak) a new one.
    if (isProviderError(err) && err.code === 'not_found') {
      try {
        if (!(await cartesiaWebhookExists(webhookId))) await forgetPlatformResource('cartesia.call_webhook')
      } catch (listErr) {
        createLogger({ component: 'cartesia_lifecycle' }).warn('cartesia.webhook_list_failed', { code: isProviderError(listErr) ? listErr.code : 'unknown' })
      }
    }
    return null
  }
}

function cartesiaName(spec: AgentSpec): string {
  return `${spec.name} · fallback`.slice(0, 64)
}

async function cartesiaHash(spec: AgentSpec, config: unknown): Promise<string> {
  const data = new TextEncoder().encode(JSON.stringify({ name: cartesiaName(spec), config }))
  return Buffer.from(await crypto.subtle.digest('SHA-256', data)).toString('hex').slice(0, 32)
}

export const cartesiaLifecycle: AgentLifecycle = {
  provider: 'cartesia',
  isConfigured: ct.isConfigured,
  async hash(spec) {
    const { config } = await cartesiaConfig(spec)
    return cartesiaHash(spec, config)
  },
  async create(spec) {
    const { config, voice } = await cartesiaConfig(spec)
    const ctx = { orgId: spec.orgId, agentId: spec.localAgentId }
    const created = await ct.agents.create({ name: cartesiaName(spec), description: AGENT_MARKER(spec.localAgentId), config }, ctx)
    const webhookId = await attachCartesiaWebhook(created.id)
    return {
      provider: 'cartesia',
      externalId: created.id,
      version: created.version?.id ?? created.version_id ?? null,
      configHash: await cartesiaHash(spec, config),
      appliedVoiceId: (created.config?.audio as { output?: { voice_id?: string } } | undefined)?.output?.voice_id ?? voice.voiceId,
      details: { voice_source: voice.source, voice_id: voice.voiceId, webhook_attached: !!webhookId },
    }
  },
  async update(externalId, spec) {
    const { config, voice } = await cartesiaConfig(spec)
    const updated = await ct.agents.update(externalId, { name: cartesiaName(spec), description: AGENT_MARKER(spec.localAgentId), config }, { orgId: spec.orgId, agentId: spec.localAgentId })
    const webhookId = await attachCartesiaWebhook(externalId)
    return {
      provider: 'cartesia',
      externalId,
      version: updated.version?.id ?? updated.version_id ?? null,
      configHash: await cartesiaHash(spec, config),
      appliedVoiceId: (updated.config?.audio as { output?: { voice_id?: string } } | undefined)?.output?.voice_id ?? voice.voiceId,
      details: { voice_source: voice.source, voice_id: voice.voiceId, webhook_attached: !!webhookId },
    }
  },
  async delete(externalId) {
    try {
      await ct.agents.delete(externalId)
    } catch (err) {
      if (isProviderError(err) && err.code === 'not_found') return
      throw err
    }
  },
  async findByLocalAgent(localAgentId) {
    const marker = AGENT_MARKER(localAgentId)
    const res = await ct.agents.list({ q: marker, limit: 20 })
    return (res.data ?? []).filter((a) => a.description === marker).map((a) => a.id)
  },
  async health() {
    const checkedAt = new Date().toISOString()
    if (!ct.isConfigured()) return { provider: 'cartesia', configured: false, ok: false, latencyMs: null, errorCode: 'not_configured', checkedAt }
    const r = await timed(() => ct.ping())
    const code = r.error ? (isProviderError(r.error) ? r.error.code : 'unknown') : null
    return { provider: 'cartesia', configured: true, ok: !r.error, latencyMs: r.ms, errorCode: code, checkedAt }
  },
}

export const LIFECYCLES: Record<VoiceProvider, AgentLifecycle> = {
  elevenlabs: elevenLabsLifecycle,
  cartesia: cartesiaLifecycle,
}

export function lifecycleFor(provider: VoiceProvider): AgentLifecycle {
  return LIFECYCLES[provider]
}
