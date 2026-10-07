import { beforeEach, describe, expect, it, vi } from 'vitest'
import { memoryDb, type MemoryDb } from '@/tests/helpers/memory-db'

const state = vi.hoisted(() => ({ db: null as unknown as MemoryDb }))
vi.mock('@/lib/supabase/admin', () => ({ createAdminClient: () => state.db }))
const el = vi.hoisted(() => ({ isConfigured: vi.fn(() => true), voices: { delete: vi.fn() } }))
vi.mock('@/lib/elevenlabs/client', () => el)
const api = vi.hoisted(() => ({ listWorkspaceVoices: vi.fn() }))
vi.mock('@/lib/elevenlabs/api/voices', () => api)
const hist = vi.hoisted(() => ({ listHistory: vi.fn(), deleteHistoryItem: vi.fn() }))
vi.mock('@/lib/elevenlabs/api/history', () => hist)
const pron = vi.hoisted(() => ({ getDictionary: vi.fn(), removeRules: vi.fn(), archiveDictionary: vi.fn(), createDictionary: vi.fn(), addRules: vi.fn(), setRules: vi.fn() }))
vi.mock('@/lib/elevenlabs/api/pronunciation', () => pron)

import { ProviderError } from './errors'
import { drainVoicePurgeQueue, platformOrgTag, runVoiceHousekeeping, runVoiceOrphanMaintenance, scanOrphanVoices } from './voice-orphans'
import { createLogger } from '@/lib/observability/logger'

const log = createLogger({ test: true })
const ORG = 'abcdef12-1111-4111-8111-111111111111'
const NOW = Date.parse('2026-10-07T12:00:00Z')
const DAY = 86_400
const wv = (id: string, category: string, extra: Record<string, unknown> = {}) => ({
  voice_id: id, category, name: `Voice [abcdef12]`, description: null, created_at_unix: Math.floor(NOW / 1000) - 3 * DAY, ...extra,
})

beforeEach(() => {
  api.listWorkspaceVoices.mockReset()
  el.voices.delete.mockReset()
  hist.listHistory.mockReset().mockResolvedValue({ history: [], has_more: false })
  hist.deleteHistoryItem.mockReset()
  for (const fn of Object.values(pron)) fn.mockReset()
})

describe('platformOrgTag', () => {
  it('recognises our clones and designed voices only', () => {
    expect(platformOrgTag({ name: 'Front desk [abcdef12]', description: null })).toBe('abcdef12')
    expect(platformOrgTag({ name: 'x', description: `Instant clone for org ${ORG}` })).toBe('abcdef12')
    expect(platformOrgTag({ name: 'x', description: `Designed voice for org ${ORG}` })).toBe('abcdef12')
    expect(platformOrgTag({ name: 'My own voice', description: 'personal' })).toBeNull()
    expect(platformOrgTag({ name: 'Voice [ABCDEF12]', description: null })).toBeNull()
  })
})

describe('scanOrphanVoices', () => {
  function seed() {
    state.db = memoryDb({
      provider_voices: [{ id: 'r1', provider: 'elevenlabs', voice_id: 'Registered00000001', status: 'deleted' }],
      provider_voice_purge: [{ id: 'q1', kind: 'voice', resource_id: 'Queued000000000001', done_at: null }],
      audit_log: [],
    })
    api.listWorkspaceVoices.mockImplementation(async ({ category }: { category: string }) =>
      category === 'cloned'
        ? {
            voices: [
              wv('Orphan000000000001', 'cloned'),
              wv('Registered00000001', 'cloned'),
              wv('Queued000000000001', 'cloned'),
              wv('Young0000000000001', 'cloned', { created_at_unix: Math.floor(NOW / 1000) - 3600 }),
              wv('NoAge0000000000001', 'cloned', { created_at_unix: null }),
              wv('NotOurs00000000001', 'cloned', { name: 'Someone voice' }),
            ],
            has_more: false,
          }
        : { voices: [wv('OrphanGen000000001', 'generated', { name: 'x', description: `Designed voice for org ${ORG}` })], has_more: false },
    )
  }

  it('dry run lists our unregistered voices older than 24 h (ids, category, org tag; no names) and deletes nothing', async () => {
    seed()
    const report = await scanOrphanVoices({ apply: false, log, now: NOW })
    expect(api.listWorkspaceVoices).toHaveBeenCalledWith(expect.objectContaining({ voice_type: 'non-community', category: 'cloned' }))
    expect(api.listWorkspaceVoices).toHaveBeenCalledWith(expect.objectContaining({ voice_type: 'non-community', category: 'generated' }))
    expect(report.orphans.map((o) => o.voice_id).sort()).toEqual(['Orphan000000000001', 'OrphanGen000000001'])
    expect(report.orphans[0]).toEqual({ voice_id: 'Orphan000000000001', category: 'cloned', org_tag: 'abcdef12', age_hours: 72, deleted: false })
    expect(JSON.stringify(report)).not.toContain('Voice [')
    expect(el.voices.delete).not.toHaveBeenCalled()
  })

  it('apply deletes them (404 = done), purges their history and audits', async () => {
    seed()
    el.voices.delete.mockResolvedValueOnce({ status: 'ok' }).mockRejectedValueOnce(new ProviderError({ system: 'elevenlabs', operation: 'voices.delete', code: 'not_found', status: 404 }))
    const report = await scanOrphanVoices({ apply: true, log, now: NOW })
    expect(report.orphans.every((o) => o.deleted)).toBe(true)
    expect(el.voices.delete).toHaveBeenCalledTimes(2)
    expect(hist.listHistory).toHaveBeenCalledWith(expect.objectContaining({ voice_id: 'Orphan000000000001', source: 'TTS' }))
    expect(state.db.tables.audit_log.map((a) => a.action)).toEqual(['voice.orphan.deleted', 'voice.orphan.deleted'])
  })
})

