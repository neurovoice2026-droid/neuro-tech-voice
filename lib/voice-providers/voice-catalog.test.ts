import { beforeEach, describe, expect, it, vi } from 'vitest'

// ─── In-memory PostgREST-ish fake ────────────────────────────────────────────
type Row = Record<string, unknown>
class FakeDb {
  tables: Record<string, Row[]> = { provider_voices: [], audit_log: [], agents: [] }
  from(table: string) {
    return new Q(this, table)
  }
}
let idSeq = 0
class Q implements PromiseLike<{ data: unknown; error: { code: string; message: string } | null }> {
  private filters: Array<(r: Row) => boolean> = []
  private op: 'select' | 'insert' | 'update' | 'delete' = 'select'
  private payload: Row | null = null
  private mode: 'many' | 'maybe' | 'one' = 'many'
  private rangeArgs: [number, number] | null = null
  private limitN: number | null = null
  constructor(private db: FakeDb, private table: string) {}
  select() { return this }
  eq(c: string, v: unknown) { this.filters.push((r) => r[c] === v); return this }
  neq(c: string, v: unknown) { this.filters.push((r) => r[c] !== v); return this }
  gte(c: string, v: string) { this.filters.push((r) => String(r[c] ?? '') >= v); return this }
  is(c: string, v: unknown) { this.filters.push((r) => (r[c] ?? null) === v); return this }
  in(c: string, vs: unknown[]) { this.filters.push((r) => vs.includes(r[c])); return this }
  ilike(c: string, p: string) { const n = p.replace(/%/g, '').toLowerCase(); this.filters.push((r) => String(r[c] ?? '').toLowerCase().includes(n)); return this }
  or(expr: string) {
    const parts = expr.split(',').map((p) => p.split('.'))
    this.filters.push((r) =>
      parts.some(([c, op, v]) =>
        op === 'is' && v === 'null' ? (r[c] ?? null) === null
        : op === 'eq' ? r[c] === v
        : op === 'cs' ? Array.isArray(r[c]) && (r[c] as unknown[]).includes(v.replace(/[{}]/g, ''))
        : false,
      ),
    )
    return this
  }
  contains(c: string, vs: unknown[]) { this.filters.push((r) => Array.isArray(r[c]) && vs.every((v) => (r[c] as unknown[]).includes(v))); return this }
  order() { return this }
  range(a: number, b: number) { this.rangeArgs = [a, b]; return this }
  limit(n: number) { this.limitN = n; return this }
  maybeSingle() { this.mode = 'maybe'; return this }
  single() { this.mode = 'one'; return this }
  insert(row: Row) { this.op = 'insert'; this.payload = row; return this }
  update(p: Row) { this.op = 'update'; this.payload = p; return this }
  delete() { this.op = 'delete'; return this }
  private rows() { return (this.db.tables[this.table] ??= []) }
  private uniqueClash(candidate: Row, self: Row | null): boolean {
    if (this.table !== 'provider_voices') return false
    return this.rows().some((r) => r !== self && (
      (r.provider === candidate.provider && r.voice_id === candidate.voice_id) ||
      (r.source === 'library' && candidate.source === 'library' && r.provider === candidate.provider && r.source_voice_id === candidate.source_voice_id)))
  }
  private exec() {
    if (this.op === 'insert') {
      const row = { id: `row-${++idSeq}`, created_at: new Date().toISOString(), ...this.payload } as Row
      if (this.uniqueClash(row, null)) return { data: null, error: { code: '23505', message: 'duplicate key' } }
      this.rows().push(row)
      return { data: [row], error: null }
    }
    let matched = this.rows().filter((r) => this.filters.every((f) => f(r)))
    if (this.op === 'delete') {
      this.db.tables[this.table] = this.rows().filter((r) => !matched.includes(r))
      return { data: null, error: null }
    }
    if (this.op === 'update') {
      for (const r of matched) {
        const next = { ...r, ...this.payload }
        if (this.uniqueClash(next, r)) return { data: null, error: { code: '23505', message: 'duplicate key' } }
        Object.assign(r, this.payload)
      }
      return { data: matched.map((r) => ({ ...r })), error: null }
    }
    if (this.rangeArgs) matched = matched.slice(this.rangeArgs[0], this.rangeArgs[1] + 1)
    if (this.limitN !== null) matched = matched.slice(0, this.limitN)
    if (this.mode === 'maybe') {
      if (matched.length > 1) return { data: null, error: { code: 'PGRST116', message: 'multiple rows' } }
      return { data: matched[0] ? { ...matched[0] } : null, error: null }
    }
    if (this.mode === 'one') return matched.length === 1 ? { data: { ...matched[0] }, error: null } : { data: null, error: { code: 'PGRST116', message: 'not one' } }
    return { data: matched.map((r) => ({ ...r })), error: null }
  }
  then<A = { data: unknown; error: { code: string; message: string } | null }, B = never>(
    res?: ((v: { data: unknown; error: { code: string; message: string } | null }) => A | PromiseLike<A>) | null,
    rej?: ((e: unknown) => B | PromiseLike<B>) | null,
  ): PromiseLike<A | B> {
    return Promise.resolve().then(() => this.exec()).then(res, rej)
  }
}

const db = new FakeDb()
vi.mock('@/lib/supabase/admin', () => ({ createAdminClient: () => db }))
vi.mock('@/lib/api/auth', () => ({ requireOrg: vi.fn() }))

const el = vi.hoisted(() => ({
  isConfigured: vi.fn(() => true),
  voices: { get: vi.fn(), search: vi.fn(), delete: vi.fn(), addInstantClone: vi.fn() },
  sharedVoices: { list: vi.fn(), add: vi.fn() },
  textToSpeech: vi.fn(),
}))
vi.mock('@/lib/elevenlabs/client', () => el)
const elv = vi.hoisted(() => ({
  searchLibrary: vi.fn(),
  getVoiceQuota: vi.fn(async () => ({})),
  getVoicesByIds: vi.fn(),
  getVoiceDetail: vi.fn(),
  listWorkspaceVoices: vi.fn(),
  listAccents: vi.fn(),
  designVoice: vi.fn(),
  createVoiceFromPreview: vi.fn(),
  LIBRARY_SORTS: ['created_date', 'usage_character_count_1y', 'trending', 'cloned_by_count'],
  VOICE_DESIGN_MODELS: ['eleven_multilingual_ttv_v2', 'eleven_ttv_v3'],
}))
vi.mock('@/lib/elevenlabs/api/voices', () => elv)
const hist = vi.hoisted(() => ({
  listHistory: vi.fn(async (): Promise<{ history: Array<Record<string, unknown>>; has_more: boolean }> => ({ history: [], has_more: false })),
  deleteHistoryItem: vi.fn(),
}))
vi.mock('@/lib/elevenlabs/api/history', () => hist)
vi.mock('@/lib/cartesia/client', () => ({ isConfigured: () => true, voices: { list: vi.fn(), get: vi.fn(), previewAudio: vi.fn() } }))

