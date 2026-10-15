import { beforeEach, describe, expect, it, vi } from 'vitest'
import { memoryDb, type MemoryDb } from '@/tests/helpers/memory-db'

// The shared workspace's answer to transcript redaction (enterprise-only),
// remembered across instances in maintenance_state.

const state = vi.hoisted(() => ({ db: null as unknown }))
vi.mock('@/lib/supabase/admin', () => ({ createAdminClient: () => state.db }))

import { ProviderError } from './errors'
import {
  PII_REDACTION_STATE_KEY,
  PII_REJECTION_TTL_MS,
  isPiiRedactionRejection,
  piiRedactionRejected,
  refreshPiiRedactionCapability,
  rememberPiiRedactionRejected,
  resetPiiRedactionMemo,
} from './pii-redaction'

const NOW = Date.parse('2026-10-15T12:00:00Z')
const MINUTE = 60_000

type LogCall = { level: string; args: unknown[] }
function logger() {
  const calls: LogCall[] = []
  const l: Record<string, unknown> = {
    info: (...args: unknown[]) => calls.push({ level: 'info', args }),
    warn: (...args: unknown[]) => calls.push({ level: 'warn', args }),
    error: (...args: unknown[]) => calls.push({ level: 'error', args }),
    debug: () => {},
  }
  l.child = () => l
  return { log: l as unknown as import('@/lib/observability/logger').Logger, calls }
}

const refusal = new ProviderError({
  system: 'elevenlabs',
  code: 'permission',
  operation: 'agents.create',
  status: 403,
  detail: 'feature_not_available - Conversation history redaction is not available for this workspace. This feature requires an enterprise subscription.',
  providerCode: 'feature_not_available',
})

const db = () => state.db as MemoryDb
const stored = () => db().tables.maintenance_state.find((r) => r.key === PII_REDACTION_STATE_KEY)

beforeEach(() => {
  resetPiiRedactionMemo()
  state.db = memoryDb({ maintenance_state: [] }, { unique: { maintenance_state: [['key']] } })
})

describe('isPiiRedactionRejection', () => {
  it('matches the workspace refusing redaction, nothing else', () => {
    expect(isPiiRedactionRejection(refusal)).toBe(true)
    expect(isPiiRedactionRejection(new ProviderError({ system: 'elevenlabs', code: 'validation', operation: 'agents.update', detail: 'invalid_parameters - bad voice' }))).toBe(false)
    expect(isPiiRedactionRejection(new ProviderError({ system: 'elevenlabs', code: 'upstream', operation: 'agents.update', detail: 'redaction service down' }))).toBe(false)
    expect(isPiiRedactionRejection(new Error('redaction'))).toBe(false)
  })
})

