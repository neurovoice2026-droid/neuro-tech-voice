import type { ProviderSyncStatus } from '@/types'

// Knowledge-base constants, API shapes and validation shared by the routes, the
// hook and the dashboard UI. No server-only imports: the browser uses this file.

export const KNOWLEDGE_BUCKET = 'knowledge-documents'
/** Same as the bucket's file_size_limit (migration 011). */
export const KNOWLEDGE_MAX_FILE_BYTES = 10 * 1024 * 1024
/** Web pages and PDFs fetched by address. */
export const KNOWLEDGE_MAX_URL_BYTES = 5 * 1024 * 1024
export const KNOWLEDGE_MAX_DOCUMENTS = 100
/** Extracted text above this is refused: it would not finish processing in one function run. */
export const KNOWLEDGE_MAX_CHARACTERS = 1_000_000
/**
 * Same limit in estimated tokens, which is what embedding time depends on:
 * 1,000,000 characters of English is ~250,000 tokens, while Hindi or Thai text
 * reaches that at ~250,000 characters.
 */
export const KNOWLEDGE_MAX_TOKENS = 300_000
export const KNOWLEDGE_MAX_QUERY_LENGTH = 300

/** Stored on a document whose text is read but can't be embedded until OpenAI is configured. */
export const WAITING_FOR_AI_MESSAGE = 'Waiting for the AI service to be configured'
/**
 * Stored on a ready document while it is read again. The status stays 'ready'
 * so calls keep answering from the current version (match_knowledge_chunks only
 * searches ready documents) until the new one replaces it.
 */
export const REFRESHING_MESSAGE = 'Refreshing'

export type KnowledgeFileType = 'pdf' | 'docx' | 'txt' | 'md'

export const KNOWLEDGE_FILE_TYPES: Record<
  KnowledgeFileType,
  { label: string; contentType: string; mimeTypes: readonly string[] }