import { ProviderError } from '@/lib/voice-providers/errors'
import { createLogger } from '@/lib/observability/logger'
import { RequestError, rateLimitedError } from '@/lib/api/http'
import * as vc from '@/lib/voice-providers/voice-catalog'
import { resetVoiceQuotaCache } from '@/lib/voice-providers/voice-capacity'
import { ProviderError as QuotaError } from '@/lib/voice-providers/errors'

const ORG_A = '11111111-1111-4111-8111-111111111111'
const ORG_B = '22222222-2222-4222-8222-222222222222'
const log = createLogger({ test: true })

const premade = { voice_id: 'PremadeVoice00000001', name: 'Ada', category: 'premade', labels: { gender: 'female', accent: 'american', language: 'en' }, preview_url: 'https://cdn.example/ada.mp3', verified_languages: [{ language: 'en' }, { language: 'ro', accent: 'romanian', preview_url: 'https://cdn.example/ada-ro.mp3' }] }
const strayClone = { voice_id: 'StrayClone0000000001', name: 'Other org clone', category: 'cloned', labels: {} }
const owner = 'a'.repeat(64)
const libVoice = (id: string, extra: Record<string, unknown> = {}) => ({ public_owner_id: owner, voice_id: id, name: `Lib ${id}`, gender: 'male', language: 'ro', accent: 'romanian', age: 'middle_aged', category: 'professional', preview_url: 'https://cdn.example/lib.mp3', notice_period: 90, live_moderation_enabled: false, fiat_rate: null, rate: null, ...extra })

beforeEach(() => {
  db.tables = { provider_voices: [], audit_log: [], agents: [] }
  for (const fn of [el.voices.get, el.voices.search, el.voices.delete, el.voices.addInstantClone, el.sharedVoices.list, el.sharedVoices.add, el.textToSpeech, elv.searchLibrary]) fn.mockReset()
  el.isConfigured.mockReturnValue(true)
  el.voices.search.mockResolvedValue({ voices: [premade, strayClone], has_more: false })
  vc.resetZeroRetentionState()
  resetVoiceQuotaCache()
  vc.resetLibraryHeadroomCache()
  elv.getVoiceQuota.mockReset().mockResolvedValue({})
})

describe('pure helpers', () => {
  it('sniffs audio containers', () => {
    const b = (...xs: number[]) => new Uint8Array([...xs, ...new Array(16).fill(0)])
    const s = (t: string, pad = 16) => new Uint8Array([...Buffer.from(t), ...new Array(pad).fill(0)])
    expect(vc.sniffAudio(new Uint8Array([...Buffer.from('RIFF'), 0, 0, 0, 0, ...Buffer.from('WAVE')]))).toBe('wav')
    expect(vc.sniffAudio(s('OggS'))).toBe('ogg')
    expect(vc.sniffAudio(b(0x1a, 0x45, 0xdf, 0xa3))).toBe('webm')
    expect(vc.sniffAudio(new Uint8Array([0, 0, 0, 0x20, ...Buffer.from('ftypM4A ')]))).toBe('m4a')
    expect(vc.sniffAudio(s('ID3'))).toBe('mp3')
    expect(vc.sniffAudio(b(0xff, 0xfb, 0x90))).toBe('mp3')
    expect(vc.sniffAudio(b(0xff, 0xe8))).toBeNull() // reserved version
    expect(vc.sniffAudio(s('%PDF'))).toBeNull()
  })
  it('normalizes gender and language', () => {
    expect(vc.normalizeGender('female')).toBe('female')
    expect(vc.normalizeGender('Male')).toBe('male')
    expect(vc.normalizeGender('feminine')).toBe('female')
    expect(vc.normalizeGender('masculine')).toBe('male')
    expect(vc.normalizeGender('gender_neutral')).toBe('neutral')
    expect(vc.normalizeLanguage('en-US')).toBe('en')
    expect(vc.normalizeLanguage('Romanian')).toBe('ro')
    expect(vc.normalizeLanguage('Chinese')).toBe('zh')
    expect(vc.normalizeLanguage('???')).toBeNull()
  })
  it('localized preview text', () => {
    expect(vc.defaultPreviewText('ro')).toContain('mulțumim')
    expect(vc.defaultPreviewText('xx')).toMatch(/^Hello/)
    expect(vc.cleanText('a\u0000b\n c', 200)).toBe('a b c')
    expect(Array.from(vc.cleanText('é'.repeat(300), 200))).toHaveLength(200)
  })
  it('hashes the first forwarded ip', () => {
    expect(vc.hashClientIp('1.2.3.4, 10.0.0.1')).toMatch(/^[0-9a-f]{64}$/)
    expect(vc.hashClientIp('1.2.3.4')).toBe(vc.hashClientIp('1.2.3.4 , 9.9.9.9'))
    expect(vc.hashClientIp(null)).toBeNull()
  })
})

