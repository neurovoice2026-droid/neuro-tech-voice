import { beforeEach, describe, expect, it, vi } from 'vitest'
import { memoryDb, type MemoryDb } from '@/tests/helpers/memory-db'

const state = vi.hoisted(() => ({ db: null as unknown as MemoryDb }))
vi.mock('@/lib/supabase/admin', () => ({ createAdminClient: () => state.db }))
const el = vi.hoisted(() => ({ isConfigured: vi.fn(() => true), agents: { get: vi.fn() }, voices: { get: vi.fn(), search: vi.fn() } }))
vi.mock('@/lib/elevenlabs/client', () => el)
const apply = vi.hoisted(() => ({ applyAgentVoice: vi.fn() }))
vi.mock('./voice-apply', () => apply)
const catalog = vi.hoisted(() => ({ defaultVoiceIds: vi.fn() }))
vi.mock('./voice-catalog', async (orig) => ({ ...(await orig<object>()), defaultVoiceIds: catalog.defaultVoiceIds }))

import { ProviderError } from './errors'
import { defaultVoiceForNewAgent } from './curated-default'
import { defaultVoiceMigrationAt, pinRemoteVoice, resetDefaultVoiceLookupCache, runDefaultVoiceMigration, runScheduledDefaultVoiceMigration } from './default-voices'
import { createLogger } from '@/lib/observability/logger'

const log = createLogger({ test: true })
const PREMADE = 'Premade00000000000001'
const CURATED_RO = 'CuratedRo00000000001'
const CURATED_EN = 'CuratedEn00000000001'

function seed() {
  state.db = memoryDb({
    provider_voices: [
      { id: 'p1', provider: 'elevenlabs', voice_id: CURATED_RO, source: 'library', owner_org_id: null, status: 'ready', notice: null, name: 'Ana', featured_languages: ['ro'], featured_rank: 1 },
      { id: 'p2', provider: 'elevenlabs', voice_id: CURATED_EN, source: 'library', owner_org_id: null, status: 'ready', notice: null, name: 'Sam', featured_languages: ['en'], featured_rank: 1 },
      { id: 'p3', provider: 'elevenlabs', voice_id: 'Retiring000000000001', source: 'library', owner_org_id: null, status: 'ready', notice: 'removal_scheduled', featured_languages: ['de'], featured_rank: 0 },
    ],
    agents: [
      { id: 'a1', org_id: 'o1', language: 'ro', voice_id: PREMADE, voice_name: 'Brian', created_at: '1' },
      { id: 'a2', org_id: 'o2', language: 'ro', voice_id: CURATED_RO, voice_name: 'Ana', created_at: '2' },
      { id: 'a3', org_id: 'o3', language: 'en', voice_id: null, voice_name: null, created_at: '3' },
      { id: 'a4', org_id: 'o4', language: 'en', voice_id: null, voice_name: null, created_at: '4' },
      { id: 'a5', org_id: 'o5', language: 'en', voice_id: 'LegacyCopy0000000001', voice_name: 'Old', created_at: '5' },
      { id: 'a6', org_id: 'o6', language: 'de', voice_id: 'GoneVoice00000000001', voice_name: 'Gone', created_at: '6' },
    ],
    agent_provider_resources: [
      { id: 'r3', agent_id: 'a3', org_id: 'o3', provider: 'elevenlabs', external_id: 'agent_ext_3' },
      { id: 'r4', agent_id: 'a4', org_id: 'o4', provider: 'elevenlabs', external_id: null },
    ],
    audit_log: [],
  })
}

