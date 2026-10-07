// Platform-owned RAG retrieval settings for every ElevenLabs agent
// (conversation_config.agent.prompt.rag). Tenants never edit them. They are
// sent on every sync, so a manual dashboard edit never silently persists
// (objects are deep-merged by the API). Values come from env, validated
// against the spec's bounds (RagConfig, 2026-10); an invalid value falls back
// to the platform default instead of turning every save into a 422.
//
// Defaults are tuned for short SMB documents on phone calls: a few chunks and
// a bounded total keep the per-turn prompt (latency, LLM cost) small. Check
// them with "Test your knowledge base" (rag-query) and a test call before
// changing them.
//
// Pure: no I/O, unit-tested.

export const RAG_DEFAULTS = {
  /** Spec: 0 < x < 10,000,000 (default 50,000). Platform cap here: 50,000. */
  maxDocumentsLength: 12_000,
  /** Spec: 1..20 (default 20). */
  maxRetrievedChunks: 6,
  /** Spec: 0 < x < 1 (default 0.6). */
  maxVectorDistance: 0.6,
} as const

export interface RagTuning {
  max_documents_length: number
  max_retrieved_rag_chunks_count: number
  max_vector_distance: number
  /** null = provider default (spec recommends at least 100 when set). */
  num_candidates: number | null
}

function intEnv(name: string, min: number, max: number, fallback: number): number {
  const raw = (process.env[name] ?? '').trim()
  if (!raw) return fallback
  const v = Number(raw)
  return Number.isInteger(v) && v >= min && v <= max ? v : fallback
}

export function ragTuning(): RagTuning {
  const distanceRaw = (process.env.ELEVENLABS_RAG_MAX_VECTOR_DISTANCE ?? '').trim()
  const distance = distanceRaw ? Number(distanceRaw) : Number.NaN
  const candidatesRaw = (process.env.ELEVENLABS_RAG_NUM_CANDIDATES ?? '').trim()
  const candidates = candidatesRaw ? Number(candidatesRaw) : Number.NaN
  return {
    max_documents_length: intEnv('ELEVENLABS_RAG_MAX_DOCS_LENGTH', 1, 50_000, RAG_DEFAULTS.maxDocumentsLength),
    max_retrieved_rag_chunks_count: intEnv('ELEVENLABS_RAG_MAX_CHUNKS', 1, 20, RAG_DEFAULTS.maxRetrievedChunks),
    max_vector_distance: Number.isFinite(distance) && distance > 0 && distance < 1 ? distance : RAG_DEFAULTS.maxVectorDistance,
    num_candidates: Number.isInteger(candidates) && candidates >= 100 && candidates <= 10_000 ? candidates : null,
  }
}

/** Invalid env values, for diagnostics (names only; values are not secret but stay out of logs anyway). */
export function ragTuningProblems(): string[] {
  const problems: string[] = []
  const check = (name: string, ok: (v: number) => boolean) => {
    const raw = (process.env[name] ?? '').trim()
    if (raw && !ok(Number(raw))) problems.push(`${name} is out of range and was ignored`)
  }
  check('ELEVENLABS_RAG_MAX_DOCS_LENGTH', (v) => Number.isInteger(v) && v >= 1 && v <= 50_000)
  check('ELEVENLABS_RAG_MAX_CHUNKS', (v) => Number.isInteger(v) && v >= 1 && v <= 20)
  check('ELEVENLABS_RAG_MAX_VECTOR_DISTANCE', (v) => Number.isFinite(v) && v > 0 && v < 1)
  check('ELEVENLABS_RAG_NUM_CANDIDATES', (v) => Number.isInteger(v) && v >= 100 && v <= 10_000)
  return problems
}

/** Smaller documents cannot be RAG-indexed: the provider always puts them in the prompt. */
export const RAG_MIN_INDEXABLE_BYTES = 500

/**
 * Whether the agent needs RAG at all: folders are only ever used through RAG,
 * and an 'auto' document needs it unless it is known to be too small to index
 * (unknown size counts as large). Prompt-mode documents never need it.
 */
export function needsRag(
  knowledge: ReadonlyArray<{ type: string; usageMode?: 'auto' | 'prompt'; sizeBytes?: number | null }>,
): boolean {
  return knowledge.some((k) => {
    if (k.type === 'folder') return true
    if (k.usageMode === 'prompt') return false
    return typeof k.sizeBytes !== 'number' || k.sizeBytes <= 0 || k.sizeBytes >= RAG_MIN_INDEXABLE_BYTES
  })
}

export interface KnowledgeLocator {
  type: 'file' | 'url' | 'text' | 'folder'
  name: string
  id: string
  usage_mode: 'auto' | 'prompt'
}

/**
 * conversation_config.agent.prompt.knowledge_base and .rag for a spec. The
 * locator array is replaced on every PATCH, so it always lists every uploaded
 * document (and imported website folder) of the organization's agent.
 */
export function buildKnowledgePromptConfig(
  knowledge: ReadonlyArray<{
    name: string
    type: 'file' | 'url' | 'text' | 'folder'
    elevenlabsId: string | null
    usageMode?: 'auto' | 'prompt'
    sizeBytes?: number | null
  }>,
  embeddingModel: 'e5_mistral_7b_instruct' | 'multilingual_e5_large_instruct',
): { knowledge_base: KnowledgeLocator[]; rag: Record<string, unknown> } {
  const attached = knowledge.filter((k) => !!k.elevenlabsId)
  const knowledge_base = attached.map((k) => ({
    type: k.type,
    name: k.name.slice(0, 200),
    id: k.elevenlabsId as string,
    // Folders are always used through RAG; 'prompt' is only valid for documents.
    usage_mode: k.type !== 'folder' && k.usageMode === 'prompt' ? ('prompt' as const) : ('auto' as const),
  }))
  return {
    knowledge_base,
    rag: { enabled: needsRag(attached), embedding_model: embeddingModel, ...ragTuning() },
  }
}