describe('listVoices', () => {
  it('workspace: own + platform rows only (default voices are retired), paginated', async () => {
    db.tables.provider_voices.push(
      { id: 'r1', provider: 'elevenlabs', voice_id: 'OwnClone000000000001', source: 'cloned', owner_org_id: ORG_A, name: 'Mine', status: 'ready', language: 'en' },
      { id: 'r2', provider: 'elevenlabs', voice_id: 'OtherClone0000000001', source: 'cloned', owner_org_id: ORG_B, name: 'Theirs', status: 'ready', language: 'en' },
      { id: 'r3', provider: 'elevenlabs', voice_id: 'LibCopy0000000000001', source: 'library', source_public_owner_id: owner, source_voice_id: 'LibOrig000000000001', owner_org_id: null, name: 'Platform lib', status: 'ready', language: 'en' },
      { id: 'r4', provider: 'elevenlabs', voice_id: 'Deleted0000000000001', source: 'cloned', owner_org_id: ORG_A, name: 'Gone', status: 'deleted', language: 'en' },
    )
    const ids: string[] = []
    let token: string | null = null
    for (let i = 0; i < 10; i++) {
      const page: vc.VoiceCatalogPage = await vc.listVoices(ORG_A, { source: 'workspace', pageSize: 1, pageToken: token })
      expect(page.voices.length).toBeLessThanOrEqual(1)
      ids.push(...page.voices.map((v) => v.voiceId))
      token = page.next_page_token
      if (!token) break
    }
    expect(ids.sort()).toEqual(['LibCopy0000000000001', 'OwnClone000000000001'].sort())
    expect(el.voices.search).not.toHaveBeenCalled()
  })

  it('workspace: multilingual and curated voices match the language; voices with a lifecycle notice are hidden', async () => {
    db.tables.provider_voices.push(
      { id: 'm1', provider: 'elevenlabs', voice_id: 'Multi000000000000001', source: 'library', owner_org_id: null, name: 'Multi', status: 'ready', language: 'en', languages: ['en', 'ro'] },
      { id: 'm2', provider: 'elevenlabs', voice_id: 'Curated0000000000001', source: 'library', owner_org_id: null, name: 'Curated', status: 'ready', language: 'en', languages: ['en'], featured_languages: ['ro'], featured_rank: 1 },
      { id: 'm3', provider: 'elevenlabs', voice_id: 'Retiring000000000001', source: 'library', owner_org_id: null, name: 'Retiring', status: 'ready', language: 'ro', languages: ['ro'], notice: 'removal_scheduled' },
      { id: 'm4', provider: 'elevenlabs', voice_id: 'English0000000000001', source: 'library', owner_org_id: null, name: 'English', status: 'ready', language: 'en', languages: ['en'] },
    )
    const page = await vc.listVoices(ORG_A, { source: 'workspace', language: 'ro' })
    expect(page.voices.map((v) => v.voiceId).sort()).toEqual(['Curated0000000000001', 'Multi000000000000001'])
    expect(page.voices.find((v) => v.voiceId === 'Multi000000000000001')).toMatchObject({ language: 'ro' })
    expect(page.voices.find((v) => v.voiceId === 'Curated0000000000001')).toMatchObject({ recommended: true })
    expect(page.voices.find((v) => v.voiceId === 'Multi000000000000001')?.recommended).toBeUndefined()
  })

  it('library: conversational voices by default, filters unusable voices, ranks the language first, marks provisioned ones', async () => {
    db.tables.provider_voices.push({ id: 'r9', provider: 'elevenlabs', voice_id: 'WsCopy00000000000001', source: 'library', source_public_owner_id: owner, source_voice_id: 'LibA0000000000000001', owner_org_id: null, status: 'ready' })
    elv.searchLibrary.mockResolvedValue({
      voices: [
        libVoice('LibA0000000000000001'),
        libVoice('LibB0000000000000001', { verified_languages: [{ language: 'ro', model_id: 'eleven_flash_v2_5' }] }),
        libVoice('LibC0000000000000001', { live_moderation_enabled: true }),
        libVoice('LibD0000000000000001', { fiat_rate: 0.3 }),
      ],
      has_more: true,
    })
    const page = await vc.listVoices(ORG_A, { source: 'library', language: 'ro', gender: 'male', search: 'x%_*,()', accent: 'Romanian', age: 'young', highQuality: true, sort: 'trending' })
    expect(elv.searchLibrary).toHaveBeenCalledWith(
      expect.objectContaining({ page: 0, language: 'ro', gender: 'male', min_notice_period_days: 30, search: 'x', use_cases: ['conversational'], accent: 'romanian', age: 'young', category: 'high_quality', sort: 'trending' }),
    )
    // LibB is verified for Romanian with the agent's model: ranked first.
    expect(page.voices.map((v) => [v.voiceId, v.requiresProvisioning])).toEqual([['LibB0000000000000001', true], ['WsCopy00000000000001', false]])
    expect(page.voices[0].libraryRef).toEqual({ publicOwnerId: owner, voiceId: 'LibB0000000000000001' })
    const next = await vc.listVoices(ORG_A, { source: 'library', pageToken: page.next_page_token, useCase: 'all' })
    expect(elv.searchLibrary).toHaveBeenLastCalledWith(expect.objectContaining({ page: 1, use_cases: undefined }))
    expect(next.voices).toBeDefined()
  })

  it('rejects tampered or cross-source page tokens', async () => {
    await expect(vc.listVoices(ORG_A, { source: 'workspace', pageToken: 'not a token!' })).rejects.toBeInstanceOf(RequestError)
    const libToken = vc.libraryPageToken(2) as string
    await expect(vc.listVoices(ORG_A, { source: 'workspace', pageToken: libToken })).rejects.toMatchObject({ status: 400 })
  })
})

