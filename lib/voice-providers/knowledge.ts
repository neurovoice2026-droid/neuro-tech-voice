import 'server-only'
// Knowledge base pipeline: one document → ElevenLabs KB document → attached to
// the org's agent (and summarised for the Cartesia fallback agent).
//
// Flow (processDocument):
//   1. Load the row (admin client, scoped by the authorized org id) and claim it
//      with an optimistic-concurrency update on updated_at, so two requests can
//      never upload the same document twice.
//   2. Obtain the bytes: files and pasted text come from Supabase Storage (the
//      browser uploads there directly through a signed URL; Vercel caps request
//      bodies at 4.5 MB), URL documents are fetched by ElevenLabs itself.
//   3. Validate size (≤ 20 MB) and content (magic bytes / UTF-8), then create the
//      ElevenLabs document and store its id (status stays 'processing').
//   4. Attach: bump the agent's config revision and sync ElevenLabs. The agent
//      spec includes processing documents that have an elevenlabs_doc_id, and the
//      ElevenLabs agent body carries the full prompt.knowledge_base array (the
//      old add-to-knowledge-base endpoint no longer exists).
//   5. Ready: status 'ready' + attached_at. Then, non-fatal: start RAG indexing,
//      store a plain-text excerpt for the fallback agent, and sync the fallback
//      provider after the response.
//   Any failure marks the row 'failed' with a product-level message and bumps
//   attempt_count; the full error goes to the structured log.
//
// SECURITY: every function takes an org id the caller has ALREADY authorized
// with requireOrg(). Admin-client queries and Storage paths are always scoped
// by that org id.

import crypto from 'crypto'
import { z } from 'zod'
import type { SupabaseClient } from '@supabase/supabase-js'
import { createAdminClient } from '@/lib/supabase/admin'
import * as el from '@/lib/elevenlabs/client'
import * as kb from '@/lib/elevenlabs/api/knowledge'
import { ragEmbeddingModel } from '@/lib/elevenlabs/models'
import { RequestError } from '@/lib/api/http'
import { describeError, type Logger } from '@/lib/observability/logger'
import { deferBackground } from '@/lib/observability/telemetry'
import { normalizeAgentLanguage } from '@/lib/voice/languages'
import { bumpRevision, providersFor, syncAgent } from './agent-sync'
import { ProviderError, isProviderError } from './errors'
import { ensureOrgFolder, forgetOrgFolder } from './knowledge-folders'
import { assertBytesFit, assertDocumentsFit, orgKnowledgeUsage, syncFrequencyDays } from './knowledge-limits'
import { assertWorkspaceRagHeadroom, ragPatch } from './knowledge-rag'
import { healMissingDocuments, summaryPatch } from './knowledge-reconcile'
import type { KnowledgeDocument } from '@/types'

// ─── Limits ──────────────────────────────────────────────────────────────────

export const KNOWLEDGE_BUCKET = 'knowledge-documents'
/** ElevenLabs accepts files up to 20 MB. */
export const KNOWLEDGE_MAX_FILE_BYTES = 20 * 1024 * 1024
/** The legacy multipart endpoint goes through the 4.5 MB Vercel body cap. */
export const KNOWLEDGE_LEGACY_MAX_FILE_BYTES = 4 * 1024 * 1024
/** Roughly what fits in an agent prompt (ElevenLabs full-context limit). */
export const KNOWLEDGE_MAX_TEXT_CHARS = 300_000
export const KNOWLEDGE_MAX_NAME_CHARS = 200
export const KNOWLEDGE_MAX_URL_CHARS = 2_048
/** Per-agent cap: the platform's ElevenLabs workspace (and its RAG quota) is shared. */
export const KNOWLEDGE_MAX_DOCS_PER_AGENT = 100
/** Plain-text excerpt kept per document for the Cartesia fallback agent. */
export const KNOWLEDGE_EXCERPT_CHARS = 8_000
/** At most this much of the provider's extracted content is read to build the excerpt. */
export const EXCERPT_SOURCE_MAX_BYTES = 256 * 1024
/** A 'processing' row untouched for this long is treated as abandoned (retryable). */
export const STALE_PROCESSING_MS = 5 * 60_000

const STORAGE_DOWNLOAD_TIMEOUT_MS = 45_000
const ATTACH_MAX_ROUNDS = 8
const ATTACH_WAIT_MS = 2_500

/** Columns returned to the browser (content_excerpt and pending_storage_path stay server-side). */
export const KNOWLEDGE_DOC_COLUMNS =
  'id, agent_id, org_id, elevenlabs_doc_id, cartesia_doc_id, name, type, url, storage_path, size_bytes, character_count, status, error_message, mime_type, attached_at, last_synced_at, attempt_count, created_at, updated_at, usage_mode, supported_usages, auto_sync, sync_frequency_days, sync_failures, remote_updated_at, rag_status, rag_progress, rag_model, rag_used_bytes, rag_checked_at, elevenlabs_folder_id, deleting_at'

export type KnowledgeDocumentRow = KnowledgeDocument & {
  attempt_count: number
  updated_at: string
  /** 'prompt' = always in the agent's prompt ("Always include"); platform-managed. */
  usage_mode?: 'auto' | 'prompt'
  supported_usages?: string[] | null
  auto_sync?: boolean
  sync_frequency_days?: number | null
  /** Consecutive failed auto-syncs reported by the provider. */
  sync_failures?: number
  remote_updated_at?: string | null
  rag_status?: string | null
  rag_progress?: number | null
  rag_model?: string | null
  rag_used_bytes?: number | null
  rag_checked_at?: string | null
  elevenlabs_folder_id?: string | null
  /** Set while a delete runs (the agent no longer uses the document). */
  deleting_at?: string | null
}