beforeEach(() => {
  seed()
  resetDefaultVoiceLookupCache()
  el.isConfigured.mockReturnValue(true)
  el.agents.get.mockReset().mockResolvedValue({ agent_id: 'agent_ext_3', conversation_config: { tts: { voice_id: PREMADE } } })
  el.voices.get.mockReset().mockImplementation(async (id: string) => {
    if (id === 'GoneVoice00000000001') throw new ProviderError({ system: 'elevenlabs', operation: 'voices.get', code: 'not_found', status: 404 })
    return { voice_id: id, name: id === PREMADE ? 'Brian' : 'Legacy', category: id === PREMADE ? 'premade' : 'professional' }
  })
  catalog.defaultVoiceIds.mockReset().mockResolvedValue(new Set([PREMADE]))
  apply.applyAgentVoice.mockReset().mockResolvedValue({ status: 'synced', error: null })
})

describe('defaultVoiceMigrationAt', () => {
  it('defaults to 2026-12-15 and reads the env', () => {
    expect(defaultVoiceMigrationAt().toISOString()).toBe('2026-12-15T00:00:00.000Z')
    vi.stubEnv('ELEVENLABS_DEFAULT_VOICE_MIGRATION_AT', '2026-12-01T08:00:00Z')
    expect(defaultVoiceMigrationAt().toISOString()).toBe('2026-12-01T08:00:00.000Z')
    vi.stubEnv('ELEVENLABS_DEFAULT_VOICE_MIGRATION_AT', 'soon')
    expect(defaultVoiceMigrationAt().toISOString()).toBe('2026-12-15T00:00:00.000Z')
  })
})

describe('runDefaultVoiceMigration', () => {
  it('before the date: reports only (pins agents saved without a voice, switches nothing)', async () => {
    const report = await runDefaultVoiceMigration({ log, now: new Date('2026-10-07T00:00:00Z') })
    expect(report).toMatchObject({ mode: 'report', agents_on_default_voice: 2, agents_on_missing_voice: 1, agents_without_voice: 0, pinned: 1, migrated: 0, remaining: 3 })
    expect(apply.applyAgentVoice).not.toHaveBeenCalled()
    // a3 now records the provider's actual (default) voice; a4 (no provider agent yet) is untouched.
    expect(state.db.tables.agents.find((a) => a.id === 'a3')).toMatchObject({ voice_id: PREMADE, voice_name: 'Brian', voice_sync_status: 'synced' })
    expect(state.db.tables.agents.find((a) => a.id === 'a4')).toMatchObject({ voice_id: null })
    expect(state.db.tables.audit_log).toEqual([expect.objectContaining({ action: 'voice.pinned', org_id: 'o3', actor_kind: 'system' })])
  })

  it('dry run (admin): no pinning, no switching', async () => {
    const report = await runDefaultVoiceMigration({ log, dryRun: true, force: true })
    expect(report).toMatchObject({ mode: 'report', pinned: 0, agents_without_voice: 1 })
    expect(el.agents.get).not.toHaveBeenCalled()
    expect(apply.applyAgentVoice).not.toHaveBeenCalled()
  })

  it('from the date: switches each agent to the curated voice of its language through the voice path, audited', async () => {
    const report = await runDefaultVoiceMigration({ log, now: new Date('2026-12-16T00:00:00Z') })
    expect(report).toMatchObject({ mode: 'migrate', migrated: 2, failed: 0, no_curated_voice: { de: 1 } })
    expect(apply.applyAgentVoice).toHaveBeenCalledWith(expect.objectContaining({ orgId: 'o1', agentId: 'a1', voiceId: CURATED_RO, voiceName: 'Ana', expectedCurrentVoiceId: PREMADE }))
    expect(apply.applyAgentVoice).toHaveBeenCalledWith(expect.objectContaining({ orgId: 'o3', agentId: 'a3', voiceId: CURATED_EN, expectedCurrentVoiceId: PREMADE }))
    // The voice with a notice is never used as a replacement (de has no usable curated voice).
    expect(apply.applyAgentVoice.mock.calls.some(([p]) => p.voiceId === 'Retiring000000000001')).toBe(false)
    const migrated = state.db.tables.audit_log.filter((r) => r.action === 'voice.default_migrated')
    expect(migrated).toHaveLength(2)
    expect(migrated[0]).toMatchObject({ actor_kind: 'system', details: expect.objectContaining({ from_voice_id: PREMADE }) })
  })

  it('never overwrites a voice the tenant chose meanwhile; force migrates before the date', async () => {
    apply.applyAgentVoice.mockResolvedValue(null)
    const report = await runDefaultVoiceMigration({ log, now: new Date('2026-10-07T00:00:00Z'), force: true })
    expect(report).toMatchObject({ mode: 'migrate', migrated: 0, skipped_changed: 2 })
    expect(state.db.tables.audit_log.filter((r) => r.action === 'voice.default_migrated')).toHaveLength(0)
  })

  it('counts an unconfirmed switch as failed', async () => {
    apply.applyAgentVoice.mockResolvedValue({ status: 'failed', error: 'not confirmed' })
    const report = await runDefaultVoiceMigration({ log, now: new Date('2026-12-16T00:00:00Z') })
    expect(report).toMatchObject({ migrated: 0, failed: 2 })
  })
})