describe('assertVoiceEligible', () => {
  it('rejects another org clone and unregistered workspace voices with the same 403', async () => {
    db.tables.provider_voices.push({ id: 'r2', provider: 'elevenlabs', voice_id: 'OtherClone0000000001', source: 'cloned', owner_org_id: ORG_B, status: 'ready' })
    await expect(vc.assertVoiceEligible(ORG_A, { voiceId: 'OtherClone0000000001' })).rejects.toMatchObject({ status: 403 })
    el.voices.get.mockResolvedValueOnce(strayClone)
    await expect(vc.assertVoiceEligible(ORG_A, { voiceId: strayClone.voice_id })).rejects.toMatchObject({ status: 403 })
    el.voices.get.mockRejectedValueOnce(new ProviderError({ system: 'elevenlabs', operation: 'voices.get', code: 'not_found' }))
    await expect(vc.assertVoiceEligible(ORG_A, { voiceId: 'Missing0000000000001' })).rejects.toMatchObject({ status: 403 })
  })
  it('refuses default (premade) voices as a new pick, keeps them for the agent already on one', async () => {
    el.voices.get.mockResolvedValueOnce(premade)
    await expect(vc.assertVoiceEligible(ORG_A, { voiceId: premade.voice_id })).rejects.toMatchObject({ status: 403, details: { reason: 'voice_retiring' } })
    el.voices.get.mockResolvedValueOnce(premade)
    await expect(vc.assertVoiceEligible(ORG_A, { voiceId: premade.voice_id, currentVoiceId: 'SomethingElse0000001' })).rejects.toMatchObject({ status: 403 })
    el.voices.get.mockResolvedValueOnce(premade)
    await expect(vc.assertVoiceEligible(ORG_A, { voiceId: premade.voice_id, currentVoiceId: premade.voice_id })).resolves.toMatchObject({ kind: 'default' })
  })
  it('refuses registry voices with a lifecycle notice as a new pick only', async () => {
    db.tables.provider_voices.push({ id: 'n1', provider: 'elevenlabs', voice_id: 'Noticed0000000000001', source: 'library', source_public_owner_id: owner, source_voice_id: 'NoticedLib0000000001', owner_org_id: null, status: 'ready', notice: 'removal_scheduled' })
    await expect(vc.assertVoiceEligible(ORG_A, { voiceId: 'Noticed0000000000001' })).rejects.toMatchObject({ status: 403, details: { reason: 'voice_retiring' } })
    await expect(vc.assertVoiceEligible(ORG_A, { voiceId: 'Noticed0000000000001', libraryRef: { publicOwnerId: owner, voiceId: 'NoticedLib0000000001' } })).rejects.toMatchObject({ status: 403 })
    await expect(vc.assertVoiceEligible(ORG_A, { voiceId: 'Noticed0000000000001', currentVoiceId: 'Noticed0000000000001' })).resolves.toMatchObject({ kind: 'registry' })
  })
  it('accepts own clones and library voices (validated by owner lookup)', async () => {
    db.tables.provider_voices.push({ id: 'r1', provider: 'elevenlabs', voice_id: 'OwnClone000000000001', source: 'cloned', owner_org_id: ORG_A, status: 'ready' })
    await expect(vc.assertVoiceEligible(ORG_A, { voiceId: 'OwnClone000000000001' })).resolves.toMatchObject({ kind: 'registry' })
    el.sharedVoices.list.mockResolvedValue({ voices: [libVoice('LibE0000000000000001')], has_more: false })
    const r = await vc.assertVoiceEligible(ORG_A, { voiceId: 'LibE0000000000000001', libraryRef: { publicOwnerId: owner, voiceId: 'LibE0000000000000001' } })
    expect(r).toMatchObject({ kind: 'library', requiresProvisioning: true })
    expect(el.sharedVoices.list).toHaveBeenCalledWith(expect.objectContaining({ owner_id: owner }))
    await expect(vc.assertVoiceEligible(ORG_A, { voiceId: 'LibF0000000000000001', libraryRef: { publicOwnerId: owner, voiceId: 'LibF0000000000000001' } })).rejects.toMatchObject({ status: 403 })
    // voice_id must match the ref when not provisioned
    await expect(vc.assertVoiceEligible(ORG_A, { voiceId: 'OwnClone000000000001', libraryRef: { publicOwnerId: owner, voiceId: 'LibE0000000000000001' } })).rejects.toMatchObject({ status: 403 })
  })
})

describe('provisionLibraryVoice', () => {
  it('is deduplicated under concurrency and discards the losing copy', async () => {
    const lib = libVoice('LibG0000000000000001')
    let n = 0
    el.sharedVoices.add.mockImplementation(async () => ({ voice_id: `WsCopyG00000000000${++n}0` }))
    el.voices.delete.mockResolvedValue({ status: 'ok' })
    const ref = { publicOwnerId: owner, voiceId: lib.voice_id }
    const [a, b] = await Promise.all([
      vc.provisionLibraryVoice({ orgId: ORG_A, userId: 'u1', libraryRef: ref, libraryVoice: lib, log }),
      vc.provisionLibraryVoice({ orgId: ORG_B, userId: 'u2', libraryRef: ref, libraryVoice: lib, log }),
    ])
    expect(a.voiceId).toBe(b.voiceId)
    expect(db.tables.provider_voices).toHaveLength(1)
    expect(db.tables.provider_voices[0]).toMatchObject({ owner_org_id: null, source: 'library', status: 'ready' })
    expect(el.voices.delete).toHaveBeenCalledTimes(1)
    expect(db.tables.audit_log.filter((r) => r.action === 'voice.library.provisioned')).toHaveLength(1)
    // third call reuses the row without a provider call
    const c = await vc.provisionLibraryVoice({ orgId: ORG_A, userId: 'u1', libraryRef: ref, log })
    expect(c).toEqual({ voiceId: a.voiceId, provisioned: false })
    expect(el.sharedVoices.add).toHaveBeenCalledTimes(2)
  })
  it('reuses an existing workspace copy on 409', async () => {
    const lib = libVoice('LibH0000000000000001')
    el.sharedVoices.add.mockRejectedValue(new ProviderError({ system: 'elevenlabs', operation: 'shared_voices.add', code: 'conflict' }))
    el.voices.search.mockResolvedValue({ voices: [{ voice_id: 'OldCopyH000000000001', name: 'x', category: 'professional', sharing: { original_voice_id: lib.voice_id } }], has_more: false })
    const r = await vc.provisionLibraryVoice({ orgId: ORG_A, userId: 'u1', libraryRef: { publicOwnerId: owner, voiceId: lib.voice_id }, libraryVoice: lib, log })
    expect(r.voiceId).toBe('OldCopyH000000000001')
    expect(el.voices.delete).not.toHaveBeenCalled()
  })
})

