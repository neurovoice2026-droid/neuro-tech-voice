import { beforeEach, describe, expect, it, vi } from 'vitest'
import { memoryDb, type MemoryDb } from '@/tests/helpers/memory-db'

const state = vi.hoisted(() => ({ db: null as unknown as MemoryDb }))
vi.mock('@/lib/supabase/admin', () => ({ createAdminClient: () => state.db }))
const el = vi.hoisted(() => ({ isConfigured: vi.fn(() => true), voices: { delete: vi.fn() } }))
vi.mock('@/lib/elevenlabs/client', () => el)
const api = vi.hoisted(() => ({ designVoice: vi.fn(), createVoiceFromPreview: vi.fn(), VOICE_DESIGN_MODELS: ['eleven_multilingual_ttv_v2', 'eleven_ttv_v3'] }))
vi.mock('@/lib/elevenlabs/api/voices', () => api)

import { AGENT_LANGUAGES } from '@/lib/agent-languages'
import { ProviderError } from './errors'
import { designPreviewText, designVoicePreviews, pruneDesignPreviews, saveDesignedVoice, voiceDesignModel } from './voice-design'
import { createLogger } from '@/lib/observability/logger'

const ORG = '11111111-1111-4111-8111-111111111111'
const OTHER = '99999999-9999-4999-8999-999999999999'
const log = createLogger({ test: true })
const audio = Buffer.from('ID3fake-mp3').toString('base64')
const preview = (id: string) => ({ generated_voice_id: id, audio_base_64: audio, media_type: 'audio/mpeg', duration_secs: 6.43, language: 'ro' })

beforeEach(() => {
  state.db = memoryDb({ voice_design_previews: [], provider_voices: [], audit_log: [] }, { unique: { provider_voices: [['provider', 'voice_id']] } })
  api.designVoice.mockReset()
  api.createVoiceFromPreview.mockReset()
  el.voices.delete.mockReset()
})

describe('preview text and model', () => {
  it('every agent language gets a 100–1000 character text (the endpoint minimum)', () => {
    for (const l of AGENT_LANGUAGES) {
      const len = Array.from(designPreviewText(l.value)).length
      expect(len, l.value).toBeGreaterThanOrEqual(100)
      expect(len, l.value).toBeLessThanOrEqual(1000)
    }
    expect(designPreviewText('ro')).toContain('programare')
  })
  it('model: spec default, env may pick eleven_ttv_v3 only', () => {
    expect(voiceDesignModel()).toBe('eleven_multilingual_ttv_v2')
    vi.stubEnv('ELEVENLABS_VOICE_DESIGN_MODEL', 'eleven_ttv_v3')
    expect(voiceDesignModel()).toBe('eleven_ttv_v3')
    vi.stubEnv('ELEVENLABS_VOICE_DESIGN_MODEL', 'eleven_v4')
    expect(voiceDesignModel()).toBe('eleven_multilingual_ttv_v2')
  })
})

describe('designVoicePreviews', () => {
  it('sends the description and a localized text (never reference audio), records each preview for the org', async () => {
    api.designVoice.mockResolvedValue({ previews: [preview('gen_aaa111'), preview('gen_bbb222'), { generated_voice_id: 'bad id', audio_base_64: audio }], text: 'x' })
    const res = await designVoicePreviews({ orgId: ORG, userId: 'u1', description: '  A warm   receptionist voice, calm\u0000 and clear  ', language: 'ro', log })
    const [body, format, ctx] = api.designVoice.mock.calls[0]
    expect(body).toEqual({ voice_description: 'A warm receptionist voice, calm and clear', model_id: 'eleven_multilingual_ttv_v2', text: designPreviewText('ro') })
    expect(JSON.stringify(body)).not.toContain('reference_audio')
    expect([format, ctx]).toEqual(['mp3_22050_32', { orgId: ORG }])
    expect(res.previews.map((p) => p.generated_voice_id)).toEqual(['gen_aaa111', 'gen_bbb222'])
    const rows = state.db.tables.voice_design_previews
    expect(rows).toHaveLength(2)
    expect(rows[0]).toMatchObject({ org_id: ORG, generated_voice_id: 'gen_aaa111', language: 'ro', created_by: 'u1' })
    expect(rows[0].batch_id).toBe(rows[1].batch_id)
    expect(Date.parse(rows[0].expires_at as string)).toBeGreaterThan(Date.now())
  })

  it('uses the tenant text when long enough; rejects short descriptions; no usable preview is an error', async () => {
    api.designVoice.mockResolvedValue({ previews: [preview('gen_ccc333')], text: 'x' })
    await designVoicePreviews({ orgId: ORG, userId: 'u1', description: 'A deep, calm and reassuring male voice.', text: 'y'.repeat(120), language: 'en', log })
    expect(api.designVoice.mock.calls[0][0].text).toBe('y'.repeat(120))
    await expect(designVoicePreviews({ orgId: ORG, userId: 'u1', description: 'too short', language: 'en', log })).rejects.toMatchObject({ status: 400 })
    api.designVoice.mockResolvedValue({ previews: [], text: 'x' })
    await expect(designVoicePreviews({ orgId: ORG, userId: 'u1', description: 'A deep, calm and reassuring male voice.', language: 'en', log })).rejects.toMatchObject({ code: 'bad_response' })
  })
})

