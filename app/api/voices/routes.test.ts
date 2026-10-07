import { beforeEach, describe, expect, it, vi } from 'vitest'
import { memoryDb, type MemoryDb } from '@/tests/helpers/memory-db'

// Slice F tenant routes: catalog filters, accents, limits, Voice Design and
// the clone gates. Provider and DB calls are mocked; nothing leaves the process.

const ORG = '11111111-1111-4111-8111-111111111111'
const USER = '55555555-5555-4555-8555-555555555555'
const state = vi.hoisted(() => ({ db: null as unknown as MemoryDb, plan: 'pro' as string | null, rateDenied: new Set<string>() }))
vi.mock('@/lib/api/auth', () => ({
  requireOrg: async () => ({ supabase: state.db, user: { id: USER }, org: { id: ORG, name: 'Acme', timezone: null, plan: state.plan } }),
}))
vi.mock('@/lib/supabase/admin', () => ({ createAdminClient: () => state.db }))
vi.mock('@/lib/security/rate-limit', () => ({
  RATE_LIMITS: { voiceCatalog: { name: 'voice_catalog' }, voiceClone: { name: 'voice_clone' }, voiceProvision: { name: 'voice_provision' }, ttsPreview: { name: 'tts_preview' }, ttsPreviewDaily: { name: 'tts_preview_day' } },
  enforceRateLimit: async (rules: { name: string } | Array<{ name: string }>) => {
    for (const r of Array.isArray(rules) ? rules : [rules]) {
      if (state.rateDenied.has(r.name)) {
        const { rateLimitedError } = await import('@/lib/api/http')
        throw rateLimitedError(Date.now() + 5_000)
      }
    }
  },
}))
const el = vi.hoisted(() => ({ isConfigured: vi.fn(() => true), voices: { addInstantClone: vi.fn(), delete: vi.fn() } }))
vi.mock('@/lib/elevenlabs/client', () => el)
const api = vi.hoisted(() => ({
  listAccents: vi.fn(),
  getVoiceQuota: vi.fn(async () => ({})),
  searchLibrary: vi.fn(),
  LIBRARY_SORTS: ['created_date', 'usage_character_count_1y', 'trending', 'cloned_by_count'],
  VOICE_DESIGN_MODELS: ['eleven_multilingual_ttv_v2', 'eleven_ttv_v3'],
}))
vi.mock('@/lib/elevenlabs/api/voices', () => api)
const design = vi.hoisted(() => ({ designVoicePreviews: vi.fn(), saveDesignedVoice: vi.fn() }))
vi.mock('@/lib/voice-providers/voice-design', async (orig) => ({ ...(await orig<object>()), ...design }))
const catalog = vi.hoisted(() => ({ listVoices: vi.fn() }))
vi.mock('@/lib/voice-providers/voice-catalog', async (orig) => ({ ...(await orig<object>()), listVoices: catalog.listVoices }))

import { GET as listRoute } from '@/app/api/voices/route'
import { GET as accentsRoute } from '@/app/api/voices/accents/route'
import { GET as limitsRoute } from '@/app/api/voices/limits/route'
import { POST as designRoute } from '@/app/api/voices/design/route'
import { POST as saveRoute } from '@/app/api/voices/design/save/route'
import { POST as cloneRoute } from '@/app/api/voices/clone/route'
import { resetVoiceQuotaCache } from '@/lib/voice-providers/voice-capacity'

const H = { host: 'app.test', origin: 'http://app.test', 'content-type': 'application/json' }
const post = (body: unknown, headers: Record<string, string> = H) => new Request('http://app.test/api/x', { method: 'POST', headers, body: JSON.stringify(body) })
const get = (qs: string) => new Request(`http://app.test/api/voices${qs}`, { headers: { host: 'app.test' } })
const DESCRIPTION = 'A warm, calm and friendly receptionist voice.'

beforeEach(() => {
  state.db = memoryDb({ provider_voices: [], agents: [{ id: 'a1', org_id: ORG, language: 'ro', created_at: '1' }] })
  state.plan = 'pro'
  state.rateDenied.clear()
  resetVoiceQuotaCache()
  api.getVoiceQuota.mockReset().mockResolvedValue({})
  design.designVoicePreviews.mockReset()
  design.saveDesignedVoice.mockReset()
  catalog.listVoices.mockReset().mockResolvedValue({ voices: [], next_page_token: null })
  el.voices.addInstantClone.mockReset()
})