describe('synthesizePreview', () => {
  it('409 for unprovisioned library voices; the current (even retiring) voice is spoken like a call', async () => {
    await expect(vc.synthesizePreview({ orgId: ORG_A, voiceId: 'LibZ0000000000000001', libraryRef: { publicOwnerId: owner, voiceId: 'LibZ0000000000000001' }, text: 'hi', language: 'en' })).rejects.toBeInstanceOf(vc.VoiceNotProvisionedError)
    expect(el.sharedVoices.list).not.toHaveBeenCalled()
    el.textToSpeech.mockResolvedValueOnce(new ArrayBuffer(4))
    await vc.synthesizePreview({
      orgId: ORG_A,
      voiceId: premade.voice_id,
      libraryRef: null,
      text: 'x'.repeat(500),
      language: 'ro',
      currentAgentVoiceId: premade.voice_id,
      sound: { tuning: { stability: 0.3, similarity_boost: null, speed: 2 }, pronunciation: { dictionaryId: 'dict_abc123', versionId: 'ver_abc123' } },
    })
    const [vid, text, model, lang, opts] = el.textToSpeech.mock.calls[0]
    expect([vid, text.length, model, lang]).toEqual([premade.voice_id, 200, 'eleven_flash_v2_5', 'ro'])
    expect(opts).toEqual({
      voiceSettings: { stability: 0.3, similarity_boost: 0.8, speed: 1.2 },
      pronunciationLocators: [{ pronunciation_dictionary_id: 'dict_abc123', version_id: 'ver_abc123' }],
      outputFormat: 'mp3_22050_32',
      enableLogging: false,
    })
  })
  it('own clone with default tuning; a premade voice that is not the current one is refused', async () => {
    db.tables.provider_voices.push({ id: 'c1', provider: 'elevenlabs', voice_id: 'OwnClone000000000001', source: 'cloned', owner_org_id: ORG_A, status: 'ready' })
    el.textToSpeech.mockResolvedValueOnce(new ArrayBuffer(4))
    await vc.synthesizePreview({ orgId: ORG_A, voiceId: 'OwnClone000000000001', libraryRef: null, text: '  ', language: 'en', sound: { phoneQuality: true } })
    expect(el.textToSpeech.mock.calls[0][1]).toMatch(/^Hello!/)
    expect(el.textToSpeech.mock.calls[0][2]).toBe('eleven_flash_v2')
    expect(el.textToSpeech.mock.calls[0][4]).toMatchObject({ voiceSettings: { stability: 0.5, similarity_boost: 0.8, speed: 1 }, pronunciationLocators: [], outputFormat: 'wav_8000' })
    el.voices.get.mockResolvedValueOnce(premade)
    await expect(vc.synthesizePreview({ orgId: ORG_A, voiceId: premade.voice_id, libraryRef: null, text: 'x', language: 'en', currentAgentVoiceId: 'OwnClone000000000001' })).rejects.toMatchObject({ status: 403 })
  })
  it('falls back to a logged request once when zero retention is refused (non-enterprise)', async () => {
    db.tables.provider_voices.push({ id: 'c2', provider: 'elevenlabs', voice_id: 'OwnClone000000000002', source: 'cloned', owner_org_id: ORG_A, status: 'ready' })
    el.textToSpeech
      .mockRejectedValueOnce(new ProviderError({ system: 'elevenlabs', operation: 'tts.convert', code: 'auth', status: 403, detail: 'zero_retention_mode_not_allowed - enterprise only' }))
      .mockResolvedValue(new ArrayBuffer(4))
    await vc.synthesizePreview({ orgId: ORG_A, voiceId: 'OwnClone000000000002', libraryRef: null, text: 'hi', language: 'en' })
    expect(el.textToSpeech).toHaveBeenCalledTimes(2)
    expect(el.textToSpeech.mock.calls[0][4]).toMatchObject({ enableLogging: false })
    expect(el.textToSpeech.mock.calls[1][4].enableLogging).toBeUndefined()
    // Later previews skip zero retention on this instance.
    await vc.synthesizePreview({ orgId: ORG_A, voiceId: 'OwnClone000000000002', libraryRef: null, text: 'hi', language: 'en' })
    expect(el.textToSpeech).toHaveBeenCalledTimes(3)
    // Other provider errors are not swallowed.
    vc.resetZeroRetentionState()
    el.textToSpeech.mockRejectedValueOnce(new ProviderError({ system: 'elevenlabs', operation: 'tts.convert', code: 'auth', status: 401, detail: 'invalid_api_key' }))
    await expect(vc.synthesizePreview({ orgId: ORG_A, voiceId: 'OwnClone000000000002', libraryRef: null, text: 'hi', language: 'en' })).rejects.toMatchObject({ code: 'auth' })
  })
})

