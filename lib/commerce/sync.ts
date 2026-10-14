import 'server-only'
// Sync jobs: imports and incremental refreshes of a connection's products,
// customers, orders and carts through its adapter, one page at a time.
// A job is claimed with a lease (commerce_claim_sync_jobs), runs pages until
// its time slice is spent, persists the checkpoint after every page and
// either finishes or puts itself back to 'pending' to continue on the next
// cron tick. Failures classify as retryable (backoff with jitter) or final
// (credentials, mapping): the connection status reflects them.

import type { SupabaseClient } from '@supabase/supabase-js'
import type { Logger } from '@/lib/observability/logger'
import { adapterFor } from './adapters'
import { ConnectionError, type SyncCheckpoint } from './adapters/types'
import { CommerceCryptoError } from './crypto'
import { StoreHttpError, UnsafeUrlError } from './safe-fetch'
import { pollingMinutes } from './config'
import { applyEvents } from './events'
import { type ConnectionRow, type SyncJobRow, enqueueSyncJob, listConnections, loadConnection, readCapabilities, toAdapterConnection, writeAudit } from './store'
import type { CommerceEvent, SyncResource } from './types'

export const SYNC_LEASE_SECONDS = 120
/** Pages one job may fetch per claim (bounded request count per cron tick). */
export const MAX_PAGES_PER_SLICE = 8
const ORDERED_RESOURCES: SyncResource[] = ['products', 'customers', 'orders', 'carts']

export interface SyncOutcome {
  jobId: string
  status: 'succeeded' | 'continued' | 'failed' | 'retry'
  counts: Record<string, number>
  error?: string
}

interface Classified {
  code: string
  message: string
  retryable: boolean
}

/** Public-safe classification of a sync failure (never the raw provider body or a secret). */
export function classifySyncError(err: unknown): Classified {
  if (err instanceof ConnectionError) return { code: err.code, message: err.publicMessage, retryable: err.retryable }
  if (err instanceof CommerceCryptoError) return { code: 'credentials_unreadable', message: 'Datele de acces nu pot fi citite: reconectează magazinul.', retryable: false }
  if (err instanceof UnsafeUrlError) return { code: 'ssrf_blocked', message: 'Adresa magazinului nu este permisă.', retryable: false }
  if (err instanceof StoreHttpError) {
    if (err.code === 'timeout' || err.code === 'network') return { code: err.code, message: 'Magazinul nu a răspuns. Se reîncearcă automat.', retryable: true }
    if (err.code === 'redirect') return { code: 'redirect', message: 'Magazinul răspunde cu o redirecționare: folosește adresa finală https.', retryable: false }
    return { code: err.code, message: 'Răspuns neașteptat de la magazin. Se reîncearcă automat.', retryable: true }
  }
  const message = err instanceof Error ? err.message : String(err)
  // Database or coding errors: retry a few times, then surface.
  return { code: 'internal', message: 'Sincronizarea a întâmpinat o eroare internă. Se reîncearcă automat.', retryable: true, ...(message ? {} : {}) }
}

/** Exponential backoff with jitter: 1, 2, 4, 8... minutes (capped at 60) ± 20 %. */
export function backoffMs(attempt: number, random = Math.random): number {
  const base = Math.min(60, 2 ** Math.max(0, attempt - 1)) * 60_000
  return Math.round(base * (0.8 + random() * 0.4))
}

function readCheckpoint(raw: unknown, resource: SyncResource): SyncCheckpoint {
  const r = raw && typeof raw === 'object' && !Array.isArray(raw) ? ((raw as Record<string, unknown>)[resource] as Record<string, unknown> | undefined) : undefined
  return {
    cursor: typeof r?.cursor === 'string' ? r.cursor : null,
    modifiedAfter: typeof r?.modifiedAfter === 'string' ? r.modifiedAfter : null,
    pages: typeof r?.pages === 'number' ? r.pages : 0,
  }
}

function resourcesOf(job: SyncJobRow, connection: ConnectionRow): SyncResource[] {
  const caps = readCapabilities(connection.capabilities)
  const wanted = job.resource === 'all' ? ORDERED_RESOURCES : [job.resource]
  return wanted.filter((r) => (r === 'carts' ? caps.abandoned_carts : caps[r]))
}

function jobCursor(raw: unknown): Record<string, unknown> {
  return raw && typeof raw === 'object' && !Array.isArray(raw) ? { ...(raw as Record<string, unknown>) } : {}
}

export async function claimSyncJobs(db: SupabaseClient, owner: string, limit: number): Promise<SyncJobRow[]> {
  const { data, error } = await db.rpc('commerce_claim_sync_jobs', { p_owner: owner, p_limit: limit, p_lease_seconds: SYNC_LEASE_SECONDS })
  if (error) throw new Error(`commerce_claim_sync_jobs failed: ${error.message}`)
  return (data ?? []) as SyncJobRow[]
}

/**
 * Runs one claimed job for up to `sliceMs` (or MAX_PAGES_PER_SLICE pages).
 * The incremental watermark per resource lives on the connection
 * (sync_cursor[resource].modifiedAfter) and only moves forward once the
 * resource finished a full pass.
 */