/** What the API returns for a document: the row plus whether a retry is possible now. */
export type KnowledgeDocumentView = KnowledgeDocumentRow & { can_retry: boolean }

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

/** Route param schema for [docId]. */
export const DocIdSchema = z.string().regex(UUID_RE, 'Invalid document id.')

export function parseDocId(raw: string): string {
  const parsed = DocIdSchema.safeParse(raw)
  if (!parsed.success) throw new RequestError('invalid_request', 'Invalid document id.', 400)
  return parsed.data.toLowerCase()
}

// ─── File types ──────────────────────────────────────────────────────────────

export type KnowledgeFileKind = 'pdf' | 'docx' | 'txt' | 'md' | 'html' | 'epub'

interface FileTypeInfo {
  kind: KnowledgeFileKind
  /** Canonical extension used for the stored object and the upload filename. */
  ext: string
  /** Canonical MIME type stored on the row and sent upstream. */
  mime: string
  /** MIME types a browser may report for this extension. */
  accepts: readonly string[]
}

const FILE_TYPES: Record<string, FileTypeInfo> = {
  pdf: { kind: 'pdf', ext: 'pdf', mime: 'application/pdf', accepts: ['application/pdf', 'application/x-pdf'] },
  docx: {
    kind: 'docx',
    ext: 'docx',
    mime: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    accepts: ['application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'application/zip', 'application/x-zip-compressed'],
  },
  txt: { kind: 'txt', ext: 'txt', mime: 'text/plain', accepts: ['text/plain'] },
  md: { kind: 'md', ext: 'md', mime: 'text/markdown', accepts: ['text/markdown', 'text/x-markdown', 'text/plain'] },
  markdown: { kind: 'md', ext: 'md', mime: 'text/markdown', accepts: ['text/markdown', 'text/x-markdown', 'text/plain'] },
  html: { kind: 'html', ext: 'html', mime: 'text/html', accepts: ['text/html', 'application/xhtml+xml'] },
  htm: { kind: 'html', ext: 'html', mime: 'text/html', accepts: ['text/html', 'application/xhtml+xml'] },
  epub: { kind: 'epub', ext: 'epub', mime: 'application/epub+zip', accepts: ['application/epub+zip', 'application/zip'] },
}

/** Browsers report these when they do not know the type; the extension decides. */
const GENERIC_MIMES = new Set(['', 'application/octet-stream', 'binary/octet-stream'])

export const KNOWLEDGE_TYPES_LABEL = 'PDF, DOCX, TXT, MD, HTML or EPUB'

/**
 * Resolves the document type from the file name's extension, cross-checked
 * against the MIME type the browser reported. Null when unsupported or
 * contradictory (e.g. "report.pdf" sent as image/png).
 */
export function resolveFileType(fileName: string, mime: string | null | undefined): FileTypeInfo | null {
  const base = baseName(fileName)
  const dot = base.lastIndexOf('.')
  if (dot <= 0 || dot === base.length - 1) return null
  const info = FILE_TYPES[base.slice(dot + 1).toLowerCase()]
  if (!info) return null
  const reported = (mime ?? '').split(';')[0].trim().toLowerCase()
  if (!GENERIC_MIMES.has(reported) && !info.accepts.includes(reported)) return null
  return info
}

function fileTypeForKind(kind: string): FileTypeInfo | null {
  return Object.values(FILE_TYPES).find((t) => t.kind === kind) ?? null
}

function baseName(name: string): string {
  return name.split(/[\\/]/).pop() ?? ''
}

/** User-visible name: no control characters, single spaces, bounded. */
export function cleanDisplayName(raw: string): string {
  return raw
    .replace(/\p{Cc}/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, KNOWLEDGE_MAX_NAME_CHARS)
}

/** Display name for an uploaded file: its base name only (browsers may send a path). */
export function cleanFileDisplayName(raw: string): string {
  return cleanDisplayName(baseName(raw))
}

/** ASCII-only object/file name: letters, digits, dot, dash, underscore. */
export function safeFileName(raw: string, ext: string): string {
  const stem = baseName(raw).replace(/\.[^.]*$/, '')
  const ascii = stem.normalize('NFKD').replace(/[̀-ͯ]/g, '')
  const cleaned = ascii
    .replace(/[^A-Za-z0-9._-]+/g, '-')
    .replace(/[-.]{2,}/g, '-')
    .replace(/^[-._]+|[-._]+$/g, '')
    .slice(0, 80)
  return `${cleaned || 'document'}.${ext}`
}

/** Storage object path: `${orgId}/${agentId}/${uuid}-${safeName}` (the org folder is what the Storage policy checks). */
export function storagePathFor(orgId: string, agentId: string, objectId: string, safeName: string): string {
  return `${orgId}/${agentId}/${objectId}-${safeName}`
}

/** True when the object path lives in the org's own folder (guards admin-client Storage calls). */
export function isOrgStoragePath(orgId: string, path: string): boolean {
  return path.startsWith(`${orgId}/`) && !path.split('/').some((seg) => seg === '..' || seg === '.' || seg === '')
}

/**
 * Checks content against the declared type. Returns a product-level problem
 * description, or null when the content is acceptable.
 */
export function validateContent(kind: KnowledgeFileKind | 'text', bytes: Uint8Array): string | null {
  if (bytes.byteLength === 0) return 'The file is empty.'
  if (bytes.byteLength > KNOWLEDGE_MAX_FILE_BYTES) return 'The file is larger than 20 MB.'
  switch (kind) {
    case 'pdf':
      // PDF readers accept the header anywhere in the first 1024 bytes.
      return indexOfAscii(bytes.subarray(0, 1024), '%PDF-') >= 0 ? null : 'This file is not a valid PDF.'
    case 'docx':
    case 'epub':
      return startsWith(bytes, [0x50, 0x4b, 0x03, 0x04])
        ? null
        : `This file is not a valid ${kind === 'docx' ? 'Word (DOCX)' : 'EPUB'} document.`
    case 'txt':
    case 'md':
    case 'html':
    case 'text': {
      if (bytes.includes(0)) return 'This file is not plain text (it contains binary data).'
      const text = decodeUtf8(bytes)
      if (text === null) return 'This file is not UTF-8 text. Save it as UTF-8 and try again.'
      if (!text.replace(/^﻿/, '').trim()) return 'The file is empty.'
      return null
    }
  }
}

function startsWith(bytes: Uint8Array, prefix: number[]): boolean {
  return prefix.every((b, i) => bytes[i] === b)
}

function indexOfAscii(bytes: Uint8Array, needle: string): number {
  const n = Array.from(needle, (c) => c.charCodeAt(0))
  outer: for (let i = 0; i + n.length <= bytes.length; i++) {
    for (let j = 0; j < n.length; j++) if (bytes[i + j] !== n[j]) continue outer
    return i
  }
  return -1
}

/** Strict UTF-8 decode; null when the bytes are not valid UTF-8. */
function decodeUtf8(bytes: Uint8Array): string | null {
  try {
    return new TextDecoder('utf-8', { fatal: true }).decode(bytes)
  } catch {
    // TextDecoder({fatal}) throws a TypeError on invalid input: that IS the answer.
    return null
  }
}

// ─── URL checks ──────────────────────────────────────────────────────────────

const BLOCKED_HOST_SUFFIXES = ['.localhost', '.local', '.internal', '.localdomain', '.home.arpa', '.lan', '.intranet', '.corp']

export type PublicUrlCheck = { ok: true; url: URL } | { ok: false; reason: string }

/**
 * Accepts only public http(s) addresses: no credentials, no localhost or
 * internal names, no single-label hosts, and no IP literal in a private,
 * loopback, link-local, shared, documentation, multicast or reserved range.
 * The WHATWG parser has already normalised numeric hosts (0x7f.1 → 127.0.0.1).
 */
export function checkPublicUrl(raw: string): PublicUrlCheck {
  const input = raw.trim()
  if (!input || input.length > KNOWLEDGE_MAX_URL_CHARS || !URL.canParse(input)) {
    return { ok: false, reason: 'Enter a valid web address, starting with https://.' }
  }
  const url = new URL(input)
  if (url.protocol !== 'https:' && url.protocol !== 'http:') {
    return { ok: false, reason: 'Only http:// and https:// addresses can be added.' }
  }
  if (url.username || url.password) {
    return { ok: false, reason: 'Remove the login details from the address.' }
  }
  const host = url.hostname.toLowerCase().replace(/\.$/, '')
  const notPublic = { ok: false as const, reason: 'This address is not a public web page.' }
  if (!host) return notPublic

  if (host.startsWith('[')) {
    const groups = ipv6Groups(host.slice(1, -1))
    if (!groups || isBlockedIPv6(groups)) return notPublic
  } else {
    const octets = ipv4Octets(host)
    if (octets) {
      if (isBlockedIPv4(octets)) return notPublic
    } else {
      if (host === 'localhost' || BLOCKED_HOST_SUFFIXES.some((s) => host.endsWith(s) || host === s.slice(1))) return notPublic
      if (!host.includes('.')) return notPublic
    }
  }
  url.hash = ''
  return { ok: true, url }
}

function ipv4Octets(host: string): number[] | null {
  const parts = host.split('.')
  if (parts.length !== 4 || !parts.every((p) => /^\d{1,3}$/.test(p))) return null
  const nums = parts.map(Number)
  return nums.every((n) => n <= 255) ? nums : null
}

function isBlockedIPv4([a, b, c]: number[]): boolean {
  return (
    a === 0 || // "this network"
    a === 10 || // private
    a === 127 || // loopback
    (a === 100 && b >= 64 && b <= 127) || // shared address space (CGNAT)
    (a === 169 && b === 254) || // link-local
    (a === 172 && b >= 16 && b <= 31) || // private
    (a === 192 && b === 168) || // private
    (a === 192 && b === 0 && (c === 0 || c === 2)) || // IETF protocol / TEST-NET-1
    (a === 198 && (b === 18 || b === 19)) || // benchmarking
    (a === 198 && b === 51 && c === 100) || // TEST-NET-2
    (a === 203 && b === 0 && c === 113) || // TEST-NET-3
    a >= 224 // multicast, reserved, broadcast
  )
}

function ipv6Groups(raw: string): number[] | null {
  let h = raw.toLowerCase()
  const lastColon = h.lastIndexOf(':')
  if (lastColon < 0) return null
  const tail = h.slice(lastColon + 1)
  if (tail.includes('.')) {
    const o = ipv4Octets(tail)
    if (!o) return null
    h = `${h.slice(0, lastColon + 1)}${((o[0] << 8) | o[1]).toString(16)}:${((o[2] << 8) | o[3]).toString(16)}`
  }
  const halves = h.split('::')
  if (halves.length > 2) return null
  const parse = (s: string) => (s === '' ? [] : s.split(':').map((x) => (/^[0-9a-f]{1,4}$/.test(x) ? parseInt(x, 16) : Number.NaN)))
  const head = parse(halves[0])
  const rest = halves.length === 2 ? parse(halves[1]) : []
  if ([...head, ...rest].some((n) => Number.isNaN(n))) return null
  if (halves.length === 1) return head.length === 8 ? head : null
  const fill = 8 - head.length - rest.length
  if (fill < 1) return null
  return [...head, ...new Array<number>(fill).fill(0), ...rest]
}

function isBlockedIPv6(g: number[]): boolean {
  const zeroUntil = (n: number) => g.slice(0, n).every((x) => x === 0)
  const embeddedV4 = (hi: number, lo: number) => isBlockedIPv4([hi >> 8, hi & 0xff, lo >> 8, lo & 0xff])
  if (zeroUntil(8)) return true // unspecified
  if (zeroUntil(7) && g[7] === 1) return true // loopback
  if ((g[0] & 0xfe00) === 0xfc00) return true // unique local fc00::/7
  if ((g[0] & 0xffc0) === 0xfe80) return true // link-local fe80::/10
  if ((g[0] & 0xffc0) === 0xfec0) return true // site-local (deprecated)
  if ((g[0] & 0xff00) === 0xff00) return true // multicast
  if (g[0] === 0x2001 && g[1] === 0x0db8) return true // documentation
  if (zeroUntil(5) && g[5] === 0xffff) return embeddedV4(g[6], g[7]) // IPv4-mapped
  if (zeroUntil(6)) return embeddedV4(g[6], g[7]) // IPv4-compatible (deprecated)
  if (g[0] === 0x64 && g[1] === 0xff9b && g.slice(2, 6).every((x) => x === 0)) return embeddedV4(g[6], g[7]) // NAT64
  if (g[0] === 0x2002) return embeddedV4(g[1], g[2]) // 6to4
  return false
}

// ─── Retry eligibility ───────────────────────────────────────────────────────

type DocState = 'settled' | 'in_flight' | 'retryable'

function isStale(doc: Pick<KnowledgeDocumentRow, 'updated_at'>, now: number): boolean {
  const updated = Date.parse(doc.updated_at)
  return !Number.isFinite(updated) || now - updated > STALE_PROCESSING_MS
}

/** A row inserted and never touched since: an upload waiting for its first processing run. */
function isUnclaimed(doc: Pick<KnowledgeDocumentRow, 'updated_at' | 'created_at'>): boolean {
  return doc.updated_at === doc.created_at
}

function retryState(doc: KnowledgeDocumentRow, now: number): DocState {
  if (doc.status === 'failed') return 'retryable'
  if (doc.status === 'ready') return doc.attached_at ? 'settled' : 'retryable'
  return isStale(doc, now) ? 'retryable' : 'in_flight'
}

/** An attached document whose search index failed: a retry re-indexes it. */
function ragRetryable(doc: KnowledgeDocumentRow): boolean {
  return doc.status === 'ready' && !!doc.attached_at && !!doc.elevenlabs_doc_id && doc.rag_status === 'failed'
}

export function toDocumentView(doc: KnowledgeDocumentRow, now = Date.now()): KnowledgeDocumentView {
  const { pending_storage_path: _pending, content_excerpt: _excerpt, ...visible } = doc as KnowledgeDocumentRow & {
    pending_storage_path?: unknown
    content_excerpt?: unknown
  }
  const can_retry = !doc.deleting_at && (retryState(doc, now) === 'retryable' || ragRetryable(doc))
  return { ...visible, can_retry }
}

// ─── Errors ──────────────────────────────────────────────────────────────────

/** A processing failure whose message is safe to show (and store) as is. */
export class KnowledgeError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'KnowledgeError'
  }
}