describe('new agents and pinning', () => {
  it('a new agent gets the curated voice of its language; an agent already at the provider gets none', async () => {
    expect(await defaultVoiceForNewAgent(state.db as never, { id: 'a4', language: 'ro' })).toBe(CURATED_RO)
    expect(await defaultVoiceForNewAgent(state.db as never, { id: 'aX', language: 'en' })).toBe(CURATED_EN)
    expect(await defaultVoiceForNewAgent(state.db as never, { id: 'a3', language: 'en' })).toBeNull()
    expect(await defaultVoiceForNewAgent(state.db as never, { id: 'aY', language: 'de' })).toBeNull()
  })

  it('pins only agents still without a voice, with the provider-reported id', async () => {
    expect(await pinRemoteVoice({ orgId: 'o3', agentId: 'a3', log })).toBe(PREMADE)
    expect(await pinRemoteVoice({ orgId: 'o3', agentId: 'a3', log })).toBeNull() // already pinned
    expect(await pinRemoteVoice({ orgId: 'o4', agentId: 'a4', log })).toBeNull() // no provider agent
    el.agents.get.mockResolvedValueOnce({ agent_id: 'x', conversation_config: { tts: { voice_id: 'bad id' } } })
    seed()
    expect(await pinRemoteVoice({ orgId: 'o3', agentId: 'a3', log })).toBeNull()
  })
})

describe('runScheduledDefaultVoiceMigration', () => {
  it('reports once an hour before the migration date, migrates every quarter hour from it', async () => {
    expect(await runScheduledDefaultVoiceMigration(log, new Date('2026-10-07T10:07:00Z'))).toEqual({ skipped: 'not_scheduled' })
    expect(await runScheduledDefaultVoiceMigration(log, new Date('2026-10-07T10:02:00Z'))).toMatchObject({ mode: 'report' })
    expect(await runScheduledDefaultVoiceMigration(log, new Date('2026-12-16T10:22:00Z'))).toEqual({ skipped: 'not_scheduled' })
    expect(await runScheduledDefaultVoiceMigration(log, new Date('2026-12-16T10:31:00Z'))).toMatchObject({ mode: 'migrate' })
  })

  it('does not look up the same non-default legacy voice again on the next run', async () => {
    await runDefaultVoiceMigration({ log, now: new Date('2026-10-07T00:00:00Z'), dryRun: true })
    const first = el.voices.get.mock.calls.length
    await runDefaultVoiceMigration({ log, now: new Date('2026-10-07T01:00:00Z'), dryRun: true })
    expect(el.voices.get.mock.calls.slice(0, first).map((c) => c[0])).toContain('LegacyCopy0000000001')
    const lookedUpAgain = el.voices.get.mock.calls.slice(first).map((c) => c[0])
    expect(lookedUpAgain).not.toContain('LegacyCopy0000000001')
    // A missing voice is checked again (it may be a transient answer).
    expect(lookedUpAgain).toContain('GoneVoice00000000001')
  })
})
