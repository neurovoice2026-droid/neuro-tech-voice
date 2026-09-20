import 'server-only'
import { ApiError } from '@/lib/api/http'
import { env } from '@/lib/env'

// ElevenLabs knowledge base for the standby (fallback) agent. Documents are
// created from the text we already extracted (one extraction for every
// provider), attached through the agent's conversation_config.agent.prompt.
// knowledge_base list (the legacy add-to-knowledge-base endpoint is gone), and
// deleted with force=true so a document still attached to an agent is really
// removed. Errors never carry the upstream body into messages; only a short
// detail is kept for server logs.

const BASE = 'https://api.elevenlabs.io'
const DEFAULT_TIMEOUT_MS = 15_000
const UPLOAD_TIMEOUT_MS = 30_000

/** Above roughly this many characters ElevenLabs needs a RAG index to use a document. */
export const ELEVENLABS_RAG_THRESHOLD_CHARS = 300_000
/** Multilingual embeddings: the agents speak 14 languages. */
export const ELEVENLABS_RAG_MODEL = 'multilingual_e5_large_instruct'

export type ElevenLabsKnowledgeType = 'file' | 'url' | 'text' | 'folder'

export interface ElevenLabsKnowledgeLocator {
  type: ElevenLabsKnowledgeType
  name: string
  id: string
  usage_mode?: 'auto' | 'prompt'
}

export interface ElevenLabsRagConfig {
  enabled?: boolean
  embedding_model?: string
  [key: string]: unknown
}

export class ElevenLabsKnowledgeError extends Error {
  /** HTTP status; 0 when no response arrived. */
  readonly status: number
  readonly endpoint: string
  /** Short upstream detail for logs only. */
  readonly detail: string | null