const PROCESS_FAILED = 'Processing failed. Please try again.'
const ATTACH_FAILED = 'The document was uploaded but could not be added to your agent. Please retry.'
const FILE_REJECTED = 'The document could not be read. Check that it is not empty, password-protected or damaged.'
const URL_REJECTED = 'This web page could not be imported. Check that it is public and reachable.'
const UPLOAD_MISSING = 'The upload did not complete. Please upload the file again.'

function failureMessage(err: unknown, doc: KnowledgeDocumentRow): string {
  let message = PROCESS_FAILED
  if (err instanceof KnowledgeError) message = err.message
  else if (isProviderError(err)) {
    message =
      err.code === 'validation' && err.operation.startsWith('kb.create')
        ? doc.type === 'url' ? URL_REJECTED : FILE_REJECTED
        : err.safeMessage
  }
  return message.slice(0, 300)
}

// ─── Database helpers (admin client, always scoped by org) ───────────────────

async function loadDoc(db: SupabaseClient, orgId: string, docId: string): Promise<KnowledgeDocumentRow> {
  const { data, error } = await db
    .from('knowledge_documents')
    .select(KNOWLEDGE_DOC_COLUMNS)
    .eq('id', docId)
    .eq('org_id', orgId)
    .maybeSingle()
  if (error) throw new Error(`knowledge_documents read failed: ${error.message}`)
  if (!data) throw new RequestError('not_found', 'Document not found.', 404)
  return data as unknown as KnowledgeDocumentRow
}

