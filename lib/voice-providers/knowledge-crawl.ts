import 'server-only'
// Website imports: ElevenLabs crawls the organization's site into a folder of
// URL documents (kept in sync weekly), and the folder is attached to the agent
// as one RAG locator {type: 'folder'}.
//
// Safety rules:
//   • the owner confirms they own or are authorised for the site; the consent
//     (who, when, domain) is written to audit_log BEFORE the crawl starts;
//   • the seed must be a public http(s) address (checkPublicUrl) and the
//     crawl is restricted to the same host (pattern) and to a hard page cap
//     (ELEVENLABS_CRAWL_MAX_PAGES, ≤ 50; the provider default is 1,000);
//   • one running crawl per organization (unique index), at most
//     KNOWLEDGE_MAX_WEBSITES imports, and the byte/document budgets reserve
//     the page cap while the crawl runs;
//   • the crawl job id is read from the organization's own row only: the
//     provider's job listing covers every tenant and is never used;
//   • the deprecated max_depth is never sent; auto_remove stays false;
//     auto_discover stays false (the page set only changes on re-import).

import type { SupabaseClient } from '@supabase/supabase-js'
import { createAdminClient } from '@/lib/supabase/admin'
import * as el from '@/lib/elevenlabs/client'
import * as kb from '@/lib/elevenlabs/api/knowledge'
import { RequestError } from '@/lib/api/http'
import { describeError, type Logger } from '@/lib/observability/logger'
import { deferBackground } from '@/lib/observability/telemetry'
import { bumpRevision, syncAgent } from './agent-sync'
import { isProviderError, ProviderError } from './errors'
import { ensureOrgFolder, forgetOrgFolder } from './knowledge-folders'
import {
  KNOWLEDGE_MAX_WEBSITES,
  assertBytesFit,
  assertDocumentsFit,
  crawlMaxPages,
  orgKnowledgeUsage,
  syncFrequencyDays,
  CRAWL_RESERVED_BYTES_PER_PAGE,
} from './knowledge-limits'
import { agentEmbeddingModel, assertWorkspaceRagHeadroom, indexFolderPages } from './knowledge-rag'
import {
  KNOWLEDGE_EXCERPT_CHARS,
  KNOWLEDGE_MAX_DOCS_PER_AGENT,
  attachToAgent,
  checkPublicUrl,
  scheduleFallbackSync,
  toPlainText,
} from './knowledge'

export type CrawlRowStatus = 'starting' | 'queued' | 'processing' | 'succeeded' | 'failed' | 'skipped' | 'cancelled' | 'deleting'
export const ACTIVE_CRAWL_STATUSES: readonly CrawlRowStatus[] = ['starting', 'queued', 'processing']

export const CRAWL_COLUMNS =
  'id, org_id, agent_id, seed_url, host, max_pages, status, crawl_job_id, root_folder_id, pages_identified, pages_scraped, pages_skipped, pages_failed, page_count, size_bytes, rag_status, rag_progress, rag_model, rag_cleanup_pending, sync_failures, error_message, consent_at, attached_at, finished_at, last_checked_at, created_at, updated_at'

export interface CrawlRow {
  id: string
  org_id: string
  agent_id: string
  seed_url: string
  host: string
  max_pages: number
  status: CrawlRowStatus
  crawl_job_id: string | null
  root_folder_id: string | null
  pages_identified: number
  pages_scraped: number
  pages_skipped: number
  pages_failed: number
  page_count: number
  size_bytes: number
  rag_status: string | null
  rag_progress: number | null
  rag_model: string | null
  rag_cleanup_pending: boolean
  sync_failures: number
  error_message: string | null
  consent_at: string | null
  attached_at: string | null
  finished_at: string | null
  last_checked_at: string | null
  created_at: string
  updated_at: string
}

/** What the browser sees: no provider ids. */
export type CrawlView = Omit<CrawlRow, 'org_id' | 'agent_id' | 'crawl_job_id' | 'root_folder_id' | 'rag_model' | 'rag_cleanup_pending' | 'last_checked_at'>

export function toCrawlView(row: CrawlRow): CrawlView {
  const {
    org_id: _org,
    agent_id: _agent,
    crawl_job_id: _job,
    root_folder_id: _root,
    rag_model: _model,
    rag_cleanup_pending: _cleanup,
    last_checked_at: _checked,
    ...view
  } = row
  return view
}