  constructor(init: { status: number; endpoint: string; detail: string | null; cause?: unknown }) {
    super(`ElevenLabs ${init.endpoint} failed (${init.status || 'no response'})`, { cause: init.cause })
    this.name = 'ElevenLabsKnowledgeError'
    this.status = init.status
    this.endpoint = init.endpoint
    this.detail = init.detail
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

async function errorDetail(res: Response): Promise<string | null> {
  try {
    const text = await res.text()
    const json = JSON.parse(text) as unknown
    const detail = isRecord(json) ? json.detail : null
    if (typeof detail === 'string') return detail.slice(0, 200)
    if (isRecord(detail)) {
      const status = typeof detail.status === 'string' ? detail.status : null
      const message = typeof detail.message === 'string' ? detail.message : null
      return [status, message].filter(Boolean).join(': ').slice(0, 200) || null
    }
    return null
  } catch {
    return null
  }
}

async function call(
  method: 'GET' | 'POST' | 'PATCH' | 'DELETE',
  path: string,
  opts: { body?: unknown; timeoutMs?: number } = {}
): Promise<unknown> {
  const apiKey = env.ELEVENLABS_API_KEY
  if (!apiKey) throw new ApiError(503, 'not_configured', 'ElevenLabs is not configured.')
  const endpoint = `${method} ${path.split('?')[0]}`

  let res: Response
  try {
    res = await fetch(`${BASE}${path}`, {
      method,
      headers: {
        'xi-api-key': apiKey,
        ...(opts.body !== undefined ? { 'Content-Type': 'application/json' } : {}),
      },
      body: opts.body !== undefined ? JSON.stringify(opts.body) : undefined,
      signal: AbortSignal.timeout(opts.timeoutMs ?? DEFAULT_TIMEOUT_MS),
      cache: 'no-store',
    })
  } catch (error) {
    const timedOut = error instanceof Error && error.name === 'TimeoutError'
    throw new ElevenLabsKnowledgeError({ status: 0, endpoint, detail: timedOut ? 'timeout' : 'network_error', cause: error })
  }

  if (!res.ok) {
    throw new ElevenLabsKnowledgeError({ status: res.status, endpoint, detail: await errorDetail(res) })
  }
  const text = await res.text()
  if (!text) return null
  try {
    return JSON.parse(text) as unknown
  } catch {
    return null
  }
}

function seg(id: string): string {
  return encodeURIComponent(id)
}

export async function createElevenLabsTextDocument(input: { name: string; text: string }): Promise<{ id: string; name: string }> {
  const raw = await call('POST', '/v1/convai/knowledge-base/text', {
    body: { text: input.text, name: input.name },
    timeoutMs: UPLOAD_TIMEOUT_MS,
  })
  if (!isRecord(raw) || typeof raw.id !== 'string') {
    throw new ElevenLabsKnowledgeError({ status: 502, endpoint: 'POST /v1/convai/knowledge-base/text', detail: 'missing id' })
  }
  return { id: raw.id, name: typeof raw.name === 'string' ? raw.name : input.name }
}

/** Starts (or reuses) the RAG index for a document; indexing continues in the background upstream. */
export async function computeElevenLabsRagIndex(documentId: string, model: string = ELEVENLABS_RAG_MODEL): Promise<void> {
  await call('POST', `/v1/convai/knowledge-base/${seg(documentId)}/rag-index`, { body: { model } })
}

/** force=true removes it from every agent that uses it; an already-deleted document counts as done. */
export async function deleteElevenLabsDocument(documentId: string): Promise<void> {
  try {
    await call('DELETE', `/v1/convai/knowledge-base/${seg(documentId)}?force=true`)
  } catch (error) {
    if (error instanceof ElevenLabsKnowledgeError && error.status === 404) return
    throw error
  }
}

export interface ElevenLabsAgentKnowledge {
  locators: ElevenLabsKnowledgeLocator[]
  rag: ElevenLabsRagConfig | null
}

function parseLocators(value: unknown): ElevenLabsKnowledgeLocator[] {
  if (!Array.isArray(value)) return []
  return value.flatMap((item) => {
    if (!isRecord(item) || typeof item.id !== 'string' || typeof item.type !== 'string') return []
    const locator: ElevenLabsKnowledgeLocator = {
      type: item.type as ElevenLabsKnowledgeType,
      name: typeof item.name === 'string' ? item.name : item.id,
      id: item.id,
    }
    if (item.usage_mode === 'auto' || item.usage_mode === 'prompt') locator.usage_mode = item.usage_mode
    return [locator]
  })
}

/**
 * The embedding model a document's RAG index must be computed with for this
 * agent: the model its RAG already runs on, else our default. An agent whose
 * RAG is off still reports a default embedding_model (e5_mistral_7b_instruct),
 * which is ignored because enabling RAG sets the model we indexed with.
 */
export function ragModelForAgent(rag: ElevenLabsRagConfig | null): string {
  return rag?.enabled === true && typeof rag.embedding_model === 'string' && rag.embedding_model
    ? rag.embedding_model
    : ELEVENLABS_RAG_MODEL
}

export async function getElevenLabsAgentKnowledge(agentId: string): Promise<ElevenLabsAgentKnowledge> {
  const raw = await call('GET', `/v1/convai/agents/${seg(agentId)}`)
  const prompt = isRecord(raw) && isRecord(raw.conversation_config) && isRecord(raw.conversation_config.agent)
    ? raw.conversation_config.agent.prompt
    : null
  return {
    locators: parseLocators(isRecord(prompt) ? prompt.knowledge_base : null),
    rag: isRecord(prompt) && isRecord(prompt.rag) ? (prompt.rag as ElevenLabsRagConfig) : null,
  }
}

/**
 * Pure merge: drops `remove` ids, then adds or renames `add` entries by id,
 * keeping every other document the agent already had (owner-added ones too).
 */
export function mergeKnowledgeLocators(
  current: ElevenLabsKnowledgeLocator[],
  change: { add?: ElevenLabsKnowledgeLocator[]; remove?: string[] }
): ElevenLabsKnowledgeLocator[] {
  const removed = new Set(change.remove ?? [])
  const merged = current.filter((locator) => !removed.has(locator.id))
  for (const locator of change.add ?? []) {
    const existing = merged.findIndex((item) => item.id === locator.id)
    const next = { ...locator, usage_mode: locator.usage_mode ?? 'auto' }
    if (existing === -1) merged.push(next)
    else merged[existing] = { ...merged[existing], ...next }
  }
  return merged
}

function sameLocators(a: ElevenLabsKnowledgeLocator[], b: ElevenLabsKnowledgeLocator[]): boolean {
  if (a.length !== b.length) return false
  return a.every((item, i) => item.id === b[i].id && item.name === b[i].name && item.type === b[i].type)
}

/**
 * Reads the agent's knowledge list, merges the change and PATCHes only that
 * list (and RAG when asked). The PATCH is partial, so the prompt, voice and
 * everything else the agent sync writes stay untouched. Callers serialise
 * concurrent updates for the same agent (read-merge-write).
 */
export async function updateElevenLabsAgentKnowledge(
  agentId: string,
  change: { add?: ElevenLabsKnowledgeLocator[]; remove?: string[]; enableRagModel?: string | null }
): Promise<{ changed: boolean; rag: ElevenLabsRagConfig | null }> {
  const current = await getElevenLabsAgentKnowledge(agentId)
  const merged = mergeKnowledgeLocators(current.locators, change)
  const ragModel = change.enableRagModel ?? null
  const needsRag = ragModel !== null && current.rag?.enabled !== true
  if (sameLocators(current.locators, merged) && !needsRag) return { changed: false, rag: current.rag }

  // Retrieval only finds documents indexed with the agent's embedding model, so
  // RAG is switched on with the model the documents were indexed with, not the
  // default the disabled config reports.
  const rag: ElevenLabsRagConfig | null = needsRag
    ? { ...(current.rag ?? {}), enabled: true, embedding_model: ragModel ?? undefined }
    : current.rag
  await call('PATCH', `/v1/convai/agents/${seg(agentId)}`, {
    body: {
      conversation_config: {
        agent: { prompt: { knowledge_base: merged, ...(needsRag ? { rag } : {}) } },
      },
    },
  })
  return { changed: true, rag }
}