export async function runSyncJob(db: SupabaseClient, job: SyncJobRow, log: Logger, opts: { owner: string; sliceMs: number; now?: () => number }): Promise<SyncOutcome> {
  const now = opts.now ?? Date.now
  const started = now()
  const l = log.child({ orgId: job.org_id, connectionId: job.connection_id, jobId: job.id })
  const connection = await loadConnection(db, job.connection_id)
  if (!connection || connection.status === 'disconnected' || connection.status === 'draft') {
    await finishJob(db, job, opts.owner, { status: 'cancelled', error_code: 'connection_inactive', error_message: 'Conexiunea nu mai este activă.' })
    return { jobId: job.id, status: 'failed', counts: {}, error: 'connection_inactive' }
  }
  if (job.attempts > job.max_attempts) {
    await finishJob(db, job, opts.owner, { status: 'failed', error_code: 'too_many_attempts', error_message: 'Sincronizarea a eșuat de prea multe ori.' })
    await markConnectionError(db, connection, 'sync_failed', 'Sincronizarea a eșuat repetat; verifică accesul la magazin.', l)
    return { jobId: job.id, status: 'failed', counts: {}, error: 'too_many_attempts' }
  }
  const counts: Record<string, number> = Object.fromEntries(Object.entries(jobCursor(job.counts)).filter(([, v]) => typeof v === 'number')) as Record<string, number>
  const progress = jobCursor(job.cursor)
  const connCursor = jobCursor(connection.sync_cursor)
  // Watermarks this job completed, in this or an earlier slice: merged into the connection cursor at the end.
  const watermarks: Record<string, { modifiedAfter: string }> = {}
  let pages = 0
  try {
    const adapter = adapterFor(connection.platform)
    const adapterConn = toAdapterConnection(connection)
    const mode = job.kind === 'initial' ? 'initial' : 'incremental'
    for (const resource of resourcesOf(job, connection)) {
      const earlier = progress[resource] as Record<string, unknown> | undefined
      if (earlier?.done === true) {
        // Finished in an earlier slice of this job: its watermark still has to reach the connection.
        if (typeof earlier.startedAt === 'string') watermarks[resource] = { modifiedAfter: earlier.startedAt }
        continue
      }
      let checkpoint = readCheckpoint(progress, resource)
      // An incremental pass starts from the connection's watermark for this resource.
      if (mode === 'incremental' && !checkpoint.cursor && !checkpoint.modifiedAfter) checkpoint = { ...checkpoint, modifiedAfter: readCheckpoint(connCursor, resource).modifiedAfter }
      const passStartedAt = typeof (progress[resource] as Record<string, unknown> | undefined)?.startedAt === 'string' ? String((progress[resource] as Record<string, unknown>).startedAt) : new Date(started).toISOString()
      for (;;) {
        if (pages >= MAX_PAGES_PER_SLICE || now() - started > opts.sliceMs) {
          progress[resource] = { ...checkpoint, done: false, startedAt: passStartedAt }
          await continueJob(db, job, opts.owner, progress, counts)
          return { jobId: job.id, status: 'continued', counts }
        }
        const batch = await adapter.syncPage(adapterConn, resource, checkpoint, mode, l)
        pages++
        const events: CommerceEvent[] = [
          ...(batch.products ?? []).map((product) => ({ kind: 'product.updated' as const, product })),
          ...(batch.customers ?? []).map((customer) => ({ kind: 'customer.updated' as const, customer })),
          ...(batch.orders ?? []).map((order) => ({ kind: 'order.updated' as const, order })),
          ...(batch.carts ?? []).map((cart) => ({ kind: 'cart.updated' as const, cart })),
        ]
        const applied = await applyEvents({ db, connection, log: l }, events)
        counts[resource] = (counts[resource] ?? 0) + (applied.products + applied.customers + applied.orders + applied.carts)
        checkpoint = batch.checkpoint
        progress[resource] = { ...checkpoint, done: batch.done, startedAt: passStartedAt }
        if (batch.done) {
          // The next incremental pass starts where this one began (overlap never skips a record).
          watermarks[resource] = { modifiedAfter: passStartedAt }
          break
        }
        // Persist progress after every page so a crash resumes here.
        await continueJob(db, job, opts.owner, progress, counts, { keepRunning: true })
      }
    }
    // Merged into the cursor as it is now (re-read): a job of another resource that finished meanwhile keeps its key.
    const { data: fresh, error: cursorErr } = await db.from('commerce_connections').select('sync_cursor').eq('id', connection.id).maybeSingle()
    if (cursorErr) throw new Error(`commerce_connections read failed: ${cursorErr.message}`)
    const { error } = await db
      .from('commerce_connections')
      .update({ sync_cursor: { ...jobCursor(fresh?.sync_cursor), ...watermarks }, last_sync_at: new Date().toISOString(), last_successful_sync_at: new Date().toISOString(), error_code: null, error_message: null, ...(connection.status === 'degraded' || connection.status === 'error' ? { status: 'active' } : {}) })
      .eq('id', connection.id)
    if (error) throw new Error(`commerce_connections update failed: ${error.message}`)
    await finishJob(db, job, opts.owner, { status: 'succeeded', counts })
    await writeAudit(db, { orgId: job.org_id, actor: 'cron', action: 'sync.succeeded', connectionId: connection.id, metadata: { kind: job.kind, resource: job.resource, ...counts } }, l)
    l.info('commerce.sync.succeeded', { kind: job.kind, resource: job.resource, counts })
    return { jobId: job.id, status: 'succeeded', counts }
  } catch (err) {
    const c = classifySyncError(err)
    l.error('commerce.sync.failed', err, { code: c.code, retryable: c.retryable, attempts: job.attempts })
    if (c.retryable && job.attempts < job.max_attempts) {
      const { error } = await db
        .from('commerce_sync_jobs')
        .update({ status: 'pending', run_after: new Date(now() + backoffMs(job.attempts)).toISOString(), cursor: progress, counts, error_code: c.code, error_message: c.message, lease_owner: null, lease_until: null })
        .eq('id', job.id)
        .eq('lease_owner', opts.owner)
      if (error) l.error('commerce.sync.requeue_failed', error)
      await markConnectionError(db, connection, c.code, c.message, l, 'degraded')
      return { jobId: job.id, status: 'retry', counts, error: c.code }
    }
    await finishJob(db, job, opts.owner, { status: 'failed', counts, error_code: c.code, error_message: c.message })
    await markConnectionError(db, connection, c.code, c.message, l, c.code === 'unauthorized' || c.code === 'forbidden' || c.code === 'credentials_unreadable' ? 'error' : 'degraded')
    await writeAudit(db, { orgId: job.org_id, actor: 'cron', action: 'sync.failed', connectionId: connection.id, metadata: { kind: job.kind, resource: job.resource, code: c.code } }, l)
    return { jobId: job.id, status: 'failed', counts, error: c.code }
  }
}

