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
import { drainVoicePurgeQueue, platformOrgTag, platformVoiceMarker, runVoiceHousekeeping, runVoiceOrphanMaintenance, scanOrphanVoices } from './voice-orphans'
import { platformEnvMarker, platformVoiceDescription } from './voice-catalog'
import { createLogger } from '@/lib/observability/logger'

const log = createLogger({ test: true })
const ORG = 'abcdef12-1111-4111-8111-111111111111'
const NOW = Date.parse('2026-10-07T12:00:00Z')
const DAY = 86_400
const ORG_LIVE = 'bbbbbbbb-2222-4222-8222-222222222222'
const ORG_UNKNOWN = 'cccccccc-3333-4333-8333-333333333333'
const ORG_PURGED = 'dddddddd-4444-4444-8444-444444444444'
const wv = (id: string, category: string, extra: Record<string, unknown> = {}) => ({
  voice_id: id, category, name: `Voice [abcdef12]`, description: null, created_at_unix: Math.floor(NOW / 1000) - 3 * DAY, ...extra,
})
/** A voice created by a deployment of `env` (description written by platformVoiceDescription). */
const marked = (id: string, category: string, org: string, env = 'production', extra: Record<string, unknown> = {}) =>
  wv(id, category, { name: 'x', description: `${category === 'generated' ? 'Designed voice' : 'Instant clone'} for org ${org} [ntv-env:${env}]`, ...extra })

beforeEach(() => {
  vi.stubEnv('VERCEL_ENV', 'production')
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

  it('new voices carry the full org id and the deployment environment marker (the agents\' ntv-env: tag value)', () => {
    expect(platformEnvMarker()).toBe('ntv-env:production')
    const description = platformVoiceDescription('clone', ORG)
    expect(description).toBe(`Instant clone for org ${ORG} [ntv-env:production]`)
    expect(platformVoiceMarker({ name: 'x', description })).toEqual({ orgTag: 'abcdef12', orgId: ORG, env: 'production' })
    expect(platformVoiceMarker({ name: 'x', description: platformVoiceDescription('designed', ORG) })).toMatchObject({ env: 'production' })
    // Legacy voices: no environment marker.
    expect(platformVoiceMarker({ name: 'x', description: `Instant clone for org ${ORG}` })).toEqual({ orgTag: 'abcdef12', orgId: ORG, env: null })
    expect(platformVoiceMarker({ name: 'Front desk [abcdef12]', description: null })).toEqual({ orgTag: 'abcdef12', orgId: null, env: null })
    vi.stubEnv('VERCEL_ENV', 'preview')
    expect(platformVoiceDescription('clone', ORG)).toContain('[ntv-env:preview]')
  })
})