describe('saveDesignedVoice', () => {
  const seedPreviews = (extra: Record<string, unknown> = {}) => {
    const future = new Date(Date.now() + 3600_000).toISOString()
    state.db.tables.voice_design_previews.push(
      { id: 'p1', org_id: ORG, batch_id: 'b1', generated_voice_id: 'gen_aaa111', description: 'd', language: 'ro', expires_at: future, consumed_at: null, saved_voice_id: null, ...extra },
      { id: 'p2', org_id: ORG, batch_id: 'b1', generated_voice_id: 'gen_bbb222', description: 'd', language: 'ro', expires_at: future, consumed_at: null, saved_voice_id: null },
      { id: 'p3', org_id: OTHER, batch_id: 'b9', generated_voice_id: 'gen_other9', description: 'd', language: 'en', expires_at: future, consumed_at: null, saved_voice_id: null },
    )
  }

  it('creates the voice from the org own preview, registers it org-owned and audits', async () => {
    seedPreviews()
    api.createVoiceFromPreview.mockResolvedValue({ voice_id: 'NewDesigned000000001', name: 'x', category: 'generated' })
    const { voice } = await saveDesignedVoice({ orgId: ORG, userId: 'u1', generatedVoiceId: 'gen_aaa111', name: 'Front desk', log })
    expect(voice).toMatchObject({ voiceId: 'NewDesigned000000001', source: 'designed', language: 'ro' })
    const [body, ctx] = api.createVoiceFromPreview.mock.calls[0]
    expect(body).toEqual({
      voice_name: `Front desk [${ORG.slice(0, 8)}]`,
      // Full org id + this deployment's environment marker (the orphan sweep reads both).
      voice_description: expect.stringMatching(new RegExp(`^Designed voice for org ${ORG} \\[ntv-env:[a-z0-9_-]+\\]$`)),
      generated_voice_id: 'gen_aaa111',
      labels: { language: 'ro' },
      played_not_selected_voice_ids: ['gen_bbb222'],
    })
    expect(ctx).toEqual({ orgId: ORG })
    expect(state.db.tables.provider_voices[0]).toMatchObject({ voice_id: 'NewDesigned000000001', owner_org_id: ORG, source: 'designed', status: 'ready', category: 'generated' })
    expect(state.db.tables.voice_design_previews[0]).toMatchObject({ saved_voice_id: 'NewDesigned000000001' })
    expect(state.db.tables.audit_log[0]).toMatchObject({ action: 'voice.design.saved', org_id: ORG })
    // A second save of the same preview is refused (claimed).
    await expect(saveDesignedVoice({ orgId: ORG, userId: 'u1', generatedVoiceId: 'gen_aaa111', name: 'Again', log })).rejects.toMatchObject({ status: 404 })
  })

  it('refuses another org preview, an expired one and an unknown id with the same 404', async () => {
    seedPreviews({ expires_at: new Date(Date.now() - 1000).toISOString() })
    for (const id of ['gen_other9', 'gen_aaa111', 'gen_unknown']) {
      await expect(saveDesignedVoice({ orgId: ORG, userId: 'u1', generatedVoiceId: id, name: 'X', log })).rejects.toMatchObject({ status: 404 })
    }
    expect(api.createVoiceFromPreview).not.toHaveBeenCalled()
  })

  it('releases the claim when the provider fails, so the tenant can retry', async () => {
    seedPreviews()
    api.createVoiceFromPreview.mockRejectedValueOnce(new ProviderError({ system: 'elevenlabs', operation: 'voices.create_from_preview', code: 'upstream', status: 502 }))
    await expect(saveDesignedVoice({ orgId: ORG, userId: 'u1', generatedVoiceId: 'gen_aaa111', name: 'X', log })).rejects.toBeInstanceOf(ProviderError)
    expect(state.db.tables.voice_design_previews[0]).toMatchObject({ consumed_at: null })
  })

  it('compensates when the registry write fails and undoes a voice over the per-org cap', async () => {
    seedPreviews()
    state.db.tables.provider_voices.push({ id: 'x', provider: 'elevenlabs', voice_id: 'Clash000000000000001', owner_org_id: OTHER, source: 'cloned', status: 'ready' })
    api.createVoiceFromPreview.mockResolvedValueOnce({ voice_id: 'Clash000000000000001' })
    await expect(saveDesignedVoice({ orgId: ORG, userId: 'u1', generatedVoiceId: 'gen_aaa111', name: 'X', log })).rejects.toThrow()
    expect(el.voices.delete).toHaveBeenCalledWith('Clash000000000000001', { orgId: ORG })

    // (The fake keeps insertion order for equal created_at; the database orders by now().)
    state.db.tables.provider_voices = [
      { id: 'c1', provider: 'elevenlabs', voice_id: 'Old1', owner_org_id: ORG, source: 'cloned', status: 'ready' },
      { id: 'c2', provider: 'elevenlabs', voice_id: 'Old2', owner_org_id: ORG, source: 'designed', status: 'ready' },
    ]
    api.createVoiceFromPreview.mockResolvedValueOnce({ voice_id: 'OverCap0000000000001' })
    el.voices.delete.mockResolvedValue({ status: 'ok' })
    await expect(saveDesignedVoice({ orgId: ORG, userId: 'u1', generatedVoiceId: 'gen_aaa111', name: 'X', log })).rejects.toMatchObject({ status: 409 })
    expect(state.db.tables.provider_voices.find((r) => r.voice_id === 'OverCap0000000000001')).toMatchObject({ status: 'deleted' })
  })

  it('prunes previews a day after expiry', async () => {
    state.db.tables.voice_design_previews.push(
      { id: 'old', org_id: ORG, expires_at: new Date(Date.now() - 2 * 86_400_000).toISOString() },
      { id: 'new', org_id: ORG, expires_at: new Date(Date.now() + 3600_000).toISOString() },
    )
    await pruneDesignPreviews(log)
    expect(state.db.tables.voice_design_previews.map((r) => r.id)).toEqual(['new'])
  })
})
