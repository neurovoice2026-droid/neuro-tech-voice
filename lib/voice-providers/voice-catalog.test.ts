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
  private op: 'select' | 'insert' | 'update' = 'select'
  private payload: Row | null = null
  private mode: 'many' | 'maybe' | 'one' = 'many'
  private rangeArgs: [number, number] | null = null
  private limitN: number | null = null
  constructor(private db: FakeDb, private table: string) {}
  select() { return this }
  eq(c: string, v: unknown) { this.filters.push((r) => r[c] === v); return this }
  neq(c: string, v: unknown) { this.filters.push((r) => r[c] !== v); return this }
  is(c: string, v: unknown) { this.filters.push((r) => (r[c] ?? null) === v); return this }
  in(c: string, vs: unknown[]) { this.filters.push((r) => vs.includes(r[c])); return this }
  ilike(c: string, p: string) { const n = p.replace(/%/g, '').toLowerCase(); this.filters.push((r) => String(r[c] ?? '').toLowerCase().includes(n)); return this }
  or(expr: string) {
    const parts = expr.split(',').map((p) => p.split('.'))
    this.filters.push((r) => parts.some(([c, op, v]) => (op === 'is' && v === 'null' ? (r[c] ?? null) === null : op === 'eq' ? r[c] === v : false)))
    return this
  }
  order() { return this }
  range(a: number, b: number) { this.rangeArgs = [a, b]; return this }
  limit(n: number) { this.limitN = n; return this }
  maybeSingle() { this.mode = 'maybe'; return this }
  single() { this.mode = 'one'; return this }
  insert(row: Row) { this.op = 'insert'; this.payload = row; return this }
  update(p: Row) { this.op = 'update'; this.payload = p; return this }
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
vi.mock('@/lib/cartesia/client', () => ({ isConfigured: () => true, voices: { list: vi.fn(), get: vi.fn(), previewAudio: vi.fn() } }))

import { ProviderError } from '@/lib/voice-providers/errors'
import { createLogger } from '@/lib/observability/logger'
import { RequestError, rateLimitedError } from '@/lib/api/http'
import * as vc from '@/lib/voice-providers/voice-catalog'

const ORG_A = '11111111-1111-4111-8111-111111111111'
const ORG_B = '22222222-2222-4222-8222-222222222222'
const log = createLogger({ test: true })

const premade = { voice_id: 'PremadeVoice00000001', name: 'Ada', category: 'premade', labels: { gender: 'female', accent: 'american', language: 'en' }, preview_url: 'https://cdn.example/ada.mp3', verified_languages: [{ language: 'en' }, { language: 'ro', accent: 'romanian', preview_url: 'https://cdn.example/ada-ro.mp3' }] }
const strayClone = { voice_id: 'StrayClone0000000001', name: 'Other org clone', category: 'cloned', labels: {} }
const owner = 'a'.repeat(64)
const libVoice = (id: string, extra: Record<string, unknown> = {}) => ({ public_owner_id: owner, voice_id: id, name: `Lib ${id}`, gender: 'male', language: 'ro', accent: 'romanian', age: 'middle_aged', category: 'professional', preview_url: 'https://cdn.example/lib.mp3', notice_period: 90, live_moderation_enabled: false, fiat_rate: null, rate: null, ...extra })