describe('clones', () => {
  it('creates a clone with consent and deletes it unless in use', async () => {
    el.voices.addInstantClone.mockResolvedValue({ voice_id: 'NewClone000000000001', requires_verification: false })
    const r = await vc.createInstantClone({ orgId: ORG_A, userId: 'u1', name: 'Front desk', speakerName: 'Ana Pop', language: 'ro', samples: [{ file: new Blob([new Uint8Array(2048)]), kind: 'wav', mime: 'audio/wav' }], ipHash: 'abc', log })
    expect(r.voice).toMatchObject({ voiceId: 'NewClone000000000001', source: 'cloned' })
    const row = db.tables.provider_voices[0]
    expect(row).toMatchObject({ owner_org_id: ORG_A, source: 'cloned', status: 'ready' })
    expect(row.consent).toMatchObject({ user_id: 'u1', speaker_name: 'Ana Pop', statement_version: '2026-10', ip_hash: 'abc' })
    expect(el.voices.addInstantClone.mock.calls[0][0].files[0].filename).toBe('sample-1.wav')

    // other org cannot delete
    await expect(vc.deleteOrgClone({ orgId: ORG_B, userId: 'u2', voiceId: 'NewClone000000000001', log })).rejects.toMatchObject({ status: 404 })
    db.tables.agents.push({ id: 'a1', org_id: ORG_A, voice_id: 'NewClone000000000001' })
    await expect(vc.deleteOrgClone({ orgId: ORG_A, userId: 'u1', voiceId: 'NewClone000000000001', log })).rejects.toMatchObject({ status: 409 })
    expect(row.status).toBe('ready')
    db.tables.agents = []
    el.voices.delete.mockRejectedValueOnce(new ProviderError({ system: 'elevenlabs', operation: 'voices.delete', code: 'upstream' }))
    await expect(vc.deleteOrgClone({ orgId: ORG_A, userId: 'u1', voiceId: 'NewClone000000000001', log })).rejects.toBeInstanceOf(ProviderError)
    expect(row.status).toBe('ready') // restored
    el.voices.delete.mockRejectedValueOnce(new ProviderError({ system: 'elevenlabs', operation: 'voices.delete', code: 'not_found' }))
    await vc.deleteOrgClone({ orgId: ORG_A, userId: 'u1', voiceId: 'NewClone000000000001', log })
    expect(row.status).toBe('deleted')
    expect(db.tables.audit_log.map((a) => a.action)).toEqual(['voice.clone.created', 'voice.clone.deleted'])
  })
  it('compensates when the registry write fails', async () => {
    el.voices.addInstantClone.mockResolvedValue({ voice_id: 'Clash000000000000001' })
    db.tables.provider_voices.push({ id: 'x', provider: 'elevenlabs', voice_id: 'Clash000000000000001', source: 'cloned', owner_org_id: ORG_B, status: 'ready' })
    el.voices.delete.mockResolvedValue({ status: 'ok' })
    await expect(vc.createInstantClone({ orgId: ORG_A, userId: 'u1', name: 'n', speakerName: 's', language: null, samples: [{ file: new Blob([new Uint8Array(2048)]), kind: 'mp3', mime: 'audio/mpeg' }], ipHash: null, log })).rejects.toThrow()
    expect(el.voices.delete).toHaveBeenCalledWith('Clash000000000000001', { orgId: ORG_A })
  })
  it('deletes and rejects a clone the provider holds for verification', async () => {
    const sample = { file: new Blob([new Uint8Array(2048)]), kind: 'wav' as const, mime: 'audio/wav' }
    el.voices.addInstantClone.mockResolvedValue({ voice_id: 'Verify00000000000001', requires_verification: true })
    el.voices.delete.mockResolvedValue({ status: 'ok' })
    const err = await vc.createInstantClone({ orgId: ORG_A, userId: 'u1', name: 'Front desk', speakerName: 'Ana Pop', language: 'ro', samples: [sample], ipHash: 'abc', log }).catch((e: unknown) => e)
    expect(err).toMatchObject({ status: 422, message: 'This voice could not be cloned automatically. Try different recordings.' })
    expect(el.voices.delete).toHaveBeenCalledWith('Verify00000000000001', { orgId: ORG_A })
    // No usable or pending row: only a 'deleted' one holding the consent evidence.
    expect(db.tables.provider_voices).toHaveLength(1)
    expect(db.tables.provider_voices[0]).toMatchObject({ voice_id: 'Verify00000000000001', owner_org_id: ORG_A, status: 'deleted' })
    expect(db.tables.provider_voices[0].deleted_at).toEqual(expect.any(String))
    expect(db.tables.provider_voices[0].consent).toMatchObject({ user_id: 'u1', speaker_name: 'Ana Pop' })
    expect(db.tables.audit_log).toHaveLength(1)
    expect(db.tables.audit_log[0]).toMatchObject({ action: 'voice.clone.rejected_verification', target_id: 'Verify00000000000001', details: { provider_deleted: true } })
    // The route maps it to a 422 with the product message.
    const res = vc.voiceErrorResponse(err, log, 'e', 'rid')
    expect(res.status).toBe(422)
    expect(await res.json()).toMatchObject({ error: 'This voice could not be cloned automatically. Try different recordings.' })
    // Never offered in the catalog.
    expect(await vc.deleteOrgClone({ orgId: ORG_A, userId: 'u1', voiceId: 'Verify00000000000001', log }).catch((e: unknown) => e)).toMatchObject({ status: 404 })
  })
  it('still rejects a verification-held clone when the provider delete fails', async () => {
    const sample = { file: new Blob([new Uint8Array(2048)]), kind: 'mp3' as const, mime: 'audio/mpeg' }
    el.voices.addInstantClone.mockResolvedValue({ voice_id: 'Verify00000000000002', requires_verification: true })
    el.voices.delete.mockRejectedValueOnce(new ProviderError({ system: 'elevenlabs', operation: 'voices.delete', code: 'upstream' }))
    await expect(vc.createInstantClone({ orgId: ORG_A, userId: 'u1', name: 'n', speakerName: 's', language: null, samples: [sample], ipHash: null, log })).rejects.toMatchObject({ status: 422 })
    // Still at the provider: kept as 'failed' (never listed) so maintenance retries the delete.
    expect(db.tables.provider_voices[0]).toMatchObject({ status: 'failed', deleted_at: null })
    expect(db.tables.audit_log[0]).toMatchObject({ action: 'voice.clone.rejected_verification', details: { provider_deleted: false } })

    el.voices.addInstantClone.mockResolvedValue({ voice_id: 'Verify00000000000003', requires_verification: true })
    el.voices.delete.mockRejectedValueOnce(new ProviderError({ system: 'elevenlabs', operation: 'voices.delete', code: 'not_found' }))
    await expect(vc.createInstantClone({ orgId: ORG_A, userId: 'u1', name: 'n', speakerName: 's', language: null, samples: [sample], ipHash: null, log })).rejects.toMatchObject({ status: 422 })
    expect(db.tables.audit_log[1]).toMatchObject({ details: { provider_deleted: true } })
    expect(db.tables.provider_voices[1]).toMatchObject({ status: 'deleted' })

    // Maintenance retries the failed provider delete and then marks the row deleted.
    el.voices.delete.mockResolvedValueOnce(undefined)
    expect(await vc.purgeRejectedClones(5, log)).toEqual({ purged: 1, failed: 0 })
    expect(db.tables.provider_voices[0]).toMatchObject({ status: 'deleted' })
  })
})

