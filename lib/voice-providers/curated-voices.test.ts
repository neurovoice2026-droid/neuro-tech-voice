import { beforeEach, describe, expect, it, vi } from 'vitest'
import { memoryDb, type MemoryDb } from '@/tests/helpers/memory-db'

const state = vi.hoisted(() => ({ db: null as unknown as MemoryDb }))
vi.mock('@/lib/supabase/admin', () => ({ createAdminClient: () => state.db }))
const api = vi.hoisted(() => ({ searchLibrary: vi.fn() }))
vi.mock('@/lib/elevenlabs/api/voices', async (orig) => ({ ...(await orig<object>()), searchLibrary: api.searchLibrary }))
const catalog = vi.hoisted(() => ({ findLibraryVoice: vi.fn(), provisionPlatformLibraryVoice: vi.fn() }))
vi.mock('./voice-catalog', async (orig) => ({ ...(await orig<object>()), ...catalog }))

import { applyCuratedVoices, proposeCuratedVoices } from './curated-voices'
import { createLogger } from '@/lib/observability/logger'

const log = createLogger({ test: true })
const OWNER = 'a'.repeat(64)
const lib = (id: string, extra: Record<string, unknown> = {}) => ({
  public_owner_id: OWNER, voice_id: id, name: `N ${id}`, gender: 'female', accent: 'standard', age: 'young', use_case: 'conversational', category: 'high_quality',
  language: 'ro', notice_period: 90, live_moderation_enabled: false, rate: null, fiat_rate: null, cloned_by_count: 10,
  verified_languages: [{ language: 'ro', model_id: 'eleven_flash_v2_5' }], preview_url: 'https://cdn.example/p.mp3', ...extra,
})

beforeEach(() => {
  state.db = memoryDb({ provider_voices: [], audit_log: [] })
  api.searchLibrary.mockReset()
  catalog.findLibraryVoice.mockReset()
  catalog.provisionPlatformLibraryVoice.mockReset()
})

describe('proposeCuratedVoices', () => {
  it('searches conversational studio-quality voices sorted by trending then clones; keeps usable voices verified for the language', async () => {
    api.searchLibrary
      .mockResolvedValueOnce({ voices: [lib('TrendA0000000000001'), lib('Moderated0000000001', { live_moderation_enabled: true }), lib('NotRo00000000000001', { verified_languages: [{ language: 'en' }] })], has_more: false })
      .mockResolvedValueOnce({ voices: [lib('TrendA0000000000001'), lib('Cloned00000000000001', { verified_languages: [{ language: 'ro', model_id: 'eleven_multilingual_v2' }] })], has_more: false })
    state.db.tables.provider_voices.push({ id: 'p', provider: 'elevenlabs', voice_id: 'WsCopyA000000000001', source: 'library', source_voice_id: 'TrendA0000000000001', owner_org_id: null, status: 'ready' })
    const [proposal] = await proposeCuratedVoices({ languages: ['ro'], perLanguage: 5, log })
    expect(api.searchLibrary).toHaveBeenNthCalledWith(1, expect.objectContaining({ language: 'ro', use_cases: ['conversational'], category: 'high_quality', sort: 'trending', min_notice_period_days: 30 }))
    expect(api.searchLibrary).toHaveBeenNthCalledWith(2, expect.objectContaining({ sort: 'cloned_by_count' }))
    expect(proposal.candidates.map((c) => [c.voice_id, c.language_fit, c.provisioned_voice_id])).toEqual([
      ['TrendA0000000000001', 2, 'WsCopyA000000000001'],
      ['Cloned00000000000001', 1, null],
    ])
    expect(proposal.error).toBeNull()
  })

  it('reports a failing language without stopping the others', async () => {
    api.searchLibrary.mockRejectedValueOnce(new Error('boom')).mockResolvedValue({ voices: [], has_more: false })
    const out = await proposeCuratedVoices({ languages: ['ro', 'en'], perLanguage: 3, log })
    expect(out.map((p) => [p.language, p.error === null])).toEqual([['ro', false], ['en', true]])
  })
})

describe('applyCuratedVoices', () => {
  it('re-validates against the library, provisions platform-wide, sets featured languages and rank, audits', async () => {
    catalog.findLibraryVoice.mockImplementation(async (_o: string, id: string) => (id === 'Gone000000000000001' ? null : lib(id)))
    catalog.provisionPlatformLibraryVoice.mockImplementation(async ({ lib: l }: { lib: { voice_id: string } }) => {
      state.db.tables.provider_voices.push({ id: `row-${l.voice_id}`, provider: 'elevenlabs', voice_id: `Ws${l.voice_id}`.slice(0, 20), owner_org_id: null, featured_languages: null })
      return { voiceId: `Ws${l.voice_id}`.slice(0, 20), provisioned: true }
    })
    const res = await applyCuratedVoices({
      approve: [
        { language: 'ro', public_owner_id: OWNER, voice_id: 'Good000000000000001', rank: 1 },
        { language: 'ro', public_owner_id: OWNER, voice_id: 'Gone000000000000001', rank: 2 },
        { language: 'de', public_owner_id: OWNER, voice_id: 'Good000000000000001', rank: 1 },
      ],
      remove: [{ language: 'en', voice_id: 'Missing000000000001' }],
      actor: { userId: null, kind: 'admin_token' },
      log,
    })
    expect(res.approved.map((a) => a.status)).toEqual(['curated', 'not_available', 'language_not_verified'])
    expect(res.removed).toEqual([{ language: 'en', voice_id: 'Missing000000000001', status: 'not_found' }])
    expect(state.db.tables.provider_voices[0]).toMatchObject({ featured_languages: ['ro'], featured_rank: 1 })
    expect(state.db.tables.audit_log).toEqual([expect.objectContaining({ action: 'voice.curated.added', org_id: null, actor_kind: 'admin_token' })])
  })

  it('removing curation clears the language (and the rank when none is left)', async () => {
    state.db.tables.provider_voices.push({ id: 'r', provider: 'elevenlabs', voice_id: 'Curated0000000000001', owner_org_id: null, featured_languages: ['ro'], featured_rank: 3 })
    const res = await applyCuratedVoices({ approve: [], remove: [{ language: 'ro', voice_id: 'Curated0000000000001' }], actor: { userId: 'admin-1', kind: 'admin_user' }, log })
    expect(res.removed[0].status).toBe('removed')
    expect(state.db.tables.provider_voices[0]).toMatchObject({ featured_languages: null, featured_rank: null })
  })
})
