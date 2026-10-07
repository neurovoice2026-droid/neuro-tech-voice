import { beforeEach, describe, expect, it, vi } from 'vitest'
import { memoryDb, type MemoryDb } from '@/tests/helpers/memory-db'
import type { NormalizedCallEvent } from './types'

// A re-analysis never gives content back to a call the privacy retention
// purged, even when the retention ran after the route's own check.

const state: { db: MemoryDb | null } = { db: null }
vi.mock('@/lib/supabase/admin', () => ({ createAdminClient: () => state.db }))

import { applyReanalysis } from './call-reanalysis'
import { RequestError } from '@/lib/api/http'
import { createLogger } from '@/lib/observability/logger'

const CALL = 'c0000000-0000-4000-8000-000000000001'
const ORG = '11111111-1111-4111-8111-111111111111'
const log = createLogger({ component: 'test' })

const event = {
  provider: 'elevenlabs',
  kind: 'call.completed',
  providerCallId: 'conv_1',
  summary: 'New summary that quotes the caller',
  summaryTitle: 'New title',
  callSuccessful: 'success',
  analysis: { evaluation: {}, data: { caller_name: 'Ana', outcome: 'booked' } },
  metadata: { channel: 'phone' },
} as unknown as NormalizedCallEvent

function seed(row: Record<string, unknown>) {
  state.db = memoryDb({ calls: [{ id: CALL, org_id: ORG, outcome: null, summary: null, summary_title: null, analysis: {}, retention_applied_at: null, ...row }] })
  return state.db
}

beforeEach(() => {
  vi.spyOn(console, 'log').mockImplementation(() => {})
  vi.spyOn(console, 'warn').mockImplementation(() => {})
})

describe('applyReanalysis', () => {
  it('replaces the analysis of a call that still has its content', async () => {
    const db = seed({})
    await applyReanalysis({ id: CALL, org_id: ORG, outcome: null, retention_applied_at: null }, event, log)
    expect(db.tables.calls[0]).toMatchObject({ summary: 'New summary that quotes the caller', summary_title: 'New title', call_successful: 'success', outcome: 'booked' })
  })

  it('a call purged after the caller checked it is never written back (409, row unchanged)', async () => {
    const db = seed({ retention_applied_at: '2026-10-07T10:00:00Z' })
    const err = await applyReanalysis({ id: CALL, org_id: ORG, outcome: null, retention_applied_at: null }, event, log).catch((e: unknown) => e)
    expect(err).toBeInstanceOf(RequestError)
    expect(err).toMatchObject({ status: 409 })
    expect(db.tables.calls[0]).toMatchObject({ summary: null, summary_title: null, analysis: {}, retention_applied_at: '2026-10-07T10:00:00Z' })
    expect(db.tables.calls[0].call_successful).toBeUndefined()
  })

  it('refuses before writing when the row read by the caller was already purged; another org\'s row is never touched', async () => {
    const db = seed({})
    await expect(applyReanalysis({ id: CALL, org_id: ORG, outcome: null, retention_applied_at: '2026-10-07T10:00:00Z' }, event, log)).rejects.toMatchObject({ status: 409 })
    expect(db.log.filter((l) => l.op === 'update')).toHaveLength(0)
    await expect(applyReanalysis({ id: CALL, org_id: '22222222-2222-4222-8222-222222222222', outcome: null, retention_applied_at: null }, event, log)).rejects.toMatchObject({ status: 409 })
    expect(db.tables.calls[0].summary).toBeNull()
  })
})