/** Updates the row; null when it no longer exists (deleted meanwhile). */
async function patchDoc(
  db: SupabaseClient,
  orgId: string,
  docId: string,
  patch: Record<string, unknown>,
): Promise<KnowledgeDocumentRow | null> {
  const { data, error } = await db
    .from('knowledge_documents')
    .update(patch)
    .eq('id', docId)
    .eq('org_id', orgId)
    .select(KNOWLEDGE_DOC_COLUMNS)
    .maybeSingle()
  if (error) throw new Error(`knowledge_documents update failed: ${error.message}`)
  return (data as unknown as KnowledgeDocumentRow | null) ?? null
}

const DELETED = () => new RequestError('not_found', 'This document was deleted.', 404)

/**
 * Takes ownership of a processing run. The update only matches if nobody
 * touched the row since we read it (updated_at changes on every write).
 */
async function claim(db: SupabaseClient, orgId: string, doc: KnowledgeDocumentRow): Promise<KnowledgeDocumentRow> {
  const { data, error } = await db
    .from('knowledge_documents')
    .update({ status: 'processing', error_message: null })
    .eq('id', doc.id)
    .eq('org_id', orgId)
    .eq('updated_at', doc.updated_at)
    .select(KNOWLEDGE_DOC_COLUMNS)
  if (error) throw new Error(`knowledge_documents claim failed: ${error.message}`)
  const row = (data as unknown as KnowledgeDocumentRow[] | null)?.[0]
  if (!row) throw new RequestError('conflict', 'This document is already being processed.', 409)
  return row
}

