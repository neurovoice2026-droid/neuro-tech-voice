import 'server-only'
// Per-organization knowledge-base budgets. Every tenant shares ONE ElevenLabs
// workspace and its RAG quota (counted on original document size), so one
// organization must not be able to fill it for everybody:
//   • a byte budget over files, pasted text, URL pages and imported websites;
//   • a character cap over documents pinned "Always include" (prompt mode),
//     which add LLM tokens to every turn of every call;
//   • the document count cap (KNOWLEDGE_MAX_DOCS_PER_AGENT) also counts pages
//     of imported websites;
//   • uploads pause while the shared workspace is above 95 % of its RAG quota.
// Every input to these caps is a server-written column (locked for tenants by
// migration 013), never something the browser sent.

import type { SupabaseClient } from '@supabase/supabase-js'
import { RequestError } from '@/lib/api/http'
import type { RateLimitRule } from '@/lib/security/rate-limit'

const MB = 1024 * 1024

function intEnv(name: string, min: number, max: number, fallback: number): number {
  const raw = (process.env[name] ?? '').trim()
  if (!raw) return fallback
  const v = Number(raw)
  return Number.isInteger(v) && v >= min && v <= max ? v : fallback
}

/** Total knowledge bytes per organization (env KNOWLEDGE_ORG_MAX_BYTES, default 50 MB). */
export function orgByteBudget(): number {
  return intEnv('KNOWLEDGE_ORG_MAX_BYTES', MB, 1024 * MB, 50 * MB)
}

/** Total characters across "Always include" documents (env KNOWLEDGE_PROMPT_MAX_CHARS, default 8,000). */
export function promptCharBudget(): number {
  return intEnv('KNOWLEDGE_PROMPT_MAX_CHARS', 500, 50_000, 8_000)
}

/** Largest non-text document that may be pinned (env KNOWLEDGE_PROMPT_DOC_MAX_BYTES, default 32 KB). */
export function promptDocMaxBytes(): number {
  return intEnv('KNOWLEDGE_PROMPT_DOC_MAX_BYTES', 1_024, MB, 32 * 1024)
}

/** Pages per website import (env ELEVENLABS_CRAWL_MAX_PAGES, default 25, hard maximum 50). */
export function crawlMaxPages(): number {
  return intEnv('ELEVENLABS_CRAWL_MAX_PAGES', 1, 50, 25)
}

/** Auto-sync interval for URL documents and website imports (env ELEVENLABS_KB_SYNC_DAYS, default 7). */
export function syncFrequencyDays(): number {
  return intEnv('ELEVENLABS_KB_SYNC_DAYS', 1, 180, 7)
}

/** Bytes reserved per page while a website import runs (its real size is known only when it finishes). */
export const CRAWL_RESERVED_BYTES_PER_PAGE = 100 * 1024
/** Website imports kept per organization (each one is a folder of pages). */
export const KNOWLEDGE_MAX_WEBSITES = 3

/** Rate limits of the knowledge actions that call the provider (per organization). */
export const KNOWLEDGE_RATE_LIMITS = {
  /** Re-scrape + re-index of one URL document. */
  refresh: { name: 'knowledge_refresh', limit: 20, windowSeconds: 3_600 },
  /** Renames, usage-mode changes (each re-syncs the agent). */
  edit: { name: 'knowledge_edit', limit: 60, windowSeconds: 3_600 },
  /** Website imports (each crawl reads up to 50 pages). */
  crawl: { name: 'knowledge_crawl', limit: 5, windowSeconds: 86_400 },
  /** Test questions (embedding + vector search per question). */
  test: { name: 'knowledge_test', limit: 60, windowSeconds: 3_600 },
  /** Search-index refreshes triggered by the dashboard's document list (also throttled to one per 10 s). */
  status: { name: 'knowledge_status', limit: 400, windowSeconds: 3_600 },
  /** Website-import progress reads triggered by the dashboard (also throttled to one per 10 s per import). */
  crawlStatus: { name: 'knowledge_crawl_status', limit: 400, windowSeconds: 3_600 },
} as const satisfies Record<string, RateLimitRule>

export interface KnowledgeUsage {
  bytesUsed: number
  bytesLimit: number
  documents: number
  documentsLimit: number
  promptChars: number
  promptCharsLimit: number
  websites: number
}

const ACTIVE_CRAWL = ['starting', 'queued', 'processing']

/**
 * The organization's current usage, from server-written columns only.
 * Documents being deleted no longer count; a running website import counts
 * its reserved pages until its real size is known.
 */
export async function orgKnowledgeUsage(db: SupabaseClient, orgId: string, docsLimit: number): Promise<KnowledgeUsage> {
  const [{ data: docs, error: docErr }, { data: crawls, error: crawlErr }] = await Promise.all([
    db.from('knowledge_documents').select('size_bytes, character_count, usage_mode, deleting_at').eq('org_id', orgId),
    db.from('knowledge_crawls').select('status, size_bytes, page_count, max_pages').eq('org_id', orgId),
  ])
  if (docErr) throw new Error(`knowledge_documents usage read failed: ${docErr.message}`)
  if (crawlErr) throw new Error(`knowledge_crawls usage read failed: ${crawlErr.message}`)
  let bytesUsed = 0
  let documents = 0
  let promptChars = 0
  for (const d of docs ?? []) {
    if (d.deleting_at) continue
    documents++
    bytesUsed += Math.max(0, Number(d.size_bytes ?? 0))
    if (d.usage_mode === 'prompt') promptChars += Math.max(0, Number(d.character_count ?? 0))
  }
  let websites = 0
  for (const c of crawls ?? []) {
    const status = String(c.status)
    if (status === 'deleting' || status === 'cancelled') continue
    if (ACTIVE_CRAWL.includes(status)) {
      websites++
      documents += Number(c.max_pages ?? 0)
      bytesUsed += Number(c.max_pages ?? 0) * CRAWL_RESERVED_BYTES_PER_PAGE
    } else if (status === 'succeeded') {
      websites++
      documents += Number(c.page_count ?? 0)
      bytesUsed += Math.max(0, Number(c.size_bytes ?? 0))
    }
  }
  return {
    bytesUsed,
    bytesLimit: orgByteBudget(),
    documents,
    documentsLimit: docsLimit,
    promptChars,
    promptCharsLimit: promptCharBudget(),
    websites,
  }
}

function formatMb(bytes: number): string {
  return `${(bytes / MB).toFixed(bytes < 10 * MB ? 1 : 0)} MB`
}

/** Rejects an addition that would take the organization over its byte budget (409, friendly message). */
export function assertBytesFit(usage: KnowledgeUsage, incomingBytes: number): void {
  const incoming = Math.max(0, incomingBytes)
  if (usage.bytesUsed + incoming > usage.bytesLimit || (incoming === 0 && usage.bytesUsed >= usage.bytesLimit)) {
    throw new RequestError(
      'conflict',
      `Your knowledge base is full (${formatMb(usage.bytesUsed)} of ${formatMb(usage.bytesLimit)} used). Remove documents to add more.`,
      409,
      { bytes_used: usage.bytesUsed, bytes_limit: usage.bytesLimit },
    )
  }
}

/** Rejects an addition that would exceed the document count (pages of imported websites included). */
export function assertDocumentsFit(usage: KnowledgeUsage, incomingDocs: number): void {
  if (usage.documents + Math.max(0, incomingDocs) > usage.documentsLimit) {
    throw new RequestError(
      'conflict',
      `Your knowledge base is full (${usage.documentsLimit} documents and website pages). Remove a document to add another.`,
      409,
    )
  }
}
