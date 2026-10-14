import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('server-only', () => ({}))
vi.mock('@/lib/supabase/admin', () => ({ createAdminClient: () => { throw new Error('not used') } }))
const adapterState = vi.hoisted(() => ({ adapter: null as unknown }))
vi.mock('./adapters', () => ({ adapterFor: () => adapterState.adapter, isCommercePlatform: () => true }))

import { CONN_A, ORG_A, asClient, commerceDb, connectionRow, fakeAdapter, normalizedOrder, orgRow } from '@/tests/helpers/commerce'
import { ConnectionError } from './adapters/types'
import { backoffMs, claimSyncJobs, classifySyncError, runSyncJob, schedulePollingJobs } from './sync'

const log = { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn(), child: () => log, context: {} }
const job = (over: Record<string, unknown> = {}) => ({ id: 'job-1', org_id: ORG_A, connection_id: CONN_A, kind: 'initial', resource: 'all', status: 'pending', attempts: 0, max_attempts: 5, run_after: '2026-10-13T07:00:00Z', lease_owner: null, lease_until: null, cursor: {}, counts: {}, error_code: null, error_message: null, started_at: null, finished_at: null, created_at: 'x', updated_at: 'x', ...over })

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(new Date('2026-10-13T08:00:00Z'))
})

describe('sync jobs', () => {
  it('imports page by page, persists checkpoints, finishes and moves the watermark', async () => {
    adapterState.adapter = fakeAdapter({
      pages: {
        orders: [{ resource: 'orders', orders: [normalizedOrder()], checkpoint: { cursor: null, modifiedAfter: null, pages: 0 }, done: false }, { resource: 'orders', orders: [normalizedOrder({ externalId: '1002', orderNumber: '1002' })], checkpoint: { cursor: null, modifiedAfter: null, pages: 0 }, done: true }],
        products: [{ resource: 'products', products: [{ externalId: 'p1', sku: 'A', name: 'Tricou', status: 'active', price: 10, currency: 'RON', stockStatus: 'in_stock', stockQuantity: 3, url: null, providerUpdatedAt: null }], checkpoint: { cursor: null, modifiedAfter: null, pages: 0 }, done: true }],
      },
    })
    const db = commerceDb({ organizations: [orgRow()], commerce_connections: [connectionRow({ status: 'degraded' })], commerce_sync_jobs: [job()] })
    const [claimed] = await claimSyncJobs(asClient(db), 'w1', 3)
    expect(claimed).toMatchObject({ status: 'running', attempts: 1 })
    const out = await runSyncJob(asClient(db), claimed, log, { owner: 'w1', sliceMs: 60_000 })
    expect(out).toMatchObject({ status: 'succeeded', counts: { products: 1, orders: 2 } })
    expect(db.tables.commerce_orders).toHaveLength(2)
    expect(db.tables.commerce_products).toHaveLength(1)
    const conn = db.tables.commerce_connections[0]
    expect(conn).toMatchObject({ status: 'active', error_code: null })
    expect((conn.sync_cursor as Record<string, { modifiedAfter: string }>).orders.modifiedAfter).toBe('2026-10-13T08:00:00.000Z')
    expect(db.tables.commerce_sync_jobs[0]).toMatchObject({ status: 'succeeded', lease_owner: null })
    expect(db.tables.commerce_audit_log.some((a) => a.action === 'sync.succeeded')).toBe(true)
  })

  it('hands the job back as pending with its checkpoint when the time slice is spent, and resumes there', async () => {
    const adapter = fakeAdapter({
      pages: { orders: Array.from({ length: 3 }, (_, i) => ({ resource: 'orders' as const, orders: [normalizedOrder({ externalId: String(2000 + i), orderNumber: String(2000 + i) })], checkpoint: { cursor: null, modifiedAfter: null, pages: 0 }, done: i === 2 })) },
      capabilities: { products: false, customers: false, orders: true, webhooks: false, abandoned_carts: false, customer_phone: true, polling_minutes: 15, notes: [] },
    })
    adapterState.adapter = adapter
    const db = commerceDb({ organizations: [orgRow()], commerce_connections: [connectionRow({ capabilities: adapter.getCapabilities({ capabilities: {} as never, webhookRegistrations: [] }) })], commerce_sync_jobs: [job()] })
    let t = Date.parse('2026-10-13T08:00:00Z')
    const now = () => (t += 700)
    const [claimed] = await claimSyncJobs(asClient(db), 'w1', 3)
    // Each page costs 700 ms of fake time; a 1 s slice stops after the first page.
    const first = await runSyncJob(asClient(db), claimed, log, { owner: 'w1', sliceMs: 1_000, now })
    expect(first.status).toBe('continued')
    expect(db.tables.commerce_sync_jobs[0]).toMatchObject({ status: 'pending', lease_owner: null })
    expect((db.tables.commerce_sync_jobs[0].cursor as Record<string, { cursor: string }>).orders.cursor).toBe('1')
    expect(db.tables.commerce_orders).toHaveLength(1)
    const [again] = await claimSyncJobs(asClient(db), 'w2', 3)
    const second = await runSyncJob(asClient(db), again, log, { owner: 'w2', sliceMs: 60_000, now })
    expect(second.status).toBe('succeeded')
    expect(db.tables.commerce_orders).toHaveLength(3)
    expect(adapter.calls['sync:orders']).toBe(3)
  })

  it('carries the watermark of a resource finished in an earlier slice and merges keys written meanwhile', async () => {
    const adapter = fakeAdapter({
      pages: {
        products: [{ resource: 'products', products: [{ externalId: 'p1', sku: 'A', name: 'Tricou', status: 'active', price: 10, currency: 'RON', stockStatus: 'in_stock', stockQuantity: 3, url: null, providerUpdatedAt: null }], checkpoint: { cursor: null, modifiedAfter: null, pages: 0 }, done: true }],
        orders: Array.from({ length: 10 }, (_, i) => ({ resource: 'orders' as const, orders: [normalizedOrder({ externalId: String(3000 + i), orderNumber: String(3000 + i) })], checkpoint: { cursor: null, modifiedAfter: null, pages: 0 }, done: i === 9 })),
      },
      capabilities: { products: true, customers: false, orders: true, webhooks: false, abandoned_carts: false, customer_phone: true, polling_minutes: 15, notes: [] },
    })
    adapterState.adapter = adapter
    const db = commerceDb({ organizations: [orgRow()], commerce_connections: [connectionRow({ capabilities: adapter.getCapabilities({ capabilities: {} as never, webhookRegistrations: [] }) })], commerce_sync_jobs: [job()] })
    const inner = adapter.syncPage
    adapter.syncPage = vi.fn(async (c, resource, checkpoint, mode, l) => {
      const batch = await inner(c, resource, checkpoint, mode, l)
      // A per-resource job of another worker finishing between this job's read and its final write.
      if (resource === 'orders' && batch.done) db.tables.commerce_connections[0].sync_cursor = { customers: { modifiedAfter: '2026-10-13T07:30:00.000Z' } }
      return batch
    })
    const [claimed] = await claimSyncJobs(asClient(db), 'w1', 3)
    // One product page and seven order pages fill the 8-page slice: products is done before the hand-back.
    expect((await runSyncJob(asClient(db), claimed, log, { owner: 'w1', sliceMs: 60_000 })).status).toBe('continued')
    const [again] = await claimSyncJobs(asClient(db), 'w2', 3)
    expect((await runSyncJob(asClient(db), again, log, { owner: 'w2', sliceMs: 60_000 })).status).toBe('succeeded')
    const cursor = db.tables.commerce_connections[0].sync_cursor as Record<string, { modifiedAfter: string }>
    expect(cursor.products?.modifiedAfter).toBe('2026-10-13T08:00:00.000Z')
    expect(cursor.orders?.modifiedAfter).toBe('2026-10-13T08:00:00.000Z')
    expect(cursor.customers?.modifiedAfter).toBe('2026-10-13T07:30:00.000Z')
    expect(db.tables.commerce_orders).toHaveLength(10)
  })

  it('does not count a spent slice as an attempt: an import needing more claims than max_attempts still completes', async () => {
    const adapter = fakeAdapter({
      pages: { orders: Array.from({ length: 48 }, (_, i) => ({ resource: 'orders' as const, orders: [normalizedOrder({ externalId: String(4000 + i), orderNumber: String(4000 + i) })], checkpoint: { cursor: null, modifiedAfter: null, pages: 0 }, done: i === 47 })) },
      capabilities: { products: false, customers: false, orders: true, webhooks: false, abandoned_carts: false, customer_phone: true, polling_minutes: 15, notes: [] },
    })
    adapterState.adapter = adapter
    const db = commerceDb({ organizations: [orgRow()], commerce_connections: [connectionRow({ capabilities: adapter.getCapabilities({ capabilities: {} as never, webhookRegistrations: [] }) })], commerce_sync_jobs: [job({ max_attempts: 5 })] })
    const statuses: string[] = []
    for (let n = 0; n < 10; n++) {
      const [claimed] = await claimSyncJobs(asClient(db), `w${n}`, 3)
      if (!claimed) break
      expect(claimed.attempts).toBe(1)
      const out = await runSyncJob(asClient(db), claimed, log, { owner: `w${n}`, sliceMs: 60_000 })
      statuses.push(out.status)
      if (out.status !== 'continued') break
    }
    expect(statuses).toEqual(['continued', 'continued', 'continued', 'continued', 'continued', 'succeeded'])
    expect(db.tables.commerce_orders).toHaveLength(48)
    expect(db.tables.commerce_sync_jobs[0]).toMatchObject({ status: 'succeeded', attempts: 1, error_code: null })
    expect(db.tables.commerce_connections[0]).toMatchObject({ status: 'active', error_code: null })
  })

  it('retries transient failures with backoff and fails for bad credentials, marking the connection', async () => {
    const timeout = fakeAdapter()
    timeout.syncPage = vi.fn(async () => { throw new ConnectionError('timeout', 'Magazinul nu a răspuns.', true) })
    adapterState.adapter = timeout
    const db = commerceDb({ organizations: [orgRow()], commerce_connections: [connectionRow()], commerce_sync_jobs: [job()] })
    const [claimed] = await claimSyncJobs(asClient(db), 'w1', 3)
    expect((await runSyncJob(asClient(db), claimed, log, { owner: 'w1', sliceMs: 60_000 })).status).toBe('retry')
    expect(db.tables.commerce_sync_jobs[0]).toMatchObject({ status: 'pending', error_code: 'timeout' })
    expect(Date.parse(String(db.tables.commerce_sync_jobs[0].run_after))).toBeGreaterThan(Date.now())
    expect(db.tables.commerce_connections[0]).toMatchObject({ status: 'degraded', error_code: 'timeout' })

    const unauthorized = fakeAdapter()
    unauthorized.syncPage = vi.fn(async () => { throw new ConnectionError('unauthorized', 'Cheia a fost respinsă.', false) })
    adapterState.adapter = unauthorized
    const db2 = commerceDb({ organizations: [orgRow()], commerce_connections: [connectionRow()], commerce_sync_jobs: [job()] })
    const [c2] = await claimSyncJobs(asClient(db2), 'w1', 3)
    expect((await runSyncJob(asClient(db2), c2, log, { owner: 'w1', sliceMs: 60_000 })).status).toBe('failed')
    expect(db2.tables.commerce_sync_jobs[0]).toMatchObject({ status: 'failed', error_code: 'unauthorized' })
    expect(db2.tables.commerce_connections[0]).toMatchObject({ status: 'error', error_message: 'Cheia a fost respinsă.' })
    expect(JSON.stringify(db2.tables.commerce_connections[0].error_message)).not.toMatch(/ck_|cs_/)
  })

  it('schedules polling for stores without webhooks and classifies errors without secrets', async () => {
    const db = commerceDb({ commerce_connections: [connectionRow({ capabilities: { ...connectionRow().capabilities, webhooks: false, polling_minutes: 15 }, last_sync_at: '2026-10-13T07:00:00Z' }), connectionRow({ id: 'conn-fresh', webhook_public_id: 'p2', store_domain: 'fresh.example.com', last_sync_at: '2026-10-13T07:58:00Z' })] })
    expect(await schedulePollingJobs(asClient(db), log)).toBe(1)
    expect(db.tables.commerce_sync_jobs).toHaveLength(1)
    expect(await schedulePollingJobs(asClient(db), log)).toBe(0)
    expect(classifySyncError(new Error('ck_live_secret leaked'))).toMatchObject({ code: 'internal', retryable: true })
    expect(JSON.stringify(classifySyncError(new Error('ck_live_secret leaked')))).not.toContain('ck_live')
    expect(backoffMs(1, () => 0.5)).toBe(60_000)
    expect(backoffMs(4, () => 0.5)).toBe(8 * 60_000)
    expect(backoffMs(20, () => 0.5)).toBe(60 * 60_000)
  })
})