// ─── Sources ─────────────────────────────────────────────────────────────────

type Source =
  | { kind: 'file'; blob: Blob; filename: string; size: number }
  | { kind: 'text'; text: string; size: number }
  | { kind: 'url'; url: string }

export async function readCapped(stream: ReadableStream<Uint8Array>, max: number): Promise<Uint8Array<ArrayBuffer>> {
  const reader = stream.getReader()
  const chunks: Uint8Array[] = []
  let total = 0
  for (;;) {
    const { done, value } = await reader.read()
    if (done) break
    total += value.byteLength
    if (total > max) {
      await reader.cancel()
      throw new KnowledgeError('The file is larger than 20 MB.')
    }
    chunks.push(value)
  }
  const out = new Uint8Array(total)
  let offset = 0
  for (const c of chunks) {
    out.set(c, offset)
    offset += c.byteLength
  }
  return out
}

async function downloadObject(db: SupabaseClient, orgId: string, path: string, log: Logger): Promise<Uint8Array<ArrayBuffer>> {
  if (!isOrgStoragePath(orgId, path)) {
    // Only reachable if the row was edited outside this API: never read another org's folder.
    log.error('knowledge.storage_path_outside_org', undefined, { orgId })
    throw new KnowledgeError(UPLOAD_MISSING)
  }
  const { data, error } = await db.storage
    .from(KNOWLEDGE_BUCKET)
    .download(path, {}, { signal: AbortSignal.timeout(STORAGE_DOWNLOAD_TIMEOUT_MS) })
    .asStream()
  if (error) {
    const status = Number(error.status ?? error.statusCode ?? 0)
    if (status === 400 || status === 404) throw new KnowledgeError(UPLOAD_MISSING)
    throw new Error(`storage download failed: ${error.message}`)
  }
  return readCapped(data as ReadableStream<Uint8Array>, KNOWLEDGE_MAX_FILE_BYTES)
}

async function loadSource(db: SupabaseClient, orgId: string, doc: KnowledgeDocumentRow, log: Logger): Promise<Source> {
  if (doc.type === 'url') {
    const check = checkPublicUrl(doc.url ?? '')
    if (!check.ok) throw new KnowledgeError(check.reason)
    return { kind: 'url', url: check.url.href }
  }
  if (!doc.storage_path) {
    throw new KnowledgeError(doc.type === 'text' ? 'The text of this document is missing. Please add it again.' : UPLOAD_MISSING)
  }
  const bytes = await downloadObject(db, orgId, doc.storage_path, log)
  if (doc.type === 'text') {
    const problem = validateContent('text', bytes)
    if (problem) throw new KnowledgeError(problem)
    return { kind: 'text', text: (decodeUtf8(bytes) ?? '').replace(/^﻿/, ''), size: bytes.byteLength }
  }
  const info = fileTypeForKind(doc.type)
  if (!info) throw new KnowledgeError('This file type is not supported.')
  const problem = validateContent(info.kind, bytes)
  if (problem) throw new KnowledgeError(problem)
  return {
    kind: 'file',
    blob: new Blob([bytes], { type: info.mime }),
    filename: safeFileName(doc.name, info.ext),
    size: bytes.byteLength,
  }
}

// ─── Agent attachment ────────────────────────────────────────────────────────

const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms))

/**
 * Pushes the agent config (which now lists the document) to ElevenLabs.
 * When another request holds the sync lease, that holder re-pushes because
 * the revision moved; we wait until a push at or after our revision landed.
 */
export async function attachToAgent(db: SupabaseClient, orgId: string, agentId: string, log: Logger): Promise<void> {
  let revision = await bumpRevision(agentId)
  let healed = false
  for (let round = 0; round < ATTACH_MAX_ROUNDS; round++) {
    const results = await syncAgent(agentId, { providers: ['elevenlabs'], log })
    const r = results.find((x) => x.provider === 'elevenlabs')
    if (!r) throw new KnowledgeError('Your agent could not be found.')
    if (r.status === 'ready') return
    if (r.status === 'skipped') {
      throw new ProviderError({ system: 'elevenlabs', operation: 'agent.sync', code: 'not_configured' })
    }
    if (r.status === 'failed' || r.status === 'degraded') {
      // A locator for a document the provider no longer has can fail the whole
      // agent update: drop such documents from the spec once, then retry.
      if (r.errorCode === 'validation' && !healed) {
        healed = true
        const removed = await healMissingDocuments(db, orgId, agentId, log)
        if (removed > 0) {
          revision = await bumpRevision(agentId)
          continue
        }
      }
      log.warn('knowledge.attach_sync_unsuccessful', { agentId, status: r.status, errorCode: r.errorCode })
      throw new KnowledgeError(r.error ? `${ATTACH_FAILED} (${r.error})`.slice(0, 300) : ATTACH_FAILED)
    }
    // 'in_progress' (or 'pending'): check whether the lease holder already pushed our revision.
    const { data, error } = await db
      .from('agent_provider_resources')
      .select('status, synced_revision')
      .eq('org_id', orgId)
      .eq('agent_id', agentId)
      .eq('provider', 'elevenlabs')
      .maybeSingle()
    if (error) throw new Error(`agent_provider_resources read failed: ${error.message}`)
    if (data?.status === 'ready' && Number(data.synced_revision ?? 0) >= revision) return
    await sleep(ATTACH_WAIT_MS)
  }
  throw new KnowledgeError('Your agent is busy with another update. Please retry in a moment.')
}

