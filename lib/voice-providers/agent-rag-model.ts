import 'server-only'
import { ragEmbeddingModel } from '@/lib/elevenlabs/models'
import type { EmbeddingModel } from '@/lib/elevenlabs/api/knowledge'
import { normalizeAgentLanguage } from '@/lib/voice/languages'
import { effectiveAdditionalLanguages } from './language-presets'
import { readConversationSettings } from './settings'

/** Columns embeddingModelForAgentRow needs from `agents`. */
export const AGENT_RAG_COLUMNS = 'language, conversation_settings'

/**
 * RAG embedding model of an agent row. Must match what buildElevenLabsAgentBody
 * sends (primary language plus additional languages), otherwise documents are
 * indexed for a model the agent does not query.
 */
export function embeddingModelForAgentRow(row: { language?: unknown; conversation_settings?: unknown } | null | undefined): EmbeddingModel {
  const language = normalizeAgentLanguage((row?.language as string | null | undefined) ?? null)
  const extra = effectiveAdditionalLanguages(language, readConversationSettings(row?.conversation_settings).additional_languages)
  return ragEmbeddingModel(language, extra)
}
