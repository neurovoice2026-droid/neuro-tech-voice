import { beforeEach, describe, expect, it, vi } from 'vitest'

const state = vi.hoisted(() => ({ admin: true, audit: [] as unknown[] }))
vi.mock('@/lib/api/auth', () => ({
  requireAdmin: async () => {
    if (!state.admin) {
      const { RequestError: RE } = await import('@/lib/api/http')
      throw new RE('forbidden', 'Forbidden', 403)
    }
    return { kind: 'token', userId: null }
  },
}))
vi.mock('@/lib/supabase/admin', () => ({
  createAdminClient: () => ({ from: () => ({ insert: async (row: unknown) => (state.audit.push(row), { error: null }) }) }),
}))
vi.mock('@/lib/elevenlabs/client', () => ({ isConfigured: () => true }))
const curated = vi.hoisted(() => ({ proposeCuratedVoices: vi.fn(), applyCuratedVoices: vi.fn(), CURATED_LANGUAGES: ['en', 'ro'] }))
vi.mock('@/lib/voice-providers/curated-voices', () => curated)
const orphans = vi.hoisted(() => ({ scanOrphanVoices: vi.fn(), drainVoicePurgeQueue: vi.fn() }))
vi.mock('@/lib/voice-providers/voice-orphans', () => orphans)
const history = vi.hoisted(() => ({ purgeOldTtsHistory: vi.fn() }))
vi.mock('@/lib/voice-providers/tts-history', () => history)
const defaults = vi.hoisted(() => ({ runDefaultVoiceMigration: vi.fn() }))
vi.mock('@/lib/voice-providers/default-voices', () => defaults)
const lifecycle = vi.hoisted(() => ({ checkLibraryVoices: vi.fn() }))
vi.mock('@/lib/voice-providers/library-lifecycle', () => lifecycle)

import { POST as curatedRoute } from './curated/route'
import { POST as orphansRoute } from './orphans/route'
import { POST as historyRoute } from './tts-history/route'
import { POST as defaultsRoute } from './default-voices/route'

const post = (body: unknown) => new Request('http://app.test/api/admin/voice/x', { method: 'POST', headers: { 'content-type': 'application/json', authorization: 'Bearer t' }, body: JSON.stringify(body) })
const OWNER = 'a'.repeat(64)

beforeEach(() => {
  state.admin = true
  state.audit = []
  for (const m of [curated.proposeCuratedVoices, curated.applyCuratedVoices, orphans.scanOrphanVoices, orphans.drainVoicePurgeQueue, history.purgeOldTtsHistory, defaults.runDefaultVoiceMigration, lifecycle.checkLibraryVoices]) m.mockReset()
})

describe('admin voice routes', () => {
  it('are refused to non-admins before anything runs', async () => {
    state.admin = false
    for (const route of [curatedRoute, orphansRoute, historyRoute, defaultsRoute]) {
      expect((await route(post({}))).status).toBe(403)
    }
    expect(curated.proposeCuratedVoices).not.toHaveBeenCalled()
    expect(orphans.scanOrphanVoices).not.toHaveBeenCalled()
  })

  it('curated: dry run by default proposes; applying needs dry_run=false and validated ids', async () => {
    curated.proposeCuratedVoices.mockResolvedValue([{ language: 'ro', current: [], candidates: [], error: null }])
    const dry = await curatedRoute(post({}))
    expect(dry.status).toBe(200)
    expect(curated.proposeCuratedVoices).toHaveBeenCalledWith(expect.objectContaining({ languages: ['en', 'ro'], perLanguage: 5 }))
    const approve = [{ language: 'ro', public_owner_id: OWNER, voice_id: 'LibVoice0000000001', rank: 1 }]
    expect((await curatedRoute(post({ approve }))).status).toBe(400)
    expect((await curatedRoute(post({ dry_run: false }))).status).toBe(400)
    expect((await curatedRoute(post({ dry_run: false, approve: [{ ...approve[0], voice_id: 'bad id' }] }))).status).toBe(400)
    curated.applyCuratedVoices.mockResolvedValue({ approved: [{ status: 'curated' }], removed: [] })
    const res = await curatedRoute(post({ dry_run: false, approve }))
    expect(res.status).toBe(200)
    expect(curated.applyCuratedVoices).toHaveBeenCalledWith(expect.objectContaining({ approve, remove: [], actor: { userId: null, kind: 'admin_token' } }))
  })

  it('orphans: dry run lists only; apply drains the purge queue, deletes and audits', async () => {
    orphans.scanOrphanVoices.mockResolvedValue({ apply: false, scanned: 3, ours: 1, orphans: [{ voice_id: 'x', deleted: false }], truncated: false })
    await orphansRoute(post({}))
    expect(orphans.scanOrphanVoices).toHaveBeenCalledWith(expect.objectContaining({ apply: false, minAgeHours: 24 }))
    expect(orphans.drainVoicePurgeQueue).not.toHaveBeenCalled()
    expect(state.audit).toHaveLength(0)
    orphans.drainVoicePurgeQueue.mockResolvedValue({ processed: 0, done: 0, failed: 0 })
    orphans.scanOrphanVoices.mockResolvedValue({ apply: true, scanned: 3, ours: 1, orphans: [{ voice_id: 'x', deleted: true }], truncated: false })
    await orphansRoute(post({ apply: true }))
    expect(state.audit).toEqual([expect.objectContaining({ action: 'voice.orphans.applied', actor_kind: 'admin_token' })])
  })

  it('tts-history: dry run by default, bounded inputs', async () => {
    history.purgeOldTtsHistory.mockResolvedValue({ apply: false, matched: 2, deleted: 0, failed: 0, by_voice_category: {}, truncated: false })
    await historyRoute(post({}))
    expect(history.purgeOldTtsHistory).toHaveBeenCalledWith(expect.objectContaining({ apply: false, olderThanDays: 7, limit: 500 }))
    expect((await historyRoute(post({ older_than_days: 0 }))).status).toBe(400)
    expect((await historyRoute(post({ limit: 1_000_000 }))).status).toBe(400)
  })

  it('default voices: report by default, force needs apply; library check on demand', async () => {
    defaults.runDefaultVoiceMigration.mockResolvedValue({ mode: 'report', migrated: 0, failed: 0, remaining: 3 })
    await defaultsRoute(post({}))
    expect(defaults.runDefaultVoiceMigration).toHaveBeenCalledWith(expect.objectContaining({ dryRun: true, force: false }))
    expect((await defaultsRoute(post({ force: true }))).status).toBe(400)
    await defaultsRoute(post({ apply: true, force: true }))
    expect(defaults.runDefaultVoiceMigration).toHaveBeenLastCalledWith(expect.objectContaining({ dryRun: false, force: true }))
    expect(state.audit).toEqual([expect.objectContaining({ action: 'voice.default_migration.run' })])
    lifecycle.checkLibraryVoices.mockResolvedValue({ checked: 1 })
    expect(await (await defaultsRoute(post({ check_library: true }))).json()).toEqual({ library: { checked: 1 } })
  })

  it('returns provider-safe errors', async () => {
    curated.proposeCuratedVoices.mockRejectedValue(new Error('secret detail'))
    const res = await curatedRoute(post({}))
    expect(res.status).toBe(500)
    expect(JSON.stringify(await res.json())).not.toContain('secret')
  })
})