// ─── Post-ready (non-fatal) ──────────────────────────────────────────────────

const ENTITIES: Record<string, string> = {
  amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ',
  ndash: '–', mdash: '—', hellip: '…', lsquo: '‘', rsquo: '’', ldquo: '“', rdquo: '”',
  euro: '€', pound: '£', copy: '©', reg: '®', trade: '™', middot: '·', bull: '•', deg: '°',
}

/** Extracted document content (HTML or Markdown) → bounded plain text. */
export function toPlainText(content: string): string {
  return content
    .replace(/<(script|style|noscript|template)\b[^>]*>[\s\S]*?<\/\1\s*>/gi, ' ')
    .replace(/<!--[\s\S]*?-->/g, ' ')
    .replace(/<(br|\/p|\/div|\/li|\/tr|\/h[1-6]|\/section|\/article|\/blockquote)\b[^>]*>/gi, '\n')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (m, code: string) => {
      const lower = code.toLowerCase()
      if (lower.startsWith('#x')) return safeCodePoint(parseInt(lower.slice(2), 16)) ?? m
      if (lower.startsWith('#')) return safeCodePoint(parseInt(lower.slice(1), 10)) ?? m
      return ENTITIES[lower] ?? m
    })
    .replace(/\p{Cc}/gu, (c) => (c === '\n' ? '\n' : ' '))
    .replace(/[ \t ]+/g, ' ')
    .replace(/ *\n */g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}

function safeCodePoint(n: number): string | null {
  if (!Number.isInteger(n) || n <= 0 || n > 0x10ffff || (n >= 0xd800 && n <= 0xdfff)) return null
  return String.fromCodePoint(n)
}

/**
 * Starts (or reads) RAG indexing for the agent's embedding model and stores
 * the state on the row, so the dashboard shows indexing progress, failures and
 * the workspace limit instead of a blanket "Ready". Non-fatal: the agent can
 * still use the document in full-context mode, and ElevenLabs also indexes
 * documents attached to a RAG-enabled agent.
 */
export async function startRagIndex(
  db: SupabaseClient,
  doc: KnowledgeDocumentRow,
  elId: string,
  language: string,
  ctx: { orgId: string; agentId: string },
  log: Logger,
): Promise<KnowledgeDocumentRow> {
  try {
    const model = ragEmbeddingModel(language)
    const res = await kb.ragIndex(elId, model, ctx)
    const status = String(res?.status ?? 'unknown')
    // document_too_small: always used in the prompt instead; the others leave RAG unavailable for this doc.
    if (status === 'failed' || status === 'rag_limit_exceeded' || status === 'cannot_index_folder') {
      log.warn('knowledge.rag_index_unavailable', { docId: doc.id, status })
    } else {
      log.info('knowledge.rag_index', { docId: doc.id, status })
    }
    const patch = ragPatch(res)
    if (doc.rag_model && doc.rag_model !== model) patch.rag_cleanup_pending = true
    return (await patchDoc(db, ctx.orgId, doc.id, patch)) ?? doc
  } catch (err) {
    log.warn('knowledge.rag_index_failed', { docId: doc.id, error: describeError(err) })
    return doc
  }
}

/** Plain-text excerpt for the fallback agent, from text we already hold or the provider's (bounded) content. */
export function excerptPatch(raw: string, truncated: boolean): Record<string, unknown> {
  const text = toPlainText(raw)
  return {
    content_excerpt: text.slice(0, KNOWLEDGE_EXCERPT_CHARS) || null,
    // Content cut at 256 KB: the real length is unknown, so record a value above
    // every prompt-mode cap (such a document can never be pinned to the prompt).
    character_count: truncated ? Math.max(text.length, EXCERPT_SOURCE_MAX_BYTES) : text.length,
  }
}

export async function storeExcerpt(
  db: SupabaseClient,
  orgId: string,
  doc: KnowledgeDocumentRow,
  elId: string,
  localText: string | null,
  ctx: { orgId: string; agentId: string },
  log: Logger,
): Promise<KnowledgeDocumentRow> {
  try {
    // At most 256 KB of the provider's copy is read: only 8,000 characters are kept.
    const source = localText !== null ? { text: localText, truncated: false } : await kb.contentPrefix(elId, { maxBytes: EXCERPT_SOURCE_MAX_BYTES }, ctx)
    const updated = await patchDoc(db, orgId, doc.id, excerptPatch(source.text, source.truncated))
    return updated ?? doc
  } catch (err) {
    // Non-fatal: the document is attached to the primary agent; only the
    // fallback agent's copy is missing until the next retry or sync.
    log.error('knowledge.excerpt_failed', err, { docId: doc.id })
    return doc
  }
}

/**
 * Stores the provider's metadata for the document (size for URL documents,
 * supported usage modes, auto-sync state). Non-fatal.
 */