> = {
  pdf: { label: 'PDF', contentType: 'application/pdf', mimeTypes: ['application/pdf', 'application/x-pdf'] },
  docx: {
    label: 'Word',
    contentType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    mimeTypes: ['application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'application/zip'],
  },
  txt: { label: 'text', contentType: 'text/plain', mimeTypes: ['text/plain'] },
  md: { label: 'Markdown', contentType: 'text/markdown', mimeTypes: ['text/markdown', 'text/x-markdown', 'text/plain'] },
}

/** For <input accept>: extensions plus MIME types (some mobile pickers only honour MIME types). */
export const KNOWLEDGE_ACCEPT = [
  '.pdf', '.docx', '.txt', '.md',
  'application/pdf',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'text/plain', 'text/markdown',
].join(',')

// Browsers report an empty or generic type when the OS doesn't know the extension.
const GENERIC_MIME_TYPES = new Set(['', 'application/octet-stream', 'binary/octet-stream'])

export function knowledgeFileTypeFromName(name: string): KnowledgeFileType | null {
  const match = /\.([a-z0-9]+)$/i.exec(name.trim())
  const ext = match?.[1].toLowerCase()
  if (ext === 'markdown') return 'md'
  return ext && ext in KNOWLEDGE_FILE_TYPES ? (ext as KnowledgeFileType) : null
}

export function formatMegabytes(bytes: number): string {
  const mb = bytes / (1024 * 1024)
  return `${mb >= 10 ? Math.round(mb) : Math.round(mb * 10) / 10} MB`
}

/** A plain-language reason the file can't be added, or null when it can. */
export function validateKnowledgeFile(file: { name: string; size: number; type?: string | null }): string | null {
  const name = file.name.trim() || 'This file'
  const type = knowledgeFileTypeFromName(name)
  if (!type) {
    if (/\.doc$/i.test(name)) {
      return `“${name}” is an older Word file. Open it in Word, save it as .docx and upload that instead.`
    }
    return `“${name}” isn’t a supported file. Upload a PDF, Word (.docx), .txt or .md file.`
  }
  if (!Number.isFinite(file.size) || file.size <= 0) return `“${name}” is empty.`
  if (file.size > KNOWLEDGE_MAX_FILE_BYTES) {
    return `“${name}” is ${formatMegabytes(file.size)}. Files can be up to ${formatMegabytes(KNOWLEDGE_MAX_FILE_BYTES)}.`
  }
  const mime = (file.type ?? '').split(';')[0].trim().toLowerCase()
  if (!GENERIC_MIME_TYPES.has(mime) && !KNOWLEDGE_FILE_TYPES[type].mimeTypes.includes(mime)) {
    return `“${name}” doesn’t look like a ${KNOWLEDGE_FILE_TYPES[type].label} file. Check the file and try again.`
  }
  return null
}

/**
 * Accepts what owners type ("example.com/faq", "http://…") and returns the
 * https address we fetch, without the #fragment. Null when it isn't a web address.
 */
export function normalizeKnowledgeUrl(input: string): string | null {
  let raw = input.trim()
  if (!raw) return null
  if (!/^[a-z][a-z0-9+.-]*:\/\//i.test(raw)) raw = `https://${raw}`
  let url: URL
  try {
    url = new URL(raw)
  } catch {
    return null
  }
  if (url.protocol === 'http:') url.protocol = 'https:'
  if (url.protocol !== 'https:' || !url.hostname.includes('.')) return null
  url.hash = ''
  return url.toString()
}

/** "example.com/faq" for a page until its <title> is known. */
export function defaultUrlDocumentName(url: string): string {
  try {
    const parsed = new URL(url)
    const path = parsed.pathname === '/' ? '' : parsed.pathname.replace(/\/$/, '')
    return `${parsed.hostname.replace(/^www\./, '')}${path}`.slice(0, 200)
  } catch {
    return url.slice(0, 200)
  }
}

// ─── API shapes ──────────────────────────────────────────────────────────────

export type KnowledgeDocumentType = KnowledgeFileType | 'url'

/** What the dashboard shows for one document. 'refreshing' is a ready document being read again (still used by calls). */
export type KnowledgeDocumentState = 'processing' | 'waiting_for_ai' | 'refreshing' | 'ready' | 'failed'

export interface KnowledgeProviderSummary {
  cartesia: ProviderSyncStatus | null
  elevenlabs: ProviderSyncStatus | null
  /** First backup-copy problem in plain words, or null. */
  error: string | null
}

export interface KnowledgeDocumentView {
  id: string
  name: string
  type: KnowledgeDocumentType
  url: string | null
  size_bytes: number
  character_count: number
  chunk_count: number
  status: 'processing' | 'ready' | 'failed'
  state: KnowledgeDocumentState
  /** Failure reason, the waiting note, or a refresh problem on a ready document. */
  error_message: string | null
  /** Still processing (or refreshing) long after it should have finished; offer a retry. */
  stuck: boolean
  providers: KnowledgeProviderSummary
  created_at: string
  updated_at: string | null
}

/** Calls can answer from it right now: ready, or ready and being read again. */
export function isSearchableDocument(doc: Pick<KnowledgeDocumentView, 'state'>): boolean {
  return doc.state === 'ready' || doc.state === 'refreshing'
}

/** Being read in the background right now (the dashboard polls while any document is). */
export function isDocumentInProgress(doc: Pick<KnowledgeDocumentView, 'state' | 'stuck'>): boolean {
  return (doc.state === 'processing' || doc.state === 'refreshing') && !doc.stuck
}

export interface KnowledgeCapabilities {
  /** OpenAI is configured: documents become searchable. */
  search: boolean
  backups: { cartesia: boolean; elevenlabs: boolean }
}

export interface KnowledgeListResponse {
  documents: KnowledgeDocumentView[]
  capabilities: KnowledgeCapabilities
  limits: { max_documents: number; max_file_bytes: number }
}

export interface KnowledgeUploadTarget {
  path: string
  signed_url: string
  token: string
  content_type: string
}

export interface KnowledgeSearchResult {
  chunk_id: string
  document_id: string
  document_name: string
  heading: string | null
  excerpt: string
  content: string
  similarity: number
}

export interface KnowledgeSearchResponse {
  query: string
  results: KnowledgeSearchResult[]
}

/** Plain-words strength for a cosine similarity from text-embedding-3-small. */
export function matchStrength(similarity: number): 'strong' | 'good' | 'possible' {
  if (similarity >= 0.6) return 'strong'
  if (similarity >= 0.4) return 'good'
  return 'possible'
}