describe('slice F: provisioning, custom voices, capacity', () => {
  it('reuses the existing workspace copy when the provider answers "already exists" with 400/422', async () => {
    const lib = libVoice('LibK0000000000000001')
    el.sharedVoices.add.mockRejectedValue(new ProviderError({ system: 'elevenlabs', operation: 'shared_voices.add', code: 'validation', status: 400, detail: 'voice_already_exists - You already have this voice' }))
    el.voices.search.mockResolvedValue({ voices: [{ voice_id: 'OldCopyK000000000001', name: 'x', category: 'professional', sharing: { original_voice_id: lib.voice_id, public_owner_id: owner, status: 'copied' } }], has_more: false })
    const r = await vc.provisionLibraryVoice({ orgId: ORG_A, userId: 'u1', libraryRef: { publicOwnerId: owner, voiceId: lib.voice_id }, libraryVoice: lib, log })
    expect(r.voiceId).toBe('OldCopyK000000000001')
    expect(vc.isAlreadyAddedError(new ProviderError({ system: 'elevenlabs', operation: 'shared_voices.add', code: 'validation', status: 422, detail: 'body.new_name: field required' }))).toBe(false)
  })

  it('platform rows keep no tenant user id, store every verified language, and the actor stays in the audit log', async () => {
    const lib = libVoice('LibL0000000000000001', { language: 'en', verified_languages: [{ language: 'en' }, { language: 'ro', model_id: 'eleven_flash_v2_5' }] })
    el.sharedVoices.add.mockResolvedValue({ voice_id: 'WsCopyL0000000000001' })
    await vc.provisionLibraryVoice({ orgId: ORG_A, userId: 'u1', libraryRef: { publicOwnerId: owner, voiceId: lib.voice_id }, libraryVoice: lib, log })
    expect(db.tables.provider_voices[0]).toMatchObject({ owner_org_id: null, created_by: null, language: 'en', languages: ['en', 'ro'] })
    expect(db.tables.audit_log.find((a) => a.action === 'voice.library.provisioned')).toMatchObject({ org_id: ORG_A, actor_user_id: 'u1' })
    // The add/edit operation was reserved against the org's library-add cap before the provider call.
    expect(db.tables.audit_log.find((a) => a.action === 'voice.library.add_reserved')).toMatchObject({ org_id: ORG_A, actor_user_id: 'u1', target_id: lib.voice_id })
  })

  it('a deleted/failed registry row reuses a still-usable workspace copy instead of adding a new one', async () => {
    const lib = libVoice('LibM0000000000000001')
    db.tables.provider_voices.push({ id: 'old', provider: 'elevenlabs', voice_id: 'OldCopyM000000000001', source: 'library', source_voice_id: lib.voice_id, source_public_owner_id: owner, owner_org_id: null, status: 'deleted' })
    el.voices.search.mockResolvedValue({ voices: [{ voice_id: 'OldCopyM000000000001', name: 'x', category: 'professional', sharing: { original_voice_id: lib.voice_id, status: 'copied' } }], has_more: false })
    const r = await vc.provisionLibraryVoice({ orgId: ORG_A, userId: 'u1', libraryRef: { publicOwnerId: owner, voiceId: lib.voice_id }, libraryVoice: lib, log })
    expect(r).toEqual({ voiceId: 'OldCopyM000000000001', provisioned: true })
    expect(el.sharedVoices.add).not.toHaveBeenCalled()
    expect(db.tables.provider_voices[0]).toMatchObject({ status: 'ready' })
  })

  it('a full workspace (add/edit limit) answers 503 voice_capacity without calling the provider', async () => {
    elv.getVoiceQuota.mockResolvedValueOnce({ voice_add_edit_counter: 10, max_voice_add_edits: 10 })
    const lib = libVoice('LibN0000000000000001')
    const err = await vc.provisionLibraryVoice({ orgId: ORG_A, userId: 'u1', libraryRef: { publicOwnerId: owner, voiceId: lib.voice_id }, libraryVoice: lib, log }).catch((e: unknown) => e)
    expect(el.sharedVoices.add).not.toHaveBeenCalled()
    const res = vc.voiceErrorResponse(err, log, 'e', 'rid')
    expect(res.status).toBe(503)
    expect(await res.json()).toMatchObject({ code: 'voice_capacity' })
  })

  it('deletes a designed voice like a clone and purges its previews from the speech history', async () => {
    db.tables.provider_voices.push({ id: 'd1', provider: 'elevenlabs', voice_id: 'Designed000000000001', source: 'designed', owner_org_id: ORG_A, status: 'ready' })
    el.voices.delete.mockResolvedValue({ status: 'ok' })
    hist.listHistory.mockResolvedValueOnce({ history: [{ history_item_id: 'h1', voice_id: 'Designed000000000001', date_unix: 1, state: 'created' }], has_more: false })
    hist.deleteHistoryItem.mockResolvedValue({ status: 'ok' })
    await vc.deleteOrgClone({ orgId: ORG_A, userId: 'u1', voiceId: 'Designed000000000001', log })
    expect(db.tables.provider_voices[0]).toMatchObject({ status: 'deleted' })
    expect(hist.deleteHistoryItem).toHaveBeenCalledWith('h1')
    expect(db.tables.audit_log.map((a) => a.action)).toContain('voice.design.deleted')
  })

  it('a clone created over the per-org cap by a concurrent request is undone (409)', async () => {
    db.tables.provider_voices.push(
      { id: 'c1', provider: 'elevenlabs', voice_id: 'Existing000000000001', source: 'cloned', owner_org_id: ORG_A, status: 'ready', created_at: '2026-01-01T00:00:00Z' },
      { id: 'c2', provider: 'elevenlabs', voice_id: 'Existing000000000002', source: 'designed', owner_org_id: ORG_A, status: 'ready', created_at: '2026-01-02T00:00:00Z' },
    )
    el.voices.addInstantClone.mockResolvedValue({ voice_id: 'Racing00000000000001', requires_verification: false })
    el.voices.delete.mockResolvedValue({ status: 'ok' })
    const sample = { file: new Blob([new Uint8Array(2048)]), kind: 'wav' as const, mime: 'audio/wav' }
    await expect(vc.createInstantClone({ orgId: ORG_A, userId: 'u1', name: 'n', speakerName: 's', language: 'ro', samples: [sample], ipHash: null, log, gender: 'male' })).rejects.toMatchObject({ status: 409 })
    expect(el.voices.delete).toHaveBeenCalledWith('Racing00000000000001', { orgId: ORG_A })
    expect(db.tables.provider_voices.find((r) => r.voice_id === 'Racing00000000000001')).toMatchObject({ status: 'deleted' })
  })
})