export async function storeRemoteMetadata(
  db: SupabaseClient,
  doc: KnowledgeDocumentRow,
  elId: string,
  ctx: { orgId: string; agentId: string },
  log: Logger,
): Promise<KnowledgeDocumentRow> {
  try {
    const res = (await kb.summaries([elId], ctx))[elId]
    if (!res || res.status !== 'success') {
      log.warn('knowledge.metadata_unavailable', { docId: doc.id, code: res ? res.error_code : null })
      return doc
    }
    // Files and text keep the size we validated; URL pages only learn theirs here.
    const patch = summaryPatch(res.data, { includeSize: doc.type === 'url' })
    return (await patchDoc(db, ctx.orgId, doc.id, patch)) ?? doc
  } catch (err) {
    log.warn('knowledge.metadata_failed', { docId: doc.id, error: describeError(err) })
    return doc
  }
}

/**
 * Re-indexes a document whose RAG index failed: deletes the failed index
 * (re-requesting would only return it) and starts a new one.
 */
async function retryRagIndex(db: SupabaseClient, orgId: string, doc: KnowledgeDocumentRow, log: Logger): Promise<KnowledgeDocumentRow> {
  const elId = doc.elevenlabs_doc_id as string
  const ctx = { orgId, agentId: doc.agent_id }
  const { data: agent, error } = await db.from('agents').select('language').eq('id', doc.agent_id).eq('org_id', orgId).maybeSingle()
  if (error) throw new Error(`agents read failed: ${error.message}`)
  const language = normalizeAgentLanguage((agent?.language as string | null) ?? null)
  try {
    const { indexes } = await kb.ragIndexes(elId, ctx)
    for (const idx of indexes ?? []) {
      if (idx.status === 'failed') await kb.deleteRagIndex(elId, idx.id, ctx)
    }
  } catch (err) {
    log.warn('knowledge.rag_failed_index_cleanup_failed', { docId: doc.id, error: describeError(err) })
  }
  return startRagIndex(db, doc, elId, language, ctx, log)
}

/** Re-syncs every non-ElevenLabs provider (the Cartesia fallback) after the response. */
export function scheduleFallbackSync(agentId: string, log: Logger): void {
  deferBackground(
    (async () => {
      const providers = (await providersFor(createAdminClient(), agentId)).filter((p) => p !== 'elevenlabs')
      if (!providers.length) return
      const results = await syncAgent(agentId, { providers, log })
      for (const r of results) {
        if (r.status === 'failed' || r.status === 'degraded') {
          log.warn('knowledge.fallback_sync_unsuccessful', { agentId, provider: r.provider, status: r.status, errorCode: r.errorCode })
        }
      }
    })().catch((err: unknown) => log.error('knowledge.fallback_sync_failed', err, { agentId })),
  )
}

// ─── Entry point ─────────────────────────────────────────────────────────────

export interface ProcessOptions {
  /**
   * 'initial': first run right after the row was created/uploaded (no-op on a
   * settled row). 'retry': failed rows, abandoned runs, or documents that were
   * uploaded but never attached.
   */
  mode?: 'initial' | 'retry'
}

/**
 * Uploads (when needed) and attaches one document to the org's agent.
 * Returns the final row. Processing failures are persisted on the row
 * (status 'failed') and returned, not thrown; RequestError is thrown for
 * not-found (404) and concurrent runs (409); database failures throw.
 */
