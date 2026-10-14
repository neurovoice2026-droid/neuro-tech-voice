import crypto from 'node:crypto'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('server-only', () => ({}))
vi.mock('@/lib/supabase/admin', () => ({ createAdminClient: () => { throw new Error('not used') } }))
const adapterState = vi.hoisted(() => ({ adapter: null as unknown }))
vi.mock('./adapters', () => ({ adapterFor: () => adapterState.adapter, isCommercePlatform: () => true }))

import { CONN_A, CONN_B, ORG_A, USER_A, asClient, automationRow, commerceDb, connectionRow, fakeAdapter } from '@/tests/helpers/commerce'
import { CommerceCryptoError } from './crypto'
import { connectionRequestError, disconnectStore, rewrapCredentials, testConnection } from './connections'
import { encryptedSecretsFor, toAdapterConnection } from './store'

const log = { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn(), child: () => log, context: {} }
const KEY_1 = crypto.randomBytes(32).toString('base64')
const KEY_2 = crypto.randomBytes(32).toString('base64')
const SECRETS = { consumer_key: 'ck_live_1', consumer_secret: 'cs_live_2', webhook_secret: 'whs_3' }

beforeEach(() => {
  vi.stubEnv('COMMERCE_CREDENTIALS_ENCRYPTION_KEY', KEY_1)
  vi.stubEnv('COMMERCE_CREDENTIALS_KEY_VERSION', '')
  vi.stubEnv('COMMERCE_CREDENTIALS_ENCRYPTION_KEY_PREVIOUS', '')
  vi.stubEnv('VOICE_PUBLIC_BASE_URL', 'https://app.example.com')
  adapterState.adapter = fakeAdapter()
})
afterEach(() => vi.unstubAllEnvs())

/** A connection row wrapped under the key version current at call time. */
function wrappedRow(over: Record<string, unknown> = {}) {
  const base = connectionRow(over)
  return { ...base, ...encryptedSecretsFor({ id: base.id, org_id: base.org_id }, SECRETS) }
}

function rotateToVersion2() {
  vi.stubEnv('COMMERCE_CREDENTIALS_ENCRYPTION_KEY', KEY_2)
  vi.stubEnv('COMMERCE_CREDENTIALS_KEY_VERSION', '2')
  vi.stubEnv('COMMERCE_CREDENTIALS_ENCRYPTION_KEY_PREVIOUS', KEY_1)
}