/** Minimum time between two status reads of the same crawl. */
const POLL_MIN_MS = 10_000
/** A crawl still running after this long is cancelled. */
const CRAWL_MAX_AGE_MS = 6 * 3_600_000
/** A row stuck in 'starting' (the request died before the provider answered). */
const STARTING_MAX_AGE_MS = 10 * 60_000
const EXCERPT_PAGES = 3
const EXCERPT_PAGE_BYTES = 64 * 1024

const NO_PAGES = 'No page of this website could be read. Check that it is public and that robots.txt allows ElevenlabsBot.'
const CRAWL_FAILED = 'The website could not be imported. Check that it is public and reachable, then try again.'
const CRAWL_TIMEOUT = 'The website import took too long and was stopped. Try again later.'
const CRAWL_LOST = 'The website import could not be completed. Please import the website again.'

// ─── Pattern ─────────────────────────────────────────────────────────────────

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

/**
 * Same-host restriction for the crawl. The pattern syntax is not documented
 * by the provider, so it is configurable (ELEVENLABS_CRAWL_PATTERN_SYNTAX):
 *   regex (default): anchored, so it holds whether the provider searches or
 *                    fully matches; allows http/https and the www. variant;
 *   glob:            *://host/* ;
 *   off:             no pattern (rely on the provider's default scope).
 * Both regex and glob fail safe if the provider expects the other syntax:
 * the crawl then imports little or nothing, never another site.
 */
export function crawlPattern(url: URL, syntax = (process.env.ELEVENLABS_CRAWL_PATTERN_SYNTAX ?? 'regex').trim().toLowerCase()): string | null {
  const host = url.hostname.toLowerCase().replace(/\.$/, '')
  if (syntax === 'off') return null
  if (syntax === 'glob') return `*://${host}/*`
  const bare = host.startsWith('www.') ? host.slice(4) : host
  return `^https?://(?:www\\.)?${escapeRegex(bare)}(?::\\d+)?(?:[/?#].*)?$`
}

// ─── Rows ────────────────────────────────────────────────────────────────────

async function patchCrawl(db: SupabaseClient, row: Pick<CrawlRow, 'id' | 'org_id'>, patch: Record<string, unknown>, onlyIfStatus?: CrawlRowStatus): Promise<CrawlRow | null> {
  let q = db.from('knowledge_crawls').update(patch).eq('id', row.id).eq('org_id', row.org_id)
  if (onlyIfStatus) q = q.eq('status', onlyIfStatus)
  const { data, error } = await q.select(CRAWL_COLUMNS)
  if (error) throw new Error(`knowledge_crawls update failed: ${error.message}`)
  return ((data as unknown as CrawlRow[] | null) ?? [])[0] ?? null
}

export async function loadCrawl(db: SupabaseClient, orgId: string, crawlId: string): Promise<CrawlRow | null> {
  const { data, error } = await db.from('knowledge_crawls').select(CRAWL_COLUMNS).eq('id', crawlId).eq('org_id', orgId).maybeSingle()
  if (error) throw new Error(`knowledge_crawls read failed: ${error.message}`)
  return (data as unknown as CrawlRow | null) ?? null
}

/** Ends rows left in 'starting' by a request that died (they would block new imports). */
async function failStaleStarting(db: SupabaseClient, orgId: string, log: Logger): Promise<void> {
  const cutoff = new Date(Date.now() - STARTING_MAX_AGE_MS).toISOString()
  const { error } = await db
    .from('knowledge_crawls')
    .update({ status: 'failed', error_message: CRAWL_LOST, finished_at: new Date().toISOString() })
    .eq('org_id', orgId)
    .eq('status', 'starting')
    .lt('created_at', cutoff)
  if (error) log.error('knowledge.crawl_stale_starting_failed', error)
}

// ─── Start ───────────────────────────────────────────────────────────────────

export interface StartCrawlInput {
  /** User-scoped client (RLS) for capacity reads. */
  supabase: SupabaseClient
  orgId: string
  agentId: string
  userId: string
  url: string
  log: Logger
}

/**
 * Starts a website import. Throws RequestError for anything the owner can fix
 * (invalid address, full knowledge base, an import already running) and
 * provider errors as ProviderError; the row records failures.
 */
