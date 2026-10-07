import 'server-only'
// Which LLM the agents actually get. ELEVENLABS_LLM is checked against the
// cached catalogue (GET /v1/convai/llm/list, model-catalog.ts): a model that
// is not offered to agents, or is deprecated (is_deprecated is true from the
// start of the warning period), would make every sync fail with a 422 or
// silently move traffic to its replacement. The sync then uses the platform
// default (or a replacement the catalogue offers), and diagnostics report it
// as an error so the variable gets fixed.
//
// Without a readable catalogue the configured id is used when it is in the
// spec's LLM enum (vendored in models.ts), otherwise the platform default:
// a catalogue outage never blocks a sync.

import { isConfigured } from './client'
import { cachedAgentLlms } from './model-catalog'
import { DEFAULT_LLM, agentLlm, chooseReasoningEffort, isKnownAgentLlm, type LlmReasoningEffort } from './models'
import type { ELLlmInfo } from './api/models'
import { createLogger, describeError, type Logger } from '@/lib/observability/logger'
import type { ConfigProblem } from '@/lib/voice-providers/config'

export type LlmSelectionReason =
  /** The configured LLM is offered and not deprecated. */
  | 'ok'
  /** Not offered to agents by this workspace / region. */
  | 'not_offered'
  /** Deprecated or in its warning / fallback period. */
  | 'deprecated'
  /** Catalogue unreadable: the configured id was checked against the spec enum only. */
  | 'catalog_unavailable'
  /** Catalogue unreadable and the configured id is not in the spec enum. */
  | 'unknown_without_catalog'

export interface LlmSelection {
  /** What the agents get (prompt.llm). */
  llm: string
  /** What ELEVENLABS_LLM (or the default) asked for. */
  configured: string
  reason: LlmSelectionReason
  /** Replacement announced by the provider for the configured model, if any. */
  replacement: string | null
  /** Share of traffic the provider already routes to the replacement (0–100), if in its fallback period. */
  fallbackPercentage: number | null
  providerDeprecationDate: string | null
  /** reasoning_effort for the selected LLM (null = not sent). */
  /** null = the model has no configurable reasoning (clears it); undefined = catalogue unreadable (leave as is). */
  reasoningEffort: LlmReasoningEffort | null | undefined
}

function usable(info: ELLlmInfo | undefined): boolean {
  return !!info && !info.deprecation_info?.is_deprecated && !info.deprecation_info?.is_in_fallback_period
}

/** Pure decision from a catalogue (exported for tests). */
export function selectLlm(configured: string, catalog: readonly ELLlmInfo[] | null): Omit<LlmSelection, 'reasoningEffort'> & { info: ELLlmInfo | null } {
  const empty = { replacement: null, fallbackPercentage: null, providerDeprecationDate: null }
  if (!catalog) {
    return isKnownAgentLlm(configured)
      ? { llm: configured, configured, reason: 'catalog_unavailable', info: null, ...empty }
      : { llm: DEFAULT_LLM, configured, reason: 'unknown_without_catalog', info: null, ...empty }
  }
  const byId = new Map(catalog.map((l) => [l.llm, l]))
  const own = byId.get(configured)
  if (own && usable(own)) return { llm: configured, configured, reason: 'ok', info: own, ...empty }

  const dep = own?.deprecation_info ?? null
  const replacement = dep?.replacement_model ?? null
  const details = {
    replacement,
    fallbackPercentage: dep?.is_in_fallback_period ? (dep.fallback_percentage ?? null) : null,
    providerDeprecationDate: dep?.provider_deprecation_date ?? null,
  }
  const reason: LlmSelectionReason = own ? 'deprecated' : 'not_offered'
  // Platform default first (tested for the agent languages), then the
  // provider's announced replacements.
  const defaultInfo = byId.get(DEFAULT_LLM)
  const candidates = [DEFAULT_LLM, replacement, defaultInfo?.deprecation_info?.replacement_model ?? null].filter((c): c is string => !!c)
  for (const c of candidates) {
    const info = byId.get(c)
    if (info && usable(info)) return { llm: c, configured, reason, info, ...details }
  }
  // Nothing better is offered: a deprecated model still answers (traffic is
  // rerouted by the provider), an unlisted one would fail every sync.
  if (own) return { llm: configured, configured, reason, info: own, ...details }
  return { llm: DEFAULT_LLM, configured, reason, info: defaultInfo ?? null, ...details }
}

let lastReplacementLog = 0

/**
 * The LLM (and its reasoning effort) every agent sync sends. Never throws:
 * an unreadable catalogue falls back to the static check.
 */
export async function effectiveAgentLlm(log: Logger = createLogger({ component: 'elevenlabs.llm_selection' })): Promise<LlmSelection> {
  const configured = agentLlm()
  let catalog: ELLlmInfo[] | null = null
  if (isConfigured()) {
    try {
      catalog = await cachedAgentLlms()
    } catch (err) {
      log.warn('elevenlabs.llm_catalog_unavailable', { error: describeError(err) })
    }
  }
  const { info, ...selection } = selectLlm(configured, catalog)
  // Once per instance and 10 minutes: a rollout scan computes many bodies.
  if (selection.llm !== configured && Date.now() - lastReplacementLog > 600_000) {
    lastReplacementLog = Date.now()
    log.warn('elevenlabs.llm_replaced', { configured, used: selection.llm, reason: selection.reason, replacement: selection.replacement })
  }
  return { ...selection, reasoningEffort: info ? chooseReasoningEffort(info.available_reasoning_efforts ?? null) : undefined }
}

/** Diagnostics: an error whenever agents do not get the configured LLM. Never throws. */
export async function llmSelectionProblems(log: Logger): Promise<ConfigProblem[]> {
  if (!isConfigured()) return []
  const s = await effectiveAgentLlm(log)
  const extra = [
    s.replacement ? `provider replacement: ${s.replacement}` : null,
    s.fallbackPercentage !== null ? `${s.fallbackPercentage}% of its traffic is already routed to the replacement` : null,
    s.providerDeprecationDate ? `provider deprecation date: ${s.providerDeprecationDate}` : null,
  ].filter(Boolean)
  const suffix = extra.length ? ` (${extra.join('; ')})` : ''
  switch (s.reason) {
    case 'ok':
    case 'catalog_unavailable':
      return []
    case 'deprecated':
      return [{ key: 'ELEVENLABS_LLM', severity: 'error', message: `${s.configured} is deprecated${suffix}. Agents are synced with ${s.llm} instead: update ELEVENLABS_LLM.` }]
    case 'not_offered':
      return [{ key: 'ELEVENLABS_LLM', severity: 'error', message: `${s.configured} is not offered to agents by GET /v1/convai/llm/list. Agents are synced with ${s.llm} instead: update ELEVENLABS_LLM.` }]
    case 'unknown_without_catalog':
      return [{ key: 'ELEVENLABS_LLM', severity: 'error', message: `${s.configured} is not a known agent LLM and the catalogue could not be read. Agents are synced with ${s.llm} instead.` }]
  }
}