describe('library provisioning caps (shared workspace add/edit quota)', () => {
  // Fresh org ids: the per-instance rate-limit fallback window is shared by the whole file.
  const orgN = (n: number) => `${String(n).padStart(8, '0')}-3333-4333-8333-333333333333`
  const provision = (orgId: string, id: string) =>
    vc.provisionLibraryVoice({ orgId, userId: 'u1', libraryRef: { publicOwnerId: owner, voiceId: id }, libraryVoice: libVoice(id), log })
  const reservations = (orgId: string) => db.tables.audit_log.filter((r) => r.action === 'voice.library.add_reserved' && r.org_id === orgId)
  let copy = 0
  beforeEach(() => {
    el.sharedVoices.add.mockImplementation(async () => ({ voice_id: `CapCopy${String(++copy).padStart(13, '0')}` }))
  })

  it('caps new library voices per org per day (default 5, 429 without a provider call); registry hits never count; other orgs are unaffected', async () => {
    const org = orgN(31)
    const day = (i: number) => `LibCapDay${String(i).padStart(11, '0')}`
    for (let i = 1; i <= 5; i++) expect(await provision(org, day(i))).toMatchObject({ provisioned: true })
    expect(el.sharedVoices.add).toHaveBeenCalledTimes(5)
    const err = await provision(org, day(6)).catch((e: unknown) => e)
    expect(err).toBeInstanceOf(RequestError)
    expect(err).toMatchObject({ status: 429, code: 'rate_limited', details: { reason: 'library_add_limit', window: 'day', limit: 5 } })
    expect((err as RequestError).headers?.['Retry-After']).toMatch(/^\d+$/)
    expect(el.sharedVoices.add).toHaveBeenCalledTimes(5)
    expect(reservations(org)).toHaveLength(5)
    // Already provisioned (registry hit): no add/edit operation, never refused, never counted.
    expect(await provision(org, day(1))).toMatchObject({ provisioned: false })
    expect(reservations(org)).toHaveLength(5)
    // Another organization has its own budget.
    expect(await provision(orgN(32), day(7))).toMatchObject({ provisioned: true })
  })

  it('caps per rolling 30 days (ELEVENLABS_LIBRARY_ADDS_PER_ORG_MONTH); older reservations no longer count', async () => {
    vi.stubEnv('ELEVENLABS_LIBRARY_ADDS_PER_ORG_MONTH', '2')
    const org = orgN(33)
    const ago = (days: number) => new Date(Date.now() - days * 86_400_000).toISOString()
    db.tables.audit_log.push(
      { id: 'old-1', org_id: org, action: 'voice.library.add_reserved', created_at: ago(40) },
      { id: 'old-2', org_id: org, action: 'voice.library.add_reserved', created_at: ago(10) },
    )
    expect(await provision(org, 'LibCapMonth000000010')).toMatchObject({ provisioned: true })
    await expect(provision(org, 'LibCapMonth000000020')).rejects.toMatchObject({ status: 429, details: { reason: 'library_add_limit', window: 'month', limit: 2 } })
    vi.stubEnv('ELEVENLABS_LIBRARY_ADDS_PER_ORG_DAY', '0')
    await expect(provision(orgN(34), 'LibCapMonth000000030')).rejects.toMatchObject({ status: 429, details: { window: 'day', limit: 0 } })
    expect(vc.libraryAddCaps()).toEqual({ day: 0, month: 2 })
    vi.stubEnv('ELEVENLABS_LIBRARY_ADDS_PER_ORG_DAY', 'lots')
    expect(vc.libraryAddCaps().day).toBe(5)
  })

  it('concurrent adds cannot overshoot the cap: the oldest reservation wins, the refused one is released', async () => {
    vi.stubEnv('ELEVENLABS_LIBRARY_ADDS_PER_ORG_DAY', '1')
    const org = orgN(35)
    const results = await Promise.allSettled([provision(org, 'LibCapRace0000000010'), provision(org, 'LibCapRace0000000020')])
    expect(results.filter((r) => r.status === 'fulfilled')).toHaveLength(1)
    expect(results.find((r) => r.status === 'rejected')).toMatchObject({ reason: { status: 429 } })
    expect(el.sharedVoices.add).toHaveBeenCalledTimes(1)
    expect(reservations(org)).toHaveLength(1)
  })

  it('refuses tenant library adds once the workspace add/edit counter reaches 80 % (503, no provider call, nothing reserved); admin curation keeps the rest', async () => {
    const org = orgN(36)
    elv.getVoiceQuota.mockResolvedValue({ voice_add_edit_counter: 80, max_voice_add_edits: 100 })
    const err = await provision(org, 'LibHeadroom000000010').catch((e: unknown) => e)
    expect(vc.voiceErrorResponse(err, log, 'e', 'rid').status).toBe(503)
    expect(el.sharedVoices.add).not.toHaveBeenCalled()
    expect(reservations(org)).toHaveLength(0)
    // Platform provisioning (admin, curated voices) is only stopped by the real limit.
    const lib = libVoice('LibHeadroom000000020')
    expect(await vc.provisionPlatformLibraryVoice({ lib, actor: { userId: null, kind: 'admin_token' }, log })).toMatchObject({ provisioned: true })
    vc.resetLibraryHeadroomCache()
    elv.getVoiceQuota.mockResolvedValue({ voice_add_edit_counter: 79, max_voice_add_edits: 100 })
    expect(await provision(org, 'LibHeadroom000000030')).toMatchObject({ provisioned: true })
  })

  it('an unreadable quota fails open (logged); a copy the workspace already held releases the reservation', async () => {
    const org = orgN(37)
    elv.getVoiceQuota.mockRejectedValue(new QuotaError({ system: 'elevenlabs', operation: 'user.subscription', code: 'auth', status: 401 }))
    expect(await provision(org, 'LibUnread0000000010')).toMatchObject({ provisioned: true })
    expect(reservations(org)).toHaveLength(1)
    const lib = libVoice('LibAlready0000000010')
    el.sharedVoices.add.mockRejectedValueOnce(new ProviderError({ system: 'elevenlabs', operation: 'shared_voices.add', code: 'conflict' }))
    el.voices.search.mockResolvedValue({ voices: [{ voice_id: 'OldCopyCap0000000001', name: 'x', category: 'professional', sharing: { original_voice_id: lib.voice_id } }], has_more: false })
    expect(await provision(org, lib.voice_id)).toEqual({ voiceId: 'OldCopyCap0000000001', provisioned: true })
    expect(reservations(org)).toHaveLength(1)
  })
})

describe('voiceErrorResponse', () => {
  it('maps errors with Retry-After and the voice_not_provisioned code', async () => {
    const r1 = vc.voiceErrorResponse(rateLimitedError(Date.now() + 11_500), log, 'e', 'rid')
    expect(r1.status).toBe(429)
    expect(r1.headers.get('Retry-After')).toBe('12')
    const r2 = vc.voiceErrorResponse(new vc.VoiceNotProvisionedError({ publicOwnerId: owner, voiceId: 'LibZ0000000000000001' }), log, 'e', 'rid')
    expect(r2.status).toBe(409)
    expect(await r2.json()).toMatchObject({ code: 'voice_not_provisioned', details: { library_ref: { voice_id: 'LibZ0000000000000001' } } })
    const r3 = vc.voiceErrorResponse(new Error('secret db detail'), log, 'e', 'rid')
    expect(r3.status).toBe(500)
    expect(JSON.stringify(await r3.json())).not.toContain('secret')
  })
})