describe('piiRedactionRejected / rememberPiiRedactionRejected', () => {
  it('stores the refusal once for every instance, with one warning and no error', async () => {
    const { log, calls } = logger()
    expect(await piiRedactionRejected(log, NOW)).toBe(false)
    await rememberPiiRedactionRejected(refusal, log, NOW)
    expect(stored()).toMatchObject({ last_run_at: new Date(NOW).toISOString(), details: { status: 'rejected', code: 'feature_not_available', tier: null } })
    expect(calls.map((c) => `${c.level}:${String(c.args[0])}`)).toEqual(['warn:agent_sync.pii_redaction_rejected'])
    expect(calls[0].args[1]).toMatchObject({ error: { kind: 'provider', code: 'permission', status: 403 }, recheck_in_hours: 24 })

    // A cold instance: nothing in memory, the stored refusal is read.
    resetPiiRedactionMemo()
    expect(await piiRedactionRejected(log, NOW + MINUTE)).toBe(true)
    // Expired after a day: the next write asks again.
    expect(await piiRedactionRejected(log, NOW + PII_REJECTION_TTL_MS + MINUTE)).toBe(false)
  })

  it('reads the store at most every 10 minutes per instance', async () => {
    const { log } = logger()
    expect(await piiRedactionRejected(log, NOW)).toBe(false)
    // Another instance stores a refusal: seen once this instance's read is 10 minutes old.
    db().tables.maintenance_state.push({ key: PII_REDACTION_STATE_KEY, last_run_at: new Date(NOW + MINUTE).toISOString(), details: { status: 'rejected', tier: null } })
    expect(await piiRedactionRejected(log, NOW + 5 * MINUTE)).toBe(false)
    expect(await piiRedactionRejected(log, NOW + 11 * MINUTE)).toBe(true)
  })

  it('reads again when its refusal expires, so a refusal renewed by another instance is not asked again', async () => {
    const { log } = logger()
    await rememberPiiRedactionRejected(refusal, log, NOW)
    const expiry = NOW + PII_REJECTION_TTL_MS
    expect(await piiRedactionRejected(log, expiry - MINUTE)).toBe(true)
    // Another instance asked at expiry and was refused again: renewed in the store.
    stored()!.last_run_at = new Date(expiry).toISOString()
    // Only 2 minutes since this instance's last read, but its refusal has expired: it reads, and does not ask.
    expect(await piiRedactionRejected(log, expiry + MINUTE)).toBe(true)
  })

  it('asks again once after expiry when nobody renewed the refusal, without reading on every write after that', async () => {
    const { log } = logger()
    await rememberPiiRedactionRejected(refusal, log, NOW)
    const expiry = NOW + PII_REJECTION_TTL_MS
    const from = vi.spyOn(db(), 'from')
    expect(await piiRedactionRejected(log, expiry + MINUTE)).toBe(false)
    expect(await piiRedactionRejected(log, expiry + 2 * MINUTE)).toBe(false)
    // One read at expiry; the next one waits for the usual 10 minutes.
    expect(from).toHaveBeenCalledTimes(1)
  })

  it('an unreadable or unwritable store never fails the write: it is logged and the workspace is asked', async () => {
    const broken = {
      from: () => ({
        select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: null, error: { message: 'relation "maintenance_state" does not exist' } }) }) }),
        upsert: async () => ({ error: { message: 'permission denied' } }),
      }),
    }
    const { log, calls } = logger()
    expect(await piiRedactionRejected(log, NOW, broken as never)).toBe(false)
    await rememberPiiRedactionRejected(refusal, log, NOW, broken as never)
    // This instance still remembers what it saw itself.
    expect(await piiRedactionRejected(log, NOW + MINUTE, broken as never)).toBe(true)
    expect(calls.map((c) => `${c.level}:${String(c.args[0])}`)).toEqual([
      'warn:pii_redaction.state_read_failed',
      'warn:agent_sync.pii_redaction_rejected',
      'warn:pii_redaction.state_write_failed',
    ])
  })
})

describe('refreshPiiRedactionCapability', () => {
  it('does nothing without a refusal or without a known tier', async () => {
    const { log } = logger()
    expect(await refreshPiiRedactionCapability('business', log, NOW)).toBe('none')
    await rememberPiiRedactionRejected(refusal, log, NOW)
    expect(await refreshPiiRedactionCapability(null, log, NOW)).toBe('none')
    expect(stored()?.details).toMatchObject({ tier: null })
  })

  it('records the first tier, keeps the refusal while it holds, and clears it (memory included) when it changes', async () => {
    const { log } = logger()
    await rememberPiiRedactionRejected(refusal, log, NOW)
    expect(await refreshPiiRedactionCapability('creator', log, NOW)).toBe('recorded')
    expect(await refreshPiiRedactionCapability('creator', log, NOW)).toBe('unchanged')
    expect(await piiRedactionRejected(log, NOW + MINUTE)).toBe(true)
    expect(await refreshPiiRedactionCapability('enterprise', log, NOW)).toBe('cleared')
    expect(stored()).toBeUndefined()
    expect(await piiRedactionRejected(log, NOW + MINUTE)).toBe(false)
  })
})