describe('drainVoicePurgeQueue', () => {
  it('deletes queued voices and archives queued dictionaries; failures back off', async () => {
    state.db = memoryDb({
      provider_voice_purge: [
        { id: 'q1', kind: 'voice', resource_id: 'Purge0000000000001', attempts: 0, done_at: null, next_attempt_at: '2026-01-01T00:00:00Z' },
        { id: 'q2', kind: 'pronunciation_dictionary', resource_id: 'dict_0001', attempts: 0, done_at: null, next_attempt_at: '2026-01-01T00:00:00Z' },
        { id: 'q3', kind: 'voice', resource_id: 'Fail00000000000001', attempts: 1, done_at: null, next_attempt_at: '2026-01-01T00:00:00Z' },
        { id: 'q4', kind: 'voice', resource_id: 'Later0000000000001', attempts: 0, done_at: null, next_attempt_at: '2099-01-01T00:00:00Z' },
      ],
    })
    el.voices.delete.mockImplementation(async (id: string) => {
      if (id === 'Fail00000000000001') throw new ProviderError({ system: 'elevenlabs', operation: 'voices.delete', code: 'upstream', status: 502 })
      return { status: 'ok' }
    })
    pron.getDictionary.mockResolvedValue({ id: 'dict_0001', latest_version_id: 'v', rules: [{ string_to_replace: 'Ana' }] })
    const report = await drainVoicePurgeQueue({ limit: 10, log, now: NOW })
    expect(report).toEqual({ processed: 3, done: 2, failed: 1 })
    const rows = Object.fromEntries(state.db.tables.provider_voice_purge.map((r) => [r.id, r]))
    expect(rows.q1.done_at).toEqual(expect.any(String))
    expect(rows.q2.done_at).toEqual(expect.any(String))
    expect(pron.removeRules).toHaveBeenCalledWith('dict_0001', ['Ana'])
    expect(pron.archiveDictionary).toHaveBeenCalledWith('dict_0001')
    expect(rows.q3).toMatchObject({ done_at: null, attempts: 2, last_error: 'upstream' })
    expect(Date.parse(rows.q3.next_attempt_at as string)).toBeGreaterThan(Date.now())
    expect(rows.q4.done_at).toBeNull()
  })
})

describe('maintenance cadence (cron every 5 minutes)', () => {
  it('drains the purge queue every run but scans for orphans once a day', async () => {
    state.db = memoryDb({ provider_voice_purge: [], provider_voices: [] })
    api.listWorkspaceVoices.mockResolvedValue({ voices: [], has_more: false })
    expect(await runVoiceOrphanMaintenance(log, new Date('2026-10-07T10:02:00Z'))).toMatchObject({ orphans: 'not_scheduled', purge: { processed: 0 } })
    expect(api.listWorkspaceVoices).not.toHaveBeenCalled()
    expect(await runVoiceOrphanMaintenance(log, new Date('2026-10-07T04:01:00Z'))).toMatchObject({ orphans: { apply: false, orphans: 0 } })
    expect(api.listWorkspaceVoices).toHaveBeenCalled()
  })

  it('housekeeping runs once an hour; the history retention once a day and only when configured', async () => {
    state.db = memoryDb({ voice_design_previews: [] })
    expect(await runVoiceHousekeeping(log, new Date('2026-10-07T10:07:00Z'))).toEqual({ skipped: 'not_scheduled' })
    expect(await runVoiceHousekeeping(log, new Date('2026-10-07T05:01:00Z'))).toEqual({ design_previews: { deleted: expect.anything() } })
    expect(hist.listHistory).not.toHaveBeenCalled()
    vi.stubEnv('ELEVENLABS_TTS_HISTORY_RETENTION_DAYS', '7')
    try {
      expect(await runVoiceHousekeeping(log, new Date('2026-10-07T10:01:00Z'))).not.toHaveProperty('tts_history')
      expect(await runVoiceHousekeeping(log, new Date('2026-10-07T05:01:00Z'))).toHaveProperty('tts_history')
      expect(hist.listHistory).toHaveBeenCalled()
    } finally {
      vi.unstubAllEnvs()
    }
  })
})