export async function startWebsiteImport(input: StartCrawlInput): Promise<CrawlRow> {
  const { supabase, orgId, agentId, userId, log } = input
  const check = checkPublicUrl(input.url)
  if (!check.ok) throw new RequestError('invalid_request', check.reason, 400)
  if (!el.isConfigured()) throw new ProviderError({ system: 'elevenlabs', operation: 'kb.crawl_create', code: 'not_configured' })
  const seed = check.url
  const host = seed.hostname.toLowerCase().replace(/\.$/, '')
  const maxPages = crawlMaxPages()
  const db = createAdminClient()

  await failStaleStarting(db, orgId, log)
  const { data: existing, error: existingErr } = await supabase
    .from('knowledge_crawls')
    .select('id, host, status')
    .eq('org_id', orgId)
    .neq('status', 'deleting')
  if (existingErr) throw new Error(`knowledge_crawls read failed: ${existingErr.message}`)
  const rows = existing ?? []
  if (rows.some((r) => (ACTIVE_CRAWL_STATUSES as readonly string[]).includes(String(r.status)))) {
    throw new RequestError('conflict', 'A website import is already running. Wait until it finishes.', 409)
  }
  if (rows.some((r) => r.host === host && r.status === 'succeeded')) {
    throw new RequestError('conflict', 'This website is already imported. Remove it first to import it again.', 409)
  }
  if (rows.filter((r) => r.status === 'succeeded').length >= KNOWLEDGE_MAX_WEBSITES) {
    throw new RequestError('conflict', `You can import up to ${KNOWLEDGE_MAX_WEBSITES} websites. Remove one to import another.`, 409)
  }
  const usage = await orgKnowledgeUsage(supabase, orgId, KNOWLEDGE_MAX_DOCS_PER_AGENT)
  assertDocumentsFit(usage, maxPages)
  assertBytesFit(usage, maxPages * CRAWL_RESERVED_BYTES_PER_PAGE)
  await assertWorkspaceRagHeadroom(log)

  const consentAt = new Date().toISOString()
  const { data: inserted, error: insertErr } = await db
    .from('knowledge_crawls')
    .insert({
      org_id: orgId,
      agent_id: agentId,
      seed_url: seed.href,
      host,
      max_pages: maxPages,
      status: 'starting',
      consent_user_id: userId,
      consent_at: consentAt,
    })
    .select(CRAWL_COLUMNS)
    .single()
  if (insertErr) {
    if (insertErr.code === '23505') throw new RequestError('conflict', 'A website import is already running. Wait until it finishes.', 409)
    throw new Error(`knowledge_crawls insert failed: ${insertErr.message}`)
  }
  let row = inserted as unknown as CrawlRow
  const rowLog = log.child({ crawlId: row.id })

  // Consent is recorded before anything is fetched; without it nothing starts.
  const { error: auditErr } = await db.from('audit_log').insert({
    org_id: orgId,
    actor_user_id: userId,
    actor_kind: 'user',
    action: 'knowledge.website_import_consent',
    target_type: 'knowledge_crawl',
    target_id: row.id,
    details: { domain: host, seed_url: seed.href, max_pages: maxPages, consented_at: consentAt },
  })
  if (auditErr) {
    rowLog.error('knowledge.crawl_consent_audit_failed', auditErr)
    await patchCrawl(db, row, { status: 'failed', error_message: CRAWL_FAILED, finished_at: new Date().toISOString() })
    throw new RequestError('internal', 'The website import could not be started. Please try again.', 500)
  }

  let folderId: string | null = null
  try {
    folderId = await ensureOrgFolder(orgId, rowLog, db)
  } catch (err) {
    rowLog.error('knowledge.folder_unavailable', err)
  }

  const create = (parent: string | null) =>
    kb.createCrawl(
      {
        url: seed.href,
        max_pages: maxPages,
        pattern: crawlPattern(seed),
        ...(parent ? { parent_folder_id: parent } : {}),
        enable_auto_sync: true,
        auto_remove: false,
        auto_discover: false,
        minimum_frequency_days: syncFrequencyDays(),
      },
      { orgId, agentId },
    )
  let created: kb.CrawlJobCreated
  try {
    try {
      created = await create(folderId)
    } catch (err) {
      // The org folder was deleted out of band: forget it and crawl at the root (nothing was created).
      if (!folderId || !(isProviderError(err) && err.code === 'not_found')) throw err
      rowLog.warn('knowledge.folder_missing_crawling_at_root', { folderId })
      await forgetOrgFolder(orgId, folderId, rowLog, db)
      created = await create(null)
    }
    if (!created?.id || !created.root_folder_id) throw new ProviderError({ system: 'elevenlabs', operation: 'kb.crawl_create', code: 'bad_response' })
  } catch (err) {
    rowLog.error('knowledge.crawl_create_failed', err)
    const rejected = isProviderError(err) && err.code === 'validation'
    const message = rejected ? CRAWL_FAILED : isProviderError(err) ? err.safeMessage : CRAWL_FAILED
    await patchCrawl(db, row, { status: 'failed', error_message: message.slice(0, 300), finished_at: new Date().toISOString() })
    if (rejected) throw new RequestError('invalid_request', CRAWL_FAILED, 422)
    throw err
  }

  const status: CrawlRowStatus = created.status === 'processing' ? 'processing' : 'queued'
  const updated = await patchCrawl(db, row, { status, crawl_job_id: created.id, root_folder_id: created.root_folder_id }, 'starting')
  if (!updated) {
    // Removed while we were starting it: do not leave a running crawl behind.
    rowLog.warn('knowledge.crawl_deleted_while_starting')
    await kb.cancelCrawl(created.id, { orgId }).catch((err: unknown) => rowLog.error('knowledge.crawl_orphan_cancel_failed', err))
    throw new RequestError('not_found', 'This website import was removed.', 404)
  }
  row = updated
  rowLog.info('knowledge.crawl_started', { host, maxPages, patternSyntax: crawlPattern(seed) ? 'set' : 'off' })
  return row
}