describe('GET /api/voices filters', () => {
  it('passes the library filters through, validated', async () => {
    const res = await listRoute(get('?source=library&gender=neutral&accent=British&age=young&use_case=all&high_quality=true&featured=false&sort=trending&language=ro'))
    expect(res.status).toBe(200)
    expect(catalog.listVoices).toHaveBeenCalledWith(ORG, expect.objectContaining({ source: 'library', gender: 'neutral', accent: 'british', age: 'young', useCase: 'all', highQuality: true, featured: false, sort: 'trending', language: 'ro' }))
  })
  it('rejects unknown values', async () => {
    for (const qs of ['?gender=other', '?accent=%25%27or', '?age=ancient', '?sort=random', '?use_case=narration', '?high_quality=yes']) {
      expect((await listRoute(get(qs))).status, qs).toBe(400)
    }
  })
})

describe('GET /api/voices/accents', () => {
  it('maps the library accents of the language, filtered and cached', async () => {
    api.listAccents.mockResolvedValue({ accents: [{ accent: 'standard', language: 'ro', code: 'ro-standard', name: 'Standard' }, { accent: 'moldovan', language: 'ro', code: 'ro-moldovan', name: 'Moldovan' }, { accent: '<x>', language: 'ro', code: 'x', name: 'Bad' }, { accent: 'british', language: 'en', code: 'en-british', name: 'British' }] })
    const res = await accentsRoute(new Request('http://app.test/api/voices/accents?language=ro'))
    expect(res.status).toBe(200)
    expect((await res.json()).accents).toEqual([{ value: 'moldovan', label: 'Moldovan' }, { value: 'standard', label: 'Standard' }])
    await accentsRoute(new Request('http://app.test/api/voices/accents?language=ro'))
    expect(api.listAccents).toHaveBeenCalledTimes(1)
    expect((await accentsRoute(new Request('http://app.test/api/voices/accents?language=xx'))).status).toBe(400)
  })
})

describe('GET /api/voices/limits', () => {
  it('reports plan rights and the per-org count', async () => {
    state.db.tables.provider_voices.push({ id: 'c1', provider: 'elevenlabs', voice_id: 'Clone0000000000001', owner_org_id: ORG, source: 'cloned', status: 'ready' })
    let body = await (await limitsRoute(new Request('http://app.test/api/voices/limits'))).json()
    expect(body).toEqual({ custom_voices: { allowed: true, required_plan: 'pro', used: 1, limit: 2 } })
    state.plan = 'starter'
    body = await (await limitsRoute(new Request('http://app.test/api/voices/limits'))).json()
    expect(body.custom_voices.allowed).toBe(false)
  })
})

describe('POST /api/voices/design', () => {
  it('designs previews in the agent language for a plan that allows it', async () => {
    design.designVoicePreviews.mockResolvedValue({ previews: [{ generated_voice_id: 'gen_aaa111', audio_base_64: 'SUQz', media_type: 'audio/mpeg', duration_secs: 3 }], text: 't', expires_at: 'x' })
    const res = await designRoute(post({ description: DESCRIPTION }))
    expect(res.status).toBe(200)
    expect(design.designVoicePreviews).toHaveBeenCalledWith(expect.objectContaining({ orgId: ORG, userId: USER, description: DESCRIPTION, language: 'ro' }))
  })
  it('gates: cross-site 403, validation 400, plan 403, cap 409, rate 429, full workspace 503', async () => {
    expect((await designRoute(post({ description: DESCRIPTION }, { ...H, origin: 'https://evil.example' }))).status).toBe(403)
    expect((await designRoute(post({ description: 'short' }))).status).toBe(400)
    expect((await designRoute(post({ description: DESCRIPTION, reference_audio_base64: 'AAAA' }))).status).toBe(400)
    state.plan = 'trial'
    const plan = await designRoute(post({ description: DESCRIPTION }))
    expect(plan.status).toBe(403)
    expect(await plan.json()).toMatchObject({ details: { reason: 'plan', required_plan: 'pro' } })
    state.plan = 'pro'
    state.db.tables.provider_voices.push(
      { id: 'c1', provider: 'elevenlabs', voice_id: 'Clone0000000000001', owner_org_id: ORG, source: 'cloned', status: 'ready' },
      { id: 'c2', provider: 'elevenlabs', voice_id: 'Design000000000001', owner_org_id: ORG, source: 'designed', status: 'ready' },
    )
    expect((await designRoute(post({ description: DESCRIPTION }))).status).toBe(409)
    state.db.tables.provider_voices = []
    state.rateDenied.add('voice_design')
    expect((await designRoute(post({ description: DESCRIPTION }))).status).toBe(429)
    state.rateDenied.clear()
    api.getVoiceQuota.mockResolvedValue({ voice_slots_used: 10, voice_limit: 10 })
    const full = await designRoute(post({ description: DESCRIPTION }))
    expect(full.status).toBe(503)
    expect(await full.json()).toMatchObject({ code: 'voice_capacity' })
    expect(design.designVoicePreviews).not.toHaveBeenCalled()
  })
})