async function continueJob(db: SupabaseClient, job: SyncJobRow, owner: string, cursor: Record<string, unknown>, counts: Record<string, number>, opts: { keepRunning?: boolean } = {}): Promise<void> {
  // A spent slice is progress, not a failure: the claim's attempt is given back
  // (a crash never reaches here, so its lease expiring still counts as one).
  const patch = opts.keepRunning
    ? { cursor, counts }
    : { status: 'pending', run_after: new Date().toISOString(), cursor, counts, lease_owner: null, lease_until: null, attempts: Math.max(0, job.attempts - 1) }
  const { error } = await db.from('commerce_sync_jobs').update(patch).eq('id', job.id).eq('lease_owner', owner)
  if (error) throw new Error(`commerce_sync_jobs update failed: ${error.message}`)
}

async function finishJob(db: SupabaseClient, job: SyncJobRow, owner: string, patch: { status: 'succeeded' | 'failed' | 'cancelled'; counts?: Record<string, number>; error_code?: string; error_message?: string }): Promise<void> {
  const { error } = await db
    .from('commerce_sync_jobs')
    .update({ ...patch, finished_at: new Date().toISOString(), lease_owner: null, lease_until: null })
    .eq('id', job.id)
    .eq('lease_owner', owner)
  if (error) throw new Error(`commerce_sync_jobs finish failed: ${error.message}`)
}

async function markConnectionError(db: SupabaseClient, connection: ConnectionRow, code: string, message: string, log: Logger, status: 'degraded' | 'error' = 'degraded'): Promise<void> {
  const { error } = await db
    .from('commerce_connections')
    .update({ error_code: code, error_message: message, last_sync_at: new Date().toISOString(), ...(connection.status === 'active' || connection.status === 'degraded' || connection.status === 'error' ? { status } : {}) })
    .eq('id', connection.id)
  if (error) log.error('commerce.connection_error_update_failed', error)
}

/**
 * Keeps every active connection fresh: an incremental 'all' job when the
 * last sync is older than the platform's polling interval (webhook-capable
 * stores get an hourly safety net). Never more than one job per connection.
 */
export async function schedulePollingJobs(db: SupabaseClient, log: Logger, now = Date.now()): Promise<number> {
  const { data, error } = await db.from('commerce_connections').select('id, org_id, status, capabilities, last_sync_at').in('status', ['active', 'degraded']).limit(500)
  if (error) throw new Error(`commerce_connections read failed: ${error.message}`)
  let queued = 0
  for (const row of data ?? []) {
    const caps = readCapabilities(row.capabilities)
    const minutes = caps.webhooks ? 60 : (caps.polling_minutes ?? pollingMinutes())
    const last = row.last_sync_at ? Date.parse(String(row.last_sync_at)) : 0
    if (now - last < minutes * 60_000) continue
    const res = await enqueueSyncJob(db, { orgId: String(row.org_id), connectionId: String(row.id), kind: 'incremental', resource: 'all' })
    if (res === 'queued') queued++
  }
  if (queued) log.info('commerce.polling.queued', { queued })
  return queued
}

export { listConnections }
