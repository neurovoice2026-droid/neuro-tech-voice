import { beforeEach, describe, expect, it, vi } from 'vitest'
import { memoryDb, type MemoryDb } from '@/tests/helpers/memory-db'

const state = vi.hoisted(() => ({ db: null as unknown as MemoryDb }))
vi.mock('@/lib/supabase/admin', () => ({ createAdminClient: () => state.db }))
const el = vi.hoisted(() => ({ isConfigured: vi.fn(() => true) }))
vi.mock('@/lib/elevenlabs/client', () => el)
const api = vi.hoisted(() => ({ getVoicesByIds: vi.fn(), getVoiceDetail: vi.fn() }))
vi.mock('@/lib/elevenlabs/api/voices', () => api)
const apply = vi.hoisted(() => ({ applyAgentVoice: vi.fn() }))
vi.mock('./voice-apply', () => apply)

import type { ELVoiceDetail } from '@/lib/elevenlabs/api/voices'
import { ProviderError } from './errors'
import { checkLibraryVoices, evaluateLibraryVoice } from './library-lifecycle'
import { createLogger } from '@/lib/observability/logger'

const NOW = Date.parse('2026-10-07T12:00:00Z')
const log = createLogger({ test: true })
const v = (id: string, sharing: Record<string, unknown> = {}, extra: Record<string, unknown> = {}): ELVoiceDetail =>
  ({ voice_id: id, name: id, category: 'professional', sharing: { status: 'copied', ...sharing }, safety_control: 'NONE', ...extra }) as ELVoiceDetail
const row = (id: string, extra: Record<string, unknown> = {}) => ({
  id: `row-${id}`, provider: 'elevenlabs', voice_id: id, source: 'library', source_voice_id: `Lib${id}`, owner_org_id: null, status: 'ready', notice: null, ...extra,
})

describe('evaluateLibraryVoice', () => {
  it('maps the provider state to ok / notice / removed', () => {
    expect(evaluateLibraryVoice(v('A0000000'), NOW)).toMatchObject({ state: 'ok', notice: null })
    expect(evaluateLibraryVoice(null, NOW)).toMatchObject({ state: 'removed', notice: 'removed' })
    expect(evaluateLibraryVoice(v('A0000000', { status: 'copied_disabled' }), NOW)).toMatchObject({ state: 'removed' })
    expect(evaluateLibraryVoice(v('A0000000', {}, { safety_control: 'BAN' }), NOW)).toMatchObject({ state: 'removed' })
    expect(evaluateLibraryVoice(v('A0000000', {}, { safety_control: 'ENTERPRISE_BAN' }), NOW)).toMatchObject({ state: 'removed' })
    expect(evaluateLibraryVoice(v('A0000000', {}, { safety_control: 'CAPTCHA' }), NOW)).toMatchObject({ state: 'notice', notice: 'blocked' })
    const future = Math.floor(NOW / 1000) + 30 * 86_400
    expect(evaluateLibraryVoice(v('A0000000', { disable_at_unix: future }), NOW)).toMatchObject({ state: 'notice', notice: 'removal_scheduled', retiringAt: new Date(future * 1000).toISOString() })
    expect(evaluateLibraryVoice(v('A0000000', { disable_at_unix: Math.floor(NOW / 1000) - 1 }), NOW)).toMatchObject({ state: 'removed' })
    expect(evaluateLibraryVoice(v('A0000000', { live_moderation_enabled: true }), NOW)).toMatchObject({ state: 'notice', notice: 'moderation' })
    expect(evaluateLibraryVoice(v('A0000000', { fiat_rate: 0.2 }), NOW)).toMatchObject({ state: 'notice', notice: 'custom_rate' })
    expect(evaluateLibraryVoice(v('A0000000', { rate: 2 }), NOW)).toMatchObject({ state: 'notice', notice: 'custom_rate' })
    expect(evaluateLibraryVoice(v('A0000000', { status: 'disabled' }), NOW)).toMatchObject({ state: 'notice', notice: 'blocked' })
  })
})