beforeEach(() => {
  db.tables = { provider_voices: [], audit_log: [], agents: [] }
  for (const fn of [el.voices.get, el.voices.search, el.voices.delete, el.voices.addInstantClone, el.sharedVoices.list, el.sharedVoices.add, el.textToSpeech]) fn.mockReset()
  el.isConfigured.mockReturnValue(true)
  el.voices.search.mockResolvedValue({ voices: [premade, strayClone], has_more: false })
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
  it('workspace: own + platform rows and premade defaults only, paginated', async () => {
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
    expect(ids.sort()).toEqual(['LibCopy0000000000001', 'OwnClone000000000001', 'PremadeVoice00000001'].sort())
    expect(el.voices.search).toHaveBeenCalledWith(expect.objectContaining({ voice_type: 'default' }))
  })

  it('workspace language filter uses verified languages for defaults', async () => {
    const page = await vc.listVoices(ORG_A, { source: 'workspace', language: 'ro' })
    const ada = page.voices.find((v) => v.voiceId === premade.voice_id)
    expect(ada).toMatchObject({ language: 'ro', accent: 'romanian', previewUrl: 'https://cdn.example/ada-ro.mp3', source: 'premade' })
  })

  it('library: filters unusable voices, marks provisioned ones', async () => {
    db.tables.provider_voices.push({ id: 'r9', provider: 'elevenlabs', voice_id: 'WsCopy00000000000001', source: 'library', source_public_owner_id: owner, source_voice_id: 'LibA0000000000000001', owner_org_id: null, status: 'ready' })
    el.sharedVoices.list.mockResolvedValue({ voices: [libVoice('LibA0000000000000001'), libVoice('LibB0000000000000001'), libVoice('LibC0000000000000001', { live_moderation_enabled: true }), libVoice('LibD0000000000000001', { fiat_rate: 0.3 })], has_more: true })
    const page = await vc.listVoices(ORG_A, { source: 'library', language: 'ro', gender: 'male', search: 'x%_*,()' })
    expect(el.sharedVoices.list).toHaveBeenCalledWith(expect.objectContaining({ page: 0, language: 'ro', gender: 'male', min_notice_period_days: 30, search: 'x' }))
    expect(page.voices.map((v) => [v.voiceId, v.requiresProvisioning])).toEqual([['WsCopy00000000000001', false], ['LibB0000000000000001', true]])
    expect(page.voices[1].libraryRef).toEqual({ publicOwnerId: owner, voiceId: 'LibB0000000000000001' })
    const next = await vc.listVoices(ORG_A, { source: 'library', pageToken: page.next_page_token })
    expect(el.sharedVoices.list).toHaveBeenLastCalledWith(expect.objectContaining({ page: 1 }))
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
  it('accepts premade, own clones and library voices (validated by owner lookup)', async () => {
    el.voices.get.mockResolvedValueOnce(premade)
    await expect(vc.assertVoiceEligible(ORG_A, { voiceId: premade.voice_id })).resolves.toMatchObject({ kind: 'default' })
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
  it('409 for unprovisioned library voices, TTS for eligible ones', async () => {
    await expect(vc.synthesizePreview({ orgId: ORG_A, voiceId: 'LibZ0000000000000001', libraryRef: { publicOwnerId: owner, voiceId: 'LibZ0000000000000001' }, text: 'hi', language: 'en' })).rejects.toBeInstanceOf(vc.VoiceNotProvisionedError)
    expect(el.sharedVoices.list).not.toHaveBeenCalled()
    el.voices.get.mockResolvedValueOnce(premade)
    el.textToSpeech.mockResolvedValueOnce(new ArrayBuffer(4))
    await vc.synthesizePreview({ orgId: ORG_A, voiceId: premade.voice_id, libraryRef: null, text: 'x'.repeat(500), language: 'ro' })
    const [vid, text, model, lang] = el.textToSpeech.mock.calls[0]
    expect([vid, text.length, model, lang]).toEqual([premade.voice_id, 200, 'eleven_flash_v2_5', 'ro'])
    el.voices.get.mockResolvedValueOnce(premade)
    el.textToSpeech.mockResolvedValueOnce(new ArrayBuffer(4))
    await vc.synthesizePreview({ orgId: ORG_A, voiceId: premade.voice_id, libraryRef: null, text: '  ', language: 'en' })
    expect(el.textToSpeech.mock.calls[1][1]).toMatch(/^Hello!/)
    expect(el.textToSpeech.mock.calls[1][2]).toBe('eleven_flash_v2')
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