// ─── Poll / finish ───────────────────────────────────────────────────────────

/**
 * Reads the crawl job of a running import (at most every 10 s per import,
 * claimed so concurrent pollers do not double-finish) and moves the row on.
 * Never throws for provider trouble: the row is returned unchanged.
 */
export async function pollCrawl(db: SupabaseClient, row: CrawlRow, log: Logger, opts: { force?: boolean } = {}): Promise<CrawlRow> {
  if (!(ACTIVE_CRAWL_STATUSES as readonly string[]).includes(row.status) || !row.crawl_job_id) return row
  const now = Date.now()
  const last = row.last_checked_at ? Date.parse(row.last_checked_at) : 0
  if (!opts.force && Number.isFinite(last) && now - last < POLL_MIN_MS) return row
  const claimQuery = db
    .from('knowledge_crawls')
    .update({ last_checked_at: new Date(now).toISOString() })
    .eq('id', row.id)
    .eq('org_id', row.org_id)
    .eq('status', row.status)
  const { data: claimed, error: claimErr } = await (row.last_checked_at ? claimQuery.eq('last_checked_at', row.last_checked_at) : claimQuery.is('last_checked_at', null)).select(CRAWL_COLUMNS)
  if (claimErr) throw new Error(`knowledge_crawls claim failed: ${claimErr.message}`)
  const current = ((claimed as unknown as CrawlRow[] | null) ?? [])[0]
  if (!current) return row
  const rowLog = log.child({ orgId: row.org_id, crawlId: row.id })
  const ctx = { orgId: row.org_id, agentId: row.agent_id }

  let job: kb.CrawlJob
  try {
    job = await kb.getCrawl(row.crawl_job_id, ctx)
  } catch (err) {
    if (isProviderError(err) && err.code === 'not_found') {
      rowLog.warn('knowledge.crawl_job_missing')
      return (await finishFailed(db, current, CRAWL_LOST, rowLog, true)) ?? current
    }
    rowLog.warn('knowledge.crawl_poll_failed', { error: describeError(err) })
    return current
  }

  const progress = {
    pages_identified: nonNegative(job.pages_identified),
    pages_scraped: nonNegative(job.pages_scraped),
    pages_skipped: nonNegative(job.pages_skipped),
    pages_failed: nonNegative(job.pages_failed),
  }
  const status = (kb.CRAWL_STATUSES as readonly string[]).includes(String(job.status)) ? (job.status as kb.CrawlStatus) : 'queued'
  if (status === 'queued' || status === 'processing') {
    if (now - Date.parse(current.created_at) > CRAWL_MAX_AGE_MS) {
      rowLog.warn('knowledge.crawl_timeout')
      await kb.cancelCrawl(row.crawl_job_id, ctx).catch((err: unknown) => rowLog.error('knowledge.crawl_cancel_failed', err))
      return (await finishFailed(db, { ...current, ...progress }, CRAWL_TIMEOUT, rowLog, true)) ?? current
    }
    return (await patchCrawl(db, current, { ...progress, status }, current.status)) ?? current
  }
  if (status === 'succeeded') return finishSucceeded(db, { ...current, ...progress }, rowLog)
  // failed / skipped / cancelled: free whatever was imported.
  const final = await patchCrawl(db, current, { ...progress, status: status === 'cancelled' ? 'cancelled' : status, error_message: status === 'cancelled' ? null : CRAWL_FAILED, finished_at: new Date().toISOString() }, current.status)
  if (status !== 'cancelled') await deleteRootFolder(current, rowLog)
  return final ?? current
}

