import 'server-only'
// Provider adapters behind one interface. Routes and the sync engine use
// these; nothing outside lib/elevenlabs and lib/cartesia sees vendor payloads.

import type { AgentSpec, ExternalAgentRef, ProviderHealth } from './types'
import { ProviderError, isProviderError, type VoiceProvider } from './errors'
import * as el from '@/lib/elevenlabs/client'
import { createLogger } from '@/lib/observability/logger'
import * as ct from '@/lib/cartesia/client'
import { buildElevenLabsAgentBody, agentTags, configHash } from '@/lib/elevenlabs/agent-config'
import { buildCartesiaAgentConfig } from '@/lib/cartesia/agent-config'
import { cartesiaFallbackVoices } from './config'
import { isAllowedFallbackVoice } from '@/lib/cartesia/voice-policy'
import { forgetPlatformResource, tryPlatformResource } from './platform-resources'

export interface SyncedAgent extends ExternalAgentRef {
  configHash: string
  /** What the provider reports back after the write (voice confirmation). */
  appliedVoiceId: string | null
  /** Provider-specific, non-sensitive details worth remembering. */
  details: Record<string, unknown>
}

export interface AgentLifecycle {
  provider: VoiceProvider
  isConfigured(): boolean
  /** Payload fingerprint for the spec (skip no-op writes). */
  hash(spec: AgentSpec): Promise<string>
  create(spec: AgentSpec): Promise<SyncedAgent>
  update(externalId: string, spec: AgentSpec): Promise<SyncedAgent>
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

async function elevenLabsBody(spec: AgentSpec) {
  const needsTransferTool = spec.appRouted && spec.transfer.enabled && !!spec.transfer.number
  const transferToolId = needsTransferTool ? await tryPlatformResource('elevenlabs.transfer_tool') : null
  const postCallWebhookId = (process.env.ELEVENLABS_POST_CALL_WEBHOOK_ID ?? '').trim() || null
  return buildElevenLabsAgentBody(spec, { transferToolId, postCallWebhookId })
}

export const elevenLabsLifecycle: AgentLifecycle = {
  provider: 'elevenlabs',
  isConfigured: el.isConfigured,
  async hash(spec) {
    return configHash(await elevenLabsBody(spec))
  },
  async create(spec) {
    const body = await elevenLabsBody(spec)
    const ctx = { orgId: spec.orgId, agentId: spec.localAgentId }
    const { agent_id } = await el.agents.create({ name: body.name, tags: body.tags, conversation_config: body.conversation_config, platform_settings: body.platform_settings }, ctx)
    if (!agent_id) throw new ProviderError({ system: 'elevenlabs', operation: 'agents.create', code: 'bad_response', detail: 'no agent_id' })
    // Read back once: confirms the voice actually applied and gives the version id.
    const remote = await el.agents.get(agent_id, ctx)
    return {
      provider: 'elevenlabs',
      externalId: agent_id,
      version: remote.version_id ?? null,
      configHash: await configHash(body),
      appliedVoiceId: remote.conversation_config?.tts?.voice_id ?? null,
      details: { tts_model: remote.conversation_config?.tts?.model_id ?? null },
    }
  },
  async update(externalId, spec) {
    const body = await elevenLabsBody(spec)
    const remote = await el.agents.update(externalId, { ...body, version_description: `sync r${spec.revision}` }, { orgId: spec.orgId, agentId: spec.localAgentId })
    return {
      provider: 'elevenlabs',
      externalId,
      version: remote.version_id ?? null,
      configHash: await configHash(body),
      appliedVoiceId: remote.conversation_config?.tts?.voice_id ?? null,
      details: { tts_model: remote.conversation_config?.tts?.model_id ?? null },
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
    if (r.error && isProviderError(r.error) && r.error.code === 'auth') {
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
  return { config: buildCartesiaAgentConfig(spec, voice.voiceId, { contextToolId }), voice }
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
        const { data } = await ct.webhooks.list()
        if (!(data ?? []).some((w) => w.id === webhookId)) await forgetPlatformResource('cartesia.call_webhook')
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