describe('POST /api/voices/design/save', () => {
  it('saves through the org-bound preview path; validates the body', async () => {
    design.saveDesignedVoice.mockResolvedValue({ voice: { voiceId: 'NewDesigned000000001', source: 'designed' } })
    const res = await saveRoute(post({ generated_voice_id: 'gen_aaa111', name: 'Front desk' }))
    expect(res.status).toBe(201)
    expect(design.saveDesignedVoice).toHaveBeenCalledWith(expect.objectContaining({ orgId: ORG, userId: USER, generatedVoiceId: 'gen_aaa111', name: 'Front desk' }))
    expect((await saveRoute(post({ generated_voice_id: '../x', name: 'n' }))).status).toBe(400)
    expect((await saveRoute(post({ generated_voice_id: 'gen_aaa111', name: 'n', voice_id: 'Other' }))).status).toBe(400)
    state.plan = 'starter'
    expect((await saveRoute(post({ generated_voice_id: 'gen_aaa111', name: 'n' }))).status).toBe(403)
  })
})

describe('POST /api/voices/clone gates', () => {
  const form = () => {
    const f = new FormData()
    f.append('name', 'Front desk')
    f.append('speaker_name', 'Ana Pop')
    f.append('consent', 'true')
    f.append('rights_attestation', 'true')
    f.append('gender', 'female')
    f.append('remove_background_noise', 'true')
    f.append('files', new File([new Uint8Array([...Buffer.from('RIFF'), 0, 0, 0, 0, ...Buffer.from('WAVE'), ...new Array(2048).fill(0)])], 's.wav', { type: 'audio/wav' }))
    return f
  }
  const cloneReq = () => new Request('http://app.test/api/voices/clone', { method: 'POST', headers: { host: 'app.test', origin: 'http://app.test' }, body: form() })

  it('refuses plans without custom voices and orgs at the cap before any provider call', async () => {
    state.plan = 'starter'
    expect((await cloneRoute(cloneReq())).status).toBe(403)
    state.plan = 'pro'
    state.db.tables.provider_voices.push(
      { id: 'c1', provider: 'elevenlabs', voice_id: 'Clone0000000000001', owner_org_id: ORG, source: 'cloned', status: 'ready' },
      { id: 'c2', provider: 'elevenlabs', voice_id: 'Clone0000000000002', owner_org_id: ORG, source: 'cloned', status: 'ready' },
    )
    expect((await cloneRoute(cloneReq())).status).toBe(409)
    expect(el.voices.addInstantClone).not.toHaveBeenCalled()
  })

  it('503 voice_capacity when the workspace cannot clone; otherwise passes gender and the noise option', async () => {
    api.getVoiceQuota.mockResolvedValueOnce({ can_use_instant_voice_cloning: false })
    const full = await cloneRoute(cloneReq())
    expect(full.status).toBe(503)
    expect(await full.json()).toMatchObject({ code: 'voice_capacity' })
    resetVoiceQuotaCache()
    api.getVoiceQuota.mockResolvedValue({})
    el.voices.addInstantClone.mockResolvedValue({ voice_id: 'NewClone000000000001', requires_verification: false })
    const ok = await cloneRoute(cloneReq())
    expect(ok.status).toBe(201)
    const [params] = el.voices.addInstantClone.mock.calls[0]
    expect(params).toMatchObject({ labels: { language: 'ro', gender: 'female' }, removeBackgroundNoise: true, description: expect.stringMatching(new RegExp(`^Instant clone for org ${ORG} \\[ntv-env:[a-z0-9_-]+\\]$`)) })
    expect(state.db.tables.provider_voices.find((r) => r.voice_id === 'NewClone000000000001')).toMatchObject({ gender: 'female', languages: ['ro'] })
  })
})