function nonNegative(v: unknown): number {
  const n = Number(v)
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : 0
}

async function deleteRootFolder(row: Pick<CrawlRow, 'org_id' | 'root_folder_id'>, log: Logger): Promise<boolean> {
  if (!row.root_folder_id) return true
  try {
    await kb.deleteEntity(row.root_folder_id, true, { orgId: row.org_id })
    return true
  } catch (err) {
    if (isProviderError(err) && err.code === 'not_found') return true
    log.error('knowledge.crawl_folder_delete_failed', err)
    return false
  }
}

async function finishFailed(db: SupabaseClient, row: CrawlRow, message: string, log: Logger, removeFolder: boolean): Promise<CrawlRow | null> {
  const updated = await patchCrawl(
    db,
    row,
    {
      status: 'failed',
      error_message: message,
      finished_at: new Date().toISOString(),
      pages_identified: row.pages_identified,
      pages_scraped: row.pages_scraped,
      pages_skipped: row.pages_skipped,
      pages_failed: row.pages_failed,
    },
    row.status,
  )
  if (removeFolder) await deleteRootFolder(row, log)
  return updated
}

/**
 * The crawl finished: measure what was imported, build the fallback excerpt,
 * index the pages for the agent's embedding model and attach the folder.
 */
async function finishSucceeded(db: SupabaseClient, row: CrawlRow, log: Logger): Promise<CrawlRow> {
  const ctx = { orgId: row.org_id, agentId: row.agent_id }
  if (!row.root_folder_id) return (await finishFailed(db, row, CRAWL_LOST, log, false)) ?? row
  let pages: kb.KnowledgeSummary[]
  try {
    const listed = await kb.listFolderDocuments(row.root_folder_id, { types: ['url', 'file', 'text'], maxItems: row.max_pages + 10 }, ctx)
    pages = listed.documents
  } catch (err) {
    log.warn('knowledge.crawl_list_failed', { error: describeError(err) })
    return row
  }
  if (!pages.length) return (await finishFailed(db, row, NO_PAGES, log, true)) ?? row
  const sizeBytes = pages.reduce((sum, p) => sum + nonNegative(p.metadata?.size_bytes), 0)
  const excerpt = await crawlExcerpt(pages, ctx, log)

  let rag: { rag_status: string | null; rag_progress: number | null; rag_model?: string } = { rag_status: null, rag_progress: null }
  try {
    const model = await agentEmbeddingModel(db, row.org_id, row.agent_id)
    const state = await indexFolderPages(row.org_id, row.root_folder_id, row.max_pages, model, true)
    rag = { rag_status: state.rag_status, rag_progress: state.rag_progress, rag_model: model }
  } catch (err) {
    log.warn('knowledge.crawl_rag_failed', { error: describeError(err) })
  }

  const done = await patchCrawl(
    db,
    row,
    {
      status: 'succeeded',
      pages_identified: row.pages_identified,
      pages_scraped: row.pages_scraped,
      pages_skipped: row.pages_skipped,
      pages_failed: row.pages_failed,
      page_count: pages.length,
      size_bytes: sizeBytes,
      content_excerpt: excerpt,
      error_message: null,
      finished_at: new Date().toISOString(),
      ...rag,
    },
    row.status,
  )
  if (!done) return row
  log.info('knowledge.crawl_succeeded', { pages: pages.length, sizeBytes })

  try {
    await attachToAgent(db, row.org_id, row.agent_id, log)
    const attached = await patchCrawl(db, done, { attached_at: new Date().toISOString() }, 'succeeded')
    scheduleFallbackSync(row.agent_id, log)
    return attached ?? done
  } catch (err) {
    // The folder is in the spec; the sync engine/maintenance retries the push.
    log.error('knowledge.crawl_attach_failed', err)
    return done
  }
}