describe('checkLibraryVoices', () => {
  beforeEach(() => {
    api.getVoicesByIds.mockReset()
    api.getVoiceDetail.mockReset()
    apply.applyAgentVoice.mockReset()
    el.isConfigured.mockReturnValue(true)
  })

  it('marks notices, clears withdrawn ones, removes confirmed-gone voices and switches their agents to the curated voice', async () => {
    const future = Math.floor(NOW / 1000) + 10 * 86_400
    state.db = memoryDb({
      provider_voices: [
        row('Okvoice00000000001', { notice: 'moderation' }),
        row('Retire000000000001'),
        row('Gone00000000000001'),
        row('Unknown00000000001'),
        row('Curated00000000001', { featured_languages: ['ro'], featured_rank: 1 }),
        row('OrgClone0000000001', { source: 'cloned', owner_org_id: '11111111-1111-4111-8111-111111111111' }),
      ],
      agents: [
        { id: 'ag1', org_id: 'o1', language: 'ro', voice_id: 'Gone00000000000001' },
        { id: 'ag2', org_id: 'o2', language: 'ro', voice_id: 'Okvoice00000000001' },
      ],
      audit_log: [],
    })
    api.getVoicesByIds.mockResolvedValue({
      voices: [v('Okvoice00000000001'), v('Retire000000000001', { disable_at_unix: future }), v('Curated00000000001')],
      has_more: false,
    })
    api.getVoiceDetail.mockImplementation(async (id: string) => {
      if (id === 'Gone00000000000001') throw new ProviderError({ system: 'elevenlabs', operation: 'voices.get', code: 'not_found', status: 404 })
      throw new ProviderError({ system: 'elevenlabs', operation: 'voices.get', code: 'upstream', status: 502 })
    })
    apply.applyAgentVoice.mockResolvedValue({ status: 'synced', error: null })

    const report = await checkLibraryVoices({ log, now: NOW })
    expect(api.getVoicesByIds).toHaveBeenCalledTimes(1)
    // Only platform-wide library rows are checked.
    expect(api.getVoicesByIds.mock.calls[0][0]).not.toContain('OrgClone0000000001')
    expect(report).toMatchObject({ checked: 5, ok: 2, removed: 1, unknown: 1, notices: { removal_scheduled: 1 }, agents_affected: 1, agents_switched: 1 })

    const byId = (id: string) => state.db.tables.provider_voices.find((r) => r.voice_id === id) as Record<string, unknown>
    expect(byId('Okvoice00000000001')).toMatchObject({ notice: null, status: 'ready' })
    expect(byId('Retire000000000001')).toMatchObject({ notice: 'removal_scheduled', retiring_at: new Date(future * 1000).toISOString(), status: 'ready' })
    expect(byId('Gone00000000000001')).toMatchObject({ notice: 'removed', status: 'failed' })
    // A failed confirmation concludes nothing.
    expect(byId('Unknown00000000001')).toMatchObject({ notice: null, status: 'ready' })

    const agent = state.db.tables.agents.find((a) => a.id === 'ag1') as Record<string, unknown>
    expect(agent).toMatchObject({ voice_sync_status: 'failed' })
    expect(apply.applyAgentVoice).toHaveBeenCalledWith(expect.objectContaining({ orgId: 'o1', agentId: 'ag1', voiceId: 'Curated00000000001', expectedCurrentVoiceId: 'Gone00000000000001' }))
    expect(state.db.tables.audit_log).toEqual([expect.objectContaining({ action: 'voice.library_removed_migrated', org_id: 'o1', actor_kind: 'system' })])
  })

  it('does not switch agents when auto-switch is disabled; a failed batch read concludes nothing', async () => {
    vi.stubEnv('ELEVENLABS_LIBRARY_REMOVAL_AUTO_SWITCH', 'false')
    state.db = memoryDb({
      provider_voices: [row('Gone00000000000001'), row('Curated00000000001', { featured_languages: ['ro'] })],
      agents: [{ id: 'ag1', org_id: 'o1', language: 'ro', voice_id: 'Gone00000000000001' }],
      audit_log: [],
    })
    api.getVoicesByIds.mockResolvedValueOnce({ voices: [v('Curated00000000001')], has_more: false })
    api.getVoiceDetail.mockRejectedValue(new ProviderError({ system: 'elevenlabs', operation: 'voices.get', code: 'not_found', status: 404 }))
    const report = await checkLibraryVoices({ log, now: NOW })
    expect(report).toMatchObject({ removed: 1, agents_affected: 1, agents_switched: 0 })
    expect(apply.applyAgentVoice).not.toHaveBeenCalled()

    state.db = memoryDb({ provider_voices: [row('Some00000000000001')], agents: [] })
    api.getVoicesByIds.mockRejectedValueOnce(new ProviderError({ system: 'elevenlabs', operation: 'voices.lookup', code: 'timeout' }))
    expect(await checkLibraryVoices({ log, now: NOW })).toMatchObject({ checked: 0, unknown: 1 })
    expect(state.db.tables.provider_voices[0]).toMatchObject({ status: 'ready' })
  })

  it('the scheduled check skips rows checked in the last 20 hours; a targeted check does not', async () => {
    const recent = new Date(NOW - 2 * 3600_000).toISOString()
    const old = new Date(NOW - 30 * 3600_000).toISOString()
    state.db = memoryDb({
      provider_voices: [row('Fresh0000000000001', { lifecycle_checked_at: recent }), row('Stale0000000000001', { lifecycle_checked_at: old })],
      agents: [],
    })
    api.getVoicesByIds.mockResolvedValue({ voices: [v('Fresh0000000000001'), v('Stale0000000000001')], has_more: false })
    expect(await checkLibraryVoices({ log, now: NOW })).toMatchObject({ checked: 1, ok: 1 })
    expect(api.getVoicesByIds).toHaveBeenLastCalledWith(['Stale0000000000001'])
    // (The in-memory DB ignores the voice-id filter, so only the staleness bypass is asserted.)
    await checkLibraryVoices({ log, now: NOW, voiceIds: ['Fresh0000000000001'] })
    expect(api.getVoicesByIds.mock.lastCall?.[0]).toContain('Fresh0000000000001')
  })
})