describe('scanOrphanVoices', () => {
  function seed() {
    state.db = memoryDb({
      provider_voices: [{ id: 'r1', provider: 'elevenlabs', voice_id: 'Registered00000001', status: 'deleted' }],
      provider_voice_purge: [
        { id: 'q1', kind: 'voice', resource_id: 'Queued000000000001', done_at: null },
        // Purge history of a deleted organization (dictionary already handled).
        { id: 'q2', kind: 'pronunciation_dictionary', resource_id: 'dict_old', org_id: ORG_PURGED, done_at: '2026-09-01T00:00:00Z' },
      ],
      organizations: [{ id: ORG_LIVE }],
      account_deletions: [{ id: 'd1', org_id: ORG, status: 'completed' }],
      audit_log: [],
    })
    api.listWorkspaceVoices.mockImplementation(async ({ category }: { category: string }) =>
      category === 'cloned'
        ? {
            voices: [
              marked('Orphan000000000001', 'cloned', ORG),
              marked('Registered00000001', 'cloned', ORG),
              marked('Queued000000000001', 'cloned', ORG),
              marked('Young0000000000001', 'cloned', ORG, 'production', { created_at_unix: Math.floor(NOW / 1000) - 3600 }),
              marked('NoAge0000000000001', 'cloned', ORG, 'production', { created_at_unix: null }),
              wv('NotOurs00000000001', 'cloned', { name: 'Someone voice' }),
              // Created before the environment marker existed: report only.
              wv('Legacy000000000001', 'cloned'),
              // The organization still exists (e.g. a lost registry write): report only.
              marked('LiveOrg00000000001', 'cloned', ORG_LIVE),
              // No organizations row, but no evidence it was deleted either: report only.
              marked('Unknown00000000001', 'cloned', ORG_UNKNOWN),
              // Another deployment sharing the workspace: not ours at all.
              marked('OtherEnv0000000001', 'cloned', ORG, 'preview'),
            ],
            has_more: false,
          }
        : { voices: [marked('OrphanGen000000001', 'generated', ORG_PURGED)], has_more: false },
    )
  }

  it('dry run lists our unregistered voices older than 24 h (ids, category, org tag; no names), says which are deletable, deletes nothing', async () => {
    seed()
    const report = await scanOrphanVoices({ apply: false, log, now: NOW })
    expect(api.listWorkspaceVoices).toHaveBeenCalledWith(expect.objectContaining({ voice_type: 'non-community', category: 'cloned' }))
    expect(api.listWorkspaceVoices).toHaveBeenCalledWith(expect.objectContaining({ voice_type: 'non-community', category: 'generated' }))
    const by = Object.fromEntries(report.orphans.map((o) => [o.voice_id, o]))
    expect(Object.keys(by).sort()).toEqual(['Legacy000000000001', 'LiveOrg00000000001', 'Orphan000000000001', 'OrphanGen000000001', 'Unknown00000000001'])
    expect(by.Orphan000000000001).toEqual({ voice_id: 'Orphan000000000001', category: 'cloned', org_tag: 'abcdef12', age_hours: 72, deletable: true, deleted: false })
    expect(by.OrphanGen000000001).toMatchObject({ deletable: true, org_tag: 'dddddddd' })
    expect(by.Legacy000000000001).toMatchObject({ deletable: false, hold: 'no_env_marker' })
    expect(by.LiveOrg00000000001).toMatchObject({ deletable: false, hold: 'org_exists' })
    expect(by.Unknown00000000001).toMatchObject({ deletable: false, hold: 'org_not_known_gone' })
    expect(report.other_env).toBe(1)
    expect(JSON.stringify(report)).not.toContain('Voice [')
    expect(JSON.stringify(report)).not.toContain('OtherEnv')
    expect(el.voices.delete).not.toHaveBeenCalled()
  })

  it('apply deletes only voices of this environment whose organization is known to be gone (404 = done), purges their history and audits', async () => {
    seed()
    el.voices.delete.mockResolvedValueOnce({ status: 'ok' }).mockRejectedValueOnce(new ProviderError({ system: 'elevenlabs', operation: 'voices.delete', code: 'not_found', status: 404 }))
    const report = await scanOrphanVoices({ apply: true, log, now: NOW })
    expect(el.voices.delete).toHaveBeenCalledTimes(2)
    expect(el.voices.delete.mock.calls.map((c) => c[0]).sort()).toEqual(['Orphan000000000001', 'OrphanGen000000001'])
    expect(report.orphans.filter((o) => o.deleted).map((o) => o.voice_id).sort()).toEqual(['Orphan000000000001', 'OrphanGen000000001'])
    expect(report.orphans.filter((o) => !o.deletable).every((o) => !o.deleted)).toBe(true)
    expect(hist.listHistory).toHaveBeenCalledWith(expect.objectContaining({ voice_id: 'Orphan000000000001', source: 'TTS' }))
    expect(state.db.tables.audit_log.map((a) => a.action)).toEqual(['voice.orphan.deleted', 'voice.orphan.deleted'])
    expect(state.db.tables.audit_log[0].details).toMatchObject({ env: 'production' })
  })

  it('another deployment (preview) sharing the workspace never deletes production voices', async () => {
    seed()
    vi.stubEnv('VERCEL_ENV', 'preview')
    const report = await scanOrphanVoices({ apply: true, log, now: NOW })
    // Only the preview-marked voice is "ours" here, and its org (ORG) is gone.
    expect(report.orphans.map((o) => [o.voice_id, o.deleted])).toEqual([
      ['Legacy000000000001', false],
      ['OtherEnv0000000001', true],
    ])
    expect(el.voices.delete).toHaveBeenCalledTimes(1)
    expect(el.voices.delete).toHaveBeenCalledWith('OtherEnv0000000001')
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

describe('maintenance cadence (stored last run: works with the daily Vercel cron and with a 5-minute cron)', () => {
  it('drains the purge queue every run but scans for orphans at most once a day, whatever the clock minute', async () => {
    state.db = memoryDb({ provider_voice_purge: [], provider_voices: [] })
    api.listWorkspaceVoices.mockResolvedValue({ voices: [], has_more: false })
    // vercel.json: 17 3 * * * (the former 04:00–04:05 UTC window never matched it).
    expect(await runVoiceOrphanMaintenance(log, new Date('2026-10-07T03:17:00Z'))).toMatchObject({ orphans: { apply: false, orphans: 0, deletable: 0 }, purge: { processed: 0 } })
    expect(api.listWorkspaceVoices).toHaveBeenCalled()
    api.listWorkspaceVoices.mockClear()
    expect(await runVoiceOrphanMaintenance(log, new Date('2026-10-07T03:22:00Z'))).toMatchObject({ orphans: { skipped: 'not_due' }, purge: { processed: 0 } })
    expect(api.listWorkspaceVoices).not.toHaveBeenCalled()
    // The next day's run, even when it fires earlier in the hour.
    expect(await runVoiceOrphanMaintenance(log, new Date('2026-10-08T03:01:00Z'))).toMatchObject({ orphans: { orphans: 0 } })
    expect(api.listWorkspaceVoices).toHaveBeenCalled()
  })

  it('housekeeping: design previews at most once an hour; the history retention at most once a day and only when configured', async () => {
    state.db = memoryDb({ voice_design_previews: [] })
    expect(await runVoiceHousekeeping(log, new Date('2026-10-07T03:17:00Z'))).toEqual({ design_previews: { deleted: expect.anything() } })
    expect(await runVoiceHousekeeping(log, new Date('2026-10-07T03:40:00Z'))).toEqual({ design_previews: { skipped: 'not_due' } })
    expect(hist.listHistory).not.toHaveBeenCalled()
    vi.stubEnv('ELEVENLABS_TTS_HISTORY_RETENTION_DAYS', '7')
    expect(await runVoiceHousekeeping(log, new Date('2026-10-07T04:20:00Z'))).toMatchObject({ design_previews: { deleted: expect.anything() }, tts_history: { deleted: 0 } })
    expect(hist.listHistory).toHaveBeenCalled()
    expect(await runVoiceHousekeeping(log, new Date('2026-10-07T05:30:00Z'))).toMatchObject({ tts_history: { skipped: 'not_due' } })
    expect(await runVoiceHousekeeping(log, new Date('2026-10-08T03:17:00Z'))).toMatchObject({ tts_history: { deleted: 0 } })
  })
})
