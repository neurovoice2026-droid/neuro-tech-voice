// Read-back checks on the agent ElevenLabs returns after a create (GET) or an
// update (the PATCH response is the full GetAgentResponseModel). Pure.
//
// - analysis_items: the spec says "None means the agent has not been migrated
//   onto analysis items yet (...); reads fall back to the legacy
//   evaluation/data_collection fields in that case". We only write the legacy
//   fields (there is no public API to create analysis items) and never write
//   analysis_items ourselves: this is detection. Production read-backs carry
//   a non-null value for every agent, including ones we had just created,
//   while their calls still return our evaluation and data results, so only
//   attached user items (an operator edit in the dashboard) count as
//   migrated. An empty set or the built-in system items (sentiment,
//   frustration) do not; the shape (keys and counts, never ids) is reported
//   either way.
// - stale map keys: the PATCH merge semantics of object maps are not
//   documented. Keys the remote agent still has but we did not send (a
//   deleted data-collection field, a removed variable or language preset)
//   are reported so the merge behaviour becomes visible.

import type { AgentBody, ELAgent } from './client'

export interface StaleKeys {
  data_collection: string[]
  dynamic_variable_placeholders: string[]
  language_presets: string[]
}

/** platform_settings.analysis_items as counts (no item ids). */
export interface AnalysisItemsShape {
  keys: string[]
  evaluation_criteria: number
  data_collection: number
  /** Items that are not the provider's built-in ones: these replace our legacy criteria and fields. */
  user_items: number
}

export interface RemoteAgentReport {
  /** User analysis items are attached: our legacy evaluation/data_collection may no longer be read. */
  analysisItemsMigrated: boolean
  /** null when analysis_items is absent or null (the legacy fields are read). */
  analysisItems: AnalysisItemsShape | null
  staleKeys: StaleKeys
}

const MAX_KEYS = 10

function obj(v: unknown): Record<string, unknown> | null {
  return v && typeof v === 'object' && !Array.isArray(v) ? (v as Record<string, unknown>) : null
}

function path(root: unknown, keys: string[]): Record<string, unknown> | null {
  let cur: unknown = root
  for (const k of keys) {
    const o = obj(cur)
    if (!o) return null
    cur = o[k]
  }
  return obj(cur)
}

function extraKeys(sent: Record<string, unknown> | null, remote: Record<string, unknown> | null): string[] {
  if (!remote) return []
  const want = new Set(Object.keys(sent ?? {}))
  return Object.keys(remote).filter((k) => !want.has(k)).slice(0, MAX_KEYS)
}

function analysisItemsShape(items: unknown): AnalysisItemsShape | null {
  if (items === undefined || items === null) return null
  const o = obj(items) ?? {}
  const list = (k: string) => (Array.isArray(o[k]) ? (o[k] as unknown[]) : [])
  const all = [...list('evaluation_criteria'), ...list('data_collection')]
  return {
    keys: Object.keys(o).slice(0, MAX_KEYS),
    evaluation_criteria: list('evaluation_criteria').length,
    data_collection: list('data_collection').length,
    // `source` is required by the spec ('user' | 'system'): an item not marked
    // system is counted, so an unexpected shape is reported rather than hidden.
    user_items: all.filter((i) => obj(i)?.source !== 'system').length,
  }
}

/** The read-back shape we inspect (ELAgent, or any partial copy of it). */
export type RemoteAgentLike = { conversation_config?: unknown; platform_settings?: unknown } | Pick<ELAgent, 'conversation_config' | 'platform_settings'>

export function inspectRemoteAgent(sent: Pick<AgentBody, 'conversation_config' | 'platform_settings'>, remote: RemoteAgentLike | null | undefined): RemoteAgentReport {
  const ps = obj(remote?.platform_settings)
  const analysisItems = analysisItemsShape(ps ? ps.analysis_items : undefined)
  const placeholders = ['agent', 'dynamic_variables', 'dynamic_variable_placeholders']
  return {
    analysisItemsMigrated: (analysisItems?.user_items ?? 0) > 0,
    analysisItems,
    staleKeys: {
      data_collection: extraKeys(path(sent.platform_settings, ['data_collection']), path(remote?.platform_settings, ['data_collection'])),
      dynamic_variable_placeholders: extraKeys(path(sent.conversation_config, placeholders), path(remote?.conversation_config, placeholders)),
      language_presets: extraKeys(path(sent.conversation_config, ['language_presets']), path(remote?.conversation_config, ['language_presets'])),
    },
  }
}

export function staleKeyCount(keys: StaleKeys): number {
  return keys.data_collection.length + keys.dynamic_variable_placeholders.length + keys.language_presets.length
}