/** Plain-text excerpt of the first pages for the Cartesia fallback agent (bounded reads). */
async function crawlExcerpt(pages: kb.KnowledgeSummary[], ctx: { orgId: string; agentId: string }, log: Logger): Promise<string | null> {
  let out = ''
  for (const page of pages.slice(0, EXCERPT_PAGES)) {
    try {
      const { text } = await kb.contentPrefix(page.id, { maxBytes: EXCERPT_PAGE_BYTES }, ctx)
      const plain = toPlainText(text)
      if (plain) out += `${out ? '\n\n' : ''}${plain}`
    } catch (err) {
      log.warn('knowledge.crawl_excerpt_page_failed', { error: describeError(err) })
    }
    if (out.length >= KNOWLEDGE_EXCERPT_CHARS) break
  }
  return out.slice(0, KNOWLEDGE_EXCERPT_CHARS) || null
}

// ─── List / delete ───────────────────────────────────────────────────────────

const RAG_PENDING = ['new', 'created', 'processing']
/** Minimum time between two search-index reads of a finished import from the dashboard. */
const RAG_POLL_MIN_MS = 30_000

function lastChecked(row: CrawlRow): number {
  const last = row.last_checked_at ? Date.parse(row.last_checked_at) : 0
  return Number.isFinite(last) ? last : 0
}

function pollDue(row: CrawlRow, now: number): boolean {
  if ((ACTIVE_CRAWL_STATUSES as readonly string[]).includes(row.status)) return !!row.crawl_job_id && now - lastChecked(row) >= POLL_MIN_MS
  return ragPollDue(row, now)
}

function ragPollDue(row: CrawlRow, now: number): boolean {
  return row.status === 'succeeded' && !!row.root_folder_id && !!row.rag_status && RAG_PENDING.includes(row.rag_status) && now - lastChecked(row) >= RAG_POLL_MIN_MS
}

/** A finished import whose pages are still being indexed: read their state (no new indexes). */
async function refreshCrawlRag(db: SupabaseClient, row: CrawlRow, log: Logger): Promise<CrawlRow> {
  const claimed = await patchCrawl(db, row, { last_checked_at: new Date().toISOString() }, 'succeeded')
  if (!claimed || !row.root_folder_id) return row
  try {
    const model = await agentEmbeddingModel(db, row.org_id, row.agent_id)
    const state = await indexFolderPages(row.org_id, row.root_folder_id, row.max_pages, model, row.rag_model !== model)
    return (await patchCrawl(db, claimed, { rag_status: state.rag_status, rag_progress: state.rag_progress, rag_model: model }, 'succeeded')) ?? claimed
  } catch (err) {
    log.warn('knowledge.crawl_rag_refresh_failed', { crawlId: row.id, error: describeError(err) })
    return claimed
  }
}

/**
 * The organization's imports, with running ones refreshed (at most every 10 s
 * each). `allowPoll` is asked once, only when a provider read is actually due.
 */
export async function listWebsiteImports(orgId: string, log: Logger, opts: { allowPoll: () => Promise<boolean> }): Promise<CrawlRow[]> {
  const db = createAdminClient()
  const { data, error } = await db
    .from('knowledge_crawls')
    .select(CRAWL_COLUMNS)
    .eq('org_id', orgId)
    .order('created_at', { ascending: false })
    .limit(20)
  if (error) throw new Error(`knowledge_crawls read failed: ${error.message}`)
  const rows = (data as unknown as CrawlRow[] | null) ?? []
  const now = Date.now()
  if (!rows.some((r) => pollDue(r, now)) || !(await opts.allowPoll())) return rows
  const out: CrawlRow[] = []
  for (const r of rows) {
    try {
      out.push(ragPollDue(r, now) ? await refreshCrawlRag(db, r, log) : await pollCrawl(db, r, log))
    } catch (err) {
      log.error('knowledge.crawl_poll_error', err, { crawlId: r.id })
      out.push(r)
    }
  }
  return out
}