export async function processDocument(
  orgId: string,
  docId: string,
  baseLog: Logger,
  opts: ProcessOptions = {},
): Promise<KnowledgeDocumentRow> {
  const db = createAdminClient()
  const log = baseLog.child({ orgId, docId, component: 'knowledge' })
  const mode = opts.mode ?? 'initial'
  const now = Date.now()

  const loaded = await loadDoc(db, orgId, docId)
  if (loaded.deleting_at) throw new RequestError('conflict', 'This document is being deleted.', 409)
  const state = retryState(loaded, now)
  if (mode === 'initial') {
    if (loaded.status !== 'processing') return loaded
    const fresh = isUnclaimed(loaded) && !loaded.elevenlabs_doc_id
    if (!fresh && !isStale(loaded, now)) throw new RequestError('conflict', 'This document is already being processed.', 409)
  } else {
    if (state === 'settled') return ragRetryable(loaded) ? retryRagIndex(db, orgId, loaded, log) : loaded
    if (state === 'in_flight') throw new RequestError('conflict', 'This document is already being processed.', 409)
  }

  let doc = await claim(db, orgId, loaded)
  const started = Date.now()

  let elId: string | null = doc.elevenlabs_doc_id
  let localText: string | null = null
  let agentId = doc.agent_id
  let language = 'en'
  try {
    const { data: agent, error: agentErr } = await db
      .from('agents')
      .select('id, language')
      .eq('id', doc.agent_id)
      .eq('org_id', orgId)
      .maybeSingle()
    if (agentErr) throw new Error(`agents read failed: ${agentErr.message}`)
    if (!agent) throw new KnowledgeError('Your agent could not be found.')
    agentId = agent.id as string
    language = normalizeAgentLanguage(agent.language as string | null)
    const ctx = { orgId, agentId }

    // A document uploaded earlier may have been removed upstream: re-upload it
    // then. Checked with the light summaries endpoint (no document content).
    if (elId) {
      const check = (await kb.summaries([elId], ctx))[elId]
      if (kb.isMissing(check)) {
        log.warn('knowledge.remote_missing_reuploading', { elevenlabsDocId: elId })
        elId = null
        doc = (await patchDoc(db, orgId, doc.id, { elevenlabs_doc_id: null, attached_at: null, elevenlabs_folder_id: null, rag_status: null, rag_index_id: null })) ?? doc
      } else if (!check || check.status !== 'success') {
        throw new ProviderError({ system: 'elevenlabs', operation: 'kb.summaries', code: check ? 'upstream' : 'bad_response', status: check?.error_code ?? null })
      }
    }

    if (!elId) {
      const source = await loadSource(db, orgId, doc, log)
      if (source.kind === 'file' && source.size > Number(doc.size_bytes ?? 0)) {
        // The browser declared a smaller size than it uploaded: re-check the budget with the real one.
        const usage = await orgKnowledgeUsage(db, orgId, KNOWLEDGE_MAX_DOCS_PER_AGENT)
        try {
          assertBytesFit(usage, source.size - Number(doc.size_bytes ?? 0))
        } catch (err) {
          throw new KnowledgeError(err instanceof Error ? err.message : 'Your knowledge base is full.')
        }
      }
      const created = await createRemote(db, orgId, doc, source, ctx, log)
      elId = created.id
      if (source.kind === 'text') localText = source.text

      const stored = await patchDoc(db, orgId, doc.id, {
        elevenlabs_doc_id: elId,
        elevenlabs_folder_id: created.folderId,
        ...(source.kind !== 'url' ? { size_bytes: source.size } : { auto_sync: true, sync_frequency_days: syncFrequencyDays() }),
      })
      if (!stored) {
        // Deleted while we uploaded: do not leave an orphan upstream.
        log.warn('knowledge.deleted_during_processing', { elevenlabsDocId: elId })
        await el.knowledgeBase.delete(elId, true, ctx).catch((err: unknown) => {
          log.error('knowledge.orphan_delete_failed', err, { elevenlabsDocId: elId })
        })
        throw DELETED()
      }
      doc = stored
      log.info('knowledge.uploaded', { elevenlabsDocId: elId, type: doc.type })
    }

    await attachToAgent(db, orgId, agentId, log)
    const at = new Date().toISOString()
    const ready = await patchDoc(db, orgId, doc.id, { status: 'ready', attached_at: at, last_synced_at: at, error_message: null })
    if (!ready) throw DELETED()
    doc = ready
  } catch (err) {
    if (err instanceof RequestError) throw err
    const attempt = (doc.attempt_count ?? 0) + 1
    log.error('knowledge.process_failed', err, { attempt, mode, elevenlabsDocId: elId, durationMs: Date.now() - started })
    const failed = await patchDoc(db, orgId, doc.id, {
      status: 'failed',
      error_message: failureMessage(err, doc),
      attempt_count: attempt,
    })
    if (!failed) throw DELETED()
    return failed
  }

  log.info('knowledge.attached', { elevenlabsDocId: elId, durationMs: Date.now() - started })
  const ctx = { orgId, agentId }
  doc = await startRagIndex(db, doc, elId, language, ctx, log)
  doc = await storeRemoteMetadata(db, doc, elId, ctx, log)
  doc = await storeExcerpt(db, orgId, doc, elId, localText, ctx, log)
  scheduleFallbackSync(agentId, log)
  return doc
}

/**
 * Creates the provider copy inside the organization's folder (at the root when
 * the folder cannot be obtained; maintenance moves it later). URL documents
 * are created with weekly auto-sync and never auto-removed.
 */
async function createRemote(
  db: SupabaseClient,
  orgId: string,
  doc: KnowledgeDocumentRow,
  source: Source,
  ctx: { orgId: string; agentId: string },
  log: Logger,
): Promise<{ id: string; folderId: string | null }> {
  let folderId: string | null = null
  try {
    folderId = await ensureOrgFolder(orgId, log, db)
  } catch (err) {
    log.error('knowledge.folder_unavailable', err)
  }
  const name = cleanDisplayName(doc.name) || 'Document'
  const create = (parent: string | null) =>
    source.kind === 'file'
      ? el.knowledgeBase.createFromFile(source.blob, source.filename, name, ctx, parent)
      : source.kind === 'text'
        ? el.knowledgeBase.createFromText({ text: source.text, name, ...(parent ? { parent_folder_id: parent } : {}) }, ctx)
        : el.knowledgeBase.createFromUrl(
            {
              url: source.url,
              name,
              ...(parent ? { parent_folder_id: parent } : {}),
              enable_auto_sync: true,
              auto_remove: false,
              minimum_frequency_days: syncFrequencyDays(),
            },
            ctx,
          )
  let created: el.ELDocumentRef
  try {
    created = await create(folderId)
  } catch (err) {
    // The folder was deleted out of band: forget it and create at the root (nothing was created).
    if (!folderId || !(isProviderError(err) && err.code === 'not_found')) throw err
    log.warn('knowledge.folder_missing_creating_at_root', { folderId })
    await forgetOrgFolder(orgId, folderId, log, db)
    folderId = null
    created = await create(null)
  }
  if (!created || typeof created.id !== 'string' || !created.id) {
    throw new ProviderError({ system: 'elevenlabs', operation: 'kb.create', code: 'bad_response' })
  }
  return { id: created.id, folderId }
}

/** New object id for a document (also used as the row id, so logs line up). */
export function newDocumentId(): string {
  return crypto.randomUUID()
}

/**
 * Capacity check before adding knowledge: the document count (website pages
 * included), the organization's byte budget for `incomingBytes` more, and —
 * when a logger is given — the shared workspace's RAG quota. Throws a
 * RequestError (409 full / 503 paused) with a message for the owner.
 */
export async function assertDocumentCapacity(
  supabase: SupabaseClient,
  orgId: string,
  _agentId: string,
  opts: { incomingBytes?: number; incomingDocs?: number; log?: Logger } = {},
): Promise<void> {
  const usage = await orgKnowledgeUsage(supabase, orgId, KNOWLEDGE_MAX_DOCS_PER_AGENT)
  assertDocumentsFit(usage, opts.incomingDocs ?? 1)
  assertBytesFit(usage, opts.incomingBytes ?? 0)
  if (opts.log) await assertWorkspaceRagHeadroom(opts.log)
}