describe('key rotation', () => {
  it('a test re-wraps a connection still under the previous key, and housekeeping migrates the rest without merchant action', async () => {
    const row = wrappedRow()
    const other = wrappedRow({ id: CONN_B, webhook_public_id: 'pubid-bbbbbbbbbbbbbbbbbbbbbbbbbbbbb', store_domain: 'other.example.com' })
    expect(row.credential_key_version).toBe(1)
    rotateToVersion2()
    const db = commerceDb({ commerce_connections: [row, other] })
    expect(await testConnection(asClient(db), row as never, log)).toMatchObject({ ok: true })
    const stored = db.tables.commerce_connections[0]
    expect(stored.credential_key_version).toBe(2)
    expect((stored.encrypted_credentials as { k: number }).k).toBe(2)
    expect(db.tables.commerce_connections[1].credential_key_version).toBe(1)
    // The worker's housekeeping step picks up the rows nobody tested.
    expect(await rewrapCredentials(asClient(db), log)).toBe(1)
    expect(db.tables.commerce_connections[1].credential_key_version).toBe(2)
    expect(await rewrapCredentials(asClient(db), log)).toBe(0)
    // The previous key can now be removed: everything decrypts under the current key alone.
    vi.stubEnv('COMMERCE_CREDENTIALS_ENCRYPTION_KEY_PREVIOUS', '')
    for (const c of db.tables.commerce_connections) expect(toAdapterConnection(c as never).secrets).toEqual(SECRETS)
    expect(JSON.stringify(db.tables.commerce_connections)).not.toContain('ck_live_1')
    // A test under one key version writes nothing credential-related.
    const before = JSON.stringify(stored.encrypted_credentials)
    expect(await testConnection(asClient(db), db.tables.commerce_connections[0] as never, log)).toMatchObject({ ok: true })
    expect(JSON.stringify(db.tables.commerce_connections[0].encrypted_credentials)).toBe(before)
  })

  it('reports an envelope that cannot be read as credentials_unreadable (status error), not as missing encryption', async () => {
    const row = wrappedRow()
    // Two rotations without re-wrapping: version 1 is no longer readable.
    vi.stubEnv('COMMERCE_CREDENTIALS_ENCRYPTION_KEY', KEY_2)
    vi.stubEnv('COMMERCE_CREDENTIALS_KEY_VERSION', '3')
    const db = commerceDb({ commerce_connections: [row] })
    const res = await testConnection(asClient(db), row as never, log)
    expect(res.ok).toBe(false)
    expect(res.message).toContain('reconectează')
    expect(db.tables.commerce_connections[0]).toMatchObject({ status: 'error', error_code: 'credentials_unreadable' })
    expect(JSON.stringify(db.tables.commerce_connections[0])).not.toContain('ck_live_1')
    // Housekeeping leaves it alone (reported once, without content) and the platform-level cases keep their mapping.
    expect(await rewrapCredentials(asClient(db), log)).toBe(0)
    expect(db.tables.commerce_connections[0].credential_key_version).toBe(1)
    expect(log.warn).toHaveBeenCalledWith('commerce.credentials.rewrap_unreadable', { count: 1, keyVersion: 3 })
    expect(connectionRequestError(new CommerceCryptoError('not_configured', 'x'))).toMatchObject({ status: 503, details: { reason: 'encryption_not_configured' } })
    expect(connectionRequestError(new CommerceCryptoError('invalid_key', 'x'))).toMatchObject({ status: 503, details: { reason: 'encryption_not_configured' } })
    expect(connectionRequestError(new CommerceCryptoError('auth_failed', 'x'))).toMatchObject({ status: 409, details: { reason: 'credentials_unreadable' } })
  })
})

describe('disconnect', () => {
  it('cancels the queued work before erasing the credentials, and a failed cancellation is an error (retry repeats it)', async () => {
    const row = wrappedRow()
    const db = commerceDb({
      commerce_connections: [row],
      commerce_automations: [automationRow()],
      commerce_sync_jobs: [{ id: 'job-1', org_id: ORG_A, connection_id: CONN_A, resource: 'all', status: 'pending', attempts: 0 }],
      commerce_automation_runs: [{ id: 'run-1', org_id: ORG_A, connection_id: CONN_A, status: 'scheduled', idempotency_key: 'k1' }],
    })
    // The runs update fails (statement timeout): nothing may look disconnected.
    const failing = {
      ...db,
      from: (table: string) => {
        if (table !== 'commerce_automation_runs') return db.from(table)
        const chain: Record<string, unknown> = {}
        for (const m of ['update', 'eq', 'in', 'select']) chain[m] = () => chain
        chain.then = (res: (v: unknown) => unknown, rej?: (e: unknown) => unknown) => Promise.resolve({ data: null, error: { message: 'canceling statement due to statement timeout' }, count: null }).then(res, rej)
        return chain
      },
    }
    await expect(disconnectStore(failing as never, row as never, USER_A, log)).rejects.toThrow(/commerce_automation_runs update failed/)
    expect(db.tables.commerce_connections[0]).toMatchObject({ status: 'active', credential_key_version: 1 })
    expect(db.tables.commerce_connections[0].encrypted_credentials).not.toBeNull()
    expect(db.tables.commerce_audit_log ?? []).toHaveLength(0)
    // The retry is not short-circuited: everything is cancelled, then the credentials go.
    const final = await disconnectStore(asClient(db), row as never, USER_A, log)
    expect(final).toMatchObject({ status: 'disconnected', encrypted_credentials: null, credential_key_version: null })
    expect(db.tables.commerce_automations[0].enabled).toBe(false)
    expect(db.tables.commerce_sync_jobs[0].status).toBe('cancelled')
    expect(db.tables.commerce_automation_runs[0]).toMatchObject({ status: 'cancelled', eligibility_reason: 'Magazinul a fost deconectat' })
    expect(db.tables.commerce_audit_log.some((a) => a.action === 'connection.disconnected')).toBe(true)
  })
})