/**
 * Removes an import: out of the agent spec first (status 'deleting' + revision
 * bump), then the provider copy (cancel a running job, delete the folder
 * subtree), then the row; the agent is re-synced after the response. A
 * provider failure restores the previous status (502 for the caller).
 */
export async function deleteWebsiteImport(orgId: string, crawlId: string, log: Logger): Promise<void> {
  const db = createAdminClient()
  const row = await loadCrawl(db, orgId, crawlId)
  if (!row) throw new RequestError('not_found', 'Website import not found.', 404)
  const rowLog = log.child({ crawlId })
  const previous = row.status
  const marked = previous === 'deleting' ? row : await patchCrawl(db, row, { status: 'deleting' }, previous)
  if (!marked) throw new RequestError('conflict', 'This website import changed meanwhile. Please try again.', 409)
  if (previous === 'succeeded') {
    try {
      await bumpRevision(row.agent_id)
    } catch (err) {
      rowLog.error('knowledge.crawl_revision_bump_failed', err)
    }
  }

  const ctx = { orgId, agentId: row.agent_id }
  try {
    if ((ACTIVE_CRAWL_STATUSES as readonly string[]).includes(previous) && row.crawl_job_id) {
      try {
        await kb.cancelCrawl(row.crawl_job_id, ctx)
      } catch (err) {
        if (!(isProviderError(err) && err.code === 'not_found')) throw err
      }
    }
    if (row.root_folder_id) {
      try {
        await kb.deleteEntity(row.root_folder_id, true, ctx)
      } catch (err) {
        if (!(isProviderError(err) && err.code === 'not_found')) throw err
      }
    }
  } catch (err) {
    rowLog.error('knowledge.crawl_delete_remote_failed', err)
    if (previous !== 'deleting') {
      const restored = await patchCrawl(db, row, { status: previous }, 'deleting').catch((restoreErr: unknown) => {
        rowLog.error('knowledge.crawl_delete_restore_failed', restoreErr)
        return null
      })
      if (restored && previous === 'succeeded') await bumpRevision(row.agent_id).catch((bumpErr: unknown) => rowLog.error('knowledge.crawl_revision_bump_failed', bumpErr))
    }
    throw err
  }

  const { error } = await db.from('knowledge_crawls').delete().eq('id', crawlId).eq('org_id', orgId)
  if (error) throw new Error(`knowledge_crawls delete failed: ${error.message}`)
  rowLog.info('knowledge.crawl_deleted', { previous })
  if (previous === 'succeeded' || previous === 'deleting') {
    deferBackground(
      syncAgent(row.agent_id, { log: rowLog })
        .then((results) => {
          for (const r of results) {
            if (r.status === 'failed' || r.status === 'degraded') rowLog.warn('knowledge.crawl_delete_sync_unsuccessful', { provider: r.provider, status: r.status })
          }
        })
        .catch((err: unknown) => rowLog.error('knowledge.crawl_delete_sync_failed', err)),
    )
  }
}

/** Maintenance: polls running imports and finishes deletes that did not complete. */
export async function maintainWebsiteImports(limit: number, log: Logger): Promise<{ polled: number; deletesRetried: number }> {
  const db = createAdminClient()
  const { data, error } = await db
    .from('knowledge_crawls')
    .select(CRAWL_COLUMNS)
    .in('status', [...ACTIVE_CRAWL_STATUSES, 'deleting'])
    .order('last_checked_at', { ascending: true, nullsFirst: true })
    .limit(limit)
  if (error) throw new Error(`knowledge_crawls scan failed: ${error.message}`)
  let polled = 0
  let deletesRetried = 0
  for (const r of (data as unknown as CrawlRow[] | null) ?? []) {
    try {
      if (r.status === 'deleting') {
        if (Date.now() - Date.parse(r.updated_at) < 10 * 60_000) continue
        await deleteWebsiteImport(r.org_id, r.id, log)
        deletesRetried++
      } else if (r.status === 'starting') {
        await failStaleStarting(db, r.org_id, log)
      } else {
        await pollCrawl(db, r, log, { force: true })
        polled++
      }
    } catch (err) {
      log.error('maintenance.crawl_failed', err, { crawlId: r.id, orgId: r.org_id })
    }
  }
  return { polled, deletesRetried }
}
