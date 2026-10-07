import 'server-only'
// Cached views of the ElevenLabs model catalogues (TTS models and agent LLMs).
// They change rarely, so each lambda instance keeps them for an hour and keeps
// serving the last good copy if a refresh fails: an outage of a catalogue
// endpoint must never block an agent sync, and the agent body (and its config
// hash) must not flap between refreshes.

import { isConfigured } from '@/lib/elevenlabs/client'
import { listAgentLlms, listModels, type ELLlmInfo, type ELModel } from '@/lib/elevenlabs/api/models'
import { agentLlm, chooseReasoningEffort, type LlmReasoningEffort } from '@/lib/elevenlabs/models'
import { createLogger, describeError, type Logger } from '@/lib/observability/logger'

const TTL_MS = 3_600_000
/** After a failed refresh, wait this long before calling the endpoint again (no request per sync during an outage). */
const RETRY_AFTER_FAILURE_MS = 300_000

interface Entry<T> {
  at: number
  value: T
}

let modelsEntry: Entry<ELModel[]> | null = null
let llmsEntry: Entry<ELLlmInfo[]> | null = null
const lastFailure = new Map<string, { at: number; error: unknown }>()

async function cached<T>(name: string, entry: Entry<T> | null, load: () => Promise<T>, store: (e: Entry<T>) => void): Promise<T> {
  if (entry && Date.now() - entry.at < TTL_MS) return entry.value
  const failed = lastFailure.get(name)
  if (failed && Date.now() - failed.at < RETRY_AFTER_FAILURE_MS) {
    if (entry) return entry.value
    throw failed.error
  }
  try {
    const value = await load()
    store({ at: Date.now(), value })
    lastFailure.delete(name)
    return value
  } catch (err) {
    lastFailure.set(name, { at: Date.now(), error: err })
    if (!entry) throw err
    // Stale but known-good: keep serving it until a refresh succeeds.
    createLogger({ component: 'elevenlabs.model_catalog' }).warn('elevenlabs.catalog_refresh_failed', { catalog: name, error: describeError(err) })
    return entry.value
  }
}

/** GET /v1/models, cached for an hour (stale copy served when a refresh fails). */
export function cachedModels(): Promise<ELModel[]> {
  return cached(
    'models',
    modelsEntry,
    async () => {
      const res = await listModels()
      return Array.isArray(res) ? res : []
    },
    (e) => (modelsEntry = e),
  )
}

/** GET /v1/convai/llm/list, cached for an hour (stale copy served when a refresh fails). */
export function cachedAgentLlms(): Promise<ELLlmInfo[]> {
  return cached(
    'llms',
    llmsEntry,
    async () => {
      const res = await listAgentLlms()
      return Array.isArray(res?.llms) ? res.llms : []
    },
    (e) => (llmsEntry = e),
  )
}

/**
 * reasoning_effort for the configured agent LLM: the lowest level it supports
 * (or ELEVENLABS_REASONING_EFFORT when supported), null when the model has no
 * configurable reasoning or the catalogue cannot be read (the field is then
 * not sent and the API default applies). Never throws.
 */
export async function agentReasoningEffort(log: Logger = createLogger({ component: 'elevenlabs.model_catalog' })): Promise<LlmReasoningEffort | null> {
  if (!isConfigured()) return null
  try {
    const llm = agentLlm()
    const info = (await cachedAgentLlms()).find((l) => l.llm === llm)
    return chooseReasoningEffort(info?.available_reasoning_efforts ?? null)
  } catch (err) {
    log.warn('elevenlabs.llm_catalog_unavailable', { error: describeError(err) })
    return null
  }
}

/** Test helper: forget the cached catalogues. */
export function resetModelCatalogCache(): void {
  modelsEntry = null
  llmsEntry = null
  lastFailure.clear()
}
